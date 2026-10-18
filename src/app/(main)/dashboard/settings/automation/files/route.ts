import { NextResponse } from "next/server";

import { describeAutomationFiles } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// M129-B (item 129.1): the files a "Send Attachment" step sends, uploaded to this preview and kept on its disk
// (.preview-state/automation-files/, one file plus one .json beside it), so a flow saved with an attachment still has
// it after a reload. Preview only: nothing is sent to Chatwoot or to a customer from here.
// POST (raw body; x-file-name, content-type) -> { id, name, mime, size }.  GET ?id= -> the file.
// F-2: DELETE ?id= removes the file and its .json from the disk (the editor's "Remove" on an attachment), unless a
// saved flow or rule still keeps it (409, nothing deleted) or the saved flows cannot be read (500, nothing deleted).
// F-3: POST with x-restore-id puts a removed file back under its own id (Undo after Remove or Replace in the editor,
// media-upload.ts), so the step that Undo brings back points to a file the preview has again. An id the preview still
// has is answered as it is (nothing is written over it).
// The cap is Chatwoot's own MAXIMUM_FILE_UPLOAD_SIZE, 40 MB (chatwoot/config/installation_config.yml): Chatwoot
// refuses anything larger whatever the channel, so the preview refuses it too, with that reason.
export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), ".preview-state", "automation-files");
// The preview's save (src/lib/cw/persistence/file-store.ts): its "automation" section holds every saved rule and flow.
const STATE_FILE = path.join(process.cwd(), ".preview-state", "studio-preview-state.json");
const MAX_BYTES = 40 * 1024 * 1024;
const ID = /^af-[a-z0-9]{8,40}$/;
const headers = { "Cache-Control": "no-store" };

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

interface Meta {
  id: string;
  name: string;
  mime: string;
  size: number;
  savedAt: string;
}

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin upload refused");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES)
    return fail(
      413,
      "The engine accepts files up to 40 MB (MAXIMUM_FILE_UPLOAD_SIZE), so the preview does not keep larger ones",
    );
  let name = "file";
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") ?? "file");
  } catch {
    return fail(400, "x-file-name is not valid");
  }
  // no path separators or control characters in the kept name
  name =
    [...name]
      .map((ch) => (ch === "/" || ch === "\\" || ch.charCodeAt(0) < 32 ? "_" : ch))
      .join("")
      .slice(0, 200) || "file";
  const mime = (request.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim().slice(0, 120);
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length) return fail(400, "the file is empty");
  if (body.length > MAX_BYTES)
    return fail(
      413,
      "The engine accepts files up to 40 MB (MAXIMUM_FILE_UPLOAD_SIZE), so the preview does not keep larger ones",
    );
  const restoreId = request.headers.get("x-restore-id");
  if (restoreId !== null && !ID.test(restoreId)) return fail(400, "bad file id to restore");
  if (restoreId) {
    try {
      const kept = JSON.parse(await readFile(path.join(DIR, `${restoreId}.json`), "utf8")) as Meta;
      return NextResponse.json({ id: kept.id, name: kept.name, mime: kept.mime, size: kept.size }, { headers });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        return fail(500, `unreadable: ${(error as Error).message}`);
    }
  }
  const id = restoreId ?? `af-${Date.now().toString(36)}${randomBytes(5).toString("hex")}`;
  const meta: Meta = { id, name, mime, size: body.length, savedAt: new Date().toISOString() };
  try {
    await mkdir(DIR, { recursive: true });
    const temp = path.join(DIR, `${id}.${process.pid}.tmp`);
    await writeFile(temp, body);
    await rename(temp, path.join(DIR, id));
    await writeFile(path.join(DIR, `${id}.json`), JSON.stringify(meta));
  } catch (error) {
    return fail(500, `not saved: ${(error as Error).message}`);
  }
  return NextResponse.json({ id, name, mime, size: body.length }, { status: 201, headers });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return fail(400, "bad file id");
  try {
    const meta = JSON.parse(await readFile(path.join(DIR, `${id}.json`), "utf8")) as Meta;
    const data = await readFile(path.join(DIR, id));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        ...headers,
        "Content-Type": meta.mime || "application/octet-stream",
        "Content-Length": String(data.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fail(404, "this file is not in the preview");
    return fail(500, `unreadable: ${(error as Error).message}`);
  }
}

// F-2: HEAD ?id= says whether the preview still has the file (the editor asks before it shows a step's attachment).
export async function HEAD(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return new NextResponse(null, { status: 400, headers });
  try {
    await readFile(path.join(DIR, `${id}.json`));
    return new NextResponse(null, { status: 200, headers });
  } catch (error) {
    return new NextResponse(null, { status: (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500, headers });
  }
}

/** Names of the saved rules and flows whose text mentions this file id (an attachment keeps its id in the step). */
async function savedUsersOf(id: string): Promise<string[]> {
  let raw: string;
  try {
    raw = await readFile(STATE_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const items = ((JSON.parse(raw) as { sections?: { automation?: { items?: unknown[] } } }).sections?.automation
    ?.items ?? []) as { kind?: string; rule?: { name?: string }; flow?: { name?: string } }[];
  return items
    .filter((item) => JSON.stringify(item).includes(id))
    .map((item) => (item.kind === "flow" ? item.flow?.name : item.rule?.name) ?? "(unnamed)");
}

async function remove(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin delete refused");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return fail(400, "bad file id");
  try {
    const usedBy = await savedUsersOf(id);
    if (usedBy.length)
      return NextResponse.json(
        { error: `a saved automation still uses this file: ${usedBy.join(", ")}`, usedBy },
        { status: 409, headers },
      );
  } catch (error) {
    return fail(500, `saved automations unreadable, so nothing was deleted: ${(error as Error).message}`);
  }
  try {
    await readFile(path.join(DIR, `${id}.json`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fail(404, "this file is not in the preview");
    return fail(500, `unreadable: ${(error as Error).message}`);
  }
  try {
    await unlink(path.join(DIR, id)).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
    await unlink(path.join(DIR, `${id}.json`));
  } catch (error) {
    return fail(500, `not deleted: ${(error as Error).message}`);
  }
  return NextResponse.json({ removed: id }, { headers });
}

// M129-E: uploads and removals are logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts). For a
// removal the file's saved name is read first, so the log names the file, not only its id.
async function savedMeta(request: Request): Promise<Meta | null> {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (request.method !== "DELETE" || !ID.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(DIR, `${id}.json`), "utf8")) as Meta;
  } catch {
    return null;
  }
}
const audit = { area: "automation_file", snapshot: savedMeta, describe: describeAutomationFiles };
export const POST = withAudit(audit, post);
export const DELETE = withAudit(audit, remove);
