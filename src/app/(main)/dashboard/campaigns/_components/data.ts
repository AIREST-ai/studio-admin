export type CampaignKind = "live_chat" | "sms" | "whatsapp";
export type OneOffStatus = "scheduled" | "processing" | "completed";

export interface LiveChatCampaign {
  id: number;
  title: string;
  message: string;
  enabled: boolean;
  sender: string | null;
  inbox: string;
  url: string;
  timeOnPage: number;
  businessHoursOnly: boolean;
}

export interface OneOffCampaign {
  id: number;
  title: string;
  message: string;
  status: OneOffStatus;
  inbox: string;
  scheduledAt: string;
  audience: string[];
  template?: string;
}

export const avatarTones = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
];

export function toneFor(id: number) {
  return avatarTones[id % avatarTones.length];
}

export const liveChatCampaigns: LiveChatCampaign[] = [
  {
    id: 1,
    title: "Ramadan delivery slots",
    message: "Planning your Iftar order? Book a delivery slot now and get free delivery across Doha until Eid.",
    enabled: true,
    sender: "Priya Nair",
    inbox: "Website Chat",
    url: "https://shop.example.qa/ramadan",
    timeOnPage: 10,
    businessHoursOnly: false,
  },
  {
    id: 2,
    title: "Pricing page help",
    message: "Comparing plans? Our team in Dubai can help you pick the right one in two minutes.",
    enabled: true,
    sender: null,
    inbox: "Website Chat",
    url: "https://example.ae/pricing",
    timeOnPage: 25,
    businessHoursOnly: true,
  },
  {
    id: 3,
    title: "Abandoned checkout nudge",
    message: "Still thinking it over? Ask us anything about payment in instalments with Tabby or Tamara.",
    enabled: false,
    sender: "Yousef Al-Harbi",
    inbox: "Website Chat",
    url: "https://example.sa/checkout",
    timeOnPage: 40,
    businessHoursOnly: false,
  },
  {
    id: 4,
    title: "School registration week",
    message: "Registering for the new term? Send us the grade and we will share the fee schedule.",
    enabled: true,
    sender: "Lina Haddad",
    inbox: "Website Chat",
    url: "https://example.qa/admissions",
    timeOnPage: 15,
    businessHoursOnly: true,
  },
  {
    id: 5,
    title: "National Day offer",
    message: "Celebrate Qatar National Day with 18% off all annual plans. Offer ends 18 December.",
    enabled: false,
    sender: null,
    inbox: "Website Chat",
    url: "https://example.qa/national-day",
    timeOnPage: 5,
    businessHoursOnly: false,
  },
];

export const smsCampaigns: OneOffCampaign[] = [
  {
    id: 11,
    title: "Eid Al-Adha greetings",
    message: "Eid Mubarak from all of us! Our branches in Doha open 4pm-11pm during Eid holidays.",
    status: "scheduled",
    inbox: "SMS Alerts",
    scheduledAt: "Oct 20, 2026, 9:00 AM",
    audience: ["customers", "vip"],
  },
  {
    id: 12,
    title: "Demo reminders — Weblabs Studio",
    message: "Reminder: your Weblabs Studio product demo is tomorrow. Reply 1 to confirm or 2 to reschedule.",
    status: "processing",
    inbox: "SMS Alerts",
    scheduledAt: "Oct 12, 2026, 8:30 AM",
    audience: ["appointments"],
  },
  {
    id: 13,
    title: "Dubai Mall pop-up store",
    message: "Our pop-up at Dubai Mall is open this weekend. Show this SMS for a free gift with any order.",
    status: "completed",
    inbox: "SMS Alerts",
    scheduledAt: "Oct 3, 2026, 6:00 PM",
    audience: ["dubai", "leads"],
  },
  {
    id: 14,
    title: "Service outage notice",
    message: "Planned maintenance tonight 1am-3am. Online orders will resume at 3am. Thank you for your patience.",
    status: "completed",
    inbox: "SMS Alerts",
    scheduledAt: "Sep 28, 2026, 7:15 PM",
    audience: ["customers"],
  },
];

