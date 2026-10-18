// F161 foundation: ONE source for the people and lists every section shows (Conversations, sidebar, Settings,
// Users & Roles, Reports, Calls, Campaigns). Mock data only, no backend. Field names follow Chatwoot where cheap
// (role "administrator" | "agent", availability, confirmed, channel_type → channelType).
// Mutable copies (what Settings adds, edits or deletes) live in ./store.ts; read these seeds only for first values.

export type Availability = "online" | "busy" | "offline";
export type AgentRole = "administrator" | "agent";

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: AgentRole;
  customRoleId: number | null;
  availability: Availability;
  confirmed: boolean;
  provider: "email" | "saml";
  joinedDate: string;
}

/** The signed-in agent everywhere (sidebar user, "Mine", own row in Users): Arham Khan. */
export const CURRENT_USER_ID = 1;

// The Users & Roles roster (17). Ids 1-5 are the agents who work the sample conversations.
export const agents: Agent[] = [
  {
    id: 1,
    name: "Arham Khan",
    email: "arham.khan@weblabs.studio",
    role: "administrator",
    customRoleId: null,
    availability: "online",
    confirmed: true,
    provider: "email",
    joinedDate: "02 Feb 2024, 9:10 AM",
  },
  {
    id: 2,
    name: "Priya Nair",
    email: "priya.nair@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "online",
    confirmed: true,
    provider: "email",
    joinedDate: "14 Mar 2024, 11:25 AM",
  },
  {
    id: 3,
    name: "Yousef Al-Harbi",
    email: "yousef.harbi@weblabs.studio",
    role: "agent",
    customRoleId: 1,
    availability: "busy",
    confirmed: true,
    provider: "email",
    joinedDate: "21 Apr 2024, 8:40 AM",
  },
  {
    id: 4,
    name: "Lina Haddad",
    email: "lina.haddad@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "online",
    confirmed: true,
    provider: "email",
    joinedDate: "05 May 2024, 2:15 PM",
  },
  {
    id: 5,
    name: "Ravi Menon",
    email: "ravi.menon@weblabs.studio",
    role: "agent",
    customRoleId: 2,
    availability: "offline",
    confirmed: true,
    provider: "email",
    joinedDate: "19 May 2024, 10:05 AM",
  },
  {
    id: 6,
    name: "Karim Mansour",
    email: "karim.mansour@weblabs.studio",
    role: "agent",
    customRoleId: 3,
    availability: "online",
    confirmed: true,
    provider: "email",
    joinedDate: "03 Jun 2024, 4:30 PM",
  },
  {
    id: 7,
    name: "Noor Saleh",
    email: "noor.saleh@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "offline",
    confirmed: false,
    provider: "email",
    joinedDate: "08 Oct 2026, 9:45 AM",
  },
  {
    id: 8,
    name: "Ahmed Rashid",
    email: "ahmed.rashid@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "offline",
    confirmed: true,
    provider: "email",
    joinedDate: "17 Jul 2024, 1:20 PM",
  },
  {
    id: 9,
    name: "Hana Youssef",
    email: "hana.youssef@weblabs.studio",
    role: "agent",
    customRoleId: 4,
    availability: "offline",
    confirmed: true,
    provider: "email",
    joinedDate: "29 Aug 2024, 3:55 PM",
  },
  {
    id: 10,
    name: "Marco Bianchi",
    email: "marco.bianchi@weblabs.studio",
    role: "agent",
    customRoleId: 5,
    availability: "busy",
    confirmed: true,
    provider: "saml",
    joinedDate: "11 Sep 2024, 12:00 PM",
  },
  {
    id: 11,
    name: "Sofia Martins",
    email: "sofia.martins@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "online",
    confirmed: true,
    provider: "email",
    joinedDate: "02 Oct 2024, 7:35 AM",
  },
  {
    id: 12,
    name: "Tariq Aziz",
    email: "tariq.aziz@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "offline",
    confirmed: false,
    provider: "email",
    joinedDate: "10 Oct 2026, 5:10 PM",
  },
  {
    id: 13,
    name: "Huda Saleem",
    email: "huda.saleem@weblabs.studio",
    role: "agent",
    customRoleId: 2,
    availability: "online",
    confirmed: true,
    provider: "email",
    joinedDate: "26 Nov 2024, 9:00 AM",
  },
  {
    id: 14,
    name: "Ali Hassan",
    email: "ali.hassan@weblabs.studio",
    role: "agent",
    customRoleId: 3,
    availability: "offline",
    confirmed: false,
    provider: "email",
    joinedDate: "11 Oct 2026, 11:40 AM",
  },
  {
    id: 15,
    name: "Rania Khalil",
    email: "rania.khalil@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "busy",
    confirmed: true,
    provider: "email",
    joinedDate: "14 Jan 2025, 2:50 PM",
  },
  {
    id: 16,
    name: "Tom Becker",
    email: "tom.becker@weblabs.studio",
    role: "agent",
    customRoleId: null,
    availability: "offline",
    confirmed: true,
    provider: "saml",
    joinedDate: "03 Mar 2025, 10:30 AM",
  },
  {
    id: 17,
    name: "Dana Bakr",
    email: "dana.bakr@weblabs.studio",
    role: "administrator",
    customRoleId: null,
    availability: "offline",
    confirmed: false,
    provider: "email",
    joinedDate: "12 Oct 2026, 8:15 AM",
  },
];

