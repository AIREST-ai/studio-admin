"use client";

// T-96/T-101 «مسار العميل» (Fahad's decision 21:21): the stages a customer moves through, in his order, each marked
// by a colour dot. The stage belongs to the contact, as respond.io's Lifecycle does, so every conversation of the same
// contact shows it. Nothing is assigned by default: a stage is set only from a conversation.
// T-141: the added stages and the assignments are saved in the shared preview save (lib/cw/persistence, section
// "customerPath", file-store.ts validateCustomerPath), so a stage set in one browser shows in every other one after a
// load. A save based on an older revision (409) is not dropped: the saved copy is read again and the change is applied
// on top of it, then saved. What this browser kept before T-141 (localStorage "t96-customer-path") is added once to
// the shared save and left in place untouched.
// T-161: each local item is imported at most once. A receipt in localStorage lists the items the server accepted or
// already had, and the contacts saved there on another stage (a conflict: the saved stage stays, the local one is kept
// here and reported). An item on the receipt is never imported again, so a stage or contact cleared in another browser
// after the import stays cleared even while the copy is not marked as fully imported.
// F-9 (sim3 step 9.1b: only an added stage had a menu, and it held Delete only): every stage, the six starting ones
// too, can be renamed, recoloured and moved, as respond.io Lifecycle stages are renamed and rearranged "by dragging and
// dropping them to your desired position using the button on the left"
// (https://respond.io/help/workspace-settings/workspace-settings-lifecycle). Saved in the same section: an edited
// starting stage is `{ kind: "edit", id, name, color }` (the six stay in code), and the order of all stages is one
// `{ kind: "order", ids }`. A stage missing from the order (added later) goes after the ordered ones.
import { useEffect } from "react";

import { toast } from "sonner";
import { create } from "zustand";

import { contactIdOf } from "@/app/(main)/chat/_components/data";
import { loadPreviewSection, SectionConflict, savePreviewSection } from "@/lib/cw/persistence/client";

export interface PathStage {
  id: string;
  name: string;
  color: string;
  /** Added in Settings, so it can be deleted there; the six starting stages cannot. */
  added?: boolean;
}

// Fahad 21:21: «حديث وبعدها مهم … يحتاج متابعة … المدفوعات … عميلنا … عشوائي».
// T-285 (Fahad 124.8): the UI is English first, translated later, so the stages carry their English names in his
// order. 124.7: Recent's bright sky blue read like a link or a selected button; it takes the violet and Payments
// the blue, so the six stay six distinct colours.
export const DEFAULT_PATH_STAGES: PathStage[] = [
  { id: "recent", name: "Recent", color: "#8b5cf6" },
  { id: "important", name: "Important", color: "#f43f5e" },
  { id: "follow-up", name: "Needs follow-up", color: "#f59e0b" },
  { id: "payments", name: "Payments", color: "#0ea5e9" },
  { id: "our-customer", name: "Our customer", color: "#10b981" },
  { id: "random", name: "Random", color: "#64748b" },
];

// respond.io workspace-settings-lifecycle: "up to 20 stages in total".
export const MAX_PATH_STAGES = 20;

export const PATH_SECTION = "customerPath";
const LEGACY_KEY = "t96-customer-path";
/** Set once this browser's localStorage stages were added to the shared save (the old entry itself is kept). */
const IMPORTED_KEY = "t141-customer-path-imported";
/** Which items of the old local copy were already handled (see ImportReceipt). */
const RECEIPT_KEY = "t161-customer-path-import-receipt";

/**
 * The saved part: the added stages, contact key -> stage id, F-9's new name and colour of a starting stage, and the
 * order of the stages (null = starting stages first, then the added ones as they were added).
 */
export interface PathData {
  added: PathStage[];
  assigned: Record<string, string>;
  edits?: Record<string, { name: string; color: string }>;
  order?: string[] | null;
}

