// Sample data for the reports screens (visual only, nothing is fetched).

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

export const agents: SummaryRow[] = [
  { id: "1", name: "Mariam Al-Kuwari", subtitle: "mariam@alnoor-clinic.qa", conversations: 214, avgFirstResponse: "3m 12s", avgResolution: "2h 41m", avgReply: "4m 05s", resolutionCount: 188 },
  { id: "2", name: "Omar Haddad", subtitle: "omar@alnoor-clinic.qa", conversations: 187, avgFirstResponse: "5m 48s", avgResolution: "3h 10m", avgReply: "6m 22s", resolutionCount: 161 },
  { id: "3", name: "Fatima Al-Suwaidi", subtitle: "fatima@alnoor-clinic.qa", conversations: 169, avgFirstResponse: "2m 30s", avgResolution: "1h 55m", avgReply: "3m 18s", resolutionCount: 158 },
  { id: "4", name: "Yousef Al-Harbi", subtitle: "yousef@alnoor-clinic.qa", conversations: 142, avgFirstResponse: "8m 02s", avgResolution: "5h 27m", avgReply: "9m 40s", resolutionCount: 109 },
  { id: "5", name: "Priya Nair", subtitle: "priya@alnoor-clinic.qa", conversations: 131, avgFirstResponse: "4m 15s", avgResolution: "2h 08m", avgReply: "5m 01s", resolutionCount: 124 },
  { id: "6", name: "Abdulla Al-Marri", subtitle: "abdulla@alnoor-clinic.qa", conversations: 96, avgFirstResponse: "11m 37s", avgResolution: "7h 02m", avgReply: "12m 14s", resolutionCount: 71 },
  { id: "7", name: "Layla Rahman", subtitle: "layla@alnoor-clinic.qa", conversations: 58, avgFirstResponse: "6m 44s", avgResolution: "4h 19m", avgReply: "7m 30s", resolutionCount: 49 },
];

export const inboxes: SummaryRow[] = [
  { id: "1", name: "WhatsApp Doha", subtitle: "WhatsApp", conversations: 412, avgFirstResponse: "3m 40s", avgResolution: "2h 12m", avgReply: "4m 11s", resolutionCount: 376 },
  { id: "2", name: "Website Live Chat", subtitle: "Website", conversations: 268, avgFirstResponse: "1m 55s", avgResolution: "48m", avgReply: "2m 37s", resolutionCount: 251 },
  { id: "3", name: "support@alnoor-clinic.qa", subtitle: "Email", conversations: 133, avgFirstResponse: "1h 22m", avgResolution: "9h 45m", avgReply: "1h 05m", resolutionCount: 97 },
  { id: "4", name: "Instagram @alnoorclinic", subtitle: "Instagram", conversations: 121, avgFirstResponse: "14m 08s", avgResolution: "3h 33m", avgReply: "12m 50s", resolutionCount: 102 },
  { id: "5", name: "WhatsApp Dubai", subtitle: "WhatsApp", conversations: 63, avgFirstResponse: "6m 21s", avgResolution: "2h 58m", avgReply: "7m 02s", resolutionCount: 54 },
];

export const teams: SummaryRow[] = [
  { id: "1", name: "Appointments", subtitle: "Booking and rescheduling", conversations: 438, avgFirstResponse: "2m 50s", avgResolution: "1h 34m", avgReply: "3m 21s", resolutionCount: 410 },
  { id: "2", name: "Billing & Insurance", subtitle: "Invoices, QLM, Daman, Bupa", conversations: 241, avgFirstResponse: "9m 12s", avgResolution: "6h 05m", avgReply: "10m 48s", resolutionCount: 187 },
  { id: "3", name: "Pharmacy", subtitle: "Refills and deliveries", conversations: 176, avgFirstResponse: "4m 33s", avgResolution: "2h 47m", avgReply: "5m 09s", resolutionCount: 158 },
  { id: "4", name: "Patient Care", subtitle: "Follow-ups and results", conversations: 142, avgFirstResponse: "7m 18s", avgResolution: "4h 12m", avgReply: "8m 26s", resolutionCount: 125 },
];

