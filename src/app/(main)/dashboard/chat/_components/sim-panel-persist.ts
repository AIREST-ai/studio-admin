"use client";

// M129-A round 2 (Fahad 124.8 and 129.2; judge: the Arabic line "in the preview only, lost on refresh"): the
// conversation panel's edits are kept on the preview server (api/preview-sim/panel) and put back on every page load:
// conversation and contact attributes, contact details, contact notes, priority, assignee, team, participants and the
// labels on conversations. A failed save says so ("Not saved in the preview"); nothing reaches Chatwoot.
// F-3 item 13 (sim1: a tab left open put back a priority another browser had changed, every minute): a save sends only
// what this tab changed since it loaded or last saved (field by field; a note or label list as a whole), and the server
// merges it into the saved copy (api/preview-sim/panel/route.ts), so the edits of two browsers are both kept. A change
// this tab did not make (e.g. the SLA badges moving on each minute) sends nothing.
// F-8 (sim3 8.18: a label browser B added was lost when the stale browser A added another one): labels are sent as
// what this tab added and removed ({ add, remove }), and the server applies that to the saved list
// (api/preview-sim/panel/merge.ts), so both browsers' labels are kept and a label removed in one is not put back by the
// other. After each save this page takes the server's labels (another tab's changes included) and says so when another
// tab or device had changed them.
// F-8 (sim3 8.14e: teamId 'billing' stayed in conversation 2's meta, no such team): a conversation keeps no team that
// does not exist. Once the saved teams are loaded, a team id that matches no team is cleared (null) and that is saved,
// as Chatwoot nullifies a team's conversations when the team is deleted (Team has_many :conversations,
// dependent: :nullify, https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/models/team.rb). The same happens when a
// team is deleted while this page is open.
// F-19 (F-8's note: "saved in this preview" under the labels was a fixed line, shown even when the save failed): each
// conversation's label save is followed here (useLabelSaves), and the line under Conversation Labels shows "saved"
// only once the server took the change, "Not saved …" with the reason when it did not (contact-panel.tsx).
import { toast } from "sonner";
import { create } from "zustand";

import {
  getConversationTags,
  restoreConversationTags,
  subscribeConversationTags,
} from "@/app/(main)/chat/_components/chat-tags-store";
import { linkedSession } from "@/lib/cw/persistence/client";
import { onPreviewSimLoaded } from "@/lib/cw/preview-sim";
import { useCwPersistence, useCwShared } from "@/lib/cw/store";

import { type ConversationMeta, initialMeta, liveTeams } from "./cw-data";
import { cw, useCwStore } from "./cw-store";

const ENDPOINT = "/api/preview-sim/panel";

// "off": the saved copy could not be loaded, so this page does not save (panel-attributes.tsx previewOnly says so).
let saving: "loading" | "ready" | "off" = "loading";
export const panelEditsSaving = () => saving;

/** F-8: how a save of the panel edits ended; `message` says why it failed. */
export type PanelSaveOutcome = { ok: true } | { ok: false; message: string };
let saveNow: (() => Promise<PanelSaveOutcome>) | null = null;
/**
 * F-8 (monitor: a macro said "saved" before its changes were saved): saves this page's panel edits now (instead of
 * after the short pause) and resolves with how that save ended, so a caller can wait for it before saying "saved".
 */
export function savePanelEditsNow(): Promise<PanelSaveOutcome> {
  if (linkedSession()) return Promise.resolve({ ok: true });
  if (saveNow) return saveNow();
  return Promise.resolve({
    ok: false,
    message:
      saving === "off"
        ? "the saved panel edits could not be loaded, so this page does not save them"
        : "the saved panel edits are still loading",
  });
}

/** F-19: how the latest label change of each conversation (by id) on this page is doing. */
export type LabelSave = { state: "saving" } | { state: "saved"; at: string } | { state: "failed"; message: string };
export const useLabelSaves = create<Record<string, LabelSave | undefined>>(() => ({}));

type MetaPart = Pick<ConversationMeta, "priority" | "assigneeId" | "teamId" | "participants" | "unattended">;
type CwState = ReturnType<typeof useCwStore.getState>;

/** What this page holds of the panel's edits, as the saved copy names it (ids as text). */
export interface PanelState {
  conversationAttrs: Record<string, Record<string, string>>;
  contactAttrs: Record<string, Record<string, string>>;
  contactEdits: CwState["contactEdits"];
  notes: Record<string, CwState["notes"][number]>;
  meta: Record<string, MetaPart>;
  labels: Record<string, string[]>;
}
type Changes = Partial<Record<keyof PanelState, Record<string, unknown>>>;

