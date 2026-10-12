"use client";
// F159 settings-b: macros shared by the list and the editor pages, so a macro saved in the editor shows in the list
// after navigation (mock only, resets on full page reload).
// F161: backed by the shared list (src/lib/cw/store.ts), so the Conversations "Macros" menu runs the same macros.
import * as React from "react";

import { cwListStore } from "@/lib/cw/store";

export const macrosStore = cwListStore("macros");

export function useMacros() {
  return React.useSyncExternalStore(macrosStore.subscribe, macrosStore.get, () => macrosStore.seed);
}
