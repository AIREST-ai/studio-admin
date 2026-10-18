import { NextResponse } from "next/server";

import { type AuditChange, withAudit } from "@/lib/audit/with-audit";
import { linkDisabled, readLinkState, writeLinkState } from "@/lib/chatwoot/mode";
import { syncStudioWebhook } from "@/lib/chatwoot/server";
import { type LinkSection, type LinkState, PHASE1_SECTIONS } from "@/lib/chatwoot-link-types";

import { fail, headers, sameOrigin } from "../shared";

// L-2 + V-1: POST /api/chatwoot/mode switches "Preview" / "Linked", which sections are linked, and safely
// synchronizes Studio's own webhook (`syncStudioWebhook`) without touching any other webhook.
export const dynamic = "force-dynamic";

interface ModeBody {
  mode?: unknown;
  sections?: unknown;
  confirm?: unknown;
  removeWebhook?: unknown;
}

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, { error: "cross-origin write refused" });
  if (linkDisabled()) return fail(423, { error: "the link is turned off on this server" });
  let body: ModeBody | null;
  try {
    body = (await request.json()) as ModeBody | null;
  } catch {
    return fail(400, { error: "body is not JSON" });
  }
  if (body?.confirm !== true) return fail(400, { error: "the switch needs confirm: true" });
  if (body.mode !== "preview" && body.mode !== "linked")
    return fail(400, { error: 'mode must be "preview" or "linked"' });
  const asked = (body.sections && typeof body.sections === "object" ? body.sections : {}) as Record<string, unknown>;
  const sections: Partial<Record<LinkSection, boolean>> = {};
  for (const section of PHASE1_SECTIONS) sections[section] = asked[section] === true;
  if (body.mode === "linked" && !PHASE1_SECTIONS.some((section) => sections[section]))
    return fail(400, { error: "pick at least one section to link" });
  try {
    const state = await writeLinkState(body.mode, sections);
    const webhookSync = await syncStudioWebhook(body.mode, {
      removeOnPreview: body.removeWebhook === true,
    });
    return NextResponse.json({ state, webhookSync }, { headers });
  } catch (error) {
    return fail(500, { error: `not saved: ${(error as Error).message}` });
  }
}

const on = (state: LinkState | null | undefined) =>
  state?.mode === "linked" ? PHASE1_SECTIONS.filter((section) => state.sections[section]) : [];

function describe(context: { before: LinkState | undefined; response: unknown }): AuditChange[] {
  const after = (context.response as { state?: LinkState } | null)?.state;
  if (!after) return [];
  const before = context.before;
  const was = on(before);
  const now = on(after);
  if (before?.mode === after.mode && was.join() === now.join()) return [];
  return [
    {
      action: "chatwoot_link.mode_change",
      crud: "u",
      summary:
        after.mode === "linked"
          ? `linked ${now.join(" and ")} to the live engine`
          : "switched the live engine link off (preview data again)",
      target: { id: "chatwoot-link", name: "Live Engine", type: "integration" },
      before: { mode: before?.mode ?? "preview", sections: was },
      after: { mode: after.mode, sections: now },
    },
  ];
}

export const POST = withAudit<LinkState>({ area: "chatwoot_link", snapshot: () => readLinkState(), describe }, post);