// The sample conversations (their ids are fixed when the data loads; conversations made later are not panel edits).
const SAMPLE_IDS = Object.keys(initialMeta).map(Number);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const metaPart = (meta: ConversationMeta): MetaPart => ({
  priority: meta.priority,
  assigneeId: meta.assigneeId,
  teamId: meta.teamId,
  participants: meta.participants,
  unattended: meta.unattended,
});
const samplesOf = <T>(map: Record<number, T>): Record<string, T> =>
  Object.fromEntries(SAMPLE_IDS.filter((id) => map[id] !== undefined).map((id) => [String(id), map[id]]));

function current(): PanelState {
  const state = useCwStore.getState();
  const meta: Record<string, MetaPart> = {};
  for (const id of SAMPLE_IDS) if (state.meta[id]) meta[id] = metaPart(state.meta[id]);
  return {
    conversationAttrs: samplesOf(state.conversationAttrs),
    contactAttrs: samplesOf(state.contactAttrs),
    contactEdits: state.contactEdits,
    notes: state.notes as PanelState["notes"],
    meta,
    labels: Object.fromEntries(Object.entries(getConversationTags()).filter(([, tags]) => tags.length > 0)),
  };
}

const keysOf = (...maps: object[]) => [...new Set(maps.flatMap((map) => Object.keys(map)))];

/** What changed from `base` to `now` (the shape of PUT { changes }), or null when nothing did. */
function changesBetween(base: PanelState, now: PanelState): Changes | null {
  const changes: Changes = {};
  const put = (slice: keyof PanelState, id: string, value: unknown) => {
    changes[slice] = { ...(changes[slice] ?? {}), [id]: value };
  };
  for (const slice of ["meta", "contactEdits", "conversationAttrs", "contactAttrs"] as const) {
    const before = base[slice] as Record<string, Record<string, unknown>>;
    const after = now[slice] as Record<string, Record<string, unknown>>;
    for (const id of keysOf(before, after)) {
      const b = before[id] ?? {};
      const a = after[id] ?? {};
      const fields: Record<string, unknown> = {};
      for (const key of keysOf(b, a)) {
        if (same(b[key], a[key])) continue;
        if (key in a) fields[key] = a[key];
        else if (slice === "conversationAttrs" || slice === "contactAttrs") fields[key] = null; // removed
      }
      if (Object.keys(fields).length) put(slice, id, fields);
    }
  }
  for (const id of keysOf(base.notes, now.notes))
    if (!same(base.notes[id], now.notes[id])) put("notes", id, now.notes[id] ?? null);
  // F-8: labels as what was added and removed, never the whole list (see the top of this file).
  for (const id of keysOf(base.labels, now.labels)) {
    const ops = labelOps(base.labels[id] ?? [], now.labels[id] ?? []);
    if (ops.add.length || ops.remove.length) put("labels", id, ops);
  }
  return Object.keys(changes).length ? changes : null;
}

const labelOps = (before: string[], after: string[]) => ({
  add: after.filter((label) => !before.includes(label)),
  remove: before.filter((label) => !after.includes(label)),
});
const nonEmpty = (labels: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(labels).filter(([, list]) => Array.isArray(list) && list.length > 0));
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((label) => b.includes(label));
const labelTitles = (ids: string[]) => {
  const labels = useCwShared.getState().labels;
  return ids.map((id) => labels.find((label) => label.id === id)?.title ?? id).join(", ") || "no labels";
};

/**
 * F-19: once a save ended: the conversations whose labels it carried are "saved" (unless changed again since, then a
 * save of that is on its way) or "failed" with `error`; one still "Saving…" with nothing left to send is cleared.
 */
function settleLabels(sent: string[], reference: Record<string, string[]>, error: string | null) {
  const tags = getConversationTags();
  const at = new Date().toISOString();
  const next: Record<string, LabelSave | undefined> = {};
  for (const [id, save] of Object.entries(useLabelSaves.getState())) {
    const changedSince = !sameSet(tags[id] ?? [], reference[id] ?? []);
    if (sent.includes(id)) {
      if (error) next[id] = { state: "failed", message: error };
      else if (!changedSince) next[id] = { state: "saved", at };
    } else if (save?.state === "saving" && !changedSince) next[id] = undefined;
  }
  for (const id of sent)
    if (!(id in next) && !useLabelSaves.getState()[id])
      next[id] = error ? { state: "failed", message: error } : { state: "saved", at };
  if (Object.keys(next).length) useLabelSaves.setState(next);
}

