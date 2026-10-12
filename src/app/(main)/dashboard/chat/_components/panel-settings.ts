"use client";

// F159 panel: Chatwoot keeps the contact panel layout in the agent's UI settings (composables/useUISettings.js):
// which accordion sections are open, the order of the sections, the order of attribute rows and "show all
// attributes". No backend here, so they live in this browser (localStorage) and are loaded after hydration.
import { useEffect } from "react";

import { create } from "zustand";

const STORAGE_KEY = "f159-cw-ui-settings";

type Settings = Record<string, unknown>;

const usePanelSettingsStore = create<{ settings: Settings; loaded: boolean }>(() => ({ settings: {}, loaded: false }));

function persist(settings: Settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private window or blocked storage: the layout still works for this visit.
  }
}

export function useHydratePanelSettings() {
  useEffect(() => {
    if (usePanelSettingsStore.getState().loaded) return;
    let saved: Settings = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Settings;
    } catch {
      saved = {};
    }
    usePanelSettingsStore.setState((state) => ({ settings: { ...saved, ...state.settings }, loaded: true }));
  }, []);
}

export function usePanelSetting<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = usePanelSettingsStore((s) => s.settings[key]) as T | undefined;
  const update = (next: T) => {
    const settings = { ...usePanelSettingsStore.getState().settings, [key]: next };
    usePanelSettingsStore.setState({ settings });
    persist(settings);
  };
  return [value ?? fallback, update];
}

// Saved order first, new keys appended in their default order (useUISettings.useConversationSidebarItemsOrder).
export function applyOrder<T>(items: T[], keyOf: (item: T) => string, savedOrder: string[]): T[] {
  if (!savedOrder.length) return items;
  const known = savedOrder.filter((key) => items.some((item) => keyOf(item) === key));
  const ordered = known.map((key) => items.find((item) => keyOf(item) === key) as T);
  return [...ordered, ...items.filter((item) => !known.includes(keyOf(item)))];
}

export function moveKey(order: string[], from: string, to: string): string[] {
  if (from === to) return order;
  const next = order.filter((key) => key !== from);
  const index = next.indexOf(to);
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  next.splice(fromIndex < toIndex ? index + 1 : index, 0, from);
  return next;
}
