import { NextResponse } from "next/server";

import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { agents as seedAgents, teams as seedTeams } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";

// F-11 (Fahad L6, item 91): the automation action "Notify a teammate", made real from its dry run. The notification
// is one event in the preview's activity log (Retraced, through the one audit wrapper), and the bell shows the log's
// events as notifications (lib/notifications/feed.ts, F-10), so it stays after a reload or a server restart.
// POST { to: "agent" | "team", name, message, flow: { id, name } } -> 201 { sent: true }.
// The agent or team must exist in the preview's lists (Settings > Agents / Teams), as saved or as seeded.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

async function names(): Promise<{ agent: string[]; team: string[] }> {
  const saved = await readPreviewState().catch(() => null);
  const agents = (saved?.lists?.agents as { name?: unknown }[] | undefined) ?? seedAgents;
  const teams = (saved?.lists?.teams as { name?: unknown }[] | undefined) ?? seedTeams;
  return {
    agent: agents.map((a) => String(a.name ?? "")).filter(Boolean),
    team: teams.map((t) => String(t.name ?? "")).filter(Boolean),
  };
}

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail(400, "body is not JSON");
  const to = body.to === "team" || body.to === "agent" ? body.to : null;
  if (!to) return fail(400, "to must be agent or team");
  const name = str(body.name, 120);
  const message = str(body.message, 500);
  if (!message) return fail(400, "Write the notification");
  const known = await names();
  if (!known[to].includes(name)) return fail(404, `There is no ${to} “${name}” in this preview`);
  return NextResponse.json({ sent: true, to, name, message }, { status: 201, headers });
}

function describe(context: AuditContext<unknown>): AuditChange[] {
  if (context.status >= 400) return [];
  const answer = (context.response ?? {}) as { to?: string; name?: string; message?: string };
  const flow = ((context.json as { flow?: { id?: unknown; name?: unknown } } | null)?.flow ?? {}) as {
    id?: unknown;
    name?: unknown;
  };
  const flowName = str(flow.name, 120) || "Untitled flow";
  const flowId = str(flow.id, 120);
  return [
    {
      action: "automation_notify.send",
      crud: "c",
      summary: `sent the notification of the automation flow "${flowName}" to the ${answer.to} "${answer.name}": "${answer.message}" (from its dry run)`,
      target: { id: `${answer.to}:${answer.name}`, name: answer.name ?? "", type: answer.to ?? "agent" },
      after: { to: answer.to, name: answer.name, message: answer.message, flowId, flowName },
    },
  ];
}

// M129-E: logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const POST = withAudit({ area: "automation_notify", describe }, post);