export const whatsappCampaigns: OneOffCampaign[] = [
  {
    id: 21,
    title: "White Friday early access",
    message: "Hi {{1}}, White Friday starts early for you! Shop 48 hours before everyone else.",
    status: "processing",
    inbox: "WhatsApp Business",
    scheduledAt: "Oct 12, 2026, 10:00 AM",
    audience: ["vip", "customers"],
    template: "white_friday_early (en)",
  },
  {
    id: 22,
    title: "Order delivered survey",
    message: "Your order has arrived. How was your delivery? Rate us from 1 to 5.",
    status: "completed",
    inbox: "WhatsApp Business",
    scheduledAt: "Oct 6, 2026, 4:00 PM",
    audience: ["recent-orders"],
    template: "delivery_feedback (en)",
  },
  {
    id: 23,
    title: "Riyadh Season tickets",
    message: "مرحباً {{1}}، تذاكر موسم الرياض متاحة الآن. احجز مقعدك قبل نفاد الكمية.",
    status: "scheduled",
    inbox: "WhatsApp Business",
    scheduledAt: "Oct 25, 2026, 7:00 PM",
    audience: ["riyadh", "leads"],
    template: "riyadh_season_tickets (ar)",
  },
  {
    id: 24,
    title: "Back to school bundles",
    message: "Hi {{1}}, back-to-school bundles are now in stock in Abu Dhabi and Dubai stores.",
    status: "completed",
    inbox: "WhatsApp Business",
    scheduledAt: "Aug 24, 2026, 11:00 AM",
    audience: ["parents"],
    template: "back_to_school (en)",
  },
];

export const websiteInboxes = ["Website Chat"];
export const smsInboxes = ["SMS Alerts"];
export const whatsappInboxes = ["WhatsApp Business"];
export const senders = ["Bot", "Priya Nair", "Yousef Al-Harbi", "Lina Haddad", "Ravi Menon"];
export const labels = ["customers", "vip", "leads", "appointments", "recent-orders", "dubai", "riyadh", "parents"];
export const whatsappTemplates = [
  {
    value: "white_friday_early",
    label: "White Friday Early (en)",
    category: "MARKETING",
    language: "en",
    body: "Hi {{1}}, White Friday starts early for you! Shop 48 hours before everyone else.",
    variables: ["1"],
  },
  {
    value: "delivery_feedback",
    label: "Delivery Feedback (en)",
    category: "UTILITY",
    language: "en",
    body: "Your order has arrived. How was your delivery? Rate us from 1 to 5.",
    variables: [] as string[],
  },
  {
    value: "riyadh_season_tickets",
    label: "Riyadh Season Tickets (ar)",
    category: "MARKETING",
    language: "ar",
    body: "مرحباً {{1}}، تذاكر موسم الرياض متاحة الآن. احجز مقعدك قبل {{2}}.",
    variables: ["1", "2"],
  },
];

// Chatwoot sends the Website inbox members as senders. The account has one Website inbox (Settings > Inboxes).
export const inboxMembers: Record<string, string[]> = {
  "Website Chat": ["Priya Nair", "Yousef Al-Harbi", "Lina Haddad", "Ravi Menon"],
};