/**
 * F-8: after a save, this page takes the labels the server now holds (another tab's or device's changes included),
 * keeping what this page changed after the save was sent (it goes with the next save). Returns the server's labels
 * (the new base) and the conversations whose labels another tab or device had changed.
 */
function adoptServerLabels(sent: Record<string, string[]>, server: Record<string, string[]>) {
  const local = getConversationTags();
  const adopted: Record<string, string[]> = {};
  const elsewhere: { id: string; labels: string[] }[] = [];
  for (const id of keysOf(server, sent, local)) {
    const saved = server[id] ?? [];
    const before = sent[id] ?? [];
    const now = local[id] ?? [];
    const since = labelOps(before, now);
    const next = [
      ...saved.filter((label) => !since.remove.includes(label)),
      ...since.add.filter((l) => !saved.includes(l)),
    ];
    if (!same(next, now)) adopted[id] = next;
    if (!sameSet(saved, before)) elsewhere.push({ id, labels: saved });
  }
  return { adopted, elsewhere };
}

/** Fields merged into each entry; a null attribute is one that was removed. */
function mergeFields<T extends Record<string, unknown>>(
  map: Record<number, T>,
  saved: Record<string, Record<string, unknown>> | undefined,
): Record<number, T> {
  const next: Record<string, Record<string, unknown>> = { ...map };
  for (const [id, fields] of Object.entries(saved ?? {})) {
    const entry: Record<string, unknown> = { ...(next[id] ?? {}) };
    for (const [key, value] of Object.entries(fields ?? {})) {
      if (value === null) delete entry[key];
      else entry[key] = value;
    }
    next[id] = entry;
  }
  return next as Record<number, T>;
}

// A copy saved by an older build may lack a part, so every part is optional here.
function apply(saved: Partial<PanelState>) {
  useCwStore.setState((state) => {
    const meta = { ...state.meta };
    for (const [id, part] of Object.entries(saved.meta ?? {})) {
      const current = meta[Number(id)];
      if (current) meta[Number(id)] = { ...current, ...part };
    }
    return {
      meta,
      conversationAttrs: mergeFields(state.conversationAttrs, saved.conversationAttrs),
      contactAttrs: mergeFields(state.contactAttrs, saved.contactAttrs),
      contactEdits: mergeFields(
        state.contactEdits as Record<string, Record<string, unknown>>,
        saved.contactEdits,
      ) as CwState["contactEdits"],
      notes: { ...state.notes, ...saved.notes },
    };
  });
  restoreConversationTags(saved.labels ?? {});
}

// F-8: true once the saved teams (lib/cw/store.ts) were read; until then, or if they could not be read, no team id is
// cleared (an unread list would make every team look missing). The lists' first status after "loading" is the load's.
let teamsLoaded = false;
let panelReady = false;

/** F-8: clears (null) every conversation's team id that matches no team; the change is saved like any panel edit. */
function dropMissingTeams() {
  if (linkedSession() || !teamsLoaded || !panelReady) return;
  const teams = new Set(liveTeams().map((team) => team.id));
  const meta = useCwStore.getState().meta;
  const stale = Object.keys(meta)
    .map(Number)
    .filter((id) => meta[id]?.teamId && !teams.has(meta[id].teamId as string));
  if (stale.length) cw.assignTeam(stale, null);
}

function watchTeams() {
  const loadedNow = (status: string) => {
    if (teamsLoaded || status === "loading") return;
    unsubscribe();
    // "error" here is the load itself failing ("changes on this page will not be saved"): teams stay unknown.
    if (status === "error") return;
    teamsLoaded = true;
    dropMissingTeams();
    useCwShared.subscribe((state, previous) => {
      if (state.teams !== previous.teams) dropMissingTeams();
    });
  };
  const unsubscribe = useCwPersistence.subscribe((state) => loadedNow(state.status));
  loadedNow(useCwPersistence.getState().status);
}

