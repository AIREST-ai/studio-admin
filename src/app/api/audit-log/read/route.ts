import { NextResponse } from "next/server";

import { buildAuditQuery, shapeAuditEvent } from "@/lib/audit/query";
import { RetracedError, searchWithReadToken } from "@/lib/audit/retraced";
import { ownNames } from "@/lib/own-names";

// F-22: what a read token does. A customer or team reads this workspace's activity log with it, from their own tools:
//   GET /api/audit-log/read?q=&section=&action=&actor=&crud=&from=&to=&page=&size=&sort=newest|oldest
//   Authorization: Bearer <token>
// -> { total, page, size, events } (events as the Audit Logs page shows them). Read-only: GET only.
// The search runs on the audit log server WITH the token (its Enterprise API, lib/audit/retraced.ts
// searchWithReadToken), not with the preview's own key, so a revoked or wrong token is refused there (401). The
// server records every read made with a token itself (action audit_log.token_read, actor = the token's name).
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+([0-9a-f]{16,64})$/i.exec(auth.trim())?.[1];
  if (!token)
    return NextResponse.json(
      { error: "Send the read token in the header: Authorization: Bearer <token>" },
      { status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } },
    );
  const params = new URL(request.url).searchParams;
  const size = Math.min(Math.max(Number.parseInt(params.get("size") ?? "20", 10) || 20, 1), 100);
  const page = Math.max(Number.parseInt(params.get("page") ?? "0", 10) || 0, 0);
  try {
    const result = await searchWithReadToken(token, {
      query: buildAuditQuery(params),
      pageOffset: page * size,
      pageLimit: size,
      sortOrder: params.get("sort") === "oldest" ? "asc" : "desc",
    });
    return NextResponse.json(
      { total: result.total, page, size, events: result.events.map(shapeAuditEvent) },
      { headers },
    );
  } catch (error) {
    const status = error instanceof RetracedError ? error.status : 500;
    return NextResponse.json(
      { error: ownNames((error as Error).message) },
      { status, headers: status === 401 ? { ...headers, "WWW-Authenticate": "Bearer" } : headers },
    );
  }
}
