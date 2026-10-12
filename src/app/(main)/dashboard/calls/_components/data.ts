export type CallKind = "ongoing" | "incoming" | "outgoing" | "missed" | "no_reply" | "failed";
export type Activity = "missed" | "no_reply" | "incoming" | "outgoing" | "in_progress";

export interface Call {
  id: number;
  contact: string;
  kind: CallKind;
  agent: string | null;
  inbox: string;
  conversationId: number;
  createdAt: string;
  createdAtFull: string;
  recordingSeconds: number | null;
  ringing?: boolean;
}

export const agents = [
  { id: 1, name: "Priya Nair" },
  { id: 2, name: "Yousef Al-Harbi" },
  { id: 3, name: "Lina Haddad" },
  { id: 4, name: "Ravi Menon" },
];

// provider drives the inbox icon, as Chatwoot's getInboxIconByType (Twilio voice vs WhatsApp calling).
export const voiceInboxes: { id: number; name: string; provider: "twilio" | "whatsapp" }[] = [
  // The account's two voice-capable inboxes in Settings > Inboxes.
  { id: 1, name: "Phone", provider: "twilio" },
  { id: 2, name: "WhatsApp Business", provider: "whatsapp" },
];

// F159 final pass: every call belongs to a Contacts-page person and opens one of that person's inbox conversations
// (#1-#24 of /dashboard/chat), so calls, contacts and the inbox tell one story.
export const calls: Call[] = [
  {
    id: 1,
    contact: "Hamad Al-Marri",
    kind: "ongoing",
    agent: "Priya Nair",
    inbox: "Phone",
    conversationId: 16,
    createdAt: "10:42 AM",
    createdAtFull: "Oct 12, 2026, 10:42 AM",
    recordingSeconds: null,
  },
  {
    id: 2,
    contact: "Daniel Hughes",
    kind: "missed",
    agent: null,
    inbox: "Phone",
    conversationId: 10,
    createdAt: "10:15 AM",
    createdAtFull: "Oct 12, 2026, 10:15 AM",
    recordingSeconds: null,
  },
  {
    id: 3,
    contact: "Khalid Al-Mansoori",
    kind: "incoming",
    agent: "Yousef Al-Harbi",
    inbox: "Phone",
    conversationId: 12,
    createdAt: "9:58 AM",
    createdAtFull: "Oct 12, 2026, 9:58 AM",
    recordingSeconds: 312,
  },
  {
    id: 4,
    contact: "Abdullah Al-Qahtani",
    kind: "outgoing",
    agent: "Ravi Menon",
    inbox: "Phone",
    conversationId: 17,
    createdAt: "9:21 AM",
    createdAtFull: "Oct 12, 2026, 9:21 AM",
    recordingSeconds: 148,
  },
  {
    id: 5,
    contact: "Reem Al-Otaibi",
    kind: "no_reply",
    agent: null,
    inbox: "Phone",
    conversationId: 7,
    createdAt: "8:47 AM",
    createdAtFull: "Oct 12, 2026, 8:47 AM",
    recordingSeconds: null,
  },
  {
    id: 6,
    contact: "Sarah Mitchell",
    kind: "incoming",
    agent: "Lina Haddad",
    inbox: "Phone",
    conversationId: 8,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 6:12 PM",
    recordingSeconds: 534,
  },
  {
    id: 7,
    contact: "Fatima Al-Suwaidi",
    kind: "failed",
    agent: null,
    inbox: "Phone",
    conversationId: 20,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 4:40 PM",
    recordingSeconds: null,
  },
  {
    id: 8,
    contact: "Maryam Al-Kuwari",
    kind: "outgoing",
    agent: "Priya Nair",
    inbox: "Phone",
    conversationId: 13,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 1:05 PM",
    recordingSeconds: 96,
  },
  {
    id: 9,
    contact: "Reem Al-Otaibi",
    kind: "missed",
    agent: null,
    inbox: "Phone",
    conversationId: 21,
    createdAt: "Oct 10",
    createdAtFull: "Oct 10, 2026, 7:30 PM",
    recordingSeconds: null,
  },
  {
    id: 10,
    contact: "James Carter",
    kind: "incoming",
    agent: "Yousef Al-Harbi",
    inbox: "Phone",
    conversationId: 6,
    createdAt: "Oct 10",
    createdAtFull: "Oct 10, 2026, 11:18 AM",
    recordingSeconds: 221,
  },
  {
    id: 11,
    contact: "Noura Al-Thani",
    kind: "incoming",
    agent: "Lina Haddad",
    inbox: "Phone",
    conversationId: 2,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 3:52 PM",
    recordingSeconds: 407,
  },
  {
    id: 12,
    contact: "Noura Al-Thani",
    kind: "ongoing",
    agent: null,
    inbox: "WhatsApp Business",
    conversationId: 1,
    createdAt: "10:44 AM",
    createdAtFull: "Oct 12, 2026, 10:44 AM",
    recordingSeconds: null,
    ringing: true,
  },
  {
    id: 13,
    contact: "James Carter",
    kind: "incoming",
    agent: "Ravi Menon",
    inbox: "WhatsApp Business",
    conversationId: 14,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 1:20 PM",
    recordingSeconds: 265,
  },
  {
    id: 14,
    contact: "Omar Al-Shehhi",
    kind: "missed",
    agent: null,
    inbox: "Phone",
    conversationId: 9,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 10:02 AM",
    recordingSeconds: null,
  },
  {
    id: 15,
    contact: "Fatima Al-Suwaidi",
    kind: "outgoing",
    agent: "Yousef Al-Harbi",
    inbox: "Phone",
    conversationId: 23,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 5:47 PM",
    recordingSeconds: 183,
  },
  {
    id: 16,
    contact: "Hamad Al-Marri",
    kind: "no_reply",
    agent: null,
    inbox: "Phone",
    conversationId: 11,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 2:15 PM",
    recordingSeconds: null,
  },
  {
    id: 17,
    contact: "Omar Al-Shehhi",
    kind: "incoming",
    agent: "Priya Nair",
    inbox: "WhatsApp Business",
    conversationId: 24,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 11:31 AM",
    recordingSeconds: 612,
  },
  {
    id: 18,
    contact: "Abdullah Al-Qahtani",
    kind: "outgoing",
    agent: "Ravi Menon",
    inbox: "Phone",
    conversationId: 19,
    createdAt: "Oct 7",
    createdAtFull: "Oct 7, 2026, 4:09 PM",
    recordingSeconds: 74,
  },
  {
    id: 19,
    contact: "Omar Al-Shehhi",
    kind: "failed",
    agent: null,
    inbox: "WhatsApp Business",
    conversationId: 5,
    createdAt: "Oct 7",
    createdAtFull: "Oct 7, 2026, 9:55 AM",
    recordingSeconds: null,
  },
  {
    id: 20,
    contact: "Daniel Hughes",
    kind: "incoming",
    agent: "Lina Haddad",
    inbox: "Phone",
    conversationId: 15,
    createdAt: "Oct 6",
    createdAtFull: "Oct 6, 2026, 6:38 PM",
    recordingSeconds: 349,
  },
  {
    id: 21,
    contact: "Sarah Mitchell",
    kind: "missed",
    agent: null,
    inbox: "Phone",
    conversationId: 3,
    createdAt: "Oct 6",
    createdAtFull: "Oct 6, 2026, 8:12 AM",
    recordingSeconds: null,
  },
];

export function matchesActivity(call: Call, activity: Activity | null) {
  switch (activity) {
    case "missed":
      return call.kind === "missed";
    case "no_reply":
      return call.kind === "no_reply";
    case "incoming":
      return ["incoming", "missed"].includes(call.kind);
    case "outgoing":
      return ["outgoing", "no_reply"].includes(call.kind);
    case "in_progress":
      return call.kind === "ongoing";
    default:
      return true;
  }
}

export const avatarTones = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
];

export function toneFor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return avatarTones[sum % avatarTones.length];
}