export type PathItem =
  | { kind: "stage"; id: string; name: string; color: string }
  | { kind: "edit"; id: string; name: string; color: string }
  | { kind: "order"; ids: string[] }
  | { kind: "assignment"; key: string; stageId: string };

export type PathOp =
  | { type: "set"; key: string; stageId: string | null }
  | { type: "add"; stage: PathStage }
  | { type: "edit"; stageId: string; name: string; color: string }
  | { type: "order"; ids: string[] }
  | { type: "delete"; stageId: string }
  | { type: "import"; data: PathData };

const EMPTY: PathData = { added: [], assigned: {}, edits: {}, order: null };
const STAGE_ID = /^stage-[a-z0-9]{1,40}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const DEFAULT_IDS = new Set(DEFAULT_PATH_STAGES.map((stage) => stage.id));

const stageIdsOf = (data: PathData) => new Set([...DEFAULT_PATH_STAGES, ...data.added].map((stage) => stage.id));

/** F-9: every stage as shown, in order: the starting ones with their saved name and colour, then the added ones. */
export function stagesOf(data: PathData): PathStage[] {
  const edits = data.edits ?? {};
  const all: PathStage[] = [
    ...DEFAULT_PATH_STAGES.map((stage) => (edits[stage.id] ? { ...stage, ...edits[stage.id] } : stage)),
    ...data.added.map((stage) => ({ ...stage, added: true })),
  ];
  const order = data.order;
  if (!order?.length) return all;
  const rank = new Map(order.map((id, index) => [id, index]));
  return all
    .map((stage, index) => ({ stage, at: rank.get(stage.id) ?? order.length + index }))
    .sort((a, b) => a.at - b.at)
    .map(({ stage }) => stage);
}

/** The order with only the stages that exist, each once, and every existing stage in it (a new one at the end). */
function cleanOrder(data: PathData, ids: string[]): string[] {
  const existing = stagesOf({ ...data, order: null }).map((stage) => stage.id);
  const kept = [...new Set(ids)].filter((id) => existing.includes(id));
  return [...kept, ...existing.filter((id) => !kept.includes(id))];
}

/** Saved items -> data. Anything malformed is skipped, so one bad item never hides the rest. */
export function fromItems(items: readonly unknown[] | null): PathData {
  const added: PathStage[] = [];
  const assigned: Record<string, string> = {};
  const edits: Record<string, { name: string; color: string }> = {};
  let order: string[] | null = null;
  for (const raw of items ?? []) {
    const item = raw as Partial<Record<string, unknown>> | null;
    if (item?.kind === "edit" && typeof item.id === "string" && DEFAULT_IDS.has(item.id)) {
      if (typeof item.name === "string" && item.name.trim() && typeof item.color === "string" && COLOR.test(item.color))
        edits[item.id] = { name: item.name, color: item.color };
    } else if (item?.kind === "order" && Array.isArray(item.ids)) {
      order = item.ids.filter((id): id is string => typeof id === "string");
    } else if (item?.kind === "stage" && typeof item.id === "string" && STAGE_ID.test(item.id)) {
      if (typeof item.name === "string" && item.name.trim() && typeof item.color === "string" && COLOR.test(item.color))
        if (!added.some((stage) => stage.id === item.id))
          added.push({ id: item.id, name: item.name, color: item.color, added: true });
    } else if (item?.kind === "assignment" && typeof item.key === "string" && typeof item.stageId === "string") {
      assigned[item.key] = item.stageId;
    }
  }
  const ids = stageIdsOf({ added, assigned });
  return {
    added,
    assigned: Object.fromEntries(Object.entries(assigned).filter(([, id]) => ids.has(id))),
    edits,
    order: order ? order.filter((id) => ids.has(id)) : null,
  };
}

