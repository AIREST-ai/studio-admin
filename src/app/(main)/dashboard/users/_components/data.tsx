// F159: Chatwoot v4.18 Agents merged into Studio's Users table.
// Chatwoot fields: name, email, role (administrator/agent) or custom role, availability, confirmed, provider.
// Studio fields kept: team(s), inboxes (Studio "workspace" column), joined date.
// F161: the roster, teams and inboxes are the shared lists of src/lib/cw (same 17 agents, 4 teams and 8 inboxes as
// Conversations, Settings and Reports). A UserRow is an Agent plus the names of the teams and inboxes it belongs to.
import type { Agent, Availability, Inbox, Team } from "@/lib/cw/data";
import { CURRENT_USER_ID } from "@/lib/cw/data";

export type { AgentRole, Availability } from "@/lib/cw/data";
export type UserStatus = "Verified" | "Verification Pending";

export type UserRow = Agent & {
  /** Names of the Settings > Teams the agent is a member of. */
  teams: string[];
  /** Names of the Settings > Inboxes the agent is a member of. */
  inboxes: string[];
};

/** The signed-in agent (Chatwoot hides Edit and Delete on your own row): Arham Khan, the sidebar user. */
export { CURRENT_USER_ID };

export function toUserRow(agent: Agent, teams: Team[], inboxes: Inbox[]): UserRow {
  return {
    ...agent,
    teams: teams.filter((t) => t.members.includes(agent.id)).map((t) => t.name),
    inboxes: inboxes.filter((i) => i.agents.includes(agent.id)).map((i) => i.name),
  };
}

export function toAgent(row: UserRow): Agent {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    customRoleId: row.customRoleId,
    availability: row.availability,
    confirmed: row.confirmed,
    provider: row.provider,
    joinedDate: row.joinedDate,
  };
}

export const availabilityLabels: Record<Availability, string> = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
};

export function userStatus(user: Pick<UserRow, "confirmed">): UserStatus {
  return user.confirmed ? "Verified" : "Verification Pending";
}

export const statusMeta: Record<UserStatus, { badgeClass: string; dotClass: string }> = {
  Verified: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "Verification Pending": {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
};

export const availabilityMeta: Record<Availability, { badgeClass: string; dotClass: string }> = {
  online: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  busy: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  offline: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};

export function nowJoinedDate() {
  const d = new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${String(d.getDate()).padStart(2, "0")} ${month} ${d.getFullYear()}, ${time}`;
}
