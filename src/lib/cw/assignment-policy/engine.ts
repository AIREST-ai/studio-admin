// T-70: trial auto assignment. A dry run of Chatwoot's assignment v2 (AutoAssignment::AssignmentService with the
// enterprise capacity checks) over the app's existing policies, inboxes, teams and agents. It only returns who would
// get which conversation and why; it never writes to Conversations or any store. Pure: same input, same result.
//
// Rules, as in Chatwoot (app/services/auto_assignment/*, enterprise/app/services/enterprise/auto_assignment/*):
// - The inbox needs auto assignment on and an active assignment policy (this trial skips inboxes without a policy
//   instead of using Chatwoot's built-in defaults).
// - Open, unassigned conversations only. Skip those idle longer than the policy's stale age, then the capacity
//   policy's excluded labels and age (the first capacity policy with a limit for the inbox).
// - Order: earliest created first, or longest waiting (oldest last activity, then oldest created).
// - Agents: online inbox members; if the conversation has a team, the team must allow auto assignment and only its
//   members count; then the fair distribution limit (assignments in the window) and the agent's capacity limit for
//   the inbox (open conversations).
// - Pick: round robin (a queue in inbox member order; the picked agent moves to the back) or balanced (fewest open
//   conversations in the inbox, ties to the earlier member).
// Assumes the advanced assignment feature is on, so capacity and balanced apply.

export interface TrialAgent {
  id: number;
  availability: "online" | "busy" | "offline";
}
export interface TrialInbox {
  id: number;
  agents: number[];
  autoAssign: boolean;
}
export interface TrialTeam {
  id: number;
  members: number[];
  autoAssign: boolean;
}
export interface TrialAssignmentPolicy {
  id: number;
  active: boolean;
  order: "round_robin" | "balanced";
  priority: "earliest_created" | "longest_waiting";
  /** Fair distribution: at most this many assignments per agent within `window` minutes. */
  maxPerAgent: number;
  window: number;
  /** Skip conversations idle longer than this many days (0: no limit). */
  staleDays: number;
  inboxes: number[];
}
export interface TrialCapacityPolicy {
  id: number;
  limits: { inbox: number; max: number }[];
  labels: string[];
  /** Hours (0: no limit). */
  excludeOlderThan: number;
  agents: number[];
}
export interface TrialConversation {
  id: string;
  inboxId: number;
  teamId: number | null;
  labels: string[];
  status: "open" | "pending" | "resolved";
  assigneeId: number | null;
  createdHoursAgo: number;
  lastActivityHoursAgo: number;
}
/** Agent workload before the run: open conversations per inbox, and minutes ago of each recent assignment. */
export interface TrialWorkload {
  open: Record<number, Record<number, number>>;
  recent: Record<number, Record<number, number[]>>;
}
export interface TrialInput {
  now: string;
  conversations: TrialConversation[];
  workload: TrialWorkload;
  agents: TrialAgent[];
  inboxes: TrialInbox[];
  teams: TrialTeam[];
  assignmentPolicies: TrialAssignmentPolicy[];
  capacityPolicies: TrialCapacityPolicy[];
}

export type TrialReason =
  | "assigned"
  | "unknown_inbox"
  | "inbox_auto_assign_off"
  | "no_policy"
  | "policy_paused"
  | "not_open"
  | "already_assigned"
  | "excluded_stale"
  | "excluded_label"
  | "excluded_age_capacity"
  | "team_auto_assign_off"
  | "no_agent";

export type AgentDrop = "offline" | "not_in_team" | "fair_limit" | "at_capacity";

export interface TrialRow {
  conversationId: string;
  inboxId: number;
  outcome: "assigned" | "skipped";
  reason: TrialReason;
  agentId: number | null;
  policyId: number | null;
  /** 1-based position in the run (assigned or tried), null when the conversation was filtered out first. */
  step: number | null;
  /** Inbox members not chosen for this conversation, with why. */
  dropped: { agentId: number; why: AgentDrop }[];
}

export interface TrialResult {
  now: string;
  rows: TrialRow[];
  assigned: number;
  skipped: number;
}

export const reasonText: Record<TrialReason, string> = {
  assigned: "Assigned",
  unknown_inbox: "Inbox not found",
  inbox_auto_assign_off: "Inbox auto assignment is off",
  no_policy: "Inbox has no assignment policy",
  policy_paused: "Assignment policy is inactive",
  not_open: "Conversation is not open",
  already_assigned: "Already has an assignee",
  excluded_stale: "Idle longer than the policy allows",
  excluded_label: "Label excluded by the capacity policy",
  excluded_age_capacity: "Older than the capacity policy allows",
  team_auto_assign_off: "Team does not allow auto assignment",
  no_agent: "No agent available",
};

export const dropText: Record<AgentDrop, string> = {
  offline: "not online",
  not_in_team: "not in the team",
  fair_limit: "fair distribution limit reached",
  at_capacity: "at capacity for this inbox",
};

/** Why a whole inbox is not distributed, or null. */
function inboxGate(inbox: TrialInbox | undefined, policy: TrialAssignmentPolicy | undefined): TrialReason | null {
  if (!inbox) return "unknown_inbox";
  if (!inbox.autoAssign) return "inbox_auto_assign_off";
  if (!policy) return "no_policy";
  if (!policy.active) return "policy_paused";
  return null;
}