export const currentAgent: Agent = agents[0];

export type ChannelKey =
  | "website"
  | "facebook"
  | "whatsapp"
  | "whatsapp_call"
  | "sms"
  | "email"
  | "api"
  | "telegram"
  | "line"
  | "instagram"
  | "tiktok"
  | "voice";

export interface Inbox {
  id: number;
  /** The conversation channel id the inbox's conversations use (/dashboard/chat/channels/<slug>). */
  slug: string;
  name: string;
  channel: ChannelKey;
  /** Chatwoot channel_type label shown in the conversation panels. */
  channelType: string;
  identifier: string;
  agents: number[];
  autoAssign: boolean;
  /** Chatwoot provider of the channel: decides which settings tabs show (Settings.vue tabs()). */
  provider?: "whatsapp_cloud" | "twilio";
}

// The eight inboxes of Settings > Inboxes, in that order. The first six carry the sample conversations.
export const inboxes: Inbox[] = [
  {
    id: 1,
    slug: "email",
    name: "Support Email",
    channel: "email",
    channelType: "Email",
    identifier: "support@weblabs.studio",
    agents: [1, 2, 3, 4, 8, 9, 12, 15, 16],
    autoAssign: false,
  },
  {
    id: 2,
    slug: "chat",
    name: "Website Chat",
    channel: "website",
    channelType: "Website",
    identifier: "weblabs.studio",
    agents: [1, 2, 3, 4, 5, 7, 10, 11, 17],
    autoAssign: true,
  },
  {
    id: 3,
    slug: "whatsapp",
    name: "WhatsApp Business",
    channel: "whatsapp",
    channelType: "WhatsApp",
    identifier: "+974 4400 1122",
    agents: [1, 2, 3, 4, 5, 6, 13],
    autoAssign: true,
    provider: "whatsapp_cloud",
  },
  {
    id: 4,
    slug: "instagram",
    name: "Instagram",
    channel: "instagram",
    channelType: "Instagram",
    identifier: "@weblabs.studio",
    agents: [2, 3, 5, 6, 14],
    autoAssign: true,
  },
  {
    id: 5,
    slug: "facebook",
    name: "Facebook Page",
    channel: "facebook",
    channelType: "Messenger",
    identifier: "Weblabs Studio",
    agents: [2, 3, 4],
    autoAssign: true,
  },
  {
    id: 6,
    slug: "phone",
    name: "Phone",
    channel: "voice",
    channelType: "Voice",
    identifier: "+974 4400 1100",
    agents: [1, 2, 3, 4, 5],
    autoAssign: false,
    provider: "twilio",
  },
  {
    id: 7,
    slug: "sms",
    name: "SMS Alerts",
    channel: "sms",
    channelType: "SMS",
    identifier: "+974 4400 1144",
    agents: [2, 3, 11, 13],
    autoAssign: true,
    provider: "twilio",
  },
  {
    id: 8,
    slug: "api",
    name: "Mobile App API",
    channel: "api",
    channelType: "API",
    identifier: "api.weblabs.studio",
    agents: [1, 4, 5, 10],
    autoAssign: true,
  },
];

