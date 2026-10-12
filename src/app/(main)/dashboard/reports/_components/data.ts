// Sample data for the reports screens (visual only, nothing is fetched).
// F159: the live numbers (Overview), the CSAT responses and the SLA rows come from the inbox conversations
// (dashboard/chat/_components/cw-data.ts), so the same ids, people, agents and topics appear on every page.

import {
  agentName,
  baseConversations,
  type ConversationMeta,
  contactIdOf,
  agents as inboxAgents,
  inboxOf,
  teams as inboxTeams,
  initialMeta,
  teamName,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
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

export const entityMeta: Record<
  EntityKind,
  { header: string; description: string; column: string; download: string; select: string; search: string }
> = {
  agents: {
    header: "Agents Overview",
    description:
      "Easily track agent performance with key metrics such as conversations, response times, resolution times, and resolved cases. Click an agent's name to learn more.",
    column: "Agent",
    download: "Download agent reports",
    select: "Select Agent",
    search: "Search agents",
  },
  inboxes: {
    header: "Inbox Overview",
    description:
      "Quickly view your inbox performance with key metrics like conversations, response times, resolution times, and resolved cases—all in one place. Click an inbox name for more details.",
    column: "Inbox",
    download: "Download inbox reports",
    select: "Select Inbox",
    search: "Search inboxes",
  },
  teams: {
    header: "Team Overview",
    description:
      "Get a snapshot of your team's performance with essential metrics, including conversations, response times, resolution times, and resolved cases. Click a team name for more details.",
    column: "Team",
    download: "Download team reports",
    select: "Select Team",
    search: "Search teams",
  },
  labels: {
    header: "Labels Overview",
    description:
      "Track label performance with key metrics including conversations, response times, resolution times, and resolved cases. Click a label name for detailed insights.",
    column: "Label",
    download: "Download label reports",
    select: "Select Label",
    search: "Search labels",
  },
};

// Deterministic pseudo-random numbers so server and client render the same values.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const DAY_LABELS = [
  "Sep 29",
  "Sep 30",
  "Oct 1",
  "Oct 2",
  "Oct 3",
  "Oct 4",
  "Oct 5",
  "Oct 6",
  "Oct 7",
  "Oct 8",
  "Oct 9",
  "Oct 10",
  "Oct 11",
  "Oct 12",
];

export function series(seed: number, base: number, spread: number, days = 7) {
  const rand = seeded(seed);
  return DAY_LABELS.slice(-days).map((day) => ({
    day,
    value: Math.max(0, Math.round(base + (rand() - 0.5) * spread)),
  }));
}

export interface MetricDef {
  key: string;
  name: string;
  desc: string;
  total: string;
  trend: number;
  unit?: "min";
  base: number;
  spread: number;
  // Chatwoot INFO_TEXT, followed by the number of conversations used for the average.
  info?: string;
  // Exact total (counts) or average (times) for the selected period, so a detail page equals its summary row.
  anchor?: number;
}

export const conversationMetrics: MetricDef[] = [
  { key: "conversations", name: "Conversations", desc: "( Total )", total: "997", trend: 12, base: 140, spread: 70 },
  { key: "incoming", name: "Messages received", desc: "( Total )", total: "6,482", trend: 8, base: 920, spread: 400 },
  { key: "outgoing", name: "Messages sent", desc: "( Total )", total: "5,917", trend: 5, base: 840, spread: 360 },
  {
    key: "firstResponse",
    name: "First Response Time",
    desc: "( Avg )",
    total: "4 Min 38 Sec",
    trend: -9,
    unit: "min",
    base: 5,
    spread: 5,
    info: "Total number of conversations used for computation:",
  },
  {
    key: "resolutionTime",
    name: "Resolution Time",
    desc: "( Avg )",
    total: "3 Hr 6 Min",
    trend: -4,
    unit: "min",
    base: 185,
    spread: 120,
    info: "Total number of conversations used for computation:",
  },
  {
    key: "resolutionCount",
    name: "Resolution Count",
    desc: "( Total )",
    total: "861",
    trend: 15,
    base: 120,
    spread: 60,
  },
  {
    key: "replyTime",
    name: "Customer waiting time",
    desc: "",
    total: "5 Min 20 Sec",
    trend: 3,
    unit: "min",
    base: 6,
    spread: 5,
  },
];

