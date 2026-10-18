"use client";

// F-25 (F-24's note: the agent windows said "Agent added successfully" before the preview server answered): adding,
// editing and deleting an agent, and Manage team, change the shared lists and resolve only when the preview server saved
// them, as the macro editor (settings/macros/_components/macros-store.ts saveMacrosChange, F-24) and the Teams pages
// (teams-store.ts saveTeamsChange) do. When the save is refused the change is taken back off this page (so the table
// never shows an agent that is not saved, and a later save cannot send it) and the promise rejects with the reason, for
// "Not saved (reason)". A 409 is not undone: the page already took the saved lists and said so (lib/cw/store.ts).
import { CHANGED_ELSEWHERE, setCwList, useCwShared, whenListsSaved } from "@/lib/cw/store";

import { notSavedReason } from "../../settings/macros/_components/macros-store";
import { toAgent, type UserRow } from "./data";

export { notSavedReason };

/** An agent's change reaches the agents list, and a delete or Manage team also the teams and inboxes. */
const LISTS = ["agents", "teams", "inboxes"] as const;

async function saveAgentsChange(change: () => void, undo: () => void): Promise<void> {
  const saved = whenListsSaved(LISTS);
  change();
  try {
    await saved;
  } catch (error) {
    if (!(error instanceof Error && error.message === CHANGED_ELSEWHERE)) undo();
    throw error;
  }
}

/** True when the failure is the 409 the store has already announced. */
export const isChangedElsewhere = (error: unknown) => error instanceof Error && error.message === CHANGED_ELSEWHERE;

export function addAgent(row: UserRow): Promise<void> {
  return saveAgentsChange(
    () => setCwList("agents", (list) => [...list, toAgent(row)]),
    // Take back only this window's agent (the same number), not a newer change.
    () => setCwList("agents", (list) => list.filter((agent) => agent.id !== row.id)),
  );
}

export function updateAgent(next: UserRow, previous: UserRow): Promise<void> {
  return saveAgentsChange(
    () => setCwList("agents", (list) => list.map((agent) => (agent.id === next.id ? toAgent(next) : agent))),
    () => setCwList("agents", (list) => list.map((agent) => (agent.id === next.id ? toAgent(previous) : agent))),
  );
}

/** Puts `id` back at `at` in a list of ids, unless it is already there. */
function putBack(ids: number[], id: number, at: number): number[] {
  if (ids.includes(id)) return ids;
  const copy = [...ids];
  copy.splice(Math.min(Math.max(at, 0), copy.length), 0, id);
  return copy;
}

/** A deleted agent also leaves its teams and inboxes; if the delete is not saved, it returns to all of them. */
export function deleteAgent(agent: Pick<UserRow, "id">): Promise<void> {
  const { agents, teams, inboxes } = useCwShared.getState();
  const at = agents.findIndex((a) => a.id === agent.id);
  const gone = agents[at];
  const inTeams = teams
    .filter((t) => t.members.includes(agent.id))
    .map((t) => ({ id: t.id, at: t.members.indexOf(agent.id) }));
  const inInboxes = inboxes
    .filter((i) => i.agents.includes(agent.id))
    .map((i) => ({ id: i.id, at: i.agents.indexOf(agent.id) }));
  return saveAgentsChange(
    () => {
      setCwList("agents", (list) => list.filter((a) => a.id !== agent.id));
      setCwList("teams", (list) => list.map((t) => ({ ...t, members: t.members.filter((id) => id !== agent.id) })));
      setCwList("inboxes", (list) => list.map((i) => ({ ...i, agents: i.agents.filter((id) => id !== agent.id) })));
    },
    () => {
      if (gone)
        setCwList("agents", (list) => {
          if (list.some((a) => a.id === agent.id)) return list;
          const next = [...list];
          next.splice(Math.min(at, next.length), 0, gone);
          return next;
        });
      setCwList("teams", (list) =>
        list.map((t) => {
          const slot = inTeams.find((s) => s.id === t.id);
          return slot ? { ...t, members: putBack(t.members, agent.id, slot.at) } : t;
        }),
      );
      setCwList("inboxes", (list) =>
        list.map((i) => {
          const slot = inInboxes.find((s) => s.id === i.id);
          return slot ? { ...i, agents: putBack(i.agents, agent.id, slot.at) } : i;
        }),
      );
    },
  );
}

/** Manage team: puts the agent in exactly these teams (by name). */
export function setAgentTeams(agentId: number, teamNames: string[]): Promise<void> {
  const before = useCwShared.getState().teams;
  return saveAgentsChange(
    () =>
      setCwList("teams", (list) =>
        list.map((t) => {
          const member = t.members.includes(agentId);
          const wanted = teamNames.includes(t.name);
          if (member === wanted) return t;
          return { ...t, members: wanted ? [...t.members, agentId] : t.members.filter((id) => id !== agentId) };
        }),
      ),
    () =>
      setCwList("teams", (list) =>
        list.map((t) => {
          const was = before.find((b) => b.id === t.id)?.members.includes(agentId);
          if (was === undefined || was === t.members.includes(agentId)) return t;
          return { ...t, members: was ? [...t.members, agentId] : t.members.filter((id) => id !== agentId) };
        }),
      ),
  );
}
