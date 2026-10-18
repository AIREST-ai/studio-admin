import { NextResponse } from "next/server";

import { describeStudioState } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";
import {
  DEFAULT_PREVIEW_STATE_FILE,
  InvalidPreviewState,
  MAX_PREVIEW_STATE_BYTES,
  PreviewConflict,
  readPreviewState,
  writePreviewLists,
  writePreviewSection,
  writePreviewState,
} from "@/lib/cw/persistence/file-store";

// T-68: saved Studio lists for the preview machine (see lib/cw/persistence/file-store.ts). Not production storage.
// T-109: GET also returns the saved sections (folders); PUT ?section=folders with { items, baseRev } saves one section
// and answers 409 with the current revision when another tab or device saved it first.
// F-3: the lists the same way: GET returns `listsRev`, PUT { lists, baseRev } answers 409 (nothing written) when the
// lists were saved elsewhere since, or when no baseRev is sent (a page opened before this check).
// F-6B: each list has its own revision. GET also returns `listRevs`; PUT { lists: <only the changed lists>, baseRevs }
// saves those lists and answers 409 (nothing written) only when one of them was saved elsewhere since, naming it in
// `conflicts` with its saved copy in `lists`. The F-3 form ({ lists: all seven, baseRev }) still works as before.
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

export async function GET() {
  try {
    const state = await readPreviewState(DEFAULT_PREVIEW_STATE_FILE);
    return NextResponse.json(
      {
        lists: state?.lists ?? null,
        listsRev: state?.listsRev ?? 0,
        listRevs: state?.listRevs ?? null,
        savedAt: state?.savedAt ?? null,
        sections: state?.sections ?? {},
      },
      { headers },
    );
  } catch (error) {
    return fail(500, `saved state unreadable: ${(error as Error).message}`);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const text = await request.text();
  if (text.length > MAX_PREVIEW_STATE_BYTES) return fail(413, "preview state too large");
  let body: { lists?: unknown; items?: unknown; baseRev?: unknown; baseRevs?: unknown } | null;
  try {
    body = JSON.parse(text) as { lists?: unknown; items?: unknown; baseRev?: unknown; baseRevs?: unknown } | null;
  } catch {
    return fail(400, "body is not JSON");
  }
  const section = new URL(request.url).searchParams.get("section");
  // F-17: the owner's site sections are saved through /api/owner-console only, which logs each change by name.
  if (section === "siteSections") return fail(400, "siteSections is saved through /api/owner-console");
  try {
    if (section) {
      const saved = await writePreviewSection(DEFAULT_PREVIEW_STATE_FILE, section, body?.items, body?.baseRev);
      return NextResponse.json({ rev: saved.rev, savedAt: saved.savedAt }, { headers });
    }
    if (body?.baseRevs !== undefined) {
      const state = await writePreviewLists(DEFAULT_PREVIEW_STATE_FILE, body.lists, body.baseRevs);
      return NextResponse.json({ rev: state.listsRev, revs: state.listRevs, savedAt: state.savedAt }, { headers });
    }
    const state = await writePreviewState(DEFAULT_PREVIEW_STATE_FILE, body?.lists, body?.baseRev);
    return NextResponse.json({ rev: state.listsRev, revs: state.listRevs, savedAt: state.savedAt }, { headers });
  } catch (error) {
    if (error instanceof PreviewConflict)
      return NextResponse.json({ error: error.message, ...error.current }, { status: 409, headers });
    return fail(error instanceof InvalidPreviewState ? 400 : 500, (error as Error).message);
  }
}

// M129-E: every save goes through the one audit wrapper (lib/audit/with-audit.ts), which logs to Retraced what changed
// in the lists (agents, roles, teams, inboxes, labels, ...) and sections (folders, automation, ...).
export const PUT = withAudit(
  { area: "studio_state", snapshot: () => readPreviewState(DEFAULT_PREVIEW_STATE_FILE), describe: describeStudioState },
  put,
);