export const entityMetrics: MetricDef[] = [
  { key: "conversations", name: "Conversations", desc: "( Total )", total: "214", trend: 9, base: 30, spread: 18 },
  { key: "incoming", name: "Messages received", desc: "( Total )", total: "1,284", trend: 6, base: 180, spread: 90 },
  { key: "outgoing", name: "Messages sent", desc: "( Total )", total: "1,169", trend: 4, base: 165, spread: 80 },
  {
    key: "firstResponse",
    name: "First Response Time",
    desc: "( Avg )",
    total: "3 Min 12 Sec",
    trend: -11,
    unit: "min",
    base: 4,
    spread: 4,
    info: "Total number of conversations used for computation:",
  },
  {
    key: "resolutionTime",
    name: "Resolution Time",
    desc: "( Avg )",
    total: "2 Hr 41 Min",
    trend: -6,
    unit: "min",
    base: 160,
    spread: 100,
    info: "Total number of conversations used for computation:",
  },
  {
    key: "resolutionCount",
    name: "Resolution Count",
    desc: "( Total )",
    total: "188",
    trend: 13,
    base: 27,
    spread: 14,
  },
  // WootReports uses the same ReportContainer keys as the Conversations report, so the waiting time is here too.
  {
    key: "replyTime",
    name: "Customer waiting time",
    desc: "",
    total: "4 Min 05 Sec",
    trend: 2,
    unit: "min",
    base: 5,
    spread: 4,
  },
];

// F159: each agent, inbox, team and label has its own change against the previous period (every detail page showed
// the same six numbers). Conversations, messages and resolutions move together; the times move on their own.
export function entityTrends(kind: EntityKind, id: string): Record<string, number> {
  const rand = seeded(Number(id) * 97 + kind.length * 31);
  const step = (min: number, max: number) => Math.round(min + rand() * (max - min)) || 1;
  const conversations = step(-12, 18);
  return {
    conversations,
    incoming: conversations + step(-4, 4),
    outgoing: conversations + step(-5, 3),
    firstResponse: step(-22, 14),
    resolutionTime: step(-16, 12),
    resolutionCount: conversations + step(-3, 7),
  };
}

export const botMetricCards = [
  { label: "No. of Conversations", tooltip: "Total number of conversations handled by the bot", value: "1,326" },
  { label: "Total Responses", tooltip: "Total number of responses sent by the bot", value: "4,918" },
  {
    label: "Resolution Rate",
    tooltip:
      "Total number of conversations resolved by the bot / Total number of conversations handled by the bot * 100",
    value: "62%",
  },
  {
    label: "Handoff Rate",
    tooltip:
      "Total number of conversations handed off to agents / Total number of conversations handled by the bot * 100",
    value: "38%",
  },
];

export const botMetrics: MetricDef[] = [
  {
    key: "botResolutionCount",
    name: "Resolution Count",
    desc: "( Total )",
    total: "822",
    trend: 18,
    base: 118,
    spread: 50,
  },
  { key: "botHandoffCount", name: "Handoff Count", desc: "( Total )", total: "504", trend: -7, base: 72, spread: 40 },
];

export const dateRangeOptions = [
  "Last 7 days",
  "Last 14 days",
  "Last 30 days",
  "This month",
  "Last month",
  "Last 3 months",
  "Last 6 months",
  "Last year",
  "Custom date range",
];

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Heatmap: 7 days x 24 hours. Gulf week: busy Sun-Thu daytime, quiet Friday morning.
export function heatmap(seed: number, scale = 1) {
  const rand = seeded(seed);
  return DAYS.map((_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const work = h >= 8 && h <= 21 ? 1 : 0.15;
      const evening = h >= 19 && h <= 23 ? 0.6 : 0;
      const friday = d === 5 && h < 13 ? 0.2 : 1;
      const weekend = d === 5 || d === 6 ? 0.7 : 1;
      return Math.round((work * 14 + evening * 8) * friday * weekend * (0.6 + rand() * 0.8) * scale);
    }),
  );
}

export type AgentStatus = "online" | "busy" | "offline";

// F159: the live Overview numbers are counted from the conversations (cw-data initialMeta, or the live store), the
// same way the conversation list counts them: Open = status open, Unassigned = open without an agent, Unattended =
// open and still waiting for a first reply, Pending = status pending.
export interface LiveCounts {
  open: number;
  unattended: number;
  unassigned: number;
  pending: number;
}

export function liveCounts(
  meta: Record<number, ConversationMeta> = initialMeta,
  teamId: string | null = null,
  deleted: number[] = [],
): LiveCounts {
  const rows = Object.entries(meta)
    .filter(([id]) => !deleted.includes(Number(id)))
    .map(([, m]) => m)
    .filter((m) => !teamId || m.teamId === teamId);
  const open = rows.filter((m) => m.status === "open");
  return {
    open: open.length,
    unattended: open.filter((m) => m.unattended).length,
    unassigned: open.filter((m) => !m.assigneeId).length,
    pending: rows.filter((m) => m.status === "pending").length,
  };
}

export interface AgentLiveRow {
  id: number;
  name: string;
  email: string;
  status: AgentStatus;
  open: number;
  unattended: number;
}

