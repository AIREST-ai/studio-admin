// M129-B (items 129.1, 129.2): what the Studio simulator knows, as plain data (no React) so the tests load it outside
// the browser. Every limit below comes from the research table of item 129 (monitor/notes/بحث-الأتمتة-والحملات-129.md,
// section 1, checked against the platforms' own documents) and carries its source link, which the editor shows.
// Nothing here talks to Chatwoot, to a platform or to a customer.

import { PRODUCT_NAME } from "@/config/app-config";

import { attributeDefs, type EventKey, type MediaType } from "./catalog";
import type { FlowDoc, FlowEvent, FlowNode, SimChannel, SimEventKey } from "./model";
import { SIM_KINDS } from "./model";

export const MB = 1024 * 1024;
export const KB = 1024;

export interface Source {
  label: string;
  /** F-16 round 2: only official channel docs (Meta, TikTok, Telegram) keep a link; other products' code has none. */
  url?: string;
}

const S = {
  waMedia: {
    label: "WhatsApp Cloud API: media",
    url: "https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media",
  },
  waAudio: {
    label: "WhatsApp Cloud API: audio messages",
    url: "https://developers.facebook.com/docs/whatsapp/cloud-api/messages/audio-messages",
  },
  waContacts: {
    label: "WhatsApp Cloud API: contacts messages",
    url: "https://developers.facebook.com/docs/whatsapp/cloud-api/messages/contacts-messages",
  },
  waLocation: {
    label: "WhatsApp Cloud API: location messages",
    url: "https://developers.facebook.com/docs/whatsapp/cloud-api/messages/location-messages",
  },
  waButtons: {
    label: "WhatsApp Cloud API: reply buttons",
    url: "https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages",
  },
  waErrors: {
    label: "WhatsApp Cloud API: error codes",
    url: "https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes",
  },
  waPricing: {
    label: "WhatsApp: customer service window",
    url: "https://developers.facebook.com/docs/whatsapp/pricing",
  },
  waThroughput: { label: "WhatsApp: throughput", url: "https://developers.facebook.com/docs/whatsapp/throughput" },
  ig: {
    label: "Instagram Messaging API",
    url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api",
  },
  igChangelog: {
    label: "Messenger Platform changelog",
    url: "https://developers.facebook.com/docs/messenger-platform/changelog/",
  },
  fb: { label: "Messenger Send API", url: "https://developers.facebook.com/docs/messenger-platform/send-messages" },
  tiktokSend: {
    label: "TikTok Business Messaging: send messages",
    url: "https://business-api.tiktok.com/portal/docs?id=1832184403754242",
  },
  tiktokLimits: {
    label: "TikTok Business Messaging: message limits",
    url: "https://business-api.tiktok.com/portal/docs?id=1854823717597185",
  },
  telegram: { label: "Telegram Bot API", url: "https://core.telegram.org/bots/api" },
  // F-16 round 2 (Fahad: "I do not want their links, not even hidden ones"): the entries below cite the engine's own
  // source files (installation_config.yml, conversation_reply_mailer_attachment_helper.rb, attachment.rb, features.yml,
  // automation constants.js, enterprise message.rb, assignment_service.rb, v4.18.0) and an n8n Xero node; the pages no
  // longer link to them, so they keep only their label for the code.
  cwUpload: {
    label: "Engine source: MAXIMUM_FILE_UPLOAD_SIZE",
  },
  cwMail: {
    label: "Engine source: email attachments",
  },
  cwAttachment: {
    label: "Engine source: attachment checks",
  },
  // F-16 (Fahad 15 Oct: "I do not want their links"): the respond.io and ManyChat help pages that sourced the
  // simulator steps (Ask a question, Wait, Random split, HTTP, Go to flow, once-per-contact triggers) and Chatwoot's
  // help article on agent bots are no longer linked from the pages. They were: respond.io/help/workflows/
  // step-ask-a-question, step-wait, workflow-triggers, workflow-steps; help.manychat.com/hc/en-us/articles/
  // 14281151100060 and 14281170185628; chatwoot.com/hc/user-guide/articles/1677497472-how-to-use-agent-bots.
  cwFeatures: {
    label: "Engine source: delayed_automations feature",
  },
  cwConstants: {
    label: "Engine source (v4.18.0): automation constants",
  },
  // F-11 (item 87): the bot hands over when a teammate replies or is assigned (Chatwoot v4.18.0, read 15 Oct 2026):
  //  - agent bots: "new conversations are automatically assigned a pending status"; handing off sets "open" (docs);
  //  - a teammate's reply that is not private opens a Pending conversation Captain holds (enterprise message.rb 41-62);
  //  - assigning a person to a conversation a bot holds opens a Pending one (assignment_service.rb 16-35).
  cwHandoffReply: {
    label: "Engine source (v4.18.0): a teammate's reply opens Pending",
  },
  cwHandoffAssign: {
    label: "Engine source (v4.18.0): an assignment opens Pending",
  },
  // F-11: the standard each new action follows (its fields), from the integrations of the tools themselves
  taskStandard: {
    // F-16: was Twenty's Zapier app (twentyhq/twenty v2.46.0 twenty-zapier crud_record.ts); the page no longer names
    // Twenty, so the same fields are sourced from a public task API standard instead.
    label: "Asana API: create a task (name, notes, due date, assignee)",
  },
  invoiceStandard: {
    label: "n8n Xero node: create an invoice (contact, line items, due date, status Draft by default)",
  },
  notifyStandard: {
    label: "Engine source (v4.18.0): Send an Email to Team (team + message)",
  },
} satisfies Record<string, Source>;

