import { NextResponse } from "next/server";

import { createReadToken, listReadTokens, RetracedError } from "@/lib/audit/retraced";
import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { ownNames } from "@/lib/own-names";

// F-22 (Fahad 15 Oct: "I mean the whole system … I want my own system"): read tokens of the audit log, one per
// customer or team, made and revoked by the audit log server itself (its Enterprise API tokens, lib/audit/retraced.ts).
// GET -> { tokens: [{ id, token, name, kind }] }   id = "enterprise:" + the first 7 characters, as the server names
//        the token when it records a read made with it (EnterpriseController.graphqlPost).
// POST { name, kind: "customer" | "team" } -> 201 { token: { id, token, name, kind } }. Logged as
//        audit_log.token_create, without the token itself.
// Revoke: DELETE ./[id]. Reading with a token: GET /api/audit-log/read (../read/route.ts).
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error: ownNames(error) }, { status, headers });
const failFrom = (error: unknown) =>
  error instanceof RetracedError ? fail(error.status, error.message) : fail(500, (error as Error).message || "error");

type TokenKind = "customer" | "team";
const KIND_LABEL: Record<TokenKind, string> = { customer: "Customer", team: "Team" };

/** The server keeps one display name: "<name> (Customer)" or "<name> (Team)". */
function readTokenView(token: string, displayName: string) {
  const match = /^(.*) \((Customer|Team)\)$/.exec(displayName);
  return {
    id: `enterprise:${token.slice(0, 7)}`,
    token,
    name: match ? match[1] : displayName,
    kind: (match?.[2] === "Team" ? "team" : match ? "customer" : null) as TokenKind | null,
  };
}

export async function GET() {
  try {
    const tokens = (await listReadTokens()).map((t) => readTokenView(t.token, t.display_name));
    return NextResponse.json({ tokens }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function describeCreate(context: AuditContext<undefined>): AuditChange[] {
  const answer = (context.response ?? {}) as { token?: { id: string; name: string; kind: TokenKind } };
  const body = (context.json ?? {}) as { name?: unknown; kind?: unknown };
  const name = answer.token?.name ?? (typeof body.name === "string" ? body.name.trim() : "");
  const kind = answer.token?.kind ?? (body.kind === "team" ? "team" : "customer");
  return [
    {
      action: "audit_log.token_create",
      crud: "c",
      summary: `created a read token for the ${kind} "${name}"`,
      target: { id: answer.token?.id ?? "read-token", name: name || "read token", type: "read_token" },
      after: { name, for: KIND_LABEL[kind], access: "read only, this workspace's activity log" },
    },
  ];
}

export const POST = withAudit<undefined>({ area: "audit_log_token", describe: describeCreate }, async (request) => {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  let body: { name?: unknown; kind?: unknown } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "body is not JSON");
  }
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return fail(400, "Give the token the name of the customer or team");
  if (name.length > 80) return fail(400, "The name is longer than 80 characters");
  if (body?.kind !== "customer" && body?.kind !== "team") return fail(400, "Choose Customer or Team");
  try {
    const made = await createReadToken(`${name} (${KIND_LABEL[body.kind]})`);
    return NextResponse.json({ token: readTokenView(made.token, made.display_name) }, { status: 201, headers });
  } catch (error) {
    return failFrom(error);
  }
});