export function toItems(data: PathData): PathItem[] {
  return [
    ...data.added.map((stage) => ({ kind: "stage" as const, id: stage.id, name: stage.name, color: stage.color })),
    ...Object.entries(data.edits ?? {}).map(([id, edit]) => ({ kind: "edit" as const, id, ...edit })),
    ...(data.order?.length ? [{ kind: "order" as const, ids: data.order }] : []),
    ...Object.entries(data.assigned).map(([key, stageId]) => ({ kind: "assignment" as const, key, stageId })),
  ];
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * One change applied to a saved copy. A change that no longer fits it (its stage was deleted elsewhere, a stage of
 * the same name was added elsewhere, the 20 stages are full) leaves the copy as it is and reports why.
 */
export function applyOp(data: PathData, op: PathOp): { data: PathData; refused?: string } {
  switch (op.type) {
    case "set": {
      const assigned = { ...data.assigned };
      if (op.stageId === null) delete assigned[op.key];
      else if (!stageIdsOf(data).has(op.stageId))
        return { data, refused: "That stage was deleted in another tab or device, so it was not set." };
      else assigned[op.key] = op.stageId;
      return { data: { ...data, assigned } };
    }
    case "add": {
      const all = stagesOf(data);
      if (all.some((stage) => stage.id === op.stage.id)) return { data };
      if (all.some((stage) => sameName(stage.name, op.stage.name)))
        return { data, refused: `A stage named "${op.stage.name}" was added in another tab or device.` };
      if (all.length >= MAX_PATH_STAGES) return { data, refused: `Up to ${MAX_PATH_STAGES} stages.` };
      return { data: { ...data, added: [...data.added, { ...op.stage, added: true }] } };
    }
    case "edit": {
      // F-9: a new name and colour for any stage; refused when the stage is gone or another stage has the name.
      const all = stagesOf(data);
      const stage = all.find((item) => item.id === op.stageId);
      if (!stage) return { data, refused: "That stage was deleted in another tab or device, so it was not changed." };
      if (all.some((item) => item.id !== op.stageId && sameName(item.name, op.name)))
        return { data, refused: `A stage named "${op.name}" already exists, so the stage was not renamed.` };
      if (DEFAULT_IDS.has(op.stageId)) {
        const edits = { ...(data.edits ?? {}) };
        const start = DEFAULT_PATH_STAGES.find((item) => item.id === op.stageId);
        if (start && start.name === op.name && start.color === op.color) delete edits[op.stageId];
        else edits[op.stageId] = { name: op.name, color: op.color };
        return { data: { ...data, edits } };
      }
      return {
        data: {
          ...data,
          added: data.added.map((item) =>
            item.id === op.stageId ? { ...item, name: op.name, color: op.color } : item,
          ),
        },
      };
    }
    case "order": {
      // The natural order (starting stages, then the added ones as added) is kept as no order at all.
      const order = cleanOrder(data, op.ids);
      const natural = stagesOf({ ...data, order: null }).map((stage) => stage.id);
      return { data: { ...data, order: order.join() === natural.join() ? null : order } };
    }
    case "delete":
      return {
        data: {
          ...data,
          added: data.added.filter((stage) => stage.id !== op.stageId),
          assigned: Object.fromEntries(Object.entries(data.assigned).filter(([, id]) => id !== op.stageId)),
          order: data.order ? data.order.filter((id) => id !== op.stageId) : null,
        },
      };
    case "import": {
      // What is already saved wins; only what the saved copy lacks is added. A local stage whose name is already
      // saved under another id is that saved stage, so its contacts are added on the saved one.
      const legacy = mapLegacy(data, op.data);
      let next = data;
      for (const stage of legacy.added) next = applyOp(next, { type: "add", stage }).data;
      const ids = stageIdsOf(next);
      const assigned = { ...next.assigned };
      for (const [key, id] of Object.entries(legacy.assigned))
        if (!(key in assigned) && ids.has(id)) assigned[key] = id;
      return { data: { ...next, assigned } };
    }
  }
}

/** The local copy with each stage that has the name of a saved stage (another id) renamed to that stage's id. */
function mapLegacy(data: PathData, legacy: PathData): PathData {
  const all = stagesOf(data);
  const ids = new Map<string, string>();
  for (const stage of legacy.added) {
    const same = all.find((saved) => saved.id !== stage.id && sameName(saved.name, stage.name));
    if (same) ids.set(stage.id, same.id);
  }
  return {
    added: legacy.added.filter((stage) => !ids.has(stage.id)),
    assigned: Object.fromEntries(Object.entries(legacy.assigned).map(([key, id]) => [key, ids.get(id) ?? id])),
  };
}

/** This browser's pre-T-141 copy, or null when there is none, it was already imported, or it is unreadable. */
export function readLegacy(storage: Pick<Storage, "getItem"> | undefined): PathData | null {
  try {
    if (!storage || storage.getItem(IMPORTED_KEY)) return null;
    const saved = JSON.parse(storage.getItem(LEGACY_KEY) ?? "null") as {
      added?: PathStage[];
      assigned?: Record<string, string>;
    } | null;
    if (!saved) return null;
    const items = [
      ...(Array.isArray(saved.added) ? saved.added : []).map((stage) => ({ ...stage, kind: "stage" })),
      ...Object.entries(saved.assigned && typeof saved.assigned === "object" ? saved.assigned : {}).map(
        ([key, stageId]) => ({ kind: "assignment", key, stageId }),
      ),
    ];
    const data = fromItems(items);
    return data.added.length || Object.keys(data.assigned).length ? data : null;
  } catch {
    return null; // a damaged entry reads as nothing saved
  }
}

/**
 * The items of the old local copy already handled, by their local ids: stages and contacts the server accepted (a
 * save that returned a new revision) or already had, and contacts saved there on another stage (`conflicts`).
 */
export interface ImportReceipt {
  stages: string[];
  assigned: Record<string, string>;
  conflicts: Record<string, string>;
}

const strings = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(value && typeof value === "object" ? value : {}).filter(([, id]) => typeof id === "string"),
  );

