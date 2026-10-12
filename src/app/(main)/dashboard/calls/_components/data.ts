import { conversations } from "@/app/(main)/chat/_components/data";
import { agents as sharedAgents, inboxes as sharedInboxes } from "@/lib/cw/data";

function contactOf(conversationId: number): string {
  return conversations.find((conversation) => conversation.id === conversationId)?.contact.name ?? "";
}

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

// F161: the agents and the two voice-capable inboxes are the shared ones (src/lib/cw/data.ts): the agents are the
// members of Phone or WhatsApp Business, with the same ids as Users & Roles and Conversations.
const voiceInboxIds = [6, 3];

export const agents = sharedAgents
  .filter((agent) => sharedInboxes.some((inbox) => voiceInboxIds.includes(inbox.id) && inbox.agents.includes(agent.id)))
  .map((agent) => ({ id: agent.id, name: agent.name }));

// provider drives the inbox icon, as Chatwoot's getInboxIconByType (Twilio voice vs WhatsApp calling).
export const voiceInboxes: { id: number; name: string; provider: "twilio" | "whatsapp" }[] = voiceInboxIds.map((id) => {
  const inbox = sharedInboxes.find((item) => item.id === id);
  return { id, name: inbox?.name ?? "", provider: inbox?.channel === "voice" ? "twilio" : "whatsapp" };
});

// F161: every call opens a conversation of its own inbox (Chatwoot keeps a call inside the voice inbox's conversation):
// Phone calls open #10 (the Phone conversation), WhatsApp calls open #1, #6, #14 or #24 (the WhatsApp Business ones).
// The caller is that conversation's contact, so calls, the inbox and Contacts name the same person.
export const calls: Call[] = [
  {
    id: 1,
    contact: contactOf(10),
    kind: "ongoing",
    agent: "Priya Nair",
    inbox: "Phone",
    conversationId: 10,
    createdAt: "10:42 AM",
    createdAtFull: "Oct 12, 2026, 10:42 AM",
    recordingSeconds: null,
  },
  {
    id: 2,
    contact: contactOf(10),
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
    contact: contactOf(1),
    kind: "incoming",
    agent: "Yousef Al-Harbi",
    inbox: "WhatsApp Business",
    conversationId: 1,
    createdAt: "9:58 AM",
    createdAtFull: "Oct 12, 2026, 9:58 AM",
    recordingSeconds: 312,
  },
  {
    id: 4,
    contact: contactOf(10),
    kind: "outgoing",
    agent: "Ravi Menon",
    inbox: "Phone",
    conversationId: 10,
    createdAt: "9:21 AM",
    createdAtFull: "Oct 12, 2026, 9:21 AM",
    recordingSeconds: 148,
  },
  {
    id: 5,
    contact: contactOf(10),
    kind: "no_reply",
    agent: null,
    inbox: "Phone",
    conversationId: 10,
    createdAt: "8:47 AM",
    createdAtFull: "Oct 12, 2026, 8:47 AM",
    recordingSeconds: null,
  },
  {
    id: 6,
    contact: contactOf(6),
    kind: "incoming",
    agent: "Lina Haddad",
    inbox: "WhatsApp Business",
    conversationId: 6,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 6:12 PM",
    recordingSeconds: 534,
  },
  {
    id: 7,
    contact: contactOf(10),
    kind: "failed",
    agent: null,
    inbox: "Phone",
    conversationId: 10,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 4:40 PM",
    recordingSeconds: null,
  },
  {
    id: 8,
    contact: contactOf(10),
    kind: "outgoing",
    agent: "Priya Nair",
    inbox: "Phone",
    conversationId: 10,
    createdAt: "Yesterday",
    createdAtFull: "Oct 11, 2026, 1:05 PM",
    recordingSeconds: 96,
  },
  {
    id: 9,
    contact: contactOf(14),
    kind: "missed",
    agent: null,
    inbox: "WhatsApp Business",
    conversationId: 14,
    createdAt: "Oct 10",
    createdAtFull: "Oct 10, 2026, 7:30 PM",
    recordingSeconds: null,
  },
  {
    id: 10,
    contact: contactOf(10),
    kind: "incoming",
    agent: "Yousef Al-Harbi",
    inbox: "Phone",
    conversationId: 10,
    createdAt: "Oct 10",
    createdAtFull: "Oct 10, 2026, 11:18 AM",
    recordingSeconds: 221,
  },
  {
    id: 11,
    contact: contactOf(10),
    kind: "incoming",
    agent: "Lina Haddad",
    inbox: "Phone",
    conversationId: 10,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 3:52 PM",
    recordingSeconds: 407,
  },
  {
    id: 12,
    contact: contactOf(24),
    kind: "ongoing",
    agent: null,
    inbox: "WhatsApp Business",
    conversationId: 24,
    createdAt: "10:44 AM",
    createdAtFull: "Oct 12, 2026, 10:44 AM",
    recordingSeconds: null,
    ringing: true,
  },
  {
    id: 13,
    contact: contactOf(1),
    kind: "incoming",
    agent: "Ravi Menon",
    inbox: "WhatsApp Business",
    conversationId: 1,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 1:20 PM",
    recordingSeconds: 265,
  },
  {
    id: 14,
    contact: contactOf(10),
    kind: "missed",
    agent: null,
    inbox: "Phone",
    conversationId: 10,
    createdAt: "Oct 9",
    createdAtFull: "Oct 9, 2026, 10:02 AM",
    recordingSeconds: null,
  },
  {
    id: 15,
    contact: contactOf(6),
    kind: "outgoing",
    agent: "Yousef Al-Harbi",
    inbox: "WhatsApp Business",
    conversationId: 6,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 5:47 PM",
    recordingSeconds: 183,
  },
  {
    id: 16,
    contact: contactOf(10),
    kind: "no_reply",
    agent: null,
    inbox: "Phone",
    conversationId: 10,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 2:15 PM",
    recordingSeconds: null,
  },
  {
    id: 17,
    contact: contactOf(14),
    kind: "incoming",
    agent: "Priya Nair",
    inbox: "WhatsApp Business",
    conversationId: 14,
    createdAt: "Oct 8",
    createdAtFull: "Oct 8, 2026, 11:31 AM",
    recordingSeconds: 612,
  },
  {
    id: 18,
    contact: contactOf(24),
    kind: "outgoing",
    agent: "Ravi Menon",
    inbox: "WhatsApp Business",
    conversationId: 24,
    createdAt: "Oct 7",
    createdAtFull: "Oct 7, 2026, 4:09 PM",
    recordingSeconds: 74,
  },
  {
    id: 19,
    contact: contactOf(1),
    kind: "failed",
    agent: null,
    inbox: "WhatsApp Business",
    conversationId: 1,
    createdAt: "Oct 7",
    createdAtFull: "Oct 7, 2026, 9:55 AM",
    recordingSeconds: null,
  },
  {
    id: 20,
    contact: contactOf(10),
    kind: "incoming",
    agent: "Lina Haddad",
    inbox: "Phone",
    conversationId: 10,
    createdAt: "Oct 6",
    createdAtFull: "Oct 6, 2026, 6:38 PM",
    recordingSeconds: 349,
  },
  {
    id: 21,
    contact: contactOf(6),
    kind: "missed",
    agent: null,
    inbox: "WhatsApp Business",
    conversationId: 6,
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
