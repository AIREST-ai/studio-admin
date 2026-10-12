"use client";
// F159 settings-b: in-memory macros shared by the list and the editor pages, so a macro saved in the editor
// shows in the list after navigation (mock only, resets on full page reload).
import * as React from "react";

import { type Macro, macros as seed } from "./data";

let current: Macro[] = seed.map((m) => ({ ...m, actions: [...m.actions] }));
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const macrosStore = {
  get: () => current,
  find: (id: number) => current.find((m) => m.id === id),
  save(macro: Macro) {
    current = current.some((m) => m.id === macro.id)
      ? current.map((m) => (m.id === macro.id ? macro : m))
      : [...current, macro];
    emit();
  },
  remove(id: number) {
    current = current.filter((m) => m.id !== id);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useMacros() {
  return React.useSyncExternalStore(macrosStore.subscribe, macrosStore.get, () => seed);
}
