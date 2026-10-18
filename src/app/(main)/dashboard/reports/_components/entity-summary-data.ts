// Static entity summaries shared by the report list and server detail routes.
// Keep this module independent of the client store and live report calculations.

import { agents as sharedAgents, inboxes as sharedInboxes, labels as sharedLabels } from "@/lib/cw/data";

export type EntityKind = "agents" | "inboxes" | "teams" | "labels";

export interface SummaryRow {
  id: string;
  name: string;
  subtitle?: string;
  color?: string;
  conversations: number;
  avgFirstResponse: string;
  avgResolution: string;
  avgReply: string;
  resolutionCount: number;
}

// F159: same agent ids as the conversations (dashboard/chat/_components/cw-data.ts agents), so
// /dashboard/reports/agents/<id> is the same person everywhere. Rows stay in order of conversations handled.
export const agents: SummaryRow[] = [
  {
    id: "1",
    name: "Arham Khan",
    subtitle: "arham.khan@weblabs.studio",
    conversations: 214,
    avgFirstResponse: "3m 12s",
    avgResolution: "2h 41m",
    avgReply: "4m 05s",
    resolutionCount: 188,
  },
  {
    id: "4",
    name: "Lina Haddad",
    subtitle: "lina.haddad@weblabs.studio",
    conversations: 187,
    avgFirstResponse: "5m 48s",
    avgResolution: "3h 10m",
    avgReply: "6m 22s",
    resolutionCount: 161,
  },
  {
    id: "5",
    name: "Ravi Menon",
    subtitle: "ravi.menon@weblabs.studio",
    conversations: 169,
    avgFirstResponse: "2m 30s",
    avgResolution: "1h 55m",
    avgReply: "3m 18s",
    resolutionCount: 158,
  },
  {
    id: "3",
    name: "Yousef Al-Harbi",
    subtitle: "yousef.harbi@weblabs.studio",
    conversations: 142,
    avgFirstResponse: "8m 02s",
    avgResolution: "5h 27m",
    avgReply: "9m 40s",
    resolutionCount: 109,
  },
  {
    id: "2",
    name: "Priya Nair",
    subtitle: "priya.nair@weblabs.studio",
    conversations: 131,
    avgFirstResponse: "4m 15s",
    avgResolution: "2h 08m",
    avgReply: "5m 01s",
    resolutionCount: 124,
  },
];

// F159: the six inboxes of Settings > Inboxes and the conversations (same ids and names). Together they add up
// to the Conversations and Resolution Count totals of the Conversations report (997 and 861).
export const inboxes: SummaryRow[] = [
  {
    id: "1",
    name: "Support Email",
    subtitle: "Email",
    conversations: 368,
    avgFirstResponse: "1h 04m",
    avgResolution: "8h 50m",
    avgReply: "52m 10s",
    resolutionCount: 295,
  },
  {
    id: "2",
    name: "Website Chat",
    subtitle: "Website",
    conversations: 254,
    avgFirstResponse: "1m 48s",
    avgResolution: "46m",
    avgReply: "2m 31s",
    resolutionCount: 237,
  },
  {
    id: "3",
    name: "WhatsApp Business",
    subtitle: "WhatsApp",
    conversations: 198,
    avgFirstResponse: "3m 35s",
    avgResolution: "2h 05m",
    avgReply: "4m 02s",
    resolutionCount: 181,
  },
  {
    id: "4",
    name: "Instagram",
    subtitle: "Instagram",
    conversations: 76,
    avgFirstResponse: "13m 40s",
    avgResolution: "3h 21m",
    avgReply: "12m 15s",
    resolutionCount: 64,
  },
  {
    id: "5",
    name: "Facebook Page",
    subtitle: "Facebook",
    conversations: 58,
    avgFirstResponse: "16m 22s",
    avgResolution: "3h 48m",
    avgReply: "14m 30s",
    resolutionCount: 45,
  },
  {
    id: "6",
    name: "Phone",
    subtitle: "Voice",
    conversations: 43,
    avgFirstResponse: "2m 05s",
    avgResolution: "1h 12m",
    avgReply: "2m 40s",
    resolutionCount: 39,
  },
];

