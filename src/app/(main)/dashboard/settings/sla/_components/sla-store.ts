"use client";
// T-261 (buried 6, item 5 "افتحها"): the SLA policies of Settings > SLA, saved on the preview server
// (/api/sla-policies, its own file; not the shared lists), so an added, edited or deleted policy stays after a reload
// and the inbox's SLA badge follows it.
// Saves send the whole list with the revision it was loaded at. When another tab or device saved first (409), the
// change is applied again on the list it saved and sent once more, so neither edit is lost: two people editing
// different policies, or different fields of one policy, both keep their change.
import { create } from "zustand";

// biome-ignore lint/suspicious/noImportCycles: cw-data imports this module only after it has run (end of cw-data.ts).
import { appliedSlas, slaBadge } from "@/app/(main)/dashboard/chat/_components/cw-data";
// biome-ignore lint/suspicious/noImportCycles: cw-data imports this module only after it has run (end of cw-data.ts).
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { probeCeArea, rejectCeWrite } from "@/lib/chatwoot/settings-adapter";
import { linkedSession } from "@/lib/cw/persistence/client";
import { useCwShared } from "@/lib/cw/store";

import { initialSlas, type Sla, type WorkingHours } from "./sla-data";

const SLA_URL = "/api/sla-policies?space=main";

interface SlaState {
  policies: Sla[];
  rev: number;
  /** loading: reading the saved list · ready · error: the saved list could not be read, so saving is off. */
  status: "loading" | "ready" | "error";
}

export const useSlaPolicies = create<SlaState>(() => ({ policies: initialSlas, rev: 0, status: "loading" }));

const set = useSlaPolicies.setState;
const get = useSlaPolicies.getState;

let loading: Promise<void> | null = null;
let loadedMode: "preview" | "linked" | null = null;
function ensureLoaded(): Promise<void> {
  const modeNow: "preview" | "linked" = linkedSession() ? "linked" : "preview";
  if (loadedMode !== modeNow) {
    loadedMode = modeNow;
    loading = null;
  }
  if (modeNow === "linked") {
    loading ??= probeCeArea("sla_policies").then(() => {
      set({ policies: [], rev: 0, status: "ready" });
    });
    return loading;
  }
  loading ??= fetch(SLA_URL, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((saved: { rev: number; policies: Sla[] }) =>
      set({ policies: saved.policies, rev: saved.rev, status: "ready" }),
    )
    .catch(() => set({ status: "error" }));
  return loading;
}

/** Reads the saved list once per page load. */
export const loadSlaPolicies = () => (typeof window === "undefined" ? Promise.resolve() : ensureLoaded());

export type SlaChange =
  | { type: "add"; sla: Omit<Sla, "id"> }
  /** Only the fields the person changed, so a save on top of someone else's keeps their other fields. */
  | { type: "update"; id: number; patch: Partial<Omit<Sla, "id">> }
  | { type: "delete"; id: number };

class SlaChangeRefused extends Error {}

function applyChange(list: Sla[], change: SlaChange, newId: number): Sla[] {
  const taken = (name: string, id?: number) =>
    list.some((s) => s.id !== id && s.name.toLowerCase() === name.trim().toLowerCase());
  if (change.type === "add") {
    if (taken(change.sla.name)) throw new SlaChangeRefused("SLA name already exists");
    return [...list, { ...change.sla, id: newId }];
  }
  if (!list.some((s) => s.id === change.id))
    throw new SlaChangeRefused("This SLA was deleted in another tab or device");
  if (change.type === "delete") return list.filter((s) => s.id !== change.id);
  if (change.patch.name !== undefined && taken(change.patch.name, change.id))
    throw new SlaChangeRefused("SLA name already exists");
  return list.map((s) => (s.id === change.id ? { ...s, ...change.patch } : s));
}

// One save at a time, each from the revision the previous one returned.
let queue: Promise<unknown> = Promise.resolve();

/** Saves one change. Resolves when the preview server has it; rejects with the reason shown to the person. */
export function saveSlaChange(change: SlaChange): Promise<void> {
  const run = queue.then(async () => {
    if (linkedSession()) {
      await rejectCeWrite("sla_policies");
    }
    await ensureLoaded();
    if (get().status === "error")
      throw new Error("The saved SLA policies could not be read, so changes are not saved.");
    const newId = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      const policies = applyChange(get().policies, change, newId);
      let res: Response;
      try {
        res = await fetch(SLA_URL, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ baseRev: get().rev, policies }),
        });
      } catch {
        throw new Error("The preview server did not answer. The change was not saved.");
      }
      const body = await res.json().catch(() => null);
      if (res.ok) {
        set({ policies: body.policies, rev: body.rev });
        return;
      }
      // Saved elsewhere since this list was loaded: take that list and apply this change on it.
      if (res.status === 409 && body?.current) {
        set({ policies: body.current.policies, rev: body.current.rev });
        continue;
      }
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    throw new Error("The SLA policies keep changing in another tab. Try again.");
  });
  queue = run.catch(() => undefined);
  return run;
}

// --- The inbox badge -------------------------------------------------------------------------------------------

type InboxRow = { slug: string; config?: { businessHours?: WorkingHours } };

// The Business Hours Settings > Inboxes shows for an inbox that never saved its own (inbox-settings.tsx
// businessHoursFor): Sunday to Thursday 8 AM to 9 PM, Saturday 10 AM to 6 PM, Friday closed, Doha time.
const DEFAULT_HOURS: WorkingHours = {
  enabled: true,
  timezone: "Asia/Qatar",
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({
    day,
    open: day !== "Friday",
    allDay: false,
    from: day === "Saturday" ? "10:00" : "08:00",
    to: day === "Saturday" ? "18:00" : "21:00",
  })),
};

const hoursOf = (slug: string): WorkingHours =>
  (useCwShared.getState().inboxes as InboxRow[]).find((inbox) => inbox.slug === slug)?.config?.businessHours ??
  DEFAULT_HOURS;

let started = false;
// The conversations' "minutes ago" are counted back from when this page loaded.
let agesAt = 0;

function recount() {
  const { policies } = get();
  const now = Date.now();
  const { meta } = useCwStore.getState();
  let next: typeof meta | null = null;
  for (const [key, applied] of Object.entries(appliedSlas)) {
    const id = Number(key);
    const current = meta[id];
    if (!current) continue;
    const sla = slaBadge(applied, policies, hoursOf(applied.inbox), current.status === "resolved", now, agesAt);
    if (JSON.stringify(sla) === JSON.stringify(current.sla)) continue;
    next ??= { ...meta };
    next[id] = { ...current, sla };
  }
  if (next) useCwStore.setState({ meta: next });
}

/**
 * Keeps every SLA badge on the saved policies, the inbox's working hours and the clock: once the saved list is read,
 * whenever it or the inboxes change, and every minute (Chatwoot's SLA card label refreshes on a timer too).
 */
export function startSlaBadgeSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  agesAt = Date.now();
  void ensureLoaded().then(recount);
  useSlaPolicies.subscribe((state, prev) => {
    if (state.policies !== prev.policies) recount();
  });
  useCwShared.subscribe((state, prev) => {
    if (state.inboxes !== prev.inboxes) recount();
  });
  // A conversation resolved or reopened (recount writes only a changed badge, so this settles at once).
  useCwStore.subscribe((state, prev) => {
    if (state.meta !== prev.meta) recount();
  });
  window.setInterval(recount, 60_000);
}