export interface Team {
  id: number;
  /** URL id of the team's conversation view (/dashboard/chat/teams/<slug>) and ConversationMeta.teamId. */
  slug: string;
  name: string;
  description: string;
  icon: string;
  members: number[];
  autoAssign: boolean;
}

// T-74: the preview starts with no teams; the admin creates them in Settings > Teams. Teams an admin already saved
// come from the preview server (./store.ts), not from here. The sample conversations still name the old team ids
// (sales, support, billing, technical), which now match no team until one with that id is created.
export const teams: Team[] = [];

export interface Label {
  id: string;
  title: string;
  description: string;
  color: string;
  showOnSidebar: boolean;
}

// Fahad's five Arabic labels from Studio before F159 (chat-tags-store.ts at dd8f5a9), after the five English sample
// labels that saved rules, macros, CSAT and capacity policies still use. T-262 removed auto-closed, feedback and spam;
// T-271 put partner back because the capacity policy «Full-time agents» uses it.
export const labels: Label[] = [
  {
    id: "vip",
    title: "vip",
    description: "Key accounts that get an answer first",
    color: "#8b5cf6",
    showOnSidebar: true,
  },
  {
    id: "billing",
    title: "billing",
    description: "Invoices, refunds and payment questions",
    color: "#0ea5e9",
    showOnSidebar: true,
  },
  {
    id: "lead",
    title: "lead",
    description: "New sales leads and demo requests",
    color: "#f59e0b",
    showOnSidebar: true,
  },
  {
    id: "partner",
    title: "partner",
    description: "Resellers and integration partners",
    color: "#14b8a6",
    showOnSidebar: true,
  },
  {
    id: "support",
    title: "support",
    description: "General product questions and how-tos",
    color: "#ec4899",
    showOnSidebar: true,
  },
  { id: "buyer", title: "مشتري", description: "", color: "#10b981", showOnSidebar: true },
  { id: "interested", title: "مهتم", description: "", color: "#0284c7", showOnSidebar: true },
  { id: "seller", title: "بائع", description: "", color: "#a855f7", showOnSidebar: true },
  { id: "follow-up", title: "متابعة", description: "", color: "#d97706", showOnSidebar: true },
  { id: "maintenance", title: "صيانة", description: "", color: "#e11d48", showOnSidebar: true },
];

export interface CannedResponse {
  id: number;
  shortCode: string;
  content: string;
}

