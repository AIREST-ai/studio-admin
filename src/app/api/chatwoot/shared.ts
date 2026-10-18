// L-2 (plan r1-chatwoot-link/خطة.md 2.2, 5 risk 3): the one gate of the /api/chatwoot/* routes.
// - Preview mode (or a section that is not linked): 409, and the test copy is not called.
// - Linked: the route reads through src/lib/chatwoot/server.ts; a failure answers with its problem
//   ("not linked: no token", "refused: not the test copy", "unreachable", ...), never with preview data.
// - Phase 1 was read-only. L-3 (phase 2) opens the conversation writes (reply, status, assignment, labels) through
//   writeGate; every other write method still answers 409 "Read-only link (phase 1)" (or "preview mode").
import { NextResponse } from "next/server";

import { readLinkState, sectionLinked } from "@/lib/chatwoot/mode";
import { ChatwootError, problemOf } from "@/lib/chatwoot/server";
import { type LinkErrorBody, type LinkSection, READ_ONLY_TEXT } from "@/lib/chatwoot-link-types";

export const headers = { "Cache-Control": "no-store" };

export const fail = (status: number, body: LinkErrorBody) => NextResponse.json(body, { status, headers });

export function failFrom(error: unknown) {
  const problem = problemOf(error);
  const status = error instanceof ChatwootError ? error.status : 500;
  return fail(status, { error: problem.message, problem });
}

/** null when the section is linked; else the 409 answer (nothing is called). */
export async function gate(section: LinkSection) {
  const state = await readLinkState();
  if (state.mode !== "linked" || state.disabled) return fail(409, { error: "preview mode" });
  if (!sectionLinked(state, section)) return fail(409, { error: `${section}: section not linked` });
  return null;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export const positiveId = (value: string) => (/^\d{1,10}$/.test(value) && Number(value) > 0 ? Number(value) : null);

/** POST/PUT/PATCH/DELETE of a route phase 2 does not open (contacts, conversation delete, ...): nothing is written. */
export async function readOnly() {
  const state = await readLinkState();
  if (state.mode !== "linked" || state.disabled) return fail(409, { error: "preview mode" });
  return fail(409, { error: READ_ONLY_TEXT });
}

/**
 * L-3 (phase 2): the gate of a write. Another site posting here: 403. Preview mode or the section not linked: 409, as
 * the reads, and the test copy is not called (so preview mode writes nothing anywhere).
 */
export async function writeGate(request: Request, section: LinkSection) {
  if (!sameOrigin(request)) return fail(403, { error: "refused: not from this site" });
  return gate(section);
}

/** The JSON object of a write, or null (too big, not JSON, not an object). */
export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text().catch(() => "");
  if (!text || text.length > 20_000) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
