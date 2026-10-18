import { PRODUCT_NAME } from "@/config/app-config";
// M129-C (Fahad 129.3): what each channel allows for a campaign (broadcast), from the platforms' own pages. Research:
// lobehub-hub/monitor/notes/بحث-الأتمتة-والحملات-129.md sections 1 and 3. A channel that cannot broadcast says why,
// with its source; nothing is hidden without a reason.

export type CampaignChannel = "whatsapp" | "sms" | "instagram" | "messenger" | "tiktok" | "email" | "live_chat";
export type BroadcastChannel = "whatsapp" | "sms" | "instagram" | "messenger";

export interface ChannelRule {
  text: string;
  /** F-16: only official standards and sources are linked; a rule from another product's help centre has none. */
  source?: string;
  sourceLabel?: string;
}

export interface MediaLimit {
  kind: "image" | "video" | "audio" | "document";
  label: string;
  types: string[];
  extensions: string;
  maxBytes: number;
}

export interface ChannelInfo {
  id: CampaignChannel;
  label: string;
  /** Can a one-off broadcast be made here (in the preview's simulation)? */
  broadcast: boolean;
  /** Inbox channel key in lib/cw/data.ts. */
  inboxChannel?: string;
  summary: string;
  rules: ChannelRule[];
  /** Attachment limits a campaign on this channel may carry. */
  media?: MediaLimit[];
  /** The platform page the media limits come from. */
  mediaSource?: string;
  /** The 24-hour window decides who can receive it (Instagram, Messenger). */
  needsOpenWindow?: boolean;
  /** Needs a phone number (WhatsApp, SMS). */
  needsPhone?: boolean;
  href: string;
}

const MB = 1024 * 1024;

export const SOURCES = {
  waLimits: "https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits",
  waErrors: "https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes",
  waOptIn: "https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in",
  waPerUser:
    "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits/",
  waMedia: "https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media",
  waTemplates: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview",
  // F-16 round 2 (Fahad: "I do not want their links, not even hidden ones"): the rules that cited the engine's own code
  // (v4.18.0 app/models/campaign.rb and LiveChatCampaignForm.vue) keep their sentence and no longer link to it.
  // F-16: was Chatwoot's help article on WhatsApp campaigns (chatwoot.com) and respond.io's broadcast help: no links
  // to other products' sites; the WhatsApp rule now cites Meta's own error codes page (131047).
  igMessaging:
    "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api",
  messengerSend: "https://developers.facebook.com/docs/messenger-platform/reference/send-api",
  messengerAttachments: "https://developers.facebook.com/docs/messenger-platform/send-messages",
  messengerMarketing: "https://developers.facebook.com/docs/messenger-platform/marketing-messages",
  tiktokDm: "https://business-api.tiktok.com/portal/docs/manage-direct-messages-for-a-business-account/v1.3",
  tiktokLimits: "https://business-api.tiktok.com/portal/docs?id=1854823717597185",
} as const;

/** Meta's starting messaging limit (messaging-limits page). The preview's WhatsApp number has no Meta account, so it uses it. */
export const WHATSAPP_DAILY_LIMIT = 250;