// Settings > Canned Responses and the reply box "/" list.
export const cannedResponses: CannedResponse[] = [
  {
    id: 1,
    shortCode: "greeting",
    content: "Hello {{contact.name}}, thank you for reaching out to us. How can I help you today?",
  },
  { id: 2, shortCode: "salam", content: "وعليكم السلام ورحمة الله، أهلاً بك. كيف يمكننا مساعدتك اليوم؟" },
  {
    id: 3,
    shortCode: "delivery-time",
    content: "Orders inside Doha are delivered within 24 hours. Al Khor, Dukhan and Mesaieed take 2 to 3 working days.",
  },
  {
    id: 4,
    shortCode: "refund-policy",
    content:
      "You can return any unused item within 14 days. The refund reaches your card in 5 to 7 working days after we receive it.",
  },
  {
    id: 5,
    shortCode: "working-hours",
    content: "Our team is available Saturday to Thursday, 8:00 AM to 10:00 PM (Doha time). Friday from 2:00 PM.",
  },
  {
    id: 6,
    shortCode: "payment-link",
    content:
      "Here is your secure payment link for order {{conversation.custom_attribute.order_number}}. It is valid for 24 hours.",
  },
  {
    id: 7,
    shortCode: "escalate",
    content: "I have passed this to our technical team. You will hear back from us within 2 hours.",
  },
  {
    id: 8,
    shortCode: "invoice-copy",
    content: "I have attached a copy of your invoice. Let me know if anything looks off.",
  },
  { id: 9, shortCode: "closing", content: "Is there anything else I can help you with? Have a lovely day!" },
];

export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "UNSUBMITTED";
export type TemplateType =
  | "Text"
  | "Image"
  | "Video"
  | "Document"
  | "Media"
  | "Quick reply"
  | "Call to action"
  | "Catalog"
  | "Copy code";

export interface WhatsAppTemplate {
  name: string;
  status: TemplateStatus;
  type: TemplateType;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: "English" | "Arabic";
  /** Chatwoot language code sent with the template. */
  code: string;
  inboxes: string[];
  provider: "Meta" | "Twilio";
  header?: string;
  media?: "image" | "video" | "document";
  body: string;
  footer?: string;
  buttons?: string[];
  /** Sample values approved with the template for {{2}}, {{3}} ({{1}} is the contact's first name). */
  examples?: string[];
}

