"use client";

// F161: one module store for the campaign lists, so they survive moving between the campaign pages and the report.
// M129-C (Fahad 129.3 «الحفظ»: campaigns stay after a reload, not page memory only): the lists are also saved in the
// preview's shared save (lib/cw/persistence, section "campaigns", file-store.ts validateCampaigns), read once per page
// load before anything is written. A failed load or save says so; nothing claims a save that failed.
// F-3 (was: a 409 read the saved copy again, kept this tab's changes and saved again, which could bring back a campaign
// deleted in the other tab): a save refused because another tab saved first (409) writes nothing more. If this tab's
// changes are already in the saved copy (both tabs' clocks moved the same send on) the saved copy is shown; otherwise
// the page says it changed elsewhere, to reload, and sends nothing until it is reloaded.
import * as React from "react";

import { toast } from "sonner";
import { create } from "zustand";

import { loadPreviewSection, SectionConflict, savePreviewSection } from "@/lib/cw/persistence/client";

import { type LiveChatCampaign, liveChatCampaigns, type OneOffCampaign, smsCampaigns, whatsappCampaigns } from "./data";

export interface CampaignLists {
  live: LiveChatCampaign[];
  sms: OneOffCampaign[];
  whatsapp: OneOffCampaign[];
  instagram: OneOffCampaign[];
  messenger: OneOffCampaign[];
}
export type CampaignListKey = keyof CampaignLists;
const LIST_KEYS: CampaignListKey[] = ["live", "sms", "whatsapp", "instagram", "messenger"];

const seed: CampaignLists = {
  live: liveChatCampaigns,
  sms: smsCampaigns,
  whatsapp: whatsappCampaigns,
  instagram: [],
  messenger: [],
};

export const useCampaignsStore = create<CampaignLists>(() => ({ ...seed }));

interface SaveState {
  /** loading: the saved campaigns are being read · ready · failed: they could not be read, so nothing is saved. */
  phase: "idle" | "loading" | "ready" | "failed";
  error: string | null;
  savedAt: string | null;
}
export const useCampaignsSave = create<SaveState>(() => ({ phase: "idle", error: null, savedAt: null }));

type Updater<T> = T | ((previous: T) => T);

export function setCampaignList<K extends CampaignListKey>(key: K, next: Updater<CampaignLists[K]>) {
  useCampaignsStore.setState((state) => ({
    [key]: typeof next === "function" ? (next as (previous: CampaignLists[K]) => CampaignLists[K])(state[key]) : next,
  }));
}

/** Drop-in for `React.useState(list)`: reads and writes the shared campaign list. */
export function useCampaignList<K extends CampaignListKey>(
  key: K,
): [CampaignLists[K], (next: Updater<CampaignLists[K]>) => void] {
  React.useEffect(() => startSaving(), []);
  const list = useCampaignsStore((state) => state[key]);
  return [list, (next) => setCampaignList(key, next)];
}

/** Every one-off campaign, any channel. */
export function allOneOff(
  state: CampaignLists = useCampaignsStore.getState(),
): { list: Exclude<CampaignListKey, "live">; campaign: OneOffCampaign }[] {
  return (["sms", "whatsapp", "instagram", "messenger"] as const).flatMap((list) =>
    state[list].map((campaign) => ({ list, campaign })),
  );
}

// ---------- saving ----------

const SECTION = "campaigns";
type Item = Record<string, unknown> & { list: CampaignListKey; id: number };
const itemKey = (item: { list: string; id: number }) => `${item.list}:${item.id}`;

function toItems(state: CampaignLists): Item[] {
  return LIST_KEYS.flatMap((list) => (state[list] as { id: number }[]).map((c) => ({ ...c, list }) as Item));
}

function fromItems(items: Item[]): CampaignLists {
  const lists: CampaignLists = { live: [], sms: [], whatsapp: [], instagram: [], messenger: [] };
  for (const item of items) {
    if (!LIST_KEYS.includes(item.list)) continue;
    const { list, ...campaign } = item;
    (lists[list] as unknown[]).push(campaign);
  }
  return lists;
}

let saved = new Map<string, string>(toItems(seed).map((i) => [itemKey(i), JSON.stringify(i)]));
let rev = 0;
let saving = false;
let again = false;
let applying = false;