export const SOURCES = S;

/** Chatwoot refuses any upload above this (MAXIMUM_FILE_UPLOAD_SIZE, 40 MB); the preview's upload keeps the same cap. */
export const CHATWOOT_MAX_UPLOAD = 40 * MB;

export const SIM_CHANNELS: SimChannel[] = [
  "whatsapp",
  "instagram",
  "facebook",
  "tiktok",
  "telegram",
  "email",
  "website",
];

export interface ChannelInfo {
  label: string;
  /** The preview inbox of this channel (settings-data inboxNames), or null when the preview has none. */
  inbox: string | null;
  /** Hours after the customer's last message during which free messages may be sent; null = no window. */
  windowHours: number | null;
  /** What happens outside the window (shown with the error). */
  outsideWindow: string;
  windowSource: Source | null;
}

export const CHANNELS: Record<SimChannel, ChannelInfo> = {
  whatsapp: {
    label: "WhatsApp",
    inbox: "WhatsApp Business",
    windowHours: 24,
    outsideWindow:
      "Outside WhatsApp's 24-hour customer service window only an approved message template can be sent; anything else is refused (error 131047).",
    windowSource: S.waErrors,
  },
  instagram: {
    label: "Instagram",
    inbox: "Instagram",
    windowHours: 24,
    outsideWindow:
      "Outside Instagram's 24-hour window only a human agent may reply (human_agent tag, 7 days); an automated message is refused.",
    windowSource: S.ig,
  },
  facebook: {
    label: "Messenger",
    inbox: "Facebook Page",
    windowHours: 24,
    outsideWindow:
      "Outside Messenger's 24-hour window only the HUMAN_AGENT tag remains (7 days, a person replying); an automated message is refused.",
    windowSource: S.fb,
  },
  tiktok: {
    label: "TikTok",
    inbox: null,
    windowHours: 48,
    outsideWindow: "TikTok: 48 hours after the customer's last message only 3 more messages may be sent.",
    windowSource: S.tiktokLimits,
  },
  telegram: { label: "Telegram", inbox: null, windowHours: null, outsideWindow: "", windowSource: null },
  email: { label: "Email", inbox: "Support Email", windowHours: null, outsideWindow: "", windowSource: null },
  website: { label: "Website chat", inbox: "Website Chat", windowHours: null, outsideWindow: "", windowSource: null },
};

export const channelOfLabel = (label: string) =>
  SIM_CHANNELS.find((channel) => CHANNELS[channel].label === label) ?? null;

/** One channel's rule for one kind of attachment. */
export interface MediaRule {
  accept: boolean;
  /** Largest file the channel takes, in bytes (accepted types). */
  maxBytes?: number;
  /** Accepted extensions (lower case, no dot); missing = any type. */
  ext?: string[];
  /** Why the channel refuses this kind (accept false). */
  reason?: string;
  /** Shown beside an accepted file (a codec the browser cannot check, a size that changes how it shows…). */
  note?: string;
  /** For a voice note: above this it arrives as a file, not a voice note (warning only). */
  voiceMaxBytes?: number;
  source: Source;
}

