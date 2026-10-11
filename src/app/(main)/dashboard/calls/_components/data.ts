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

export const voiceInboxes = [
  { id: 1, name: "Doha Support Line" },
  { id: 2, name: "Dubai Sales Line" },
  { id: 3, name: "Riyadh Branch" },
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
