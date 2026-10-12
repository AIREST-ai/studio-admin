import { initialMeta } from "@/app/(main)/dashboard/chat/_components/cw-data";

export interface Team {
  id: number;
  name: string;
  description: string;
  icon: string;
  members: number[];
  autoAssign: boolean;
}

// F159: the same four teams as Conversations (chat/_components/cw-data.ts), same order, descriptions and members.
// Member ids are the five agents in ../../inboxes/_components/data.ts (Arham Khan, Priya Nair, Yousef Al-Harbi,
// Lina Haddad, Ravi Menon), which use the Conversations agent ids.
export const teams: Team[] = [
  {
    id: 1,
    name: "Sales",
    description: "New business, upgrades and demos",
    icon: "💼",
    members: [1, 2, 4],
    autoAssign: true,
  },
  {
    id: 2,
    name: "Support",
    description: "General product questions",
    icon: "🎧",
    members: [1, 3, 4],
    autoAssign: true,
  },
  {
    id: 3,
    name: "Billing",
    description: "Invoices, refunds and plans",
    icon: "💳",
    members: [1, 2, 3],
    autoAssign: false,
  },
  {
    id: 4,
    name: "Technical",
    description: "Bugs, outages and integrations",
    icon: "🛠️",
    members: [1, 4, 5],
    autoAssign: true,
  },
];

// F159: the team's conversations, from the same conversation list as Conversations > Teams (cw-data.ts initialMeta),
// so the counts here match the team views in the sidebar.
function teamConversations(team: Team) {
  const slug = team.name.toLowerCase();
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
