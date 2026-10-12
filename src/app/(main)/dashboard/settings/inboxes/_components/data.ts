import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Globe,
  Mail,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  Music2,
  Phone,
  PhoneCall,
  Send,
  Smartphone,
  Webhook,
} from "lucide-react";

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

export interface Channel {
  key: ChannelKey;
  title: string;
  description: string;
  name: string;
  icon: LucideIcon;
}

// Labels copied from Chatwoot INBOX_MGMT.ADD.AUTH.CHANNEL and INBOX_MGMT.CHANNELS
export const channels: Channel[] = [
  { key: "website", title: "Website", description: "Create a live-chat widget", name: "Website", icon: Globe },
  {
    key: "facebook",
    title: "Facebook",
    description: "Connect your Facebook page",
    name: "Messenger",
    icon: MessagesSquare,
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    description: "Support your customers on WhatsApp",
    name: "WhatsApp",
    icon: MessageCircle,
  },
  {
    key: "whatsapp_call",
    title: "WhatsApp Call",
    description: "Take voice calls on your WhatsApp number",
    name: "WhatsApp",
    icon: Phone,
  },
  {
    key: "sms",
    title: "SMS",
    description: "Integrate SMS channel with Twilio or bandwidth",
    name: "SMS",
    icon: Smartphone,
  },
  {
    key: "email",
    title: "Email",
    description: "Connect with Gmail, Outlook, or other providers",
    name: "Email",
    icon: Mail,
  },
  { key: "api", title: "API", description: "Make a custom channel using our API", name: "API Channel", icon: Webhook },
  {
    key: "telegram",
    title: "Telegram",
    description: "Configure Telegram channel using Bot token",
    name: "Telegram",
    icon: Send,
  },
  { key: "line", title: "Line", description: "Integrate your Line channel", name: "Line", icon: MessageSquareText },
  {
    key: "instagram",
    title: "Instagram",
    description: "Connect your instagram account",
    name: "Instagram",
    icon: Camera,
  },
  { key: "tiktok", title: "TikTok", description: "Connect your TikTok account", name: "TikTok", icon: Music2 },
  { key: "voice", title: "Voice", description: "Integrate with Twilio Voice", name: "Voice", icon: PhoneCall },
];

export function channelFor(key: ChannelKey): Channel {
  return channels.find((c) => c.key === key) ?? channels[0];
}

export interface Inbox {
  id: number;
  name: string;
  channel: ChannelKey;
  identifier: string;
  agents: number[];
  autoAssign: boolean;
  /** Chatwoot provider of the channel: decides which settings tabs show (Settings.vue tabs()). */
  provider?: "whatsapp_cloud" | "twilio";
}

// F159: the six inboxes of Conversations (cw-data.ts inboxes), same names and addresses, in the same order, then
// two settings-only examples (SMS, API).
export const inboxes: Inbox[] = [
  {
    id: 1,
    name: "Support Email",
    channel: "email",
    identifier: "support@weblabs.studio",
    agents: [1, 2, 3, 4],
    autoAssign: false,
  },
  {
    id: 2,
    name: "Website Chat",
    channel: "website",
    identifier: "weblabs.studio",
    agents: [1, 2, 3, 4, 5],
    autoAssign: true,
  },
  {
    id: 3,
    name: "WhatsApp Business",
    channel: "whatsapp",
    identifier: "+974 4400 1122",
    agents: [1, 2, 4, 5],
    autoAssign: true,
    provider: "whatsapp_cloud",
  },
  {
    id: 4,
    name: "Instagram",
    channel: "instagram",
    identifier: "@weblabs.studio",
    agents: [2, 5],
    autoAssign: true,
  },
  {
    id: 5,
    name: "Facebook Page",
    channel: "facebook",
    identifier: "Weblabs Studio",
    agents: [2, 3, 4],
    autoAssign: true,
  },
  {
    id: 6,
    name: "Phone",
    channel: "voice",
    identifier: "+974 4400 1100",
    agents: [1, 3],
    autoAssign: false,
    provider: "twilio",
  },
  // F159 settings-a: two more channel types so every inbox settings tab can be opened (Twilio SMS and API).
  {
    id: 7,
    name: "SMS Alerts",
    channel: "sms",
    identifier: "+974 4400 1144",
    agents: [2, 3],
    autoAssign: true,
    provider: "twilio",
  },
  {
    id: 8,
    name: "Mobile App API",
    channel: "api",
    identifier: "api.weblabs.studio",
    agents: [1, 4, 5],
    autoAssign: true,
  },
];

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: "Administrator" | "Agent";
}

// F159: the same five agents as Conversations (cw-data.ts), same ids, names and emails.
export const agents: Agent[] = [
  { id: 1, name: "Arham Khan", email: "arham.khan@weblabs.studio", role: "Administrator" },
  { id: 2, name: "Priya Nair", email: "priya.nair@weblabs.studio", role: "Agent" },
  { id: 3, name: "Yousef Al-Harbi", email: "yousef.harbi@weblabs.studio", role: "Agent" },
  { id: 4, name: "Lina Haddad", email: "lina.haddad@weblabs.studio", role: "Agent" },
  { id: 5, name: "Ravi Menon", email: "ravi.menon@weblabs.studio", role: "Agent" },
];

const tones = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
];

export function toneFor(id: number) {
  return tones[id % tones.length];
}
