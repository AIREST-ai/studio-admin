"use client";
// F161 settings-a: one teams list for the Teams list, create wizard and detail page.
// F161 foundation: backed by the shared teams (src/lib/cw/store.ts), so the sidebar Teams list and Conversations see
// a created, edited or deleted team.
import { toast } from "sonner";

import { CHANGED_ELSEWHERE, cwListStore, setCwList, whenListsSaved } from "@/lib/cw/store";

import { useListStore } from "../../_components/list-store";
import type { Team } from "./data";

export const teamsStore = cwListStore("teams");
export const useTeams = () => useListStore(teamsStore);

/**
 * F-6B (sim2 problem 6, any wizard like the inbox one): makes a change to the shared teams and resolves when the preview
 * server saved it; rejects with the reason when it did not (a 409 included), so a page says "ready" or "updated" only
 * after the save.
 */
export async function saveTeamsChange(change: () => void, undo?: () => void): Promise<void> {
  const saved = whenListsSaved(["teams"]);
  change();
  try {
    await saved;
  } catch (error) {
    // F-25: with `undo`, a change the server did not save is taken back off this page, so the list never shows a team
    // that is not saved and a later save cannot send it. A 409 is not undone: the page already took the saved teams.
    if (undo && !(error instanceof Error && error.message === CHANGED_ELSEWHERE)) undo();
    throw error;
  }
}

/**
 * F-25 (F-24's note: Teams said "Team deleted successfully" before the preview server answered): deletes a team and
 * resolves when the server saved the deletion. When it did not, the team comes back to its place in the list and the
 * promise rejects with the reason, for "Not saved (reason)".
 */
export function deleteTeam(team: Team): Promise<void> {
  const index = teamsStore.get().findIndex((t) => t.id === team.id);
  return saveTeamsChange(
    () => teamsStore.remove(team.id),
    () =>
      setCwList("teams", (list) => {
        if (list.some((t) => t.id === team.id)) return list;
        const next = [...list];
        next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, team);
        return next;
      }),
  );
}

/**
 * F-25: the toasts of a team deletion, for the Teams list and the team's own page. "Team deleted successfully." only
 * after the preview server saved the deletion; until then "Deleting “name”…"; when it was not saved the team is back in
 * the list and the toast says "Not saved (reason)". Resolves true when the deletion was saved.
 */
export async function deleteTeamWithNotice(team: Team): Promise<boolean> {
  const toastId = `team-delete-${team.id}-${Date.now()}`;
  toast.loading(`Deleting “${team.name}”…`, { id: toastId });
  try {
    await deleteTeam(team);
  } catch (error) {
    // A 409 already said "Not saved: changed in another tab or device" (lib/cw/store.ts).
    if (error instanceof Error && error.message === CHANGED_ELSEWHERE) toast.dismiss(toastId);
    else
      toast.error(`Not saved (${error instanceof Error ? error.message : String(error)})`, {
        id: toastId,
        description: `“${team.name}” was not deleted. It is back in the list.`,
      });
    return false;
  }
  toast.success("Team deleted successfully.", { id: toastId });
  return true;
}