export function readReceipt(storage: Pick<Storage, "getItem"> | undefined): ImportReceipt {
  try {
    const raw = JSON.parse(storage?.getItem(RECEIPT_KEY) ?? "null") as Partial<ImportReceipt> | null;
    return {
      stages: Array.isArray(raw?.stages) ? raw.stages.filter((id) => typeof id === "string") : [],
      assigned: strings(raw?.assigned),
      conflicts: strings(raw?.conflicts),
    };
  } catch {
    return { stages: [], assigned: {}, conflicts: {} };
  }
}

/** The part of the local copy the receipt does not cover yet, or null when it covers all of it. */
export function unreceipted(legacy: PathData, receipt: ImportReceipt): PathData | null {
  const added = legacy.added.filter((stage) => !receipt.stages.includes(stage.id));
  const assigned = Object.fromEntries(
    Object.entries(legacy.assigned).filter(
      ([key, id]) => receipt.assigned[key] !== id && receipt.conflicts[key] !== id,
    ),
  );
  return added.length || Object.keys(assigned).length ? { added, assigned } : null;
}

/**
 * The receipt with what `data` (a copy the server accepted or returned) shows of the local copy: each stage in it
 * (under its id or its name), each contact on the same stage, and each contact on another stage (a conflict, unless
 * it was imported before and changed since). A contact whose local stage was imported and since deleted is done too:
 * that delete cleared it. A conflict whose contact is now on the local stage is no longer a conflict.
 */
export function addToReceipt(receipt: ImportReceipt, data: PathData, legacy: PathData): ImportReceipt {
  const mapped = mapLegacy(data, legacy);
  const ids = stageIdsOf(data);
  const stages = new Set(receipt.stages);
  for (const stage of legacy.added)
    if (ids.has(stage.id) || !mapped.added.some((local) => local.id === stage.id)) stages.add(stage.id);
  const assigned = { ...receipt.assigned };
  const conflicts = { ...receipt.conflicts };
  for (const [key, id] of Object.entries(legacy.assigned)) {
    const savedId = data.assigned[key];
    if (savedId === mapped.assigned[key]) {
      assigned[key] = id;
      if (conflicts[key] === id) delete conflicts[key];
    } else if (savedId !== undefined) {
      if (assigned[key] !== id) conflicts[key] = id;
    } else if (stages.has(id) && !ids.has(mapped.assigned[key])) assigned[key] = id;
  }
  return { stages: [...stages], assigned, conflicts };
}