const IMG_JPG_PNG = ["jpg", "jpeg", "png"];

/** bahth-129 table 1, per channel and kind. */
export const MEDIA_RULES: Record<SimChannel, Record<MediaType, MediaRule>> = {
  whatsapp: {
    image: { accept: true, maxBytes: 5 * MB, ext: IMG_JPG_PNG, source: S.waMedia },
    video: {
      accept: true,
      maxBytes: 16 * MB,
      ext: ["mp4", "3gp"],
      note: "WhatsApp plays only H.264 video with AAC audio; the browser cannot read the codec, so it is not checked here.",
      source: S.waMedia,
    },
    voice: {
      accept: true,
      maxBytes: 16 * MB,
      ext: ["ogg", "opus"],
      voiceMaxBytes: 512 * KB,
      note: "A voice note must be OGG with the OPUS codec, mono. Above 512 KB it shows without the voice-note play button.",
      source: S.waAudio,
    },
    document: {
      accept: true,
      maxBytes: 100 * MB,
      ext: ["txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"],
      source: S.waMedia,
    },
    contact: { accept: true, note: "Up to 257 contacts in one message.", source: S.waContacts },
    location: { accept: true, source: S.waLocation },
  },
  instagram: {
    image: { accept: true, maxBytes: 8 * MB, ext: IMG_JPG_PNG, source: S.ig },
    video: { accept: true, maxBytes: 25 * MB, ext: ["mp4", "ogg", "avi", "mov", "webm"], source: S.ig },
    voice: {
      accept: true,
      maxBytes: 25 * MB,
      ext: ["aac", "m4a", "wav", "mp4"],
      note: "Instagram takes AAC, M4A, WAV or MP4 audio. It does not take OGG, so a WhatsApp voice note must be converted first.",
      source: S.ig,
    },
    document: {
      accept: true,
      maxBytes: 25 * MB,
      ext: ["pdf"],
      note: "PDF only (since 19 December 2025).",
      source: S.igChangelog,
    },
    contact: { accept: false, reason: "Instagram's Messaging API documents no contact-card message.", source: S.ig },
    location: { accept: false, reason: "Instagram's Messaging API documents no location message.", source: S.ig },
  },
  facebook: {
    image: {
      accept: true,
      maxBytes: 25 * MB,
      note: "Meta does not publish Messenger's list of formats; 8 MB when the image is sent by link.",
      source: S.fb,
    },
    video: { accept: true, maxBytes: 25 * MB, source: S.fb },
    voice: { accept: true, maxBytes: 25 * MB, source: S.fb },
    document: { accept: true, maxBytes: 25 * MB, source: S.fb },
    contact: {
      accept: false,
      reason: "Messenger's Send API attachments are image, audio, video and file: there is no contact card.",
      source: S.fb,
    },
    location: {
      accept: false,
      reason: "Messenger's Send API attachments are image, audio, video and file: there is no location message.",
      source: S.fb,
    },
  },
  tiktok: {
    image: {
      accept: true,
      maxBytes: 3 * MB,
      ext: IMG_JPG_PNG,
      note: "One image per message, without text: a caption goes as its own message.",
      source: S.tiktokSend,
    },
    video: {
      accept: false,
      reason: "TikTok Business Messaging cannot send video (unsupported type, error 40908).",
      source: S.tiktokSend,
    },
    voice: {
      accept: false,
      reason: "TikTok Business Messaging has no audio message at all, sent or received.",
      source: S.tiktokSend,
    },
    document: {
      accept: false,
      reason: "TikTok Business Messaging cannot send files or documents (unsupported type, error 40908).",
      source: S.tiktokSend,
    },
    contact: { accept: false, reason: "TikTok Business Messaging has no contact-card message.", source: S.tiktokSend },
    location: { accept: false, reason: "TikTok Business Messaging has no location message.", source: S.tiktokSend },
  },
  telegram: {
    image: {
      accept: true,
      maxBytes: 5 * MB,
      ext: ["jpg", "jpeg", "png", "webp"],
      note: "The engine sends Telegram files by link, where a photo may be up to 5 MB.",
      source: S.telegram,
    },
    video: {
      accept: true,
      maxBytes: 20 * MB,
      ext: ["mp4"],
      note: "The engine sends Telegram files by link, where other files may be up to 20 MB.",
      source: S.telegram,
    },
    voice: {
      accept: true,
      maxBytes: 20 * MB,
      ext: ["ogg", "opus", "mp3", "m4a"],
      voiceMaxBytes: 1 * MB,
      note: "Sent by link, a voice note must be OGG and 1 MB or less; up to 20 MB it arrives as a file.",
      source: S.telegram,
    },
    document: {
      accept: true,
      maxBytes: 20 * MB,
      note: "The engine sends Telegram files by link, where a file may be up to 20 MB.",
      source: S.telegram,
    },
    contact: { accept: true, note: "Sent as a contact (vCard up to 2048 bytes).", source: S.telegram },
    location: { accept: true, source: S.telegram },
  },
  email: {
    image: {
      accept: true,
      maxBytes: CHATWOOT_MAX_UPLOAD,
      note: "The engine attaches files up to 20 MB in total to the email; anything more goes as a download link.",
      source: S.cwMail,
    },
    video: {
      accept: true,
      maxBytes: CHATWOOT_MAX_UPLOAD,
      note: "The engine attaches files up to 20 MB in total to the email; anything more goes as a download link.",
      source: S.cwMail,
    },
    voice: {
      accept: true,
      maxBytes: CHATWOOT_MAX_UPLOAD,
      note: "The engine attaches files up to 20 MB in total to the email; anything more goes as a download link.",
      source: S.cwMail,
    },
    document: {
      accept: true,
      maxBytes: CHATWOOT_MAX_UPLOAD,
      note: "The engine attaches files up to 20 MB in total to the email; anything more goes as a download link.",
      source: S.cwMail,
    },
    contact: {
      accept: false,
      reason: "Email has no contact-card message; send the details as text.",
      source: S.cwMail,
    },
    location: { accept: false, reason: "Email has no location message; send the address as text.", source: S.cwMail },
  },
  website: {
    image: { accept: true, maxBytes: CHATWOOT_MAX_UPLOAD, source: S.cwAttachment },
    video: { accept: true, maxBytes: CHATWOOT_MAX_UPLOAD, source: S.cwAttachment },
    voice: { accept: true, maxBytes: CHATWOOT_MAX_UPLOAD, source: S.cwAttachment },
    document: { accept: true, maxBytes: CHATWOOT_MAX_UPLOAD, source: S.cwAttachment },
    contact: {
      accept: false,
      reason: "The website chat widget shows text and files only: there is no contact-card message.",
      source: S.cwAttachment,
    },
    location: {
      accept: false,
      reason: "The website chat widget shows text and files only: there is no location message.",
      source: S.cwAttachment,
    },
  },
};

