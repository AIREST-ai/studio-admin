"use client";
// F159 settings-b: macros shared by the list and the editor pages, so a macro saved in the editor shows in the list
// after navigation (mock only, resets on full page reload).
// F161: backed by the shared list (src/lib/cw/store.ts), so the Conversations "Macros" menu runs the same macros.
import * as React from "react";

import { CHANGED_ELSEWHERE, cwListStore, whenListsSaved } from "@/lib/cw/store";

export const macrosStore = cwListStore("macros");

export function useMacros() {
  return React.useSyncExternalStore(macrosStore.subscribe, macrosStore.get, () => macrosStore.seed);
}

/**
 * F-24 (F-19's note: the editor said "Macro added successfully" before the preview server answered): makes a change to
 * the shared macros and resolves only when the preview server saved it, as the Teams pages do (teams-store.ts
 * saveTeamsChange). When it was not saved it rejects with the reason, after `undo` took the change back off this page
 * (so the list never shows a macro that is not saved, and a later save cannot send it). A 409 is not undone: the page
 * already took the saved macros and said so (lib/cw/store.ts changedElsewhere).
 */
export async function saveMacrosChange(change: () => void, undo: () => void): Promise<void> {
  const saved = whenListsSaved(["macros"]);
  change();
  try {
    await saved;
  } catch (error) {
    if (!(error instanceof Error && error.message === CHANGED_ELSEWHERE)) undo();
    throw error;
  }
}

/** The reason a save failed, for "Not saved (reason)". */
export function notSavedReason(error: unknown): string {
  if (error instanceof Error && error.message === CHANGED_ELSEWHERE) return "changed in another tab or device";
  return error instanceof Error ? error.message : String(error);
}