// Agents with their open and unattended conversations, most open first (same agents and availability as the inbox).
export function agentLiveRows(meta: Record<number, ConversationMeta> = initialMeta, deleted: number[] = []) {
  const live = Object.entries(meta).filter(([id, m]) => m.status === "open" && !deleted.includes(Number(id)));
  return inboxAgents
    .map<AgentLiveRow>((agent) => {
      const own = live.filter(([, m]) => m.assigneeId === agent.id);
      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        status: agent.availability,
        open: own.length,
        unattended: own.filter(([, m]) => m.unattended).length,
      };
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

export interface TeamLiveRow {
  id: string;
  name: string;
  open: number;
  unattended: number;
}

export function teamLiveRows(meta: Record<number, ConversationMeta> = initialMeta, deleted: number[] = []) {
  return inboxTeams
    .map<TeamLiveRow>((team) => {
      const counts = liveCounts(meta, team.id, deleted);
      return { id: team.id, name: team.name, open: counts.open, unattended: counts.unattended };
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

export const agentLive = agentLiveRows();
export const teamLive = teamLiveRows();

// F159: CSAT responses on real inbox conversations. A survey goes out when a conversation is resolved: #17, #18
// and #23 are resolved now, and #2 and #5 were resolved and then reopened by the customer's thank-you message (their
// last message). Contact, email and agent are read from the conversation, so they match the inbox and Contacts.
const csatSeeds: { conversation: number; rating: number; feedback: string; time: string }[] = [
  {
    conversation: 2,
    rating: 5,
    feedback: "The duplicate charge was refunded the same morning. Thank you!",
    time: "5 minutes ago",
  },
  {
    conversation: 5,
    rating: 5,
    feedback: "Got the Scope 3 data and the methodology note in one bundle. Perfect for the board pack.",
    time: "14 minutes ago",
  },
  {
    conversation: 23,
    rating: 5,
    feedback: "Clear Azure AD checklist. The pilot group switched with no downtime.",
    time: "Yesterday",
  },
  {
    conversation: 17,
    rating: 4,
    feedback: "Helpful overview of the reseller tiers.",
    time: "Yesterday",
  },
  {
    conversation: 18,
    rating: 3,
    feedback: "The May logs arrived, but I had to ask twice for UTC timestamps.",
    time: "Yesterday",
  },
];

// Surveys sent in the period: the five answered above plus one the customer left unanswered.
export const csatSurveysSent = 6;

export interface CsatResponse {
  id: number;
  contact: string;
  contactId: number | null;
  email: string;
  agent: string | null;
  inbox: string;
  team: string | null;
  rating: number;
  feedback: string;
  conversation: number;
  subject: string;
  time: string;
}

function conversationById(id: number) {
  const conversation = baseConversations.find((c) => c.id === id);
  if (!conversation) throw new Error(`Unknown conversation #${id}`);
  return conversation;
}

export const csatResponses: CsatResponse[] = csatSeeds.map((seed, index) => {
  const conversation = conversationById(seed.conversation);
  return {
    id: index + 1,
    contact: conversation.name,
    contactId: contactIdOf(conversation.id),
    email: conversation.contact.email,
    agent: agentName(initialMeta[conversation.id]?.assigneeId),
    inbox: inboxOf(conversation).name,
    team: teamName(initialMeta[conversation.id]?.teamId),
    rating: seed.rating,
    feedback: seed.feedback,
    conversation: conversation.id,
    subject: conversation.subject,
    time: seed.time,
  };
});

const ratingEmoji: Record<number, string> = { 5: "😍", 4: "😀", 3: "😐", 2: "😞", 1: "😡" };

export const csatDistribution = [5, 4, 3, 2, 1].map((rating) => ({
  rating,
  emoji: ratingEmoji[rating],
  count: csatResponses.filter((r) => r.rating === rating).length,
}));

// Chatwoot: satisfaction score = ratings of 4 and 5 / all ratings; response rate = responses / surveys sent.
export function csatSummary(rows: CsatResponse[] = csatResponses) {
  const positive = rows.filter((r) => r.rating >= 4).length;
  const pct = (value: number) => `${(Math.round(value * 1000) / 10).toString()}%`;
  return {
    total: rows.length,
    satisfaction: rows.length ? pct(positive / rows.length) : "--",
    responseRate: pct(csatSurveysSent ? csatResponses.length / csatSurveysSent : 0),
  };
}

// The CSAT of one contact (Contacts detail page), from the same responses.
export function contactCsat(contactId: number) {
  const own = csatResponses.filter((r) => r.contactId === contactId);
  const positive = own.filter((r) => r.rating >= 4).length;
  return { ratings: own.length, score: own.length ? Math.round((positive / own.length) * 100) : null };
}

// First response time of a conversation in minutes: the gap between the customer's first message and the first
// agent reply, read from the thread itself (Pinned and Today threads carry their ages). Yesterday's threads only say
// "Yesterday", so their first reply time is listed here. Unanswered conversations have none.
const yesterdayFirstResponse: Record<number, number> = { 17: 9, 18: 16, 19: 6, 20: 12, 22: 2, 23: 7, 24: 21 };

export function firstResponseMinutes(conversationId: number): number | null {
  const conversation = baseConversations.find((c) => c.id === conversationId);
  if (!conversation) return null;
  const firstIn = conversation.messages.find((m) => m.align === "start");
  const firstOut = conversation.messages.find((m) => m.align === "end");
  if (!firstIn || !firstOut) return null;
  if (firstIn.ago !== undefined && firstOut.ago !== undefined) return Math.max(firstIn.ago - firstOut.ago, 1);
  return yesterdayFirstResponse[conversationId] ?? null;
}

// "1m 30s", "4m", "1h 5m" (the short form of the summary tables).
export function formatMinutes(minutes: number): string {
  const seconds = Math.round(minutes * 60);
  if (seconds < 3600) {
    const rest = seconds % 60;
    return rest ? `${Math.floor(seconds / 60)}m ${rest}s` : `${Math.floor(seconds / 60)}m`;
  }
  const mins = Math.round(seconds / 60);
  return mins % 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 60)}h`;
}

// Team average first response: the account average of the Conversations report (First Response Time 4 Min 38 Sec).
export const teamFirstResponse = 278 / 60;

// F159: SLA rows on real conversations, with the policies of Settings > SLA. The conversations whose card shows an
// SLA badge in the inbox (cw-data initialMeta sla: #1 NRT due, #3 FRT due, #16 FRT missed) are read from there, so
// the report says Active while the badge says due, and Missed where the badge says missed. The others met their
// targets, apart from #18, whose next reply came late (the customer asked twice, see its CSAT comment).
export type SlaMetric = "First Response Time" | "Next Response Time" | "Resolution Time";

export interface SlaRow {
  id: number;
  policy: string;
  conversation: number;
  contact: string;
  subject: string;
  agent: string | null;
  inbox: string;
  team: string | null;
  missed: SlaMetric[];
  active: boolean;
}

const slaMetricName: Record<"FRT" | "NRT" | "RT", SlaMetric> = {
  FRT: "First Response Time",
  NRT: "Next Response Time",
  RT: "Resolution Time",
};

const slaSeeds: { conversation: number; policy: string; missed?: SlaMetric[] }[] = [
  { conversation: 2, policy: "Refund 24h" },
  { conversation: 10, policy: "VIP Doha" },
  { conversation: 11, policy: "Enterprise P0" },
  { conversation: 23, policy: "Enterprise P1" },
  { conversation: 17, policy: "Standard" },
  { conversation: 18, policy: "Standard", missed: ["Next Response Time"] },
];

// The inbox SLA badges use a one hour target, the first response time of Enterprise P1.
const badgePolicy = "Enterprise P1";

export const slaPolicies = ["Enterprise P0", "Enterprise P1", "VIP Doha", "Refund 24h", "Standard"];

export const slaRows: SlaRow[] = [
  ...Object.entries(initialMeta)
    .filter(([, meta]) => meta.sla)
    .map(([id, meta]) => ({
      conversation: Number(id),
      policy: badgePolicy,
      missed: meta.sla?.state === "missed" ? [slaMetricName[meta.sla.kind]] : [],
      active: meta.sla?.state === "due",
    })),
  ...slaSeeds.map((seed) => ({ ...seed, missed: seed.missed ?? [], active: false })),
].map((seed, index) => {
  const conversation = conversationById(seed.conversation);
  return {
    id: index + 1,
    policy: seed.policy,
    conversation: conversation.id,
    contact: conversation.name,
    subject: conversation.subject,
    agent: agentName(initialMeta[conversation.id]?.assigneeId),
    inbox: inboxOf(conversation).name,
    team: teamName(initialMeta[conversation.id]?.teamId),
    missed: seed.missed,
    active: seed.active,
  };
});

// Hit rate = SLAs met / SLAs finished (hit or missed); misses count every missed target.
export function slaSummary(rows: SlaRow[] = slaRows) {
  const missed = rows.filter((r) => r.missed.length);
  const finished = rows.filter((r) => r.missed.length || !r.active);
  const hit = finished.length - missed.length;
  return {
    hitRate: finished.length ? `${Math.round((hit / finished.length) * 1000) / 10}%` : "--",
    misses: rows.reduce((sum, r) => sum + r.missed.length, 0),
    conversations: rows.length,
  };
}
