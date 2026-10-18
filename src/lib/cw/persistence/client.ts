// T-68 browser side of the preview persistence: talks to /api/studio-preview-state. Every failure throws with the
// server's reason so the caller can show "not saved" instead of pretending it worked.
const ENDPOINT = "/api/studio-preview-state";

// U-2 (task u2-cw-store-adapter-chat-contacts, condition 4): while the page shows the linked Chatwoot server
// (src/lib/chatwoot/store-adapter.ts sets this), nothing of the preview's saved state is written: every preview save
// (the lists and sections here, the simulation record in ../preview-sim.ts, the panel edits in
// dashboard/chat/_components/sim-panel-persist.ts) refuses, and the stores do not replay the preview's saved state over
// the linked data. A leaf module (no imports), so every store can read it without an import cycle.
let linked = false;
/** True while the page shows the linked Chatwoot server: no preview state is read into the stores or written. */
export const linkedSession = (): boolean => linked;
/** Set by the store adapter only (src/lib/chatwoot/store-adapter.ts). */
export function setLinkedSession(on: boolean): void {
  linked = on;
}
/** The error every preview save throws in linked mode. */
export const LINKED_NO_PREVIEW_WRITE = "linked mode: the preview's saved state is not written while Chatwoot is linked";
function refuseWhenLinked() {
  if (linked) throw new Error(LINKED_NO_PREVIEW_WRITE);
}

async function reason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return `${response.status} ${body?.error ?? response.statusText}`;
}

/**
 * `lists` is `null` when nothing was saved yet. F-6B: `revs` is each list's revision this page now holds (lists
 * missing from `revs` read 0).
 */
export async function loadPreviewLists<T>(): Promise<{
  lists: T | null;
  savedAt: string | null;
  revs: Record<string, number>;
}> {
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(`load failed: ${await reason(response)}`);
  const body = (await response.json()) as {
    lists: T | null;
    savedAt: string | null;
    listRevs?: Record<string, number> | null;
  };
  return { lists: body.lists, savedAt: body.savedAt, revs: body.listRevs ?? {} };
}

/**
 * F-6B: saves only the lists in `lists`, each over its own revision in `baseRevs`; resolves with every list's new
 * revision and the server's save time. Throws ListsConflict on 409 (one of these lists was saved elsewhere since:
 * nothing was written). `keepalive` lets the request finish while the page unloads.
 */
export async function savePreviewLists(
  lists: Record<string, unknown>,
  baseRevs: Record<string, number>,
  keepalive = false,
): Promise<{ revs?: Record<string, number>; savedAt: string }> {
  refuseWhenLinked();
  const response = await fetch(ENDPOINT, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lists, baseRevs }),
    keepalive,
  }).catch((error: Error) => {
    throw new Error(`the preview server could not be reached (${error.message})`);
  });
  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      rev?: number;
      revs?: Record<string, number>;
      conflicts?: string[];
      lists?: Record<string, unknown[] | null>;
    } | null;
    throw new ListsConflict(
      `save refused: ${body?.error ?? "conflict"}`,
      body?.conflicts ?? Object.keys(lists),
      body?.revs ?? {},
      body?.lists ?? {},
    );
  }
  if (!response.ok) throw new Error(`save failed: ${await reason(response)}`);
  return (await response.json()) as { revs?: Record<string, number>; savedAt: string };
}

// T-109: one named section of the saved state (see file-store.ts PREVIEW_SECTIONS), saved on its own with a revision.
export interface SavedSection<T> {
  rev: number;
  savedAt: string | null;
  items: T[] | null;
}

/** The other tab or device's save won; `rev` is the revision now on disk. */
export class SectionConflict extends Error {
  constructor(
    message: string,
    readonly rev: number,
  ) {
    super(message);
  }
}

/**
 * F-6B: the lists named in `conflicts` were saved by another tab or device after this page loaded them; `saved` holds
 * their copy on the server and `revs` every list's revision on the server.
 */
export class ListsConflict extends SectionConflict {
  constructor(
    message: string,
    readonly conflicts: string[],
    readonly revs: Record<string, number>,
    readonly saved: Record<string, unknown[] | null>,
  ) {
    super(message, 0);
  }
}

/** `items` is `null` (revision 0) when the section was never saved, e.g. in a file written before it existed. */
export async function loadPreviewSection<T>(name: string): Promise<SavedSection<T>> {
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(`load failed: ${await reason(response)}`);
  const body = (await response.json()) as { sections?: Record<string, { rev: number; savedAt: string; items: T[] }> };
  const section = body.sections?.[name];
  return section
    ? { rev: section.rev, savedAt: section.savedAt, items: section.items }
    : { rev: 0, savedAt: null, items: null };
}

/** Saves `items` over revision `baseRev`; resolves with the new revision, throws SectionConflict on 409. */
export async function savePreviewSection(
  name: string,
  items: unknown[],
  baseRev: number,
  keepalive = false,
): Promise<{ rev: number; savedAt: string }> {
  refuseWhenLinked();
  const response = await fetch(`${ENDPOINT}?section=${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, baseRev }),
    keepalive,
  });
  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as { error?: string; rev?: number } | null;
    throw new SectionConflict(`save refused: ${body?.error ?? "conflict"}`, body?.rev ?? baseRev);
  }
  if (!response.ok) throw new Error(`save failed: ${await reason(response)}`);
  return (await response.json()) as { rev: number; savedAt: string };
}