export const mediaTypeLabels: Record<MediaType, string> = {
  image: "Image",
  video: "Video",
  voice: "Voice note",
  document: "Document",
  contact: "Contact card",
  location: "Location",
};

/** The file picker's accept list per kind. */
export const mediaAccept: Record<MediaType, string> = {
  image: "image/*",
  video: "video/*",
  voice: "audio/*,.ogg,.opus",
  document: ".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/*,text/*",
  contact: "",
  location: "",
};

/** The smallest image limit of all channels: a compressed copy this size fits every channel that takes images. */
export const SMALLEST_IMAGE_LIMIT = Math.min(
  ...SIM_CHANNELS.map((channel) => MEDIA_RULES[channel].image.maxBytes ?? Number.POSITIVE_INFINITY),
);

/** Extensions every channel that takes images accepts: anything else is converted to JPEG in the browser. */
export const SAFE_IMAGE_EXT = IMG_JPG_PNG;

// ------------------------------------------------------------------------------------------------- events

export interface SimEventDef {
  label: string;
  hint: string;
  /** The Chatwoot event whose conditions apply (conditions offered, message rows…). */
  base: EventKey;
  /** true when the event carries a customer's message (it opens the reply window). */
  customerMessage: boolean;
  details?: string[];
  /** Template library gap it stands in for (template-data.ts templateGapTitles). */
  gap?: string;
}

const NOT_IN_CHATWOOT = "The engine (v4.18) has no such event: in the dry run you make it happen.";

