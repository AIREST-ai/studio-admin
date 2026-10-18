import { NextResponse } from "next/server";

import { describePreviewSim } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";

import { appendSimItem, InvalidSimItem, isSimKey, readSimState, removeSimItem, SimConflict, UPLOAD_DIR } from "./store";
import { unlink } from "node:fs/promises";
import path from "node:path";

// M129-A: the simulated buttons' record (see ./store.ts). Not Chatwoot, not production storage.
// GET -> { data, savedAt }.  POST { key, item } -> appends one item.  DELETE ?key=&id= -> removes one item.
// F-5A: a status change (or a block from a conversation) based on an older record than the newest one for that
// conversation (contact) -> 409 { error, current } and nothing is written (see ./store.ts, "statuses").
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 40_000;

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

export async function GET() {
  try {
    const state = await readSimState();
    return NextResponse.json({ data: state.data, savedAt: state.savedAt }, { headers });
  } catch (error) {
    return fail(500, `saved simulation unreadable: ${(error as Error).message}`);
  }
}

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return fail(413, "request too large");
  let parsed: { key?: unknown; item?: unknown } | null;
  try {
    parsed = JSON.parse(body) as { key?: unknown; item?: unknown } | null;
  } catch {
    return fail(400, "body is not JSON");
  }
  if (!isSimKey(parsed?.key)) return fail(400, "unknown key");
  try {
    const state = await appendSimItem(parsed.key, parsed?.item);
    // F-8: the kept files of a deleted reply or note go with it (Chatwoot destroys a deleted message's attachments).
    for (const id of state.removedUploads)
      if (/^up-[a-z0-9-]+$/.test(id)) await unlink(path.join(UPLOAD_DIR, id)).catch(() => undefined);
    return NextResponse.json({ savedAt: state.savedAt }, { headers });
  } catch (error) {
    if (error instanceof SimConflict)
      return NextResponse.json({ error: error.message, current: error.current }, { status: 409, headers });
    return fail(error instanceof InvalidSimItem ? 400 : 500, (error as Error).message);
  }
}

async function remove(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const id = url.searchParams.get("id");
  if (!isSimKey(key) || !id) return fail(400, "key and id are required");
  try {
    const removed = await removeSimItem(key, id);
    if (!removed) return fail(404, "no such item");
    // An uploaded file's bytes go with its record.
    if (key === "uploads" && /^up-[a-z0-9-]+$/.test(id)) await unlink(path.join(UPLOAD_DIR, id)).catch(() => undefined);
    return NextResponse.json({ removed: id }, { headers });
  } catch (error) {
    return fail(500, (error as Error).message);
  }
}

// M129-E: both writes go through the one audit wrapper (lib/audit/with-audit.ts): contact add/delete/merge, calls,
// Linear issues, Copilot messages, new conversations and removals are logged to Retraced.
const audit = { area: "preview_sim", snapshot: () => readSimState(), describe: describePreviewSim };
export const POST = withAudit(audit, post);
export const DELETE = withAudit(audit, remove);
