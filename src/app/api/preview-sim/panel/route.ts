import { NextResponse } from "next/server";

import { describeSimPanel } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";

import { checkChanges, merge, type PanelState, StaleChanges } from "./merge";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// M129-A round 2 (Fahad 124.8 and 129.2; judge: the Arabic "preview only, lost on refresh" line): the conversation
// panel's edits (attributes, contact details, notes, priority, assignee, team, participants, labels) are kept as one
// saved copy on the preview machine's disk, so they survive a reload. Preview only: nothing reaches Chatwoot.
// GET -> { state, savedAt }.  DELETE -> forgets it (used by the checks to restore).
// F-3 item 13 (the sim1 user test: a tab left open put back a priority another browser had changed): a tab no longer
// sends its whole copy. PUT { changes } carries only what this tab changed since it last loaded or saved, and the
// server merges it into the saved copy, so two browsers' edits are both kept:
//   meta, contactEdits: { [id]: { field: value } }      the fields this tab changed
//   conversationAttrs, contactAttrs: { [id]: { key: value | null } }   null = the attribute was removed
//   notes: { [id]: list | null }                        the whole list of that contact; null = none
//   labels: { [id]: { add: [...], remove: [...] } }     F-8: what this tab added to and removed from that conversation's
//                                                       labels (./merge.ts); a whole list is refused with 409
// The answer is the merged copy. A page loaded before this change still sends PUT { state } (its whole, possibly old,
// copy): it is refused with 409 and nothing is written, and the page says it was not saved.
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), ".preview-state", "preview-sim-panel.json");
const MAX_BYTES = 500_000;
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

export async function GET() {
  try {
    const saved = JSON.parse(await readFile(FILE, "utf8")) as { state: unknown; savedAt: string };
    return NextResponse.json(saved, { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return NextResponse.json({ state: null, savedAt: null }, { headers });
    return fail(500, `saved panel edits unreadable: ${(error as Error).message}`);
  }
}

let writing: Promise<unknown> = Promise.resolve();

async function readSaved(): Promise<Partial<PanelState> | null> {
  try {
    return (JSON.parse(await readFile(FILE, "utf8")) as { state: Partial<PanelState> | null }).state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const text = await request.text();
  if (text.length > MAX_BYTES) return fail(413, "panel edits too large");
  let body: { state?: unknown; changes?: unknown } | null;
  try {
    body = JSON.parse(text) as { state?: unknown; changes?: unknown } | null;
  } catch {
    return fail(400, "body is not JSON");
  }
  if (body?.changes === undefined)
    return NextResponse.json(
      { error: "this page was opened before panel edits were merged, so it may hold an old copy; reload it" },
      { status: 409, headers },
    );
  let changes: Partial<PanelState>;
  try {
    changes = checkChanges(body.changes);
  } catch (error) {
    // F-8: a whole label list (a page loaded before labels were merged) could put back an old list: 409, nothing written.
    return fail(error instanceof StaleChanges ? 409 : 400, (error as Error).message);
  }
  const savedAt = new Date().toISOString();
  const run = writing.then(async () => {
    const state = merge(await readSaved(), changes);
    await mkdir(path.dirname(FILE), { recursive: true });
    const temp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify({ state, savedAt }));
    await rename(temp, FILE);
    return state;
  });
  writing = run.catch(() => undefined);
  try {
    const state = await run;
    return NextResponse.json({ savedAt, state }, { headers });
  } catch (error) {
    return fail(500, `panel edits not saved: ${(error as Error).message}`);
  }
}

async function remove(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  await unlink(FILE).catch(() => undefined);
  return NextResponse.json({ removed: true }, { headers });
}

// M129-E: panel edits are logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts); the saved copy
// read before the change is what each edit is compared with.
async function savedPanel(): Promise<{ state?: Record<string, unknown> } | null> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as { state?: Record<string, unknown> };
  } catch {
    return null;
  }
}
const audit = { area: "conversation_panel", snapshot: savedPanel, describe: describeSimPanel };
export const PUT = withAudit(audit, put);
export const DELETE = withAudit(audit, remove);
