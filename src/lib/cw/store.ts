"use client";

// F161 foundation: the shared, editable copies of ./data.ts. Every page reads and writes the same lists, so a label,
// team, inbox, macro or canned response added in Settings shows up in Conversations, the sidebar and Reports.
// Module state (zustand): survives moving between pages. T-68: also saved to the preview server's disk
// (./persistence), so it survives reload and server restart; preview only, not production storage.
import { toast } from "sonner";
import { create } from "zustand";

import { type Macro, macros } from "@/app/(main)/dashboard/settings/macros/_components/data";
import { applyServerSharedState, handleLinkedSharedWrite, isSyncingFromServer } from "@/lib/chatwoot/settings-adapter";

import {
  type Agent,
  agents,
  type CannedResponse,
  cannedResponses,
  type Inbox,
  inboxes,
  type Label,
  labels,
  type Team,
  teams,
  type WhatsAppTemplate,
  whatsappTemplates,
} from "./data";
import { ListsConflict, linkedSession, loadPreviewLists, savePreviewLists } from "./persistence/client";

export interface CwLists {
  agents: Agent[];
  inboxes: Inbox[];
  teams: Team[];
  labels: Label[];
  cannedResponses: CannedResponse[];
  macros: Macro[];
  whatsappTemplates: WhatsAppTemplate[];
}

export const useCwShared = create<CwLists>(() => ({
  agents,
  inboxes,
  teams,
  labels,
  cannedResponses,
  macros,
  whatsappTemplates,
}));

type Updater<T> = T | ((previous: T) => T);

// U-2 (task u2-cw-store-adapter-chat-contacts): in linked mode the shared lists are Chatwoot's (agents, inboxes, teams,
// labels, canned responses, macros), put here by src/lib/chatwoot/store-adapter.ts. They are never saved to the
// preview's disk (startPersistence below ignores every change while `linkedLists` is set), and the preview's saved
// lists, if they arrive while linked, are kept aside in `previewCopy` instead of replacing them.
let linkedLists = false;
let previewCopy: CwLists | null = null;

/** U-2: shows Chatwoot's lists (the keys given) in place of the preview's; nothing of it is saved. */
export function showLinkedLists(lists: Partial<CwLists> | null): void {
  if (lists === null) {
    if (linkedLists && previewCopy) {
      applyServerSharedState(previewCopy);
    }
    linkedLists = false;
    previewCopy = null;
    return;
  }
  if (!linkedLists) previewCopy = useCwShared.getState();
  linkedLists = true;
  applyServerSharedState(lists);
}

/** U-2: true while the shared lists are Chatwoot's (a change to them is not saved to the preview). */
export const sharedListsLinked = (): boolean => linkedLists;

/** Replace (or update with a function) one shared list. Works outside React too. */
export function setCwList<K extends keyof CwLists>(key: K, next: Updater<CwLists[K]>): void {
  useCwShared.setState((state) => ({
    [key]: typeof next === "function" ? (next as (previous: CwLists[K]) => CwLists[K])(state[key]) : next,
  }));
}

/** Drop-in replacement for `React.useState(initialList)`: `const [teams, setTeams] = useCwList("teams")`. */
export function useCwList<K extends keyof CwLists>(key: K): [CwLists[K], (next: Updater<CwLists[K]>) => void] {
  const list = useCwShared((state) => state[key]);
  return [list, (next) => setCwList(key, next)];
}

type ListKey = "agents" | "inboxes" | "teams" | "cannedResponses" | "macros";
type Row<K extends ListKey> = CwLists[K][number];

/**
 * The same list as an object store (get/find/nextId/save/update/remove/subscribe), shaped like Settings'
 * createListStore, so a settings page can keep its store API and still write to the shared list.
 */
