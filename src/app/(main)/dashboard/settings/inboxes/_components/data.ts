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

import { type ChannelKey, type Inbox, agents as sharedAgents, inboxes as sharedInboxes } from "@/lib/cw/data";

// F161: channel keys, inboxes and agents come from the shared layer (src/lib/cw/data.ts).
export type { ChannelKey, Inbox } from "@/lib/cw/data";

export interface Channel {
  key: ChannelKey;
  title: string;
  description: string;
  name: string;
  icon: LucideIcon;
  /** Chatwoot ChannelItem.vue isBeta: TikTok, Voice and WhatsApp Call carry a "Beta" badge. */
  beta?: boolean;
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
  {
    key: "tiktok",
    title: "TikTok",
    description: "Connect your TikTok account",
    name: "TikTok",
    icon: Music2,
    beta: true,
  },
  {
    key: "voice",
    title: "Voice",
    description: "Integrate with Twilio Voice",
    name: "Voice",
    icon: PhoneCall,
    beta: true,
  },
  // Chatwoot ChannelList.vue pushes WhatsApp Call last.
  {
    key: "whatsapp_call",
    title: "WhatsApp Call",
    description: "Take voice calls on your WhatsApp number",
    name: "WhatsApp",
    icon: Phone,
    beta: true,
  },
];

export function channelFor(key: ChannelKey): Channel {
  return channels.find((c) => c.key === key) ?? channels[0];
}

// F161: the eight inboxes and the agent roster are the shared ones (Users & Roles, Conversations, Reports).
export const inboxes: Inbox[] = sharedInboxes;

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: "Administrator" | "Agent";
}

export const agents: Agent[] = sharedAgents.map((agent) => ({
  id: agent.id,
  name: agent.name,
  email: agent.email,
  role: agent.role === "administrator" ? "Administrator" : "Agent",
}));

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

/** The channel name a row shows under the inbox name (Chatwoot's channel type label). */
export function inboxChannelName(inbox: Inbox): string {
  // Chatwoot ChannelName.vue: a Twilio SMS inbox reads "Twilio SMS".
  if (inbox.channel === "sms" && inbox.provider === "twilio") return "Twilio SMS";
  return channelFor(inbox.channel).name;
}