/** Every item of the local copy is handled and none is in conflict: the import is complete. */
export const importComplete = (legacy: PathData, receipt: ImportReceipt) =>
  !unreceipted(legacy, receipt) && !Object.keys(receipt.conflicts).length;

interface PathState {
  stages: PathStage[];
  /** contact key (pathKeyOf) -> stage id */
  assigned: Record<string, string>;
  loaded: boolean;
  /** loading · ready · saving · error (see `error`; the change shown here is not saved yet, `retry` saves it). */
  status: "loading" | "ready" | "saving" | "error";
  error: string | null;
}

const usePathStore = create<PathState>(() => ({
  stages: DEFAULT_PATH_STAGES,
  assigned: {},
  loaded: false,
  status: "loading",
  error: null,
}));

// The saved copy as last read from or written to the server, its revision, and the changes not saved yet.
let saved: PathData = EMPTY;
let rev = 0;
let pending: PathOp[] = [];
let started = false;
let loadFailed = false;
let flushing: Promise<void> | null = null;
// This browser's old local copy (all of it, not only what is still to import), and whether its conflict was shown.
let legacy: PathData | null = null;
let conflictShown = false;

function show(status: PathState["status"], error: string | null = null) {
  const view = pending.reduce((data, op) => applyOp(data, op).data, saved);
  usePathStore.setState({
    stages: stagesOf(view),
    assigned: view.assigned,
    loaded: true,
    status,
    error,
  });
}

function failed(message: string) {
  console.error(`[customer path] ${message}`);
  show("error", message);
  toast.error("Customer Path not saved", { description: message, duration: Number.POSITIVE_INFINITY });
}

async function reload() {
  const section = await loadPreviewSection<unknown>(PATH_SECTION);
  rev = section.rev;
  saved = fromItems(section.items);
}

/** Saves the pending changes in order. On 409 the saved copy is read again and the changes go on top of it. */
async function flushNow(keepalive = false) {
  let conflicts = 0;
  while (pending.length) {
    const batch = pending.slice();
    let next = saved;
    const refused: string[] = [];
    for (const op of batch) {
      const result = applyOp(next, op);
      next = result.data;
      if (result.refused) refused.push(result.refused);
    }
    try {
      const result = await savePreviewSection(PATH_SECTION, toItems(next), rev, keepalive);
      rev = result.rev;
      saved = next;
      pending = pending.slice(batch.length);
      if (batch.some((op) => op.type === "import")) await confirmImported(next);
      for (const reason of refused) toast.error("Customer Path", { description: reason });
    } catch (error) {
      if (error instanceof SectionConflict && conflicts < 3) {
        conflicts++;
        try {
          await reload();
        } catch (loadError) {
          failed(`Saved stages could not be read again: ${(loadError as Error).message}. Retry to save this change.`);
          return;
        }
        toast.info("Customer Path was changed in another tab or device", {
          description: "Your change was added to the saved stages.",
        });
        continue;
      }
      failed(
        error instanceof SectionConflict
          ? "Changed again in another tab or device while saving. Retry to save this change on top of it."
          : `${(error as Error).message}. This change shows here but is not saved; Retry to save it.`,
      );
      return;
    }
  }
  show("ready");
}

function flush(keepalive = false) {
  if (!usePathStore.getState().loaded || loadFailed) return;
  usePathStore.setState({ status: "saving" });
  const run: Promise<void> = (flushing ?? Promise.resolve())
    .then(() => flushNow(keepalive))
    .finally(() => {
      if (flushing === run) flushing = null;
    });
  flushing = run;
}