/** Why a conversation is left out before agents are picked, or null. */
function conversationGate(
  c: TrialConversation,
  policy: TrialAssignmentPolicy,
  exclusion: TrialCapacityPolicy | undefined,
): TrialReason | null {
  if (c.status !== "open") return "not_open";
  if (c.assigneeId !== null) return "already_assigned";
  if (policy.staleDays > 0 && c.lastActivityHoursAgo > policy.staleDays * 24) return "excluded_stale";
  if (exclusion?.labels.some((l) => c.labels.includes(l))) return "excluded_label";
  if (exclusion && exclusion.excludeOlderThan > 0 && c.lastActivityHoursAgo > exclusion.excludeOlderThan)
    return "excluded_age_capacity";
  return null;
}

export function runTrialAssignment(input: TrialInput): TrialResult {
  const agentById = new Map(input.agents.map((a) => [a.id, a]));
  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const rows = new Map<string, TrialRow>();
  const row = (c: TrialConversation, reason: TrialReason, policyId: number | null = null): TrialRow => ({
    conversationId: c.id,
    inboxId: c.inboxId,
    outcome: reason === "assigned" ? "assigned" : "skipped",
    reason,
    agentId: null,
    policyId,
    step: null,
    dropped: [],
  });
  // Working copies: the run adds its own assignments to the open counts and the recent list.
  const open = (inboxId: number, agentId: number) => input.workload.open[inboxId]?.[agentId] ?? 0;
  const added = new Map<string, number>();
  const key = (inboxId: number, agentId: number) => `${inboxId}:${agentId}`;
  const openNow = (inboxId: number, agentId: number) =>
    open(inboxId, agentId) + (added.get(key(inboxId, agentId)) ?? 0);
  const recentNow = (inboxId: number, agentId: number, windowMinutes: number) =>
    (input.workload.recent[inboxId]?.[agentId] ?? []).filter((m) => m < windowMinutes).length +
    (added.get(key(inboxId, agentId)) ?? 0);

  let step = 0;
  const inboxIds = [...new Set(input.conversations.map((c) => c.inboxId))].sort((a, b) => a - b);
  for (const inboxId of inboxIds) {
    const inConversations = input.conversations.filter((c) => c.inboxId === inboxId);
    const inbox = input.inboxes.find((i) => i.id === inboxId);
    const policy = input.assignmentPolicies.find((p) => p.inboxes.includes(inboxId));
    const gate = inboxGate(inbox, policy);
    if (gate || !inbox || !policy) {
      for (const c of inConversations) rows.set(c.id, row(c, gate ?? "unknown_inbox", policy?.id ?? null));
      continue;
    }

    const capacityFor = (agentId: number) => input.capacityPolicies.find((p) => p.agents.includes(agentId));
    const exclusion = input.capacityPolicies.find((p) => p.limits.some((l) => l.inbox === inboxId));
    const queue: TrialConversation[] = [];
    for (const c of inConversations) {
      const why = conversationGate(c, policy, exclusion);
      if (why) rows.set(c.id, row(c, why, policy.id));
      else queue.push(c);
    }
    // Hours ago: a larger number is older, so oldest first means descending.
    queue.sort((a, b) =>
      policy.priority === "longest_waiting"
        ? b.lastActivityHoursAgo - a.lastActivityHoursAgo || b.createdHoursAgo - a.createdHoursAgo
        : b.createdHoursAgo - a.createdHoursAgo,
    );

    let rotation = [...inbox.agents];
    for (const c of queue) {
      step += 1;
      const r = row(c, "assigned", policy.id);
      r.step = step;
      const team = c.teamId !== null ? teamById.get(c.teamId) : undefined;
      if (c.teamId !== null && !team?.autoAssign) {
        r.outcome = "skipped";
        r.reason = "team_auto_assign_off";
        rows.set(c.id, r);
        continue;
      }
      const allowed: number[] = [];
      for (const agentId of inbox.agents) {
        const agent = agentById.get(agentId);
        let why: AgentDrop | null = null;
        if (agent?.availability !== "online") why = "offline";
        else if (team && !team.members.includes(agentId)) why = "not_in_team";
        else if (recentNow(inboxId, agentId, policy.window) >= policy.maxPerAgent) why = "fair_limit";
        else {
          const limit = capacityFor(agentId)?.limits.find((l) => l.inbox === inboxId);
          if (limit && openNow(inboxId, agentId) >= limit.max) why = "at_capacity";
        }
        if (why) r.dropped.push({ agentId, why });
        else allowed.push(agentId);
      }
      let picked: number | null = null;
      if (allowed.length > 0) {
        if (policy.order === "balanced") {
          picked = allowed.reduce((best, id) => (openNow(inboxId, id) < openNow(inboxId, best) ? id : best));
        } else {
          picked = rotation.find((id) => allowed.includes(id)) ?? null;
          if (picked !== null) rotation = [...rotation.filter((id) => id !== picked), picked];
        }
      }
      if (picked === null) {
        r.outcome = "skipped";
        r.reason = "no_agent";
      } else {
        r.agentId = picked;
        added.set(key(inboxId, picked), (added.get(key(inboxId, picked)) ?? 0) + 1);
      }
      rows.set(c.id, r);
    }
  }

  // Rows in run order: tried conversations by step, then the filtered ones in their input order.
  const list = input.conversations.map((c) => rows.get(c.id) as TrialRow);
  list.sort((a, b) => (a.step ?? Number.MAX_SAFE_INTEGER) - (b.step ?? Number.MAX_SAFE_INTEGER));
  const assigned = list.filter((r) => r.outcome === "assigned").length;
  return { now: input.now, rows: list, assigned, skipped: list.length - assigned };
}
