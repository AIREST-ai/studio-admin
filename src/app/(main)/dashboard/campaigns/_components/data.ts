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
    sender: "Noura Al-Kuwari",
    inbox: "Website — Doha",
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
    inbox: "Website — Dubai",
    url: "https://example.ae/pricing",
    timeOnPage: 25,
    businessHoursOnly: true,
  },
  {
    id: 3,
    title: "Abandoned checkout nudge",
    message: "Still thinking it over? Ask us anything about payment in instalments with Tabby or Tamara.",
    enabled: false,
    sender: "Omar Al-Harthy",
    inbox: "Website — Riyadh",
    url: "https://example.sa/checkout",
    timeOnPage: 40,
    businessHoursOnly: false,
  },
  {
    id: 4,
    title: "School registration week",
    message: "Registering for the new term? Send us the grade and we will share the fee schedule.",
    enabled: true,
    sender: "Mariam Al-Sulaiti",
    inbox: "Website — Doha",
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
    inbox: "Website — Doha",
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
    inbox: "Twilio SMS — Qatar",
    scheduledAt: "Oct 20, 2026, 9:00 AM",
    audience: ["customers", "vip"],
  },
  {
    id: 12,
    title: "Appointment reminders — West Bay clinic",
    message: "Reminder: your appointment at West Bay clinic is tomorrow. Reply 1 to confirm or 2 to reschedule.",
    status: "processing",
    inbox: "Twilio SMS — Qatar",
    scheduledAt: "Oct 12, 2026, 8:30 AM",
    audience: ["appointments"],
  },
  {
    id: 13,
    title: "Dubai Mall pop-up store",
    message: "Our pop-up at Dubai Mall is open this weekend. Show this SMS for a free gift with any order.",
    status: "completed",
    inbox: "Bandwidth SMS — UAE",
    scheduledAt: "Oct 3, 2026, 6:00 PM",
    audience: ["dubai", "leads"],
  },
  {
    id: 14,
    title: "Service outage notice",
    message: "Planned maintenance tonight 1am-3am. Online orders will resume at 3am. Thank you for your patience.",
    status: "completed",
    inbox: "Twilio SMS — Qatar",
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
    inbox: "WhatsApp — +974 4410 2200",
    scheduledAt: "Oct 12, 2026, 10:00 AM",
    audience: ["vip", "customers"],
    template: "white_friday_early (en)",
  },
  {
    id: 22,
    title: "Order delivered survey",
    message: "Your order has arrived. How was your delivery? Rate us from 1 to 5.",
    status: "completed",
    inbox: "WhatsApp — +974 4410 2200",
    scheduledAt: "Oct 6, 2026, 4:00 PM",
    audience: ["recent-orders"],
    template: "delivery_feedback (en)",
  },
  {
    id: 23,
    title: "Riyadh Season tickets",
    message: "مرحباً {{1}}، تذاكر موسم الرياض متاحة الآن. احجز مقعدك قبل نفاد الكمية.",
    status: "scheduled",
    inbox: "WhatsApp — +966 11 520 8800",
    scheduledAt: "Oct 25, 2026, 7:00 PM",
    audience: ["riyadh", "leads"],
    template: "riyadh_season_tickets (ar)",
  },
  {
    id: 24,
    title: "Back to school bundles",
    message: "Hi {{1}}, back-to-school bundles are now in stock in Abu Dhabi and Dubai stores.",
    status: "completed",
    inbox: "WhatsApp — +971 4 330 1900",
    scheduledAt: "Aug 24, 2026, 11:00 AM",
    audience: ["parents"],
    template: "back_to_school (en)",
  },
];

export const websiteInboxes = ["Website — Doha", "Website — Dubai", "Website — Riyadh"];
export const smsInboxes = ["Twilio SMS — Qatar", "Bandwidth SMS — UAE"];
export const whatsappInboxes = ["WhatsApp — +974 4410 2200", "WhatsApp — +971 4 330 1900", "WhatsApp — +966 11 520 8800"];
export const senders = ["Bot", "Noura Al-Kuwari", "Omar Al-Harthy", "Mariam Al-Sulaiti", "Faisal Al-Mutairi"];
export const labels = ["customers", "vip", "leads", "appointments", "recent-orders", "dubai", "riyadh", "parents"];
export const whatsappTemplates = [
  { value: "white_friday_early", label: "White Friday Early (en)", category: "MARKETING", language: "en" },
  { value: "delivery_feedback", label: "Delivery Feedback (en)", category: "UTILITY", language: "en" },
  { value: "riyadh_season_tickets", label: "Riyadh Season Tickets (ar)", category: "MARKETING", language: "ar" },
];

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "skipped";

export interface Delivery {
  id: number;
  name: string;
  phone: string;
  status: DeliveryStatus;
  message: string | null;
  reason: string | null;
}

export const analyticsMetrics = {
  audience: 1240,
  sent: 1188,
  delivered: 1102,
  read: 846,
  failed: 31,
  skipped: 21,
  queued: 12,
};

const people = [
  ["Hamad Al-Marri", "+974 5501 2287"],
  ["Aisha Al-Naimi", "+974 6612 9034"],
  ["Rashid Al-Ketbi", "+971 50 118 4420"],
  ["Latifa Al-Shamsi", "+971 55 902 1176"],
  ["Abdullah Al-Qahtani", "+966 55 340 8812"],
  ["Reem Al-Otaibi", "+966 50 771 2093"],
  ["Jassim Al-Kuwari", "+974 3377 1450"],
  ["Fatima Al-Hajri", "+974 5590 8821"],
  ["Sultan Al-Dhaheri", "+971 52 664 3018"],
  ["Huda Al-Ghamdi", "+966 54 228 9907"],
  ["Yousef Al-Emadi", "+974 7001 4432"],
  ["Shaikha Al-Mazrouei", "+971 56 330 7781"],
] as const;

const statuses: DeliveryStatus[] = [
  "read",
  "read",
  "delivered",
  "read",
  "failed",
  "delivered",
  "sent",
  "read",
  "skipped",
  "queued",
  "read",
  "delivered",
];

export const deliveries: Delivery[] = people.map(([name, phone], index) => {
  const status = statuses[index];
  return {
    id: index + 1,
    name,
    phone: status === "skipped" ? "" : phone,
    status,
    message:
      status === "skipped" || status === "queued"
        ? null
        : `Hi ${name.split(" ")[0]}, White Friday starts early for you! Shop 48 hours before everyone else.`,
    reason:
      status === "failed"
        ? "Code 131026 · Message undeliverable"
        : status === "skipped"
          ? "Missing phone number"
          : null,
  };
});
