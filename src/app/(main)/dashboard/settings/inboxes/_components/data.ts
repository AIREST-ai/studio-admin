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
}

export const inboxes: Inbox[] = [
  {
    id: 1,
    name: "Doha Website Chat",
    channel: "website",
    identifier: "www.alrayyan-clinics.qa",
    agents: [1, 2, 3, 5],
    autoAssign: true,
  },
  {
    id: 2,
    name: "WhatsApp Qatar",
    channel: "whatsapp",
    identifier: "+974 4412 7788",
    agents: [1, 2, 4],
    autoAssign: true,
  },
  {
    id: 3,
    name: "Support Email",
    channel: "email",
    identifier: "care@alrayyan-clinics.qa",
    agents: [2, 3, 6],
    autoAssign: false,
  },
  {
    id: 4,
    name: "Dubai Branch WhatsApp",
    channel: "whatsapp",
    identifier: "+971 4 388 1290",
    agents: [4, 7],
    autoAssign: true,
  },
  {
    id: 5,
    name: "Instagram DMs",
    channel: "instagram",
    identifier: "@alrayyan.clinics",
    agents: [5, 8],
    autoAssign: true,
  },
  {
    id: 6,
    name: "Appointments SMS",
    channel: "sms",
    identifier: "+974 3300 1456",
    agents: [1, 6],
    autoAssign: false,
  },
  {
    id: 7,
    name: "Riyadh Telegram",
    channel: "telegram",
    identifier: "@alrayyan_ksa_bot",
    agents: [7, 8],
    autoAssign: true,
  },
  { id: 8, name: "Booking API", channel: "api", identifier: "", agents: [3], autoAssign: false },
];

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: "Administrator" | "Agent";
}

export const agents: Agent[] = [
  { id: 1, name: "Noura Al-Thani", email: "noura@alrayyan-clinics.qa", role: "Administrator" },
  { id: 2, name: "Khalid Al-Kuwari", email: "khalid@alrayyan-clinics.qa", role: "Agent" },
  { id: 3, name: "Mariam Al-Sulaiti", email: "mariam@alrayyan-clinics.qa", role: "Agent" },
  { id: 4, name: "Omar Al-Mansoori", email: "omar@alrayyan-clinics.ae", role: "Agent" },
  { id: 5, name: "Fatima Al-Marri", email: "fatima@alrayyan-clinics.qa", role: "Agent" },
  { id: 6, name: "Yousef Al-Emadi", email: "yousef@alrayyan-clinics.qa", role: "Administrator" },
  { id: 7, name: "Reem Al-Otaibi", email: "reem@alrayyan-clinics.sa", role: "Agent" },
  { id: 8, name: "Hamad Al-Naimi", email: "hamad@alrayyan-clinics.qa", role: "Agent" },
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
