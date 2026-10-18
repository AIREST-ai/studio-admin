// T-98: the two header buttons (Fahad 2026-10-13 20:01, items 15 and 16), as plain functions so they can be tested
// without React. Only type imports here.
//
// Notifications (bell): the My Inbox notifications Chatwoot raises besides messages: mention, assignment and SLA
// (Notification::NOTIFICATION_TYPES, see notification-data.ts). T-132 round 3 (Fahad 2026-10-14 00:45, item 51): no
// notification for arriving messages, the Messages button next to the bell is that already; My Inbox still lists them.
// F-10 (Fahad item 51b, 01:23:54: «الاشعارات تكون للنظام التسجيل التغيير الموافقات اشعارات عامه بكل شيئ»): the bell
// also lists System, Sign-ups, Changes and Approvals notifications, each made from a real event of the preview's
// activity log (lib/notifications/feed.ts). Still nothing is made up: no event, no notification.
//
// Messages: one row per conversation, the start of its latest real message (the thread data, plus replies sent in
// this session), newest first, like the Messenger list. Nothing here is invented: no text, no count.
import type { Conversation } from "@/app/(main)/chat/_components/data";
import type { ConversationMeta } from "@/app/(main)/dashboard/chat/_components/cw-data";

import type { InboxNotification, NotificationType } from "./notification-data";
import type { FeedEntry } from "./notifications-store";

// Chatwoot raises these when a customer writes: a new conversation, or a new message in one assigned to you or that
// you take part in. They stay out of the bell (item 51 above).
export const MESSAGE_TYPES: readonly NotificationType[] = [
  "conversation_creation",
  "assigned_conversation_new_message",
  "participating_conversation_new_message",
];

// Which SLA each breach notification is about (Chatwoot sla_missed_first_response / next_response / resolution).
const SLA_KIND: Partial<Record<NotificationType, "FRT" | "NRT" | "RT">> = {
  sla_missed_first_response: "FRT",
  sla_missed_next_response: "NRT",
  sla_missed_resolution: "RT",
};

export interface ConversationBellEntry {
  kind: "single";
  key: string;
  item: InboxNotification;
  unread: boolean;
  minutesAgo: number;
  href: string;
}

// F-10: a System / Sign-ups / Changes / Approvals notification.
export interface FeedBellEntry {
  kind: "feed";
  key: string;
  feed: FeedEntry;
  unread: boolean;
  minutesAgo: number;
  href: string;
}

export type BellEntry = ConversationBellEntry | FeedBellEntry;

export function conversationHref(id: number) {
  return `/dashboard/chat?conversation=${id}`;
}

// Snoozed notifications stay out until their snooze ends (Chatwoot lists them only with Display > Snoozed). `meta` is
// the inbox's live conversation state (cw-store, seeded from cw-data initialMeta): an SLA notification shows only while
// that conversation's own SLA of the same kind is missed (T-132: #3 reads "Reply due in 52m", so a "SLA breach" on it
// was a guess); with no SLA there, none shows.
export function bellEntries(
  items: InboxNotification[],
  meta: Record<number, Pick<ConversationMeta, "sla">> = {},
  feed: FeedEntry[] = [],
  now = Date.now(),
): BellEntry[] {
  const entries: BellEntry[] = [];
  for (const n of items) {
    if (n.snoozedUntil || MESSAGE_TYPES.includes(n.type)) continue;
    if (n.type in SLA_KIND) {
      const sla = meta[n.conversationId]?.sla;
      if (sla?.state !== "missed" || sla.kind !== SLA_KIND[n.type]) continue;
    }
    entries.push({
      kind: "single",
      key: `n-${n.id}`,
      item: n,
      unread: n.unread,
      minutesAgo: n.minutesAgo,
      href: conversationHref(n.conversationId),
    });
  }
  for (const f of feed)
    entries.push({
      kind: "feed",
      key: `f-${f.id}`,
      feed: f,
      unread: f.unread,
      minutesAgo: Math.max(0, (now - Date.parse(f.time)) / 60_000),
      href: f.href,
    });
  return entries.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

// The red number on the bell: unread entries, a group counting once (as Facebook counts a grouped notification).
export function bellUnreadCount(entries: BellEntry[]): number {
  return entries.filter((e) => e.unread).length;
}

export interface SentLine {
  kind: string; // "outgoing" | "note"; private notes are not messages to or from the customer
  text: string;
}

export interface MessageRow {
  id: number;
  name: string;
  channel: string;
  snippet: string;
  fromYou: boolean;
  time: string;
  minutesAgo: number;
  unread: number;
  href: string;
}

const SNIPPET_LENGTH = 90;

// The start of the message on one line ("Hi, the export times out after…").
export function snippetOf(text: string, length = SNIPPET_LENGTH) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > length ? `${line.slice(0, length).trimEnd()}…` : line;
}

export function messageRows(
  conversations: Conversation[],
  state: { unread: Record<number, number>; sent: Record<number, SentLine[]>; deleted: number[] },
): MessageRow[] {
  const rows: MessageRow[] = [];
  for (const c of conversations) {
    if (state.deleted.includes(c.id)) continue;
    const sentNow = (state.sent[c.id] ?? []).filter((m) => m.kind === "outgoing" && m.text.trim()).at(-1);
    const last = c.messages.at(-1);
    let text: string;
    let fromYou: boolean;
    let minutesAgo: number;
    let time: string;
    if (sentNow) {
      text = sentNow.text;
      fromYou = true;
      minutesAgo = 0;
      time = "now";
    } else if (last?.text.trim()) {
      text = last.text;
      fromYou = last.align === "end";
      minutesAgo = c.ago ?? last.ago ?? Number.POSITIVE_INFINITY;
      time = c.time;
    } else {
      continue; // no message yet: nothing real to show
    }
    rows.push({
      id: c.id,
      name: c.contact.name,
      channel: c.channel,
      snippet: snippetOf(text),
      fromYou,
      time,
      minutesAgo,
      unread: state.unread[c.id] ?? 0,
      href: conversationHref(c.id),
    });
  }
  // Newest first; Yesterday's conversations (no age in minutes) keep their list order after today's.
  return rows.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

// The red number on the Messages button: conversations with unread messages (Messenger counts chats, not messages).
export function unreadConversations(rows: MessageRow[]): number {
  return rows.filter((r) => r.unread > 0).length;
}
