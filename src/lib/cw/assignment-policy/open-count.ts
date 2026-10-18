// T-232 (item 78.1a): the capacity count, taken from the conversations as they are in Inbox. Chatwoot counts an agent's
// open conversations in the inbox (enterprise/app/services/enterprise/auto_assignment/capacity_service.rb:
// user.assigned_conversations.where(inbox: inbox, status: :open).count): every one the agent holds, assigned by hand or
// automatically; other inboxes, teams and pending/snoozed/resolved conversations are not counted.
import type { TrialWorkload } from "./engine";

export interface HeldConversation {
  inboxId: number | null;
  assigneeId: number | null;
  status: string;
}

/** Open conversations per inbox and agent, the shape the trial's workload takes. */
export function openCounts(conversations: HeldConversation[]): TrialWorkload["open"] {
  const open: TrialWorkload["open"] = {};
  for (const c of conversations) {
    if (c.status !== "open" || c.assigneeId === null || c.inboxId === null) continue;
    open[c.inboxId] ??= {};
    open[c.inboxId][c.assigneeId] = (open[c.inboxId][c.assigneeId] ?? 0) + 1;
  }
  return open;
}
