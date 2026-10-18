import { NextResponse } from "next/server";

import { describeSimUpload } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";

import { appendSimItem, InvalidSimItem, readSimState, UPLOAD_DIR } from "../store";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// M129-A: the macro editor's "Upload Attachment" (Send Attachment action) keeps the file on the preview machine's
// disk, like Chatwoot's POST /api/v1/accounts/:id/upload keeps a blob (app/controllers/api/v1/accounts/upload_controller.rb).
// The checks are Chatwoot's own for a message attachment, which is what the macro sends (app/models/attachment.rb, v4.18.0):
// at most MAXIMUM_FILE_UPLOAD_SIZE, 40 MB by default, and only media (image/, video/, audio/) or ACCEPTABLE_FILE_TYPES.
// https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/models/attachment.rb
// POST multipart { file } -> { id, name, size, type }.  GET ?id= -> the saved file as a download.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const MAX_UPLOADS = 100;
const ACCEPTABLE_FILE_TYPES = [
  "text/csv",
  "text/plain",
  "text/rtf",
  "text/xml",
  "application/json",
  "application/pdf",
  "application/xml",
  "application/zip",
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/x-tar",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-pkcs12",
  "application/pkcs12",
];
const ACCEPTABLE_FILE_EXTENSIONS = ["pfx", "xml"];

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

function acceptable(type: string, name: string) {
  if (/^(image|video|audio)\//.test(type) || ACCEPTABLE_FILE_TYPES.includes(type)) return true;
  const generic = !type || type === "application/octet-stream";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return generic && ACCEPTABLE_FILE_EXTENSIONS.includes(extension);
}

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024)
    return fail(413, "File is larger than 40 MB (the engine's attachment limit)");
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail(400, "expected a multipart form with a file");
  }
  if (!file || typeof file === "string") return fail(400, "no file in the form");
  const name = file.name.slice(0, 255) || "attachment";
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "File is larger than 40 MB (the engine's attachment limit)");
  if (!acceptable(file.type, name))
    return fail(415, `File type ${file.type || "unknown"} is not supported by the engine`);
  try {
    const state = await readSimState();
    if (state.data.uploads.length >= MAX_UPLOADS) return fail(507, `the preview keeps at most ${MAX_UPLOADS} uploads`);
    const id = `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, id), Buffer.from(await file.arrayBuffer()));
    const item = { id, name, size: file.size, type: file.type.slice(0, 150), at: new Date().toISOString() };
    await appendSimItem("uploads", item);
    return NextResponse.json(item, { headers });
  } catch (error) {
    return fail(error instanceof InvalidSimItem ? 400 : 500, `upload not saved: ${(error as Error).message}`);
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^up-[a-z0-9-]{4,40}$/.test(id)) return fail(400, "bad id");
  try {
    const state = await readSimState();
    const item = state.data.uploads.find((upload) => upload.id === id);
    if (!item) return fail(404, "no such upload");
    const bytes = await readFile(path.join(UPLOAD_DIR, id));
    const name = String(item.name);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": String(item.type || "application/octet-stream"),
        "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]+/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (error) {
    return fail(500, `upload unreadable: ${(error as Error).message}`);
  }
}

// M129-E: the upload is logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const POST = withAudit({ area: "file_upload", describe: describeSimUpload }, post);