/** Reads the saved copy and shows it, except the campaigns this tab changed (or deleted) since its last read or save. */
async function reloadKeepingOwn(): Promise<boolean> {
  const before = saved;
  const section = await loadPreviewSection<Item>(SECTION);
  rev = section.rev;
  const savedItems = section.items ?? toItems(seed);
  saved = new Map(savedItems.map((i) => [itemKey(i), JSON.stringify(i)]));
  const mine = toItems(useCampaignsStore.getState());
  const mineKeys = new Set(mine.map(itemKey));
  const changed = mine.filter((i) => before.get(itemKey(i)) !== JSON.stringify(i));
  const deleted = [...before.keys()].filter((k) => !mineKeys.has(k));
  const merged = new Map(savedItems.map((i) => [itemKey(i), i]));
  for (const k of deleted) merged.delete(k);
  for (const i of changed) merged.set(itemKey(i), i);
  applying = true;
  try {
    useCampaignsStore.setState(fromItems([...merged.values()]));
  } finally {
    applying = false;
  }
  return changed.length > 0 || deleted.length > 0;
}

/** F-3: set after a 409 that this tab's changes are not part of; the page is out of date until it is reloaded. */
let stale = false;
const CHANGED_ELSEWHERE =
  "Campaigns were changed in another tab or device. Reload the page to see the latest version; this change was not saved.";

/** After a 409: true (and the saved copy shown) when every change this tab made is already in the saved copy. */
async function alreadySaved(): Promise<boolean> {
  const section = await loadPreviewSection<Item>(SECTION);
  const savedItems = section.items ?? toItems(seed);
  const onDisk = new Map(savedItems.map((i) => [itemKey(i), JSON.stringify(i)]));
  const mine = toItems(useCampaignsStore.getState());
  const mineKeys = new Set(mine.map(itemKey));
  const changed = mine.filter((i) => saved.get(itemKey(i)) !== JSON.stringify(i));
  const deleted = [...saved.keys()].filter((k) => !mineKeys.has(k));
  const same =
    changed.every((i) => onDisk.get(itemKey(i)) === JSON.stringify(i)) && deleted.every((k) => !onDisk.has(k));
  if (!same) return false;
  rev = section.rev;
  saved = onDisk;
  applying = true;
  try {
    useCampaignsStore.setState(fromItems(savedItems));
  } finally {
    applying = false;
  }
  return true;
}

async function saveNow() {
  if (stale) throw new SectionConflict(CHANGED_ELSEWHERE, rev);
  const items = toItems(useCampaignsStore.getState());
  try {
    const result = await savePreviewSection(SECTION, items, rev, true);
    rev = result.rev;
    saved = new Map(items.map((i) => [itemKey(i), JSON.stringify(i)]));
    useCampaignsSave.setState({ savedAt: result.savedAt, error: null });
  } catch (error) {
    if (!(error instanceof SectionConflict)) throw error;
    if (await alreadySaved()) return;
    stale = true;
    throw new SectionConflict(CHANGED_ELSEWHERE, error.rev);
  }
}

function save() {
  if (useCampaignsSave.getState().phase !== "ready") return;
  if (saving) {
    again = true;
    return;
  }
  saving = true;
  saveNow()
    .catch((error: Error) => {
      useCampaignsSave.setState({ error: error.message });
      if (error instanceof SectionConflict) {
        console.warn(`[campaigns] not saved: ${error.message}`); // expected and shown to the user: not a page error
        // The page may already have said "saved" for this change; take that back before saying it was not.
        toast.dismiss();
        toast.error("Not saved: campaigns changed in another tab or device", {
          id: "campaigns-not-saved",
          description: "Reload the page to see the latest version, then make the change again.",
          duration: Number.POSITIVE_INFINITY,
          action: { label: "Reload", onClick: () => window.location.reload() },
        });
        return;
      }
      console.error(`[campaigns] not saved: ${error.message}`);
      toast.error("Campaign changes not saved in the preview", {
        id: "campaigns-not-saved",
        description: `${error.message}. They show here until the page is reloaded.`,
      });
    })
    .finally(() => {
      saving = false;
      if (again) {
        again = false;
        save();
      }
    });
}

/** Reads the saved campaigns once per page load; from then on every change is saved. */
export function startSaving() {
  if (typeof window === "undefined" || useCampaignsSave.getState().phase !== "idle") return;
  useCampaignsSave.setState({ phase: "loading" });
  useCampaignsStore.subscribe((state, before) => {
    if (state !== before && !applying) save();
  });
  reloadKeepingOwn()
    .then((own) => {
      useCampaignsSave.setState({ phase: "ready" });
      if (own) save();
    })
    .catch((error: Error) => {
      useCampaignsSave.setState({ phase: "failed", error: error.message });
      console.error(`[campaigns] saved campaigns not loaded: ${error.message}`);
      toast.error("Saved campaigns could not be loaded", {
        id: "campaigns-not-loaded",
        description: `${error.message}. Changes on this page are not saved.`,
      });
    });
}

/** True once the saved campaigns were read (or could not be read). */
export function useCampaignsReady(): boolean {
  React.useEffect(() => startSaving(), []);
  return useCampaignsSave((s) => s.phase === "ready" || s.phase === "failed");
}