export const CHANNELS: Record<CampaignChannel, ChannelInfo> = {
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    broadcast: true,
    inboxChannel: "whatsapp",
    needsPhone: true,
    mediaSource: SOURCES.waMedia,
    href: "/dashboard/campaigns/whatsapp",
    summary: "Approved templates only. Each contact needs a phone number and must have opted in.",
    rules: [
      {
        text: "Outside the customer's 24-hour window only an approved template can be sent (Meta error 131047). A campaign always sends a template; the engine allows no free-text broadcast.",
        source: SOURCES.waErrors,
        sourceLabel: "Meta: error codes (131047)",
      },
      {
        text: "Daily messaging limit: 250 → 2,000 → 10,000 → 100,000 → unlimited unique customers in a moving 24 hours, outside the window. New business portfolios start at 250.",
        source: SOURCES.waLimits,
        sourceLabel: "Meta: messaging limits",
      },
      {
        text: "Meta caps marketing templates per customer; a capped message fails with error 131049 and can be retried after 24 hours.",
        source: SOURCES.waPerUser,
        sourceLabel: "Meta: per-user marketing limits",
      },
      {
        text: "Customers must opt in to receive WhatsApp messages from the business.",
        source: SOURCES.waOptIn,
        sourceLabel: "Meta: getting opt-in",
      },
    ],
    media: [
      {
        kind: "image",
        label: "Image",
        types: ["image/jpeg", "image/png"],
        extensions: ".jpeg, .jpg, .png",
        maxBytes: 5 * MB,
      },
      {
        kind: "video",
        label: "Video",
        types: ["video/mp4", "video/3gpp"],
        extensions: ".mp4, .3gp (H.264 + AAC)",
        maxBytes: 16 * MB,
      },
      {
        kind: "document",
        label: "Document",
        types: [
          "application/pdf",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        extensions: ".pdf, .txt, .doc(x), .xls(x), .ppt(x)",
        maxBytes: 100 * MB,
      },
    ],
  },
  sms: {
    id: "sms",
    label: "SMS",
    broadcast: true,
    inboxChannel: "sms",
    needsPhone: true,
    href: "/dashboard/campaigns/sms",
    summary: "Text to contacts with a phone number. No 24-hour window.",
    rules: [
      {
        text: "Campaigns accept SMS inboxes (Twilio SMS and SMS), sent once to the selected audience.",
      },
      {
        text: "SMS has no read receipts, so the report shows delivered and failed, not read.",
      },
    ],
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    broadcast: true,
    inboxChannel: "instagram",
    needsOpenWindow: true,
    mediaSource: SOURCES.igMessaging,
    href: "/dashboard/campaigns/instagram",
    summary: "Only customers who messaged you in the last 24 hours. The customer starts the conversation.",
    rules: [
      {
        text: "A business can reply within 24 hours of the customer's last message; the customer starts the conversation.",
        source: SOURCES.igMessaging,
        sourceLabel: "Meta: Instagram messaging",
      },
      {
        text: "After 24 hours only the HUMAN_AGENT tag remains (7 days): a person's reply, not a broadcast. So contacts outside the window are skipped.",
        source: SOURCES.messengerSend,
        sourceLabel: "Meta: Send API (message tags)",
      },
    ],
    media: [
      {
        kind: "image",
        label: "Image",
        types: ["image/png", "image/jpeg"],
        extensions: ".png, .jpeg",
        maxBytes: 8 * MB,
      },
      {
        kind: "video",
        label: "Video",
        types: ["video/mp4", "video/ogg", "video/x-msvideo", "video/quicktime", "video/webm"],
        extensions: ".mp4, .ogg, .avi, .mov, .webm",
        maxBytes: 25 * MB,
      },
      {
        kind: "audio",
        label: "Audio",
        types: ["audio/aac", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav"],
        extensions: ".aac, .m4a, .wav, .mp4",
        maxBytes: 25 * MB,
      },
      { kind: "document", label: "PDF", types: ["application/pdf"], extensions: ".pdf only", maxBytes: 25 * MB },
    ],
  },
  messenger: {
    id: "messenger",
    label: "Messenger",
    broadcast: true,
    inboxChannel: "facebook",
    needsOpenWindow: true,
    mediaSource: SOURCES.messengerAttachments,
    href: "/dashboard/campaigns/messenger",
    summary: "Only customers who messaged your Page in the last 24 hours.",
    rules: [
      {
        text: "Standard messaging: within 24 hours of the customer's last message, promotions included.",
        source: SOURCES.messengerSend,
        sourceLabel: "Meta: Send API",
      },
      {
        text: "CONFIRMED_EVENT_UPDATE, ACCOUNT_UPDATE and POST_PURCHASE_UPDATE return error 100 since April 27, 2026. Only HUMAN_AGENT is left (7 days, a person's reply), so it cannot carry a campaign.",
        source: SOURCES.messengerSend,
        sourceLabel: "Meta: Send API (message tags)",
      },
      {
        text: `Promotions outside the window go through Meta's paid Marketing Messages API, for approved technology partners only. ${PRODUCT_NAME} has no such access.`,
        source: SOURCES.messengerMarketing,
        sourceLabel: "Meta: Marketing Messages",
      },
    ],
    // Meta gives Messenger one size (25 MB) and publishes no list of formats, so any file of the kind is accepted.
    media: [
      { kind: "image", label: "Image", types: ["image/*"], extensions: "any image", maxBytes: 25 * MB },
      { kind: "video", label: "Video", types: ["video/*"], extensions: "any video", maxBytes: 25 * MB },
      { kind: "audio", label: "Audio", types: ["audio/*"], extensions: "any audio", maxBytes: 25 * MB },
      { kind: "document", label: "File", types: ["*"], extensions: "any file", maxBytes: 25 * MB },
    ],
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    broadcast: false,
    inboxChannel: "tiktok",
    href: "/dashboard/campaigns/tiktok",
    summary: "No campaigns: TikTok does not let a business start a conversation.",
    rules: [
      {
        text: "TikTok's Business Messaging API forbids starting a conversation or messaging anyone who has not messaged the business first, so there is no broadcast on TikTok.",
        source: SOURCES.tiktokDm,
        sourceLabel: "TikTok: manage direct messages",
      },
      {
        text: "Inside a conversation: 10 messages in 48 hours after the customer's first message; after 48 hours without a reply, 3 messages only.",
        source: SOURCES.tiktokLimits,
        sourceLabel: "TikTok: message limits",
      },
    ],
  },
  email: {
    id: "email",
    label: "Email",
    broadcast: false,
    inboxChannel: "email",
    href: "/dashboard/campaigns/email",
    summary: "No campaigns from an email inbox: campaigns refuse email inboxes.",
    rules: [
      {
        text: 'The engine accepts campaigns only for Website, Twilio SMS, SMS and WhatsApp inboxes; any other inbox gets "Unsupported Inbox type".',
      },
      {
        text: "There is no email broadcast here. Newsletters belong to an email marketing tool.",
      },
    ],
  },
  live_chat: {
    id: "live_chat",
    label: "Website live chat",
    broadcast: false,
    inboxChannel: "website",
    href: "/dashboard/campaigns/live-chat",
    summary: "Not a broadcast: a message shown to visitors on a page of your site, from a Website inbox.",
    rules: [
      {
        text: 'Live chat campaigns are the engine\'s "ongoing" campaigns and only Website inboxes take them; they are not sent to a list of contacts.',
      },
      {
        text: "The message shows to a visitor of the URL you set after the number of seconds on the page you set, sent by an agent or the bot, optionally only during business hours.",
      },
    ],
  },
};

export const CHANNEL_ORDER: CampaignChannel[] = [
  "whatsapp",
  "sms",
  "instagram",
  "messenger",
  "tiktok",
  "email",
  "live_chat",
];
export const BROADCAST_CHANNELS: BroadcastChannel[] = ["whatsapp", "sms", "instagram", "messenger"];

export const isBroadcastChannel = (value: string | null | undefined): value is BroadcastChannel =>
  !!value && (BROADCAST_CHANNELS as string[]).includes(value);

const typeMatches = (pattern: string, type: string) =>
  pattern === "*" || pattern === type || (pattern.endsWith("/*") && type.startsWith(pattern.slice(0, -1)));

/** The channel's limit that accepts this file type (the first that matches), or undefined when the channel refuses it. */
export function mediaKindOf(channel: BroadcastChannel, type: string): MediaLimit | undefined {
  return CHANNELS[channel].media?.find((m) => m.types.some((pattern) => typeMatches(pattern, type)));
}