/**
 * After a save with the import: what the server accepted goes on the receipt at once, so it is never imported again
 * (even when the read below fails). The old local copy is marked as added only after a fresh read of the shared
 * save, with nothing left to import and no conflict. The old localStorage entry itself is never removed.
 */
async function confirmImported(accepted: PathData) {
  settleImport(accepted, false);
  try {
    const section = await loadPreviewSection<unknown>(PATH_SECTION);
    settleImport(fromItems(section.items), true);
  } catch {
    // not confirmed: not marked; the receipt keeps what was accepted from being imported again
  }
}

/** Adds what `data` shows to the receipt; `read` = `data` is a fresh read of the shared save, so it may mark. */
function settleImport(data: PathData, read: boolean) {
  if (!legacy) return;
  const receipt = addToReceipt(readReceipt(window.localStorage), data, legacy);
  try {
    window.localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
  } catch {
    // blocked storage: nothing is kept between loads, as before T-161
  }
  if (read && importComplete(legacy, receipt)) markImported();
  const conflicts = Object.keys(receipt.conflicts).length;
  if (conflicts && !conflictShown) {
    conflictShown = true;
    toast.warning("Customer Path: old stages not moved", {
      description: `${conflicts} contact(s) in this browser's old copy are saved on another stage. The saved stage stays; the old one is kept in this browser and was not moved.`,
      duration: Number.POSITIVE_INFINITY,
    });
  }
}

const sameData = (a: PathData, b: PathData) => JSON.stringify(toItems(a)) === JSON.stringify(toItems(b));

function markImported() {
  try {
    window.localStorage.setItem(IMPORTED_KEY, new Date().toISOString());
  } catch {
    // blocked storage: the import runs again next time and adds nothing new
  }
}

function change(op: PathOp) {
  if (loadFailed) {
    failed("Saved stages could not be loaded, so changes are off on this page. Reload to try again.");
    return;
  }
  pending.push(op);
  if (!usePathStore.getState().loaded) {
    // made before the saved copy arrived: shown now, saved on top of it once it is loaded
    const view = pending.reduce((data, next) => applyOp(data, next).data, saved);
    usePathStore.setState({ stages: stagesOf(view), assigned: view.assigned });
    return;
  }
  show("saving");
  flush();
}

/** Reads the saved copy again when this tab comes back, so a change made in another browser shows without a reload. */
async function refresh() {
  if (pending.length || flushing || loadFailed || !usePathStore.getState().loaded) return;
  try {
    const before = rev;
    await reload();
    if (rev !== before && !pending.length) show("ready");
  } catch {
    // the next visit or reload tries again; nothing local is lost
  }
}

function load() {
  reload()
    .then(() => {
      loadFailed = false;
      // What is left of the old local copy adds nothing to the shared save (all in it already, or a contact saved
      // elsewhere on another stage, which wins): nothing is saved. This read goes on the receipt, and marks the copy
      // added only when all of it is there; a conflict leaves it unmarked and is shown.
      const first = pending[0];
      if (first?.type === "import" && sameData(applyOp(saved, first).data, saved)) pending.shift();
      if (pending[0]?.type !== "import") settleImport(saved, true);
      show(pending.length ? "saving" : "ready");
      if (pending.length) flush();
    })
    // Without the saved copy we must not overwrite it: nothing is saved on this page load.
    .catch((error) => {
      loadFailed = true;
      const message = `Saved stages could not be loaded: ${(error as Error).message}`;
      console.error(`[customer path] ${message}`);
      show("error", message);
    });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  legacy = readLegacy(window.localStorage);
  // only what no receipt covers: what was imported (or found in conflict) once is never imported again
  const rest = legacy && unreceipted(legacy, readReceipt(window.localStorage));
  if (rest) pending.unshift({ type: "import", data: rest });
  load();
  window.addEventListener("focus", () => void refresh());
  window.addEventListener("pagehide", () => {
    // Only on top of a saved copy read in this page: before that (or after a failed read) nothing is written.
    if (pending.length && !flushing && usePathStore.getState().loaded && !loadFailed) void flushNow(true);
  });
}