// F159: the four teams of Settings > Teams and the conversations (Sales, Support, Billing, Technical), same ids.
export const teams: SummaryRow[] = [
  {
    id: "4",
    name: "Technical",
    subtitle: "Bugs, outages and integrations",
    conversations: 341,
    avgFirstResponse: "4m 50s",
    avgResolution: "3h 42m",
    avgReply: "5m 33s",
    resolutionCount: 288,
  },
  {
    id: "2",
    name: "Support",
    subtitle: "General product questions",
    conversations: 298,
    avgFirstResponse: "3m 05s",
    avgResolution: "1h 48m",
    avgReply: "3m 40s",
    resolutionCount: 271,
  },
  {
    id: "3",
    name: "Billing",
    subtitle: "Invoices, refunds and plans",
    conversations: 204,
    avgFirstResponse: "8m 15s",
    avgResolution: "5h 20m",
    avgReply: "9m 02s",
    resolutionCount: 168,
  },
  {
    id: "1",
    name: "Sales",
    subtitle: "New business, upgrades and demos",
    conversations: 154,
    avgFirstResponse: "6m 40s",
    avgResolution: "2h 35m",
    avgReply: "7m 12s",
    resolutionCount: 134,
  },
];

// F159: the five labels of Settings > Labels and the conversations, with the same colours.
export const labels: SummaryRow[] = [
  {
    id: "5",
    name: "support",
    color: "#ec4899",
    conversations: 402,
    avgFirstResponse: "3m 20s",
    avgResolution: "1h 52m",
    avgReply: "3m 58s",
    resolutionCount: 371,
  },
  {
    id: "2",
    name: "billing",
    color: "#0ea5e9",
    conversations: 236,
    avgFirstResponse: "7m 45s",
    avgResolution: "4h 58m",
    avgReply: "8m 30s",
    resolutionCount: 197,
  },
  {
    id: "3",
    name: "lead",
    color: "#f59e0b",
    conversations: 171,
    avgFirstResponse: "5m 10s",
    avgResolution: "2h 20m",
    avgReply: "6m 05s",
    resolutionCount: 148,
  },
  {
    id: "1",
    name: "vip",
    color: "#8b5cf6",
    conversations: 88,
    avgFirstResponse: "1m 35s",
    avgResolution: "54m",
    avgReply: "2m 02s",
    resolutionCount: 85,
  },
  {
    id: "4",
    name: "partner",
    color: "#14b8a6",
    conversations: 49,
    avgFirstResponse: "12m 30s",
    avgResolution: "6h 15m",
    avgReply: "11m 40s",
    resolutionCount: 38,
  },
];

// F161: every agent, inbox and label of the shared layer (src/lib/cw/data.ts) has a row, as in Chatwoot's reports:
// the ones above handled the sample conversations; the others (12 more agents of Users & Roles, SMS Alerts and
// Mobile App API, Fahad's five Arabic labels and the three hidden labels) handled none in this period, so 0 and "—".
function idle(id: string, name: string, extra: Partial<SummaryRow> = {}): SummaryRow {
  return {
    id,
    name,
    conversations: 0,
    avgFirstResponse: "—",
    avgResolution: "—",
    avgReply: "—",
    resolutionCount: 0,
    ...extra,
  };
}

for (const agent of sharedAgents) {
  if (!agents.some((row) => row.id === String(agent.id)))
    agents.push(idle(String(agent.id), agent.name, { subtitle: agent.email }));
}
for (const inbox of sharedInboxes) {
  if (!inboxes.some((row) => row.id === String(inbox.id)))
    inboxes.push(idle(String(inbox.id), inbox.name, { subtitle: inbox.channelType }));
}
for (const label of sharedLabels) {
  if (!labels.some((row) => row.name === label.title)) labels.push(idle(label.id, label.title, { color: label.color }));
}

export const entities: Record<EntityKind, SummaryRow[]> = { agents, inboxes, teams, labels };