export function cwListStore<K extends ListKey>(key: K) {
  const get = () => useCwShared.getState()[key] as Row<K>[];
  const write = (next: Row<K>[]) => setCwList(key, next as CwLists[K]);
  return {
    get,
    find: (id: number) => get().find((item) => item.id === id),
    nextId: () => Math.max(0, ...get().map((item) => item.id)) + 1,
    save(item: Row<K>) {
      const list = get();
      write(list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
    },
    update(id: number, patch: Partial<Row<K>>) {
      write(get().map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    remove(id: number) {
      write(get().filter((x) => x.id !== id));
    },
    subscribe(listener: () => void) {
      return useCwShared.subscribe((state, previous) => {
        if (state[key] !== previous[key]) listener();
      });
    },
    seed: useCwShared.getInitialState()[key] as Row<K>[],
  };
}

export interface CwPersistence {
  /** loading: reading the saved lists · ready: nothing pending · saving · error: see `error`, changes may be lost. */
  status: "loading" | "ready" | "saving" | "error";
  error: string | null;
  savedAt: string | null;
}

/** Save status of the shared lists, for any page that wants to show "saved" / "not saved". */
export const useCwPersistence = create<CwPersistence>(() => ({ status: "loading", error: null, savedAt: null }));

export type CwListKey = keyof CwLists;
const LIST_KEYS: CwListKey[] = [
  "agents",
  "inboxes",
  "teams",
  "labels",
  "cannedResponses",
  "macros",
  "whatsappTemplates",
];
const LIST_NAMES: Record<CwListKey, string> = {
  agents: "Agents",
  inboxes: "Inboxes",
  teams: "Teams",
  labels: "Labels",
  cannedResponses: "Canned responses",
  macros: "Macros",
  whatsappTemplates: "WhatsApp templates",
};
const isListKey = (key: string): key is CwListKey => (LIST_KEYS as string[]).includes(key);

// F-6B: what each save ended with, for whenListsSaved. `upTo` is the number of edits the save had seen when it read the
// lists, so a caller waits for a save that includes its own change, not one already on its way.
interface SaveOutcome {
  upTo: number;
  conflicts: CwListKey[];
  error: string | null;
}
const outcomeListeners = new Set<(outcome: SaveOutcome) => void>();
let edits = 0;
/** Set when the saved lists could not be read: this page load saves nothing. */
let savingOff: string | null = null;

/**
 * F-3: call just before changing a list; resolves when the server confirmed the save that follows, rejects with its
 * reason (a 409 included), so a page can wait before doing what depends on the change being saved.
 * F-6B: with `keys`, only a conflict on those lists rejects (each list has its own revision now).
 */
export function whenListsSaved(keys?: readonly CwListKey[], timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (savingOff) {
      reject(new Error(savingOff));
      return;
    }
    const since = edits;
    const listener = (outcome: SaveOutcome) => {
      if (outcome.upTo <= since) return; // sent before the caller's change
      if (outcome.error) return done(new Error(outcome.error));
      const lost = keys ? outcome.conflicts.filter((key) => keys.includes(key)) : outcome.conflicts;
      done(lost.length ? new Error(CHANGED_ELSEWHERE) : undefined);
    };
    outcomeListeners.add(listener);
    const timer = setTimeout(() => done(new Error("the preview server did not confirm the save")), timeoutMs);
    function done(error?: Error) {
      outcomeListeners.delete(listener);
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    }
  });
}

function failed(error: unknown, prefix = "") {
  const message = `${prefix}${error instanceof Error ? error.message : String(error)}`;
  console.error(`[cw persistence] ${message}`);
  useCwPersistence.setState({ status: "error", error: message });
  return message;
}

/** F-3: said when a list was saved in another tab or device after this page loaded it (409). */
export const CHANGED_ELSEWHERE =
  "This was changed in another tab or device, so this change was not saved. The page now shows the latest version; make the change again.";

function changedElsewhere(keys: CwListKey[]) {
  const names = keys.map((key) => LIST_NAMES[key]).join(", ");
  console.warn(`[cw persistence] ${names}: ${CHANGED_ELSEWHERE}`); // expected and shown to the user: not a page error
  useCwPersistence.setState({ status: "error", error: CHANGED_ELSEWHERE });
  // The page may already have said "saved" for the change it just made; take that back before saying it was not.
  toast.dismiss();
  toast.error("Not saved: changed in another tab or device", {
    id: "cw-lists-changed-elsewhere",
    description: `${names} ${keys.length > 1 ? "were" : "was"} changed in another tab or device, so your change to ${keys.length > 1 ? "them" : "it"} was not saved. This page now shows the saved ${names.toLowerCase()}; make the change again, or reload the page.`,
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Reload", onClick: () => window.location.reload() },
  });
}

function startPersistence() {
  let loaded = false;
  let editedBeforeLoad = false;
  let applyingSaved = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  // F-6B: each list's revision this page holds and the copy of it the server has (JSON), so a save sends only the
  // lists this page changed. `null`: the server has no lists yet, and the first save sends all seven.
  const revs = Object.fromEntries(LIST_KEYS.map((key) => [key, 0])) as Record<CwListKey, number>;
  const synced = Object.fromEntries(LIST_KEYS.map((key) => [key, null])) as Record<CwListKey, string | null>;

  const emit = (outcome: SaveOutcome) => {
    for (const listener of [...outcomeListeners]) listener(outcome);
  };

  // The server's copy of a list replaces this page's when this page's copy was refused (F-3: an out-of-date page must
  // not send its copy again, or deleted rows would come back).
  const adopt = (key: CwListKey, items: unknown[] | null | undefined, rev: number | undefined) => {
    if (!Array.isArray(items) || rev === undefined) return false;
    applyingSaved = true;
    useCwShared.setState({ [key]: items } as Partial<CwLists>);
    applyingSaved = false;
    synced[key] = JSON.stringify(items);
    revs[key] = rev;
    return true;
  };

  const sendChanged = async (keepalive: boolean) => {
    const upTo = edits;
    const conflicts: CwListKey[] = [];
    let savedAt: string | null = null;
    try {
      // A conflict on one list does not hold back the others: they are sent again without it (one round per list).
      for (let round = 0; round <= LIST_KEYS.length; round++) {
        const state = useCwShared.getState();
        const texts = {} as Record<CwListKey, string>;
        const send = LIST_KEYS.filter((key) => {
          if (conflicts.includes(key)) return false;
          texts[key] = JSON.stringify(state[key]);
          return texts[key] !== synced[key];
        });
        if (!send.length) break;
        try {
          const saved = await savePreviewLists(
            Object.fromEntries(send.map((key) => [key, state[key]])),
            Object.fromEntries(send.map((key) => [key, revs[key]])),
            keepalive,
          );
          for (const key of send) {
            synced[key] = texts[key];
            const rev = saved.revs?.[key];
            if (rev !== undefined && Number.isInteger(rev)) revs[key] = rev;
          }
          savedAt = saved.savedAt;
          break;
        } catch (error) {
          if (!(error instanceof ListsConflict)) throw error;
          const lost = error.conflicts.filter(isListKey).filter((key) => send.includes(key));
          if (!lost.length) throw error;
          for (const key of lost) {
            adopt(key, error.saved[key], error.revs[key]);
            conflicts.push(key);
          }
        }
      }
      if (conflicts.length) changedElsewhere(conflicts);
      else if (!pending)
        useCwPersistence.setState({
          status: "ready",
          error: null,
          savedAt: savedAt ?? useCwPersistence.getState().savedAt,
        });
      emit({ upTo, conflicts, error: null });
    } catch (error) {
      emit({ upTo, conflicts, error: failed(error) });
    }
  };

  // Saves run one at a time and always send the newest lists, so an older save can never land last.
  const save = (keepalive = false) => {
    clearTimeout(timer);
    pending = false;
    useCwPersistence.setState({ status: "saving" });
    queue = queue.then(() => sendChanged(keepalive));
  };

  useCwShared.subscribe((state, previous) => {
    if (applyingSaved || isSyncingFromServer()) return;
    if (linkedLists || linkedSession()) {
      const changed = LIST_KEYS.filter((key) => state[key] !== previous[key]);
      if (!changed.length) return;
      edits += 1;
      const upTo = edits;
      const hasWaitingCaller = outcomeListeners.size > 0;
      useCwPersistence.setState({ status: "saving" });
      queue = queue.then(async () => {
        const res = await handleLinkedSharedWrite(changed, useCwShared.getState(), hasWaitingCaller);
        if (res.error) {
          useCwPersistence.setState({ status: "error", error: res.error });
          emit({ upTo, conflicts: [], error: res.error });
        } else {
          useCwPersistence.setState({
            status: "ready",
            error: null,
            savedAt: new Date().toISOString(),
          });
          emit({ upTo, conflicts: [], error: null });
        }
      });
      return;
    }
    edits += 1;
    if (!loaded) {
      editedBeforeLoad = true;
      return;
    }
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(save, 300);
  });
  window.addEventListener("pagehide", () => {
    if (pending) save(true);
  });

  loadPreviewLists<CwLists>()
    .then(({ lists, savedAt, revs: savedRevs }) => {
      for (const key of LIST_KEYS) revs[key] = Number.isInteger(savedRevs[key]) ? savedRevs[key] : 0;
      if (lists) {
        // A list edited while loading keeps the edit (and is saved right away); every other list takes the saved copy.
        const initial = useCwShared.getInitialState();
        const local = useCwShared.getState();
        const apply = LIST_KEYS.filter((key) => !(editedBeforeLoad && local[key] !== initial[key]) && lists[key]);
        const saved = Object.fromEntries(apply.map((key) => [key, lists[key]])) as Partial<CwLists>;
        // U-2: while linked the saved lists wait aside (the page reloads when it goes back to preview).
        if (linkedLists && previewCopy) previewCopy = { ...previewCopy, ...saved };
        else {
          applyingSaved = true;
          useCwShared.setState(saved);
          applyingSaved = false;
        }
        for (const key of LIST_KEYS) synced[key] = lists[key] ? JSON.stringify(lists[key]) : null;
      }
      loaded = true;
      useCwPersistence.setState({ status: "ready", error: null, savedAt });
      if (editedBeforeLoad) save();
    })
    // Without the saved copy we must not overwrite it, so saving stays off for this page load.
    .catch((error) => {
      savingOff = failed(error, "changes on this page will not be saved: ");
    });
}

if (typeof window !== "undefined") startPersistence();
