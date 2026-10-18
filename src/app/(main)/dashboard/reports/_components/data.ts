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

import type { EntityKind } from "./entity-summary-data";

export type { EntityKind, SummaryRow } from "./entity-summary-data";
export { agents, entities, inboxes, labels, teams } from "./entity-summary-data";

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

// A deterministic display seed for any entity id; routing and record ids stay unchanged.
// Preserve the existing sequences for numeric ids.
export function entitySeed(id: string): number {
  const numeric = Number(id);
  if (Number.isSafeInteger(numeric)) return numeric;
  let seed = 0;
  for (const character of id) seed = (seed * 31 + (character.codePointAt(0) ?? 0)) % 233280;
  return seed;
}

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
  const rand = seeded(entitySeed(id) * 97 + kind.length * 31);
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
// SLA badge in the inbox (cw-data initialMeta sla, T-134: #1 NRT due and #16 FRT due, Standard) are read from there, so
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

export const slaPolicies = ["Enterprise P0", "Enterprise P1", "VIP Doha", "Refund 24h", "Standard"];

export const slaRows: SlaRow[] = [
  ...Object.entries(initialMeta)
    .filter(([, meta]) => meta.sla)
    .map(([id, meta]) => ({
      conversation: Number(id),
      // T-134: the policy the badge applies (Settings > SLA), not a fixed one.
      policy: meta.sla?.policy ?? "",
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
