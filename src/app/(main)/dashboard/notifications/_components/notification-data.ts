// F159 My Inbox mock data. Every notification points at a real conversation of the Studio inbox (/dashboard/chat), so
// the person, inbox, priority, SLA, assignee, labels and the thread on the right are the same as on the conversation
// itself. Mentions are the private notes that mention Arham Khan (the signed-in agent), assignments are the
// conversations assigned to him, "New Conversation" the unattended ones and SLA breach the ones with a missed FRT.
import {
  agentName,
  baseConversations,
  buildThread,
  type Conversation,
  contactIdOf,
  initialMeta,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import { contacts } from "@/app/(main)/dashboard/contacts/_components/data";

export type NotificationType =
  | "conversation_mention"
  | "conversation_assignment"
  | "conversation_creation"
  | "assigned_conversation_new_message"
  | "participating_conversation_new_message"
  | "sla_missed_first_response"
  | "sla_missed_next_response"
  | "sla_missed_resolution";

// Chatwoot INBOX.TYPES_NEXT.
export const typeLabels: Record<NotificationType, string> = {
  conversation_mention: "Mentioned",
  conversation_assignment: "Assigned to you",
  conversation_creation: "New Conversation",
  assigned_conversation_new_message: "New message",
  participating_conversation_new_message: "New message",
  sla_missed_first_response: "SLA breach",
  sla_missed_next_response: "SLA breach",
  sla_missed_resolution: "SLA breach",
};

export type SnoozeKey = "1h" | "1d" | "1w" | "1mo";

export interface NotificationSeed {
  id: number;
  conversationId: number;
  type: NotificationType;
  unread: boolean;
  snooze?: SnoozeKey; // snoozed when the page loads, with one of the snoozeOptions below
  snoozeEnded?: boolean; // already back from a snooze when the page loads
}

export const notificationSeeds: NotificationSeed[] = [
  { id: 1, conversationId: 1, type: "conversation_mention", unread: true },
  { id: 2, conversationId: 2, type: "conversation_mention", unread: true },
  { id: 3, conversationId: 3, type: "sla_missed_first_response", unread: true },
  { id: 4, conversationId: 10, type: "conversation_assignment", unread: true },
  { id: 5, conversationId: 8, type: "conversation_creation", unread: true },
  { id: 6, conversationId: 16, type: "sla_missed_first_response", unread: false },
  { id: 7, conversationId: 6, type: "assigned_conversation_new_message", unread: false },
  { id: 8, conversationId: 7, type: "conversation_mention", unread: false },
  { id: 9, conversationId: 13, type: "conversation_mention", unread: false, snooze: "1d" },
  { id: 10, conversationId: 14, type: "participating_conversation_new_message", unread: false },
  { id: 11, conversationId: 15, type: "conversation_creation", unread: true, snoozeEnded: true },
  { id: 12, conversationId: 19, type: "conversation_assignment", unread: false },
  { id: 13, conversationId: 23, type: "assigned_conversation_new_message", unread: false },
  { id: 14, conversationId: 21, type: "conversation_creation", unread: false, snooze: "1w" },
];

// T-286 (Fahad, item 125.5): a snooze is a real return time, not a label. `snoozedUntil` is when it comes back (epoch
// ms); at that time it returns to the top of Unread with the "Returned from snooze" mark, and `returnedAt` keeps when.
export interface InboxNotification extends Omit<NotificationSeed, "snooze" | "snoozeEnded"> {
  snoozedUntil?: number;
  returnedAt?: number;
  conversation: Conversation;
  contactName: string;
  assigneeId: number | null;
  assignee: string | null;
  actor: string; // who wrote the line shown in the card
  message: string;
  minutesAgo: number;
}

function contactNameOf(conversation: Conversation) {
  const id = contactIdOf(conversation.id);
  return contacts.find((c) => c.id === id)?.name ?? conversation.name;
}

// Pinned/Today conversations carry their age in minutes; Yesterday ones are a day or more old.
function minutesOf(conversation: Conversation, index: number) {
  return conversation.ago ?? 24 * 60 + index * 45;
}

export function buildNotification(seed: NotificationSeed, index: number, now = Date.now()): InboxNotification | null {
  const conversation = baseConversations.find((c) => c.id === seed.conversationId);
  if (!conversation) return null;
  const meta = initialMeta[conversation.id];
  const thread = buildThread(conversation, meta);
  const contactName = contactNameOf(conversation);
  let actor = contactName;
  let message = thread.filter((m) => m.kind === "incoming" && m.text.trim()).at(-1)?.text ?? conversation.subject;
  if (seed.type === "conversation_mention") {
    const note = thread.find((m) => m.kind === "note" && m.text.includes("@Arham Khan"));
    if (note) {
      actor = note.sender ?? "Teammate";
      message = note.text;
    }
  }
  const { snooze, snoozeEnded, ...rest } = seed;
  const minutesAgo = minutesOf(conversation, index);
  return {
    ...rest,
    snoozedUntil: snooze ? snoozeTime(snooze, now) : undefined,
    returnedAt: snoozeEnded ? now - minutesAgo * 60_000 : undefined,
    conversation,
    contactName,
    assigneeId: meta?.assigneeId ?? null,
    assignee: agentName(meta?.assigneeId),
    actor,
    message,
    minutesAgo,
  };
}

export const snoozeOptions: { label: string; short: SnoozeKey }[] = [
  { label: "Until an hour from now", short: "1h" },
  { label: "Until tomorrow", short: "1d" },
  { label: "Until next week", short: "1w" },
  { label: "Until next month", short: "1mo" },
];

// When each option returns, as Chatwoot computes it (app/javascript/dashboard/helper/snoozeHelpers.js, SNOOZE_RESOLVERS:
// https://github.com/chatwoot/chatwoot/blob/develop/app/javascript/dashboard/helper/snoozeHelpers.js): an hour from
// now; tomorrow 9:00; next week = the Monday after next week's Sunday (date-fns startOfWeek), 9:00; next month = the
// first Monday on or after the 1st of next month, 9:00 (findStartOfNextWeek / findStartOfNextMonth). Local time.
function mondayOnOrAfter(year: number, month: number, day: number): number {
  const start = new Date(year, month, day);
  return new Date(year, month, day + ((8 - start.getDay()) % 7), 9).getTime();
}

export function snoozeTime(key: SnoozeKey, now: number): number {
  const d = new Date(now);
  if (key === "1h") return now + 60 * 60_000;
  if (key === "1d") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9).getTime();
  if (key === "1w") return mondayOnOrAfter(d.getFullYear(), d.getMonth(), d.getDate() + 7 - d.getDay());
  return mondayOnOrAfter(d.getFullYear(), d.getMonth() + 1, 1);
}

export function relativeTime(minutes: number) {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}d`;
  return `${Math.floor(minutes / (7 * 24 * 60))}w`;
}

export function exactTime(minutes: number) {
  const date = new Date(Date.now() - minutes * 60_000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