export function formatSchedule(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "skipped";

export interface Delivery {
  id: number;
  name: string;
  phone: string;
  status: DeliveryStatus;
  message: string | null;
  reason: string | null;
  code: number | null;
}

// Delivery counts per WhatsApp campaign (mock). 23 is scheduled (pending state), 24 was sent before campaign
// analytics existed (unavailable state), as in Chatwoot's analytics empty states.
const deliveryPlan: Record<number, Record<DeliveryStatus, number>> = {
  21: { read: 846, delivered: 256, sent: 74, queued: 12, failed: 31, skipped: 21 },
  22: { read: 241, delivered: 98, sent: 0, queued: 0, failed: 9, skipped: 4 },
};

export type AnalyticsState = "ready" | "pending" | "unavailable";

export function analyticsState(id: number): AnalyticsState {
  if (deliveryPlan[id]) return "ready";
  return whatsappCampaigns.find((c) => c.id === id)?.status === "scheduled" ? "pending" : "unavailable";
}

const firstNames = [
  "Hamad", "Aisha", "Rashid", "Latifa", "Abdullah", "Reem", "Jassim", "Fatima", "Sultan", "Huda", "Yousef",
  "Shaikha", "Khalid", "Noura", "Majed", "Maryam", "Saeed", "Hessa", "Faisal", "Alya", "Tariq", "Dana",
  "Nasser", "Moza", "Ahmed", "Sara", "Omar", "Lulwa", "Ali", "Amna",
];
const lastNames = [
  "Al-Marri", "Al-Naimi", "Al-Ketbi", "Al-Shamsi", "Al-Qahtani", "Al-Otaibi", "Al-Kuwari", "Al-Hajri",
  "Al-Dhaheri", "Al-Ghamdi", "Al-Emadi", "Al-Mazrouei", "Al-Sulaiti", "Al-Mansoori", "Al-Harbi", "Al-Thani",
  "Al-Suwaidi", "Al-Shehhi", "Al-Mutairi", "Al-Romaihi",
];
const phonePrefixes = ["+974 55", "+974 66", "+974 33", "+971 50", "+971 55", "+966 55", "+966 50"];
const failures = [
  { reason: "Message undeliverable", code: 131026 },
  { reason: "Re-engagement message", code: 131047 },
  { reason: "Spam rate limit hit", code: 131048 },
  { reason: "Message failed to send because of an unknown error", code: 131000 },
];
const skips = ["Missing phone number", "Invalid phone number"];

const deliveryCache = new Map<number, Delivery[]>();

export function deliveriesFor(id: number): Delivery[] {
  const cached = deliveryCache.get(id);
  if (cached) return cached;
  const plan = deliveryPlan[id];
  const campaign = whatsappCampaigns.find((c) => c.id === id);
  if (!plan || !campaign) return [];
  // Interleave statuses so every page of "All" shows a realistic mix.
  const remaining = { ...plan };
  const order: DeliveryStatus[] = ["read", "delivered", "read", "sent", "read", "failed", "delivered", "queued", "skipped"];
  const rows: Delivery[] = [];
  let cursor = 0;
  const total = Object.values(plan).reduce((a, b) => a + b, 0);
  while (rows.length < total) {
    const status = order[cursor % order.length];
    cursor++;
    if (remaining[status] <= 0) continue;
    remaining[status]--;
    const i = rows.length;
    const name = `${firstNames[(i * 7) % firstNames.length]} ${lastNames[(i * 3 + Math.floor(i / 20)) % lastNames.length]}`;
    const digits = String(1000000 + ((i * 7919 + id * 104729) % 9000000)).slice(1);
    const skipped = status === "skipped";
    const failure = failures[i % failures.length];
    rows.push({
      id: i + 1,
      name,
      phone: skipped && i % 2 === 0 ? "" : `${phonePrefixes[i % phonePrefixes.length]} ${digits.slice(0, 3)} ${digits.slice(3)}`,
      status,
      message:
        status === "skipped" || status === "queued"
          ? null
          : campaign.message.replace("{{1}}", name.split(" ")[0]),
      reason: status === "failed" ? failure.reason : skipped ? skips[i % 2] : null,
      code: status === "failed" ? failure.code : null,
    });
  }
  deliveryCache.set(id, rows);
  return rows;
}

export function metricsFor(id: number) {
  const plan = deliveryPlan[id] ?? { read: 0, delivered: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };
  const audience = Object.values(plan).reduce((a, b) => a + b, 0);
  return {
    audience,
    sent: audience - plan.queued - plan.skipped,
    delivered: plan.delivered + plan.read,
    read: plan.read,
    failed: plan.failed,
    skipped: plan.skipped,
    queued: plan.queued,
    awaiting: plan.sent,
  };
}
