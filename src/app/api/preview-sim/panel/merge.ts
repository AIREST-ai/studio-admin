// F-3 item 13: how a tab's changes are checked and merged into the saved panel edits (see ./route.ts). Kept apart from
// the route so it can be checked on its own.
// F-8 (sim3 8.18: browser B added "support" to conversation 2, then the stale browser A added "lead" and "support" was
// gone): a conversation's labels are no longer sent as the whole list, which put back the list the stale tab held.
// A tab sends what it added and removed ({ add, remove }) and the server applies that to the saved list, so the labels
// of both browsers are kept and a label one browser removed is not put back by the other. A whole list (a page loaded
// before this change) is refused with 409 and nothing is written (StaleChanges).
// Chatwoot itself keeps a conversation's labels as one list (Labelable#update_labels, add_labels:
// https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/models/concerns/labelable.rb) and its other tabs see a change
// at once through ActionCable; this preview has no live channel between tabs, so the server merges instead.
export const SLICES = ["conversationAttrs", "contactAttrs", "contactEdits", "notes", "meta", "labels"] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export type Slice = (typeof SLICES)[number];
export type PanelState = Record<Slice, Record<string, unknown>>;
const FIELD_SLICES: Slice[] = ["meta", "contactEdits", "conversationAttrs", "contactAttrs"];
const LIST_SLICES: Slice[] = ["notes"];

/** F-8: what a tab did to one conversation's labels since it loaded or last saved. */
export interface LabelOps {
  add: string[];
  remove: string[];
}

/** F-8: changes from a page that still sends whole label lists (loaded before the label merge): answered with 409. */
export class StaleChanges extends Error {}

const isLabelList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 200 && value.every((item) => typeof item === "string" && item.length <= 200);

/** Throws with a readable reason unless `changes` has the shape described at the top of this file. */
export function checkChanges(changes: unknown): Partial<PanelState> {
  if (!isObject(changes)) throw new Error("changes must be an object");
  const extra = Object.keys(changes).filter((key) => !(SLICES as readonly string[]).includes(key));
  if (extra.length) throw new Error(`unknown parts: ${extra.join(", ")}`);
  for (const [slice, entries] of Object.entries(changes)) {
    if (!isObject(entries)) throw new Error(`${slice} must be an object`);
    for (const [id, value] of Object.entries(entries)) {
      if (FIELD_SLICES.includes(slice as Slice) && !isObject(value))
        throw new Error(`${slice}.${id} must be an object`);
      if (LIST_SLICES.includes(slice as Slice) && value !== null && !Array.isArray(value))
        throw new Error(`${slice}.${id} must be a list or null`);
      if (slice === "labels") {
        if (value === null || Array.isArray(value))
          throw new StaleChanges(
            "this page was opened before label changes were merged, so it may hold an old list of labels; reload it",
          );
        if (!isObject(value) || !isLabelList(value.add) || !isLabelList(value.remove))
          throw new Error(`labels.${id} must be { add: [...], remove: [...] }`);
      }
    }
  }
  return changes as Partial<PanelState>;
}

/** F-8: the saved labels of one conversation with a tab's additions and removals applied (order kept). */
export function applyLabelOps(saved: unknown, ops: LabelOps): string[] {
  const current = isLabelList(saved) ? saved : [];
  const kept = current.filter((label) => !ops.remove.includes(label));
  return [...kept, ...ops.add.filter((label) => !kept.includes(label) && !ops.remove.includes(label))];
}

/** The saved copy with `changes` merged in (see the top of this file). */
export function merge(saved: Partial<PanelState> | null, changes: Partial<PanelState>): PanelState {
  const next = Object.fromEntries(SLICES.map((slice) => [slice, { ...(saved?.[slice] ?? {}) }])) as PanelState;
  for (const slice of SLICES) {
    for (const [id, value] of Object.entries(changes[slice] ?? {})) {
      if (slice === "labels") {
        const labels = applyLabelOps(next.labels[id], value as LabelOps);
        if (labels.length) next.labels[id] = labels;
        else delete next.labels[id];
      } else if (LIST_SLICES.includes(slice)) {
        if (value === null) delete next[slice][id];
        else next[slice][id] = value;
      } else {
        next[slice][id] = { ...(isObject(next[slice][id]) ? next[slice][id] : {}), ...(value as object) };
      }
    }
  }
  return next;
}
