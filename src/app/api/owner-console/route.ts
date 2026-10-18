import { NextResponse } from "next/server";

import { type AuditChange, type AuditContext, currentActor, withAudit } from "@/lib/audit/with-audit";
import { InvalidPreviewState, PreviewConflict } from "@/lib/cw/persistence/file-store";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";
import { isShown, type SiteSectionsState, sectionById } from "@/lib/owner/site-sections";
import { readSiteSections, saveSiteSection } from "@/lib/owner/site-sections-server";

// F-17 (T-91): the Owner console's sections (src/lib/owner/site-sections.ts), saved in the preview state with a
// revision. GET -> { rev, savedAt, overrides }. PUT { id, shown, baseRev } sets one section shown or hidden for the
// whole site; 409 (nothing written) when another tab or device saved since `baseRev`. Every change and every refused
// save is written to the activity log (Retraced) through the one audit wrapper, so it shows in Settings > Audit Logs
// and under "Changes" in the bell (lib/notifications/feed.ts, "site_section").
// The preview has no sign-in: anyone who opens the preview can use this, as the console says. A browser set to
// "View as" another agent is refused (403), as the console itself is not offered to them.
export const dynamic = "force-dynamic";

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

function viewAsOf(request: Request): number | null {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === VIEW_AS_COOKIE)?.[1];
  return parseViewAs(value ?? null);
}

export async function GET() {
  try {
    return NextResponse.json(await readSiteSections(), { headers });
  } catch (error) {
    return fail(500, `saved state unreadable: ${(error as Error).message}`);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  if (viewAsOf(request) !== null)
    return fail(403, "viewing as another agent: the Owner console is for the site owner only");
  let body: { id?: unknown; shown?: unknown; baseRev?: unknown } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "body is not JSON");
  }
  const id = typeof body?.id === "string" ? body.id : "";
  if (!sectionById(id)) return fail(400, id ? `unknown section: ${id}` : "no section named");
  if (typeof body?.shown !== "boolean") return fail(400, "shown must be true or false");
  if (!Number.isInteger(body?.baseRev) || (body?.baseRev as number) < 0)
    return fail(400, "baseRev must be a whole number");
  try {
    const actor = await currentActor();
    const saved = await saveSiteSection(id, body.shown, body.baseRev as number, actor.name);
    return NextResponse.json(saved, { headers });
  } catch (error) {
    if (error instanceof PreviewConflict)
      return NextResponse.json({ error: error.message, ...error.current }, { status: 409, headers });
    return fail(error instanceof InvalidPreviewState ? 400 : 500, (error as Error).message);
  }
}

/** One row per request: the section shown or hidden, with the revision it was saved at. */
function describe(context: AuditContext<SiteSectionsState>): AuditChange[] {
  const body = (context.json ?? {}) as { id?: unknown; shown?: unknown };
  const section = typeof body.id === "string" ? sectionById(body.id) : undefined;
  if (!section || typeof body.shown !== "boolean") return [];
  const shown = body.shown;
  const was = context.before ? isShown(context.before, section.id) : undefined;
  if (context.status < 400 && was === shown) return []; // nothing changed
  const rev = (context.response as { rev?: unknown } | null)?.rev;
  const where = "for the whole site";
  return [
    {
      action: shown ? "site_section.enable" : "site_section.disable",
      crud: "u",
      summary: shown
        ? `showed the section "${section.title}" ${where}${typeof rev === "number" ? ` (revision ${rev})` : ""}`
        : `hid the section "${section.title}" ${where}${typeof rev === "number" ? ` (revision ${rev})` : ""}`,
      target: { id: section.id, name: section.title, type: "site_section" },
      before: { shown: was },
      after: { shown, ...(typeof rev === "number" ? { rev } : {}) },
    },
  ];
}

export const PUT = withAudit<SiteSectionsState>(
  { area: "site_section", snapshot: () => readSiteSections(), describe },
  put,
);