// ONE set of WhatsApp templates for Settings > Templates, the reply box and WhatsApp campaigns. All belong to the
// account's WhatsApp inbox (WhatsApp Business, Meta) except the Twilio ones, which belong to SMS Alerts (Twilio).
export const whatsappTemplates: WhatsAppTemplate[] = [
  {
    name: "order_update",
    status: "APPROVED",
    type: "Text",
    category: "UTILITY",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    body: "Hi {{1}}, your order {{2}} is on its way and should arrive by {{3}}.",
    examples: ["ORD-8824", "Thursday, Oct 15"],
  },
  {
    name: "payment_reminder",
    status: "APPROVED",
    type: "Text",
    category: "UTILITY",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    body: "Hello {{1}}, a friendly reminder that invoice {{2}} is due on {{3}}.",
    examples: ["INV-4821", "Oct 15, 2026"],
  },
  {
    name: "hello_world",
    status: "APPROVED",
    type: "Text",
    category: "MARKETING",
    language: "English",
    code: "en_US",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    body: "Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification.",
  },
  {
    name: "order_confirmation",
    status: "APPROVED",
    type: "Call to action",
    category: "UTILITY",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    header: "Order confirmed",
    body: "Hi {{1}}, thank you for your order {{2}}. We will deliver it to {{3}} within 24 hours.",
    footer: "Reply STOP to unsubscribe",
    buttons: ["Track order"],
    examples: ["ORD-8824", "West Bay, Doha"],
  },
  {
    name: "order_confirmation_ar",
    status: "APPROVED",
    type: "Call to action",
    category: "UTILITY",
    language: "Arabic",
    code: "ar",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    header: "تم تأكيد طلبك",
    body: "مرحباً {{1}}، شكراً لطلبك رقم {{2}}. سنوصله إلى {{3}} خلال ٢٤ ساعة.",
    buttons: ["تتبع الطلب"],
    examples: ["ORD-8824", "الدفنة، الدوحة"],
  },
  {
    name: "delivery_out_today",
    status: "APPROVED",
    type: "Quick reply",
    category: "UTILITY",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    body: "Good news {{1}}! Your order is out for delivery today between {{2}}. Will someone be home?",
    buttons: ["Yes", "Reschedule"],
    examples: ["2 PM and 5 PM"],
  },
  {
    name: "ramadan_offer_2026",
    status: "PENDING",
    type: "Image",
    category: "MARKETING",
    language: "Arabic",
    code: "ar",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    media: "image",
    body: "رمضان كريم 🌙 خصم ٢٠٪ على جميع الأجهزة المنزلية حتى نهاية الشهر. استخدم الرمز {{1}}.",
  },
  {
    name: "product_demo_video",
    status: "APPROVED",
    type: "Video",
    category: "MARKETING",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    media: "video",
    body: "See the new Smart Air Fryer in 30 seconds, {{1}}. Reply YES to book a home demo.",
  },
  {
    name: "invoice_ready",
    status: "APPROVED",
    type: "Document",
    category: "UTILITY",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    media: "document",
    body: "Hello {{1}}, your invoice {{2}} for QAR {{3}} is attached.",
    examples: ["INV-4821", "1,250"],
  },
  {
    name: "login_code",
    status: "APPROVED",
    type: "Copy code",
    category: "AUTHENTICATION",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    body: "{{1}} is your verification code. For your security, do not share this code.",
    buttons: ["Copy code"],
  },
  {
    name: "new_arrivals_catalog",
    status: "APPROVED",
    type: "Catalog",
    category: "MARKETING",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    body: "New arrivals are here, {{1}}! Browse the autumn collection right inside WhatsApp.",
    buttons: ["View catalog"],
  },
  {
    name: "feedback_request",
    status: "REJECTED",
    type: "Quick reply",
    category: "MARKETING",
    language: "English",
    code: "en",
    inboxes: ["WhatsApp Business"],
    provider: "Meta",
    body: "How was your visit to our showroom today, {{1}}?",
    buttons: ["Great", "Okay", "Not good"],
  },
  {
    name: "appointment_reminder",
    status: "UNSUBMITTED",
    type: "Text",
    category: "UTILITY",
    language: "English",
    code: "en",
    inboxes: ["SMS Alerts"],
    provider: "Twilio",
    body: "Reminder: your service visit is booked for {{1}} at {{2}}. Reply 1 to confirm or 2 to change.",
  },
  {
    name: "branch_photos",
    status: "APPROVED",
    type: "Media",
    category: "MARKETING",
    language: "Arabic",
    code: "ar",
    inboxes: ["SMS Alerts"],
    provider: "Twilio",
    media: "image",
    body: "افتتحنا فرعنا الجديد في لوسيل 🎉 تفضل بزيارتنا واحصل على هدية ترحيبية.",
  },
];

/** Templates an agent can send from the WhatsApp inbox (approved, Meta). */
export const sendableTemplates = whatsappTemplates.filter((t) => t.status === "APPROVED" && t.provider === "Meta");

export function agentById(id: number | null | undefined): Agent | undefined {
  return id ? agents.find((agent) => agent.id === id) : undefined;
}

export function agentByName(name: string | null | undefined): Agent | undefined {
  return name ? agents.find((agent) => agent.name === name) : undefined;
}

export function inboxById(id: number): Inbox | undefined {
  return inboxes.find((inbox) => inbox.id === id);
}

export function inboxBySlug(slug: string): Inbox | undefined {
  return inboxes.find((inbox) => inbox.slug === slug);
}

export function teamById(id: number): Team | undefined {
  return teams.find((team) => team.id === id);
}

export function teamBySlug(slug: string): Team | undefined {
  return teams.find((team) => team.slug === slug);
}

/** Teams an agent belongs to, in team order. */
export function teamsOf(agentId: number, list: Team[] = teams): Team[] {
  return list.filter((team) => team.members.includes(agentId));
}

/** Inboxes an agent is a member of, in inbox order. */
export function inboxesOf(agentId: number, list: Inbox[] = inboxes): Inbox[] {
  return list.filter((inbox) => inbox.agents.includes(agentId));
}
