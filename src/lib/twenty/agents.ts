// F-8 (sim3 11.1c: every Assignee list of the task windows offered only Twenty's users, not the site's agents).
// The Assignee lists show the site's agents (Settings > Agents, the shared list of lib/cw/store.ts) first, then the
// Twenty users who are not one of them. Twenty assigns a task only to one of its workspace members (Task.assignee is a
// relation to WorkspaceMember: https://docs.twenty.com/developers/extend/capabilities/apis), and the site's agents are
// not Twenty users, so a task given to a site agent keeps the agent's name in the task's own Text field
// "Studio agent" (AGENT_FIELD, added to Twenty's Task by lib/twenty/server.ts the first time it is needed). When a
// Twenty user has the agent's email, the task is also assigned to that user in Twenty. The windows say which happened.
// Plain functions with no browser or server code, so both the pages and lib/twenty/server.ts can import them.
import type { Agent } from "@/lib/cw/data";

import type { BoardMember, BoardTask } from "./server";

export const AGENT_FIELD = "studioAgent";
// F-16: shown as "Agent" (the field already made in the tasks server keeps its first label, "Studio agent"; the
// page overrides it in lib/twenty/server.ts, so the server itself is not changed).
export const AGENT_FIELD_LABEL = "Agent";

export type SiteAgent = Pick<Agent, "id" | "name" | "email">;
type TaskLike = Pick<BoardTask, "assigneeId" | "custom">;

/** One entry of an Assignee list. `value`: "agent:<id>" (a site agent) or "member:<uuid>" (a Twenty user). */
export interface AssigneeChoice {
  value: string;
  label: string;
}

const lower = (text: string | undefined) => (text ?? "").trim().toLowerCase();

/** The Twenty user with the same email as the site agent, if there is one. */
export function memberFor(agent: SiteAgent, members: BoardMember[]): BoardMember | undefined {
  const email = lower(agent.email);
  return email ? members.find((member) => lower(member.email) === email) : undefined;
}

/** The two groups of an Assignee list: the site's agents, then the Twenty users who are not one of them. */
export function assigneeChoices(agents: SiteAgent[], members: BoardMember[]) {
  const matched = new Set(agents.flatMap((agent) => memberFor(agent, members)?.id ?? []));
  return {
    agents: agents.map((agent): AssigneeChoice => ({ value: `agent:${agent.id}`, label: agent.name })),
    members: members
      .filter((member) => !matched.has(member.id))
      .map((member): AssigneeChoice => ({ value: `member:${member.id}`, label: member.name })),
  };
}

/** The site agent a task names in its "Studio agent" field ("" when none). */
export const agentNameOf = (task: TaskLike) => String(task.custom?.[AGENT_FIELD] ?? "").trim();

/**
 * The Assignee value of a task: its site agent when it names one ("agent-name:<name>" when that agent is no longer in
 * Settings > Agents), else its Twenty user, else "" (unassigned).
 */
export function assigneeValueOf(task: TaskLike, agents: SiteAgent[], members: BoardMember[]): string {
  const name = agentNameOf(task);
  if (name) {
    const agent = agents.find((each) => lower(each.name) === lower(name));
    return agent ? `agent:${agent.id}` : `agent-name:${name}`;
  }
  if (!task.assigneeId) return "";
  const agent = agents.find((each) => memberFor(each, members)?.id === task.assigneeId);
  return agent ? `agent:${agent.id}` : `member:${task.assigneeId}`;
}

/** A value from an address or an older page (a bare Twenty user id) in the form above. */
export const normalizeAssignee = (value: string) => (/^[0-9a-f-]{36}$/i.test(value) ? `member:${value}` : value);

/**
 * What a task keeps for an Assignee value: Twenty's own assignee (a Twenty user or null) and the "Studio agent" field,
 * with one honest line about it for the window (null when there is nothing to say).
 */
export function assigneeFields(
  value: string,
  agents: SiteAgent[],
  members: BoardMember[],
): { assigneeId: string | null; agentName: string; note: string | null } {
  const choice = normalizeAssignee(value);
  if (choice.startsWith("agent:")) {
    const agent = agents.find((each) => `agent:${each.id}` === choice);
    if (!agent) return { assigneeId: null, agentName: "", note: "This agent is no longer in Settings > Agents." };
    const member = memberFor(agent, members);
    return {
      assigneeId: member?.id ?? null,
      agentName: agent.name,
      note: member
        ? `Assigned to ${member.name} on the tasks server (same email), and named in the task's “${AGENT_FIELD_LABEL}” field.`
        : `${agent.name} is not a user of the tasks server, so its own Assignee stays empty. The task names ${agent.name} in its “${AGENT_FIELD_LABEL}” field.`,
    };
  }
  if (choice.startsWith("agent-name:")) {
    const name = choice.slice("agent-name:".length);
    return {
      assigneeId: null,
      agentName: name,
      note: `${name} is no longer in Settings > Agents; the task still names ${name} in its “${AGENT_FIELD_LABEL}” field.`,
    };
  }
  if (choice.startsWith("member:")) return { assigneeId: choice.slice("member:".length), agentName: "", note: null };
  return { assigneeId: null, agentName: "", note: null };
}

/** The name an Assignee line shows for a task (its site agent first), or null when unassigned. */
export function assigneeLabel(task: TaskLike, members: BoardMember[]): string | null {
  return agentNameOf(task) || members.find((member) => member.id === task.assigneeId)?.name || null;
}