export const labels: SummaryRow[] = [
  { id: "1", name: "appointment", color: "#2563eb", conversations: 356, avgFirstResponse: "2m 41s", avgResolution: "1h 22m", avgReply: "3m 10s", resolutionCount: 339 },
  { id: "2", name: "insurance", color: "#16a34a", conversations: 198, avgFirstResponse: "10m 05s", avgResolution: "6h 40m", avgReply: "11m 22s", resolutionCount: 151 },
  { id: "3", name: "lab-results", color: "#9333ea", conversations: 141, avgFirstResponse: "5m 26s", avgResolution: "3h 02m", avgReply: "6m 15s", resolutionCount: 133 },
  { id: "4", name: "complaint", color: "#dc2626", conversations: 47, avgFirstResponse: "4m 02s", avgResolution: "11h 18m", avgReply: "5m 44s", resolutionCount: 31 },
  { id: "5", name: "vip", color: "#d97706", conversations: 39, avgFirstResponse: "1m 12s", avgResolution: "58m", avgReply: "1m 50s", resolutionCount: 38 },
  { id: "6", name: "arabic", color: "#0891b2", conversations: 512, avgFirstResponse: "3m 55s", avgResolution: "2h 20m", avgReply: "4m 31s", resolutionCount: 470 },
];

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
  return DAY_LABELS.slice(-days).map((day) => ({ day, value: Math.max(0, Math.round(base + (rand() - 0.5) * spread)) }));
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
}

export const conversationMetrics: MetricDef[] = [
  { key: "conversations", name: "Conversations", desc: "( Total )", total: "997", trend: 12, base: 140, spread: 70 },
  { key: "incoming", name: "Messages received", desc: "( Total )", total: "6,482", trend: 8, base: 920, spread: 400 },
  { key: "outgoing", name: "Messages sent", desc: "( Total )", total: "5,917", trend: 5, base: 840, spread: 360 },
  { key: "firstResponse", name: "First Response Time", desc: "( Avg )", total: "4 Min 38 Sec", trend: -9, unit: "min", base: 5, spread: 5 },
  { key: "resolutionTime", name: "Resolution Time", desc: "( Avg )", total: "3 Hr 6 Min", trend: -4, unit: "min", base: 185, spread: 120 },
  { key: "resolutionCount", name: "Resolution Count", desc: "( Total )", total: "861", trend: 15, base: 120, spread: 60 },
  { key: "replyTime", name: "Customer waiting time", desc: "", total: "5 Min 20 Sec", trend: 3, unit: "min", base: 6, spread: 5 },
];

export const entityMetrics: MetricDef[] = [
  { key: "conversations", name: "Conversations", desc: "( Total )", total: "214", trend: 9, base: 30, spread: 18 },
  { key: "incoming", name: "Incoming Messages", desc: "( Total )", total: "1,284", trend: 6, base: 180, spread: 90 },
  { key: "outgoing", name: "Outgoing Messages", desc: "( Total )", total: "1,169", trend: 4, base: 165, spread: 80 },
  { key: "firstResponse", name: "First Response Time", desc: "( Avg )", total: "3 Min 12 Sec", trend: -11, unit: "min", base: 4, spread: 4 },
  { key: "resolutionTime", name: "Resolution Time", desc: "( Avg )", total: "2 Hr 41 Min", trend: -6, unit: "min", base: 160, spread: 100 },
  { key: "resolutionCount", name: "Resolution Count", desc: "( Total )", total: "188", trend: 13, base: 27, spread: 14 },
];

export const botMetricCards = [
  { label: "No. of Conversations", tooltip: "Total number of conversations handled by the bot", value: "1,326" },
  { label: "Total Responses", tooltip: "Total number of responses sent by the bot", value: "4,918" },
  { label: "Resolution Rate", tooltip: "Total number of conversations resolved by the bot / Total number of conversations handled by the bot * 100", value: "62%" },
  { label: "Handoff Rate", tooltip: "Total number of conversations handed off to agents / Total number of conversations handled by the bot * 100", value: "38%" },
];