function start() {
  watchTeams();
  let applying = false;
  // what this page last loaded or saved; null until the saved copy is read (nothing is sent before)
  let base: PanelState | null = null;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();

  const send = async (keepalive: boolean): Promise<PanelSaveOutcome> => {
    if (linkedSession()) return { ok: true };
    if (!base) return { ok: false, message: "the saved panel edits are still loading" };
    const now = current();
    const changes = changesBetween(base, now);
    if (!changes) {
      settleLabels([], now.labels, null);
      return { ok: true };
    }
    const sentLabels = Object.keys(changes.labels ?? {});
    try {
      const response = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes }),
        keepalive,
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        state?: Partial<PanelState> | null;
      } | null;
      if (!response.ok) throw new Error(`${response.status} ${body?.error ?? response.statusText}`);
      // F-8: the labels the server holds now (both tabs' changes) become this page's, and the next diff starts there.
      const server = nonEmpty((body?.state?.labels ?? {}) as Record<string, string[]>);
      const { adopted, elsewhere } = adoptServerLabels(now.labels, server);
      if (Object.keys(adopted).length) {
        applying = true;
        restoreConversationTags(adopted);
        applying = false;
      }
      base = { ...now, labels: server };
      // Compared with what the server holds now (another tab's labels included), the new base.
      settleLabels(sentLabels, server, null);
      if (elsewhere.length)
        toast.info("Labels updated from another tab or device", {
          id: "panel-labels-merged",
          duration: 10_000,
          description: `${elsewhere
            .map(({ id, labels }) => `Conversation #${id} now has: ${labelTitles(labels)}`)
            .join(". ")}. Your change and theirs were both kept (saved in this preview, not in the engine).`,
        });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      settleLabels(sentLabels, now.labels, message);
      console.error(`[panel edits] not saved: ${message}`);
      toast.error("Not saved in the preview", {
        id: "panel-edits-not-saved",
        description: `${message}. This change shows on this page only and will be gone after a reload.`,
      });
      return { ok: false, message };
    }
  };
  const save = (keepalive = false) => {
    clearTimeout(timer);
    pending = false;
    const run = queue.then(() => send(keepalive));
    queue = run.then(() => undefined);
    return run;
  };
  saveNow = () => save();
  const schedule = () => {
    if (linkedSession() || applying || !base) return;
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => save(), 400);
  };

  useCwStore.subscribe((state, previous) => {
    if (
      state.meta !== previous.meta ||
      state.conversationAttrs !== previous.conversationAttrs ||
      state.contactAttrs !== previous.contactAttrs ||
      state.contactEdits !== previous.contactEdits ||
      state.notes !== previous.notes
    )
      schedule();
  });
  // F-19: a label change shows "Saving…" under the labels until its save ends (or why it will not be saved).
  const labelsChanged = () => {
    if (linkedSession() || applying) return;
    const tags = getConversationTags();
    const from = base?.labels ?? {};
    const ids = keysOf(from, tags).filter((id) => !sameSet(from[id] ?? [], tags[id] ?? []));
    let why: string | null = null;
    if (!base && saving === "off") why = "the preview's saved copy could not be loaded, so this page does not save";
    else if (!base) why = "the saved labels were still loading; make the change again";
    if (ids.length)
      useLabelSaves.setState(
        Object.fromEntries(
          ids.map((id) => [id, why ? { state: "failed", message: why } : { state: "saving" }]),
        ) as Record<string, LabelSave>,
      );
    schedule();
  };
  subscribeConversationTags(labelsChanged);
  window.addEventListener("pagehide", () => {
    if (pending && !linkedSession()) save(true);
  });

  // Applied after the simulated record (contacts deleted or merged) is replayed, so the latest panel edits win.
  const simReplayed = new Promise<void>((resolve) => onPreviewSimLoaded(() => setTimeout(resolve, 0)));
  Promise.all([
    fetch(ENDPOINT, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    simReplayed,
  ])
    .then(([body]) => {
      if (linkedSession()) return;
      const saved = (body as { state: Partial<PanelState> | null }).state;
      if (saved) {
        applying = true;
        apply(saved);
        applying = false;
      }
      base = current();
      saving = "ready";
      panelReady = true;
      dropMissingTeams();
    })
    // Without the saved copy we must not overwrite it, so saving stays off for this page load.
    .catch((error) => {
      saving = "off";
      console.error(`[panel edits] saved copy not loaded: ${String(error)}`);
      toast.error("Panel edits not loaded from the preview", {
        description: "Changes made on this page will not be saved. Reload to try again.",
      });
    });
}

if (typeof window !== "undefined") start();
