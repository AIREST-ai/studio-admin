import { initialMeta } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { teams as sharedTeams, type Team } from "@/lib/cw/data";

// F161: the four teams are the shared ones (src/lib/cw/data.ts): same ids, members and slugs everywhere.
export type { Team } from "@/lib/cw/data";
export const teams: Team[] = sharedTeams;

// F159: the team's conversations, from the same conversation list as Conversations > Teams (cw-data.ts initialMeta),
// so the counts here match the team views in the sidebar.
function teamConversations(team: Team) {
  const slug = team.slug;
  return Object.values(initialMeta).filter((meta) => meta.teamId === slug);
}

export function openConversations(team: Team) {
  return teamConversations(team).filter((meta) => meta.status === "open");
}

export function teamStats(team: Team) {
  const all = teamConversations(team);
  const open = all.filter((meta) => meta.status === "open");
  return {
    open: open.length,
    unassigned: open.filter((meta) => !meta.assigneeId).length,
    urgent: open.filter((meta) => meta.priority === "urgent" || meta.priority === "high").length,
    resolved: all.filter((meta) => meta.status === "resolved").length,
    total: all.length,
  };
}