export const SIM_EVENTS: Record<SimEventKey, SimEventDef> = {
  scheduled: {
    label: "Scheduled time",
    hint: "Runs at a date and time, once or on repeat (daily, weekly, monthly), for the open conversations you pick by label.",
    base: "conversation_updated",
    customerMessage: false,
    gap: "G22",
  },
  label_added: {
    label: "Label added",
    hint: `Runs when this label is added to a conversation. ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: false,
  },
  manual: {
    label: "Run by a teammate (shortcut)",
    hint: `A teammate starts it from the conversation. ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: false,
    gap: "G14",
  },
  call_ended: {
    label: "Call ended",
    hint: `Runs when a call ends. ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: false,
    details: ["Missed", "Answered"],
    gap: "G08",
  },
  ad_click: {
    label: "Conversation from an ad",
    hint: `The customer wrote from a click-to-chat or messaging ad. ${NOT_IN_CHATWOOT}`,
    base: "conversation_created",
    customerMessage: true,
    details: ["Meta click-to-chat ad", "TikTok messaging ad"],
    gap: "G09",
  },
  csat_submitted: {
    label: "Satisfaction rating received",
    hint: `The customer answered the satisfaction survey (1 to 5). ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: true,
    details: ["1", "2", "3", "4", "5"],
    gap: "G12",
  },
  broadcast_reply: {
    label: "Reply to a broadcast",
    hint: `The customer answered a broadcast or campaign. ${NOT_IN_CHATWOOT}`,
    base: "message_created",
    customerMessage: true,
    gap: "G13",
  },
  comment_on_post: {
    label: "Comment on a post",
    hint: `Someone commented on an Instagram or Facebook post (one private reply within 7 days). ${NOT_IN_CHATWOOT}`,
    base: "message_created",
    customerMessage: true,
    details: ["Instagram", "Facebook"],
    gap: "G25",
  },
  store_order: {
    label: "Store order update",
    hint: `A store order changed. ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: false,
    details: [
      "Placed",
      "Shipped",
      "Out for delivery",
      "Delivery failed",
      "Cancelled",
      "Return or refund",
      "Delivered",
      "Cart abandoned",
    ],
    gap: "G20",
  },
  payment: {
    label: "Payment update",
    hint: `An invoice is due soon or a payment was received. ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: false,
    details: ["Due soon", "Received"],
    gap: "G26",
  },
  appointment: {
    label: "Appointment update",
    hint: `An appointment is near or was missed. ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: false,
    details: ["24 hours before", "Missed"],
    gap: "G21",
  },
  template_status: {
    label: "Message template status changed",
    hint: `Meta paused, rejected or disabled one of your message templates. ${NOT_IN_CHATWOOT}`,
    base: "conversation_updated",
    customerMessage: false,
    details: ["Paused", "Rejected", "Disabled"],
    gap: "G27",
  },
};

export const SIM_EVENT_KEYS = Object.keys(SIM_EVENTS) as SimEventKey[];

export const isSimEvent = (event: FlowEvent): event is SimEventKey => event in SIM_EVENTS;

/** The Chatwoot event a flow's conditions are checked against (a simulator event uses its `base`). */
export const baseEvent = (event: FlowEvent): EventKey => (isSimEvent(event) ? SIM_EVENTS[event].base : event);

export const eventCarriesMessage = (event: FlowEvent) =>
  isSimEvent(event)
    ? SIM_EVENTS[event].customerMessage
    : event === "message_created" || event === "conversation_created" || event === "conversation_opened";

// ------------------------------------------------------------------------------------------------- steps

export const DELAY_MAX_SECONDS = 7 * 24 * 3600;
export const ASK_MAX_MINUTES = 7 * 24 * 60;
export const unitSeconds = { seconds: 1, minutes: 60, hours: 3600, days: 86400 } as const;

/** F-16: the simulator steps no longer link to another product's help pages (see the note in S above). */
const NO_SOURCE: Source | undefined = undefined;

/** respond.io / ManyChat steps the simulator runs, with what each does (no outside link, F-16). */
export const SIM_STEP_INFO = {
  ask: {
    label: "Ask a question",
    hint: "Sends a question and waits: Replied or No reply after a time you set (up to 7 days).",
    source: NO_SOURCE,
  },
  delay: {
    label: "Wait between steps",
    hint: "Waits seconds, minutes, hours or days anywhere in the flow (up to 7 days).",
    source: NO_SOURCE,
  },
  split: {
    label: "Random split",
    hint: "Sends each contact down path A or B by the share you set.",
    source: NO_SOURCE,
  },
  http: {
    label: "HTTP request",
    hint: "Calls an address and branches on the answer. In this preview the answer is simulated: nothing is called.",
    source: NO_SOURCE,
  },
  goto: { label: "Go to another flow", hint: "Continues in another saved flow.", source: NO_SOURCE },
} as const;

// ------------------------------------------------------------------------------------------------- the flow's engine

const SIM_ACTIONS = new Set([
  "update_contact_field",
  "send_template",
  "assign_strategy",
  "create_calendar_event",
  // F-11
  "create_twenty_task",
  "create_invoice_draft",
  "notify_teammate",
]);

/** Why a step needs the simulator (one line), or null when Chatwoot's rules can run it. */
export function simReasonOf(node: FlowNode): string | null {
  if ((SIM_KINDS as string[]).includes(node.kind)) {
    const info = SIM_STEP_INFO[node.kind as keyof typeof SIM_STEP_INFO];
    return `${info.label} is a ${PRODUCT_NAME} simulator step`;
  }
  if (node.kind === "trigger") {
    if (isSimEvent(node.event)) return `The trigger “${SIM_EVENTS[node.event].label}” is a simulator event`;
    if (node.channels?.length) return "The trigger is limited to some channels";
    if (node.repeat === "once_per_contact") return "The trigger runs once per contact";
  }
  if (node.kind === "condition") {
    const row = node.rows.find((r) => attributeDefs[r.attribute]?.sim);
    if (row) return `The condition checks “${attributeDefs[row.attribute].label}”, which only the simulator reads`;
  }
  if (node.kind === "action") {
    if (SIM_ACTIONS.has(node.action.action)) return `This action is a ${PRODUCT_NAME} simulator action`;
    const type = node.action.media?.type;
    if (node.action.action === "send_attachment" && (type === "contact" || type === "location"))
      return "The engine's Send Attachment sends files only; a contact card or a location runs in the simulator";
  }
  return null;
}

/** Every reason the drawing runs in the simulator rather than as Chatwoot rules (empty = Chatwoot rules). */
export function simFeatures(doc: FlowDoc): { nodeId: string | null; reason: string }[] {
  const found = doc.nodes.flatMap((node): { nodeId: string | null; reason: string }[] => {
    const reason = simReasonOf(node);
    return reason ? [{ nodeId: node.id, reason }] : [];
  });
  if ((doc.settings?.secondsBetweenReplies ?? 0) > 0)
    found.push({ nodeId: null, reason: "Seconds between replies is a simulator setting" });
  return found;
}

export const isSimDoc = (doc: FlowDoc) => simFeatures(doc).length > 0;

/** The canvas names of the step kinds (canvas-parts.tsx adds the icons). */
export const KIND_LABELS: Record<FlowNode["kind"], string> = {
  trigger: "Trigger",
  wait: "Wait",
  condition: "Condition",
  action: "Action",
  ask: "Ask",
  delay: "Wait between steps",
  split: "Random split",
  http: "HTTP request",
  goto: "Go to flow",
};

/** "Condition 2", "Ask 1"…: the titles the canvas gives the steps, in drawing order. */
export function stepTitles(doc: FlowDoc): Map<string, string> {
  const map = new Map<string, string>();
  const count: Partial<Record<FlowNode["kind"], number>> = {};
  for (const node of doc.nodes) {
    count[node.kind] = (count[node.kind] ?? 0) + 1;
    map.set(node.id, node.kind === "trigger" ? "Trigger" : `${KIND_LABELS[node.kind]} ${count[node.kind]}`);
  }
  return map;
}

/** The honest line the editor shows: it runs in the simulator and reaches no real customer (short, so it fits). */
export const SIM_HONEST_LINE = `Simulation: runs in the ${PRODUCT_NAME} simulator. Nothing is sent to real customers.`;
export const SIM_HONEST_DETAIL = `This flow runs in the ${PRODUCT_NAME} simulator (Dry run) and is saved in this preview. Nothing is sent to real customers.`;