/** Loads the saved stages and assignments once per page (the first component that needs them starts it). */
export function useHydrateCustomerPath() {
  useEffect(() => start(), []);
}

/**
 * F-9: resolves once the changes made so far are saved on the preview server, rejects when saving failed (the store
 * has already shown "Customer Path not saved"). So a page says "saved" only after the server has the change.
 */
export function whenPathSaved(): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = (state: PathState) => {
      if (state.status === "ready" && !pending.length) {
        unsubscribe();
        resolve();
      } else if (state.status === "error") {
        unsubscribe();
        reject(new Error(state.error ?? "not saved"));
      }
    };
    const unsubscribe = usePathStore.subscribe(check);
    check(usePathStore.getState());
  });
}

export function useCustomerPath<T>(select: (state: PathState) => T): T {
  return usePathStore(select);
}

/** The contact the conversation belongs to; a conversation with no known contact keeps its own stage. */
export function pathKeyOf(conversationId: number): string {
  const person = contactIdOf(conversationId);
  return person === null ? `conversation-${conversationId}` : `contact-${person}`;
}

// T-141 (item 59) «مسار العميل» in the inbox filter: the advanced filter's attribute (Chatwoot filter rows, as Labels)
// and the side panel's stage list (respond.io: filter conversations by Lifecycle stage) read the stage through these.
export const CUSTOMER_PATH_FILTER = "customer_path";

/** The stage id on the conversation's contact, "" when none. Reads the store directly (usable outside React). */
export function stageIdOf(conversationId: number): string {
  return usePathStore.getState().assigned[pathKeyOf(conversationId)] ?? "";
}

// The Inbox bar's stage choice narrows whatever list is open (a folder, team or channel, with its status and the
// channel picker), as the channel picker does. It is not an applied filter, so the list keeps its own scope. null = all.
const useStageFilterStore = create<{ stageId: string | null }>(() => ({ stageId: null }));

export function useStageFilter(): string | null {
  return useStageFilterStore((s) => s.stageId);
}

export function setStageFilter(stageId: string | null) {
  useStageFilterStore.setState({ stageId });
}

/** A stage's name for filter chips; an unknown id is shown as it is. */
export function stageNameOf(stageId: string): string {
  return usePathStore.getState().stages.find((stage) => stage.id === stageId)?.name ?? stageId;
}

export const customerPath = {
  setStage(conversationId: number, stageId: string | null) {
    change({ type: "set", key: pathKeyOf(conversationId), stageId });
  },
  addStage(name: string, color: string) {
    change({ type: "add", stage: { id: `stage-${Date.now().toString(36)}`, name, color, added: true } });
  },
  /** F-9: a new name and colour for any stage, a starting one too. */
  editStage(stageId: string, name: string, color: string) {
    change({ type: "edit", stageId, name, color });
  },
  /** F-9: the stages in this order (ids); a stage left out keeps its place after them. */
  reorder(ids: string[]) {
    change({ type: "order", ids });
  },
  /** F-9: one place up (-1) or down (+1), from the stages as shown. */
  moveStage(stageId: string, delta: -1 | 1) {
    const ids = usePathStore.getState().stages.map((stage) => stage.id);
    const at = ids.indexOf(stageId);
    const to = at + delta;
    if (at < 0 || to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    change({ type: "order", ids });
  },
  /** Only an added stage; the contacts on it go back to no stage. */
  deleteStage(stageId: string) {
    if (!usePathStore.getState().stages.some((stage) => stage.id === stageId && stage.added)) return;
    change({ type: "delete", stageId });
  },
  /** Saves again what failed to save (shown with the "not saved" message). */
  retry() {
    if (loadFailed) load();
    else flush();
  },
};
