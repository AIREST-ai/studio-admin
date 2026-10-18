"use client";

// T-289 (Fahad 128.3, 2026-10-15 01:31): the Inbox bar's sections (Conversations, Folders, Teams, Channels, Labels,
// Customer Path) start folded; the person opens them («الشخص هو من يفتحها ليس نحن»), and what they open or fold
// stays after leaving the page and coming back, and after a reload («عندما سوف أخرج وأعود أعادت كلها مفتوحة»).
// The choice is this browser's own view setting, kept in localStorage like the earlier Channels choice (T-141), which
// it replaces; the server render and the first client render show every section folded, then the saved choice.
import { useSyncExternalStore } from "react";

const KEY = "studio-inbox-bar-open";
// T-141's Channels-only memory; the default is now folded for every section, so its "folded" mark says nothing.
const OLD_CHANNELS_KEY = "studio-inbox-channels-folded";

const NONE: ReadonlySet<string> = new Set();
let opened: ReadonlySet<string> = NONE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const ids: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(ids)) opened = new Set(ids.filter((id): id is string => typeof id === "string"));
    window.localStorage.removeItem(OLD_CHANNELS_KEY);
  } catch {
    // blocked or damaged storage: every section folded, as on a first visit
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  load();
  return opened;
}

const serverSnapshot = () => NONE;

export function setInboxSectionOpen(id: string, open: boolean) {
  load();
  if (opened.has(id) === open) return;
  const next = new Set(opened);
  if (open) next.add(id);
  else next.delete(id);
  opened = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // blocked storage: the choice lasts until the page is reloaded
  }
  for (const listener of listeners) listener();
}

/** Whether the Inbox bar section `id` is open (folded unless the person opened it), and how to change it. */
export function useInboxSectionOpen(id: string): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, snapshot, serverSnapshot).has(id);
  return [open, (next) => setInboxSectionOpen(id, next)];
}
