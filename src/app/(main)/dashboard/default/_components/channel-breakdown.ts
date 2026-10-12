// F159: dodges of the last 30 days by channel, on the six channels of the inbox (the channels bar of
// /dashboard/chat and Settings > Inboxes: Email, Chat, WhatsApp, Instagram, Facebook, Phone). Sample numbers.
export const DODGES_30_DAYS = 386;

export const channelBreakdown: { id: string; title: string; count: number }[] = [
  { id: "email", title: "Email", count: 118 },
  { id: "whatsapp", title: "WhatsApp", count: 96 },
  { id: "chat", title: "Chat", count: 71 },
  { id: "instagram", title: "Instagram", count: 48 },
  { id: "facebook", title: "Facebook", count: 31 },
  { id: "phone", title: "Phone", count: 22 },
];

export const channelNames = "Email, Chat, WhatsApp, Instagram, Facebook and Phone";
