import { NextResponse } from "next/server";

import { CLIENT_ACTIONS, describeClientAction } from "@/lib/audit/describe";
import { AUDIT_SECTIONS, auditSummary, searchAuditPage, shapeAuditEvent } from "@/lib/audit/query";
import { flushPendingAuditEvents, pendingAuditCount, RETRACED_URL, RetracedError } from "@/lib/audit/retraced";
import { withAudit } from "@/lib/audit/with-audit";
import { ownNames } from "@/lib/own-names";

// M129-E (Fahad 129.5): the Audit Logs page reads the real log from Retraced through this route (Retraced listens on
// 127.0.0.1 only, so the browser never calls it). Filtering is done by Retraced's own structured search.
// GET ?q=&actor=&action=&from=&to=&page=&size=&sort=newest|oldest -> { events, total, facets, pending }.
// F-18a: also ?section=&crud=c,u,d&failed=1, and the answer carries { summary, sections } (the page's totals and section tabs).
// POST { action, target } -> records one browser-only action (CLIENT_ACTIONS, e.g. contact.block) through withAudit.
// There is no PUT, PATCH or DELETE: the log is append-only, and Retraced has no API to edit or delete an event.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

// F-18a: the query, the event shape and the totals moved to lib/audit/query.ts (the CSV export uses them too).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = Math.min(Math.max(Number.parseInt(params.get("size") ?? "20", 10) || 20, 1), 100);
  const page = Math.max(Number.parseInt(params.get("page") ?? "0", 10) || 0, 0);
  const sortOrder = params.get("sort") === "oldest" ? "asc" : "desc";
  try {
    await flushPendingAuditEvents();
    const [result, summary] = await Promise.all([
      searchAuditPage(params, page * size, size, sortOrder),
      auditSummary(),
    ]);
    return NextResponse.json(
      {
        events: result.events.map(shapeAuditEvent),
        total: result.total,
        all: summary.total,
        page,
        size,
        facets: { actors: summary.actors, actions: summary.actions },
        summary,
        sections: AUDIT_SECTIONS.map(({ key, label }) => ({ key, label, count: summary.sections[key] ?? 0 })),
        pending: await pendingAuditCount(),
        source: { system: "Audit log server", url: RETRACED_URL },
      },
      { headers },
    );
  } catch (error) {
    const status = error instanceof RetracedError ? error.status : 500;
    return NextResponse.json(
      { error: ownNames((error as Error).message), pending: await pendingAuditCount().catch(() => 0) },
      { status, headers },
    );
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

export const POST = withAudit({ area: "client_action", describe: describeClientAction }, async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  let body: { action?: unknown; target?: { id?: unknown; name?: unknown } } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "body is not JSON");
  }
  if (typeof body?.action !== "string" || !(body.action in CLIENT_ACTIONS)) return fail(400, "unknown action");
  const { id, name } = body.target ?? {};
  if ((typeof id !== "string" && typeof id !== "number") || typeof name !== "string" || name.length > 200)
    return fail(400, "target needs an id and a name");
  return NextResponse.json({ accepted: body.action }, { status: 202, headers });
});