export const botMetrics: MetricDef[] = [
  { key: "botResolutionCount", name: "Resolution Count", desc: "( Total )", total: "822", trend: 18, base: 118, spread: 50 },
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

export const agentLive: { name: string; email: string; status: AgentStatus; open: number; unattended: number }[] = [
  { name: "Mariam Al-Kuwari", email: "mariam@alnoor-clinic.qa", status: "online", open: 12, unattended: 1 },
  { name: "Omar Haddad", email: "omar@alnoor-clinic.qa", status: "busy", open: 9, unattended: 3 },
  { name: "Fatima Al-Suwaidi", email: "fatima@alnoor-clinic.qa", status: "online", open: 7, unattended: 0 },
  { name: "Yousef Al-Harbi", email: "yousef@alnoor-clinic.qa", status: "offline", open: 5, unattended: 2 },
  { name: "Priya Nair", email: "priya@alnoor-clinic.qa", status: "online", open: 4, unattended: 0 },
  { name: "Abdulla Al-Marri", email: "abdulla@alnoor-clinic.qa", status: "busy", open: 3, unattended: 1 },
  { name: "Layla Rahman", email: "layla@alnoor-clinic.qa", status: "offline", open: 0, unattended: 0 },
];

export const teamLive = [
  { name: "Appointments", open: 18, unattended: 2 },
  { name: "Billing & Insurance", open: 11, unattended: 4 },
  { name: "Pharmacy", open: 7, unattended: 1 },
  { name: "Patient Care", open: 4, unattended: 0 },
];

export const csatResponses: {
  id: number;
  contact: string;
  email: string;
  agent: string | null;
  rating: number;
  feedback: string;
  conversation: number;
  time: string;
}[] = [
  { id: 1, contact: "Noura Al-Thani", email: "noura.althani@outlook.com", agent: "Mariam Al-Kuwari", rating: 5, feedback: "Booked my son's check-up in two minutes. Thank you!", conversation: 4821, time: "12 minutes ago" },
  { id: 2, contact: "Khalid Al-Mansoori", email: "khalid.mansoori@gmail.com", agent: "Omar Haddad", rating: 4, feedback: "Helpful, but I waited a bit for the Daman approval.", conversation: 4817, time: "48 minutes ago" },
  { id: 3, contact: "Reem Al-Qahtani", email: "reem.q@stc.com.sa", agent: "Fatima Al-Suwaidi", rating: 5, feedback: "Very kind and clear about the lab results.", conversation: 4809, time: "1 hour ago" },
  { id: 4, contact: "Hamad Al-Mohannadi", email: "hamad.m@qatarairways.com.qa", agent: "Yousef Al-Harbi", rating: 2, feedback: "I had to explain my problem three times.", conversation: 4796, time: "3 hours ago" },
  { id: 5, contact: "Aisha Siddiqui", email: "aisha.siddiqui@hotmail.com", agent: "Priya Nair", rating: 5, feedback: "", conversation: 4790, time: "5 hours ago" },
  { id: 6, contact: "Saeed Al-Ketbi", email: "saeed.alketbi@adnoc.ae", agent: "Abdulla Al-Marri", rating: 3, feedback: "Okay. The pharmacy delivery was late.", conversation: 4772, time: "Yesterday" },
  { id: 7, contact: "Dana Al-Sulaiti", email: "dana.sulaiti@gmail.com", agent: null, rating: 1, feedback: "Nobody replied on WhatsApp after 6 pm.", conversation: 4768, time: "Yesterday" },
  { id: 8, contact: "Mohammed Al-Shehri", email: "m.alshehri@aramco.com", agent: "Mariam Al-Kuwari", rating: 4, feedback: "Good service in Arabic, quick to reschedule.", conversation: 4751, time: "2 days ago" },
];

export const csatDistribution = [
  { rating: 5, emoji: "😍", count: 312 },
  { rating: 4, emoji: "😀", count: 141 },
  { rating: 3, emoji: "😐", count: 48 },
  { rating: 2, emoji: "😞", count: 21 },
  { rating: 1, emoji: "😡", count: 14 },
];

export const slaRows: {
  id: number;
  policy: string;
  conversation: number;
  contact: string;
  subject: string;
  agent: string | null;
  missed: string[];
}[] = [
  { id: 1, policy: "VIP patients – 15 min", conversation: 4821, contact: "Noura Al-Thani", subject: "Paediatric check-up booking", agent: "Mariam Al-Kuwari", missed: [] },
  { id: 2, policy: "Standard – 1 hr", conversation: 4817, contact: "Khalid Al-Mansoori", subject: "Daman pre-approval status", agent: "Omar Haddad", missed: ["First Response Time"] },
  { id: 3, policy: "Standard – 1 hr", conversation: 4809, contact: "Reem Al-Qahtani", subject: "Blood test results explanation", agent: "Fatima Al-Suwaidi", missed: [] },
  { id: 4, policy: "Insurance claims – 4 hr", conversation: 4796, contact: "Hamad Al-Mohannadi", subject: "QLM claim rejected twice", agent: "Yousef Al-Harbi", missed: ["Next Response Time", "Resolution Time"] },
  { id: 5, policy: "VIP patients – 15 min", conversation: 4790, contact: "Aisha Siddiqui", subject: "Home visit request, Lusail", agent: "Priya Nair", missed: [] },
  { id: 6, policy: "Standard – 1 hr", conversation: 4768, contact: "Dana Al-Sulaiti", subject: "After-hours WhatsApp enquiry", agent: null, missed: ["First Response Time"] },
  { id: 7, policy: "Insurance claims – 4 hr", conversation: 4751, contact: "Mohammed Al-Shehri", subject: "Bupa Arabia invoice copy", agent: "Mariam Al-Kuwari", missed: [] },
];
