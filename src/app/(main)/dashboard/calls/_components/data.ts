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
  { id: 1, name: "Noura Al-Kuwari" },
  { id: 2, name: "Omar Al-Harthy" },
  { id: 3, name: "Mariam Al-Sulaiti" },
  { id: 4, name: "Faisal Al-Mutairi" },
];

// provider drives the inbox icon, as Chatwoot's getInboxIconByType (Twilio voice vs WhatsApp calling).
export const voiceInboxes: { id: number; name: string; provider: "twilio" | "whatsapp" }[] = [
  { id: 1, name: "Doha Support Line", provider: "twilio" },
  { id: 2, name: "Dubai Sales Line", provider: "twilio" },
  { id: 3, name: "Riyadh Branch", provider: "twilio" },
  { id: 4, name: "WhatsApp — +974 4410 2200", provider: "whatsapp" },
];

export const calls: Call[] = [
  {
    id: 1,
    contact: "Hamad Al-Marri",
    kind: "ongoing",
    agent: "Noura Al-Kuwari",
    inbox: "Doha Support Line",
    conversationId: 4821,
    createdAt: "10:42 AM",
    createdAtFull: "Oct 12, 2026, 10:42 AM",
    recordingSeconds: null,
  },
  {
    id: 2,
    contact: "+974 5590 8821",
    kind: "missed",
    agent: null,
    inbox: "Doha Support Line",
    conversationId: 4819,
    createdAt: "10:15 AM",
    createdAtFull: "Oct 12, 2026, 10:15 AM",
    recordingSeconds: null,
  },
  {
    id: 3,
    contact: "Latifa Al-Shamsi",
    kind: "incoming",
    agent: "Omar Al-Harthy",
    inbox: "Dubai Sales Line",
    conversationId: 4816,
    createdAt: "9:58 AM",
    createdAtFull: "Oct 12, 2026, 9:58 AM",
    recordingSeconds: 312,
  },
  {
    id: 4,
    contact: "Abdullah Al-Qahtani",
    kind: "outgoing",
    agent: "Faisal Al-Mutairi",
    inbox: "Riyadh Branch",
    conversationId: 4810,
    createdAt: "9:21 AM",
    createdAtFull: "Oct 12, 2026, 9:21 AM",
    recordingSeconds: 148,
  },
  {
    id: 5,
    contact: "Reem Al-Otaibi",
    kind: "no_reply",
    agent: null,
    inbox: "Riyadh Branch",
    conversationId: 4807,
    createdAt: "8:47 AM",
    createdAtFull: "Oct 12, 2026, 8:47 AM",
    recordingSeconds: null,
  },
  {
    id: 6,
    contact: "Aisha Al-Naimi",
    kind: "incoming",
    agent: "Mariam Al-Sulaiti",
    inbox: "Doha Support Line",
    conversationId: 4799,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 6:12 PM",
    recordingSeconds: 534,
  },
  {
    id: 7,
    contact: "Sultan Al-Dhaheri",
    kind: "failed",
    agent: null,
    inbox: "Dubai Sales Line",
    conversationId: 4795,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 4:40 PM",
    recordingSeconds: null,
  },
  {
    id: 8,
    contact: "Jassim Al-Kuwari",
    kind: "outgoing",
    agent: "Noura Al-Kuwari",
    inbox: "Doha Support Line",
    conversationId: 4788,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 1:05 PM",
    recordingSeconds: 96,
  },
  {
    id: 9,
    contact: "Huda Al-Ghamdi",
    kind: "missed",
    agent: null,
    inbox: "Riyadh Branch",
    conversationId: 4781,
    createdAt: "Oct 10",
    createdAtFull: "Oct 10, 2026, 7:30 PM",
    recordingSeconds: null,
  },
  {
    id: 10,
    contact: "Deleted contact",
    kind: "incoming",
    agent: "Omar Al-Harthy",
    inbox: "Dubai Sales Line",
    conversationId: 4770,
    createdAt: "Oct 10",
    createdAtFull: "Oct 10, 2026, 11:18 AM",
    recordingSeconds: 221,
  },
  {
    id: 11,
    contact: "Yousef Al-Emadi",
    kind: "incoming",
    agent: "Mariam Al-Sulaiti",
    inbox: "Doha Support Line",
    conversationId: 4762,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 3:52 PM",
    recordingSeconds: 407,
  },
  {
    id: 12,
    contact: "Maryam Al-Romaihi",
    kind: "ongoing",
    agent: null,
    inbox: "WhatsApp — +974 4410 2200",
    conversationId: 4823,
    createdAt: "10:44 AM",
    createdAtFull: "Oct 12, 2026, 10:44 AM",
    recordingSeconds: null,
    ringing: true,
  },
  {
    id: 13,
    contact: "Khalid Al-Mansoori",
    kind: "incoming",
    agent: "Faisal Al-Mutairi",
    inbox: "WhatsApp — +974 4410 2200",
    conversationId: 4760,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 1:20 PM",
    recordingSeconds: 265,
  },
  {
    id: 14,
    contact: "+971 55 902 1176",
    kind: "missed",
    agent: null,
    inbox: "Dubai Sales Line",
    conversationId: 4755,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 10:02 AM",
    recordingSeconds: null,
  },
  {
    id: 15,
    contact: "Shaikha Al-Mazrouei",
    kind: "outgoing",
    agent: "Omar Al-Harthy",
    inbox: "Dubai Sales Line",
    conversationId: 4748,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 5:47 PM",
    recordingSeconds: 183,
  },
  {
    id: 16,
    contact: "Nasser Al-Thani",
    kind: "no_reply",
    agent: null,
    inbox: "Doha Support Line",
    conversationId: 4741,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 2:15 PM",
    recordingSeconds: null,
  },
  {
    id: 17,
    contact: "Lulwa Al-Suwaidi",
    kind: "incoming",
    agent: "Noura Al-Kuwari",
    inbox: "WhatsApp — +974 4410 2200",
    conversationId: 4736,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 11:31 AM",
    recordingSeconds: 612,
  },
  {
    id: 18,
    contact: "Tariq Al-Harbi",
    kind: "outgoing",
    agent: "Faisal Al-Mutairi",
    inbox: "Riyadh Branch",
    conversationId: 4729,
    createdAt: "Oct 7",
    createdAtFull: "Oct 7, 2026, 4:09 PM",
    recordingSeconds: 74,
  },
  {
    id: 19,
    contact: "Hessa Al-Shehhi",
    kind: "failed",
    agent: null,
    inbox: "WhatsApp — +974 4410 2200",
    conversationId: 4722,
    createdAt: "Oct 7",
    createdAtFull: "Oct 7, 2026, 9:55 AM",
    recordingSeconds: null,
  },
  {
    id: 20,
    contact: "Majed Al-Mutairi",
    kind: "incoming",
    agent: "Mariam Al-Sulaiti",
    inbox: "Doha Support Line",
    conversationId: 4715,
    createdAt: "Oct 6",
    createdAtFull: "Oct 6, 2026, 6:38 PM",
    recordingSeconds: 349,
  },
  {
    id: 21,
    contact: "Dana Al-Romaihi",
    kind: "missed",
    agent: null,
    inbox: "Doha Support Line",
    conversationId: 4709,
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
