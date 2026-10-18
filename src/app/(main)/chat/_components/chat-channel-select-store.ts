"use client";

import { useSyncExternalStore } from "react";

// T-97 (Fahad 2026-10-13 20:01): the channel picker above the conversations shows every connected channel (the live
// inboxes, src/lib/cw/store.ts) with a check mark each; the list shows only the checked ones. Ids are inbox slugs, the
// same id a conversation carries in `channel`. null = all channels, so an inbox connected later shows by itself.
// Kept in this browser (localStorage), so the choice survives a reload.

const KEY = "studio.chat.channel-picker.v1";

let selected: string[] | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function load(): string[] | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? value : null;
  } catch {
    return null;
  }
}

function getSnapshot(): string[] | null {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    selected = load();
  }
  return selected;
}

const getServerSnapshot = (): string[] | null => null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: string[] | null) {
  selected = next;
  loaded = true;
  try {
    if (next === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the choice still holds for this page
  }
  for (const listener of listeners) listener();
}

/** The checked channels that still exist; null when all are shown (nothing checked, or every channel checked). */
export function pickedChannels(choice: string[] | null, channelIds: string[]): string[] | null {
  if (choice === null) return null;
  const kept = channelIds.filter((id) => choice.includes(id));
  return kept.length === 0 || kept.length === channelIds.length ? null : kept;
}

/** The raw saved choice (null = all channels). */
export function useChannelChoice(): string[] | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Check or uncheck one channel. Unchecking the last checked channel goes back to all channels. */
export function toggleChannel(id: string, channelIds: string[]): void {
  const current = pickedChannels(getSnapshot(), channelIds) ?? channelIds;
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  emit(pickedChannels(next, channelIds));
}

/** "All channels": show every channel. */
export function showAllChannels(): void {
  emit(null);
}
