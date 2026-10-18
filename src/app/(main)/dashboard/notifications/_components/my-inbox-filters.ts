// T-140 (Fahad 2026-10-14 00:45, item 58): what My Inbox lists, as plain functions so they can be tested without
// React. Only type imports here.
//
// Chatwoot v4.18 (app/finders/notification_finder.rb, InboxDisplayMenu.vue) lists unread notifications that are not
// snoozed and adds read / snoozed ones from Display checkboxes. T-286 (Fahad 2026-10-15, item 125.5): three tabs on
// the same page instead, Unread / Read / Snoozed; no "show everything" view. Snoozed is ordered by return time and
// filtered by Today / Tomorrow / a picked date; when its time comes a notification goes back to the top of Unread with
// the "Returned from snooze" mark. Sort is by last activity, newest or oldest. Studio keeps its own extras on top
// (type, inbox and priority filters, sort by priority) in the Display menu.
// F-10b (Fahad item 51b, 01:23:54: «الاشعارات تكون للنظام التسجيل التغيير الموافقات اشعارات عامه بكل شيئ»): the page also
// lists the bell's System, Sign-ups, Changes, Approvals and Automation notifications (the activity log's, from
// notifications-store.ts `feed`), with the same read state, under Unread and Read. They have no conversation, inbox,
// priority or snooze: a filter on inbox or priority leaves them out, and Snoozed has none.
import type { ConversationMeta } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { CATEGORY_LABELS, type FeedCategory } from "@/lib/notifications/feed";

import type { InboxNotification, NotificationType } from "./notification-data";
import type { FeedEntry } from "./notifications-store";

export type SortKey = "newest" | "oldest" | "priority";

// One entry per Chatwoot card label (INBOX.TYPES_NEXT): the two "New message" kinds and the three SLA kinds share one.
export const typeGroups: { value: string; label: string; types: NotificationType[] }[] = [
  { value: "mentioned", label: "Mentioned", types: ["conversation_mention"] },
  { value: "assigned", label: "Assigned to you", types: ["conversation_assignment"] },
  { value: "created", label: "New Conversation", types: ["conversation_creation"] },
  {
    value: "message",
    label: "New message",
    types: ["assigned_conversation_new_message", "participating_conversation_new_message"],
  },
  {
    value: "sla",
    label: "SLA breach",
    types: ["sla_missed_first_response", "sla_missed_next_response", "sla_missed_resolution"],
  },
];

// T-140 round 2 (monitor's decision 01:43, approved by the clean judge 01:55, sent to the leader inbox 01:56): My Inbox
// follows the bell, so the notifications about arriving messages ("New Conversation", "New message") are not listed.
// Same three kinds as the bell (header-summary.ts MESSAGE_TYPES). The kinds stay in the code (notification-data.ts)
// and in Settings > Profile > notification preferences; only this page leaves them out. To list them again, set
// SHOW_MESSAGE_ARRIVALS to true (nothing else changes).
export const SHOW_MESSAGE_ARRIVALS = false;
export const MESSAGE_ARRIVAL_TYPES: readonly NotificationType[] = [
  "conversation_creation",
  "assigned_conversation_new_message",
  "participating_conversation_new_message",
];

// The type choices of the Display menu: a kind that is not listed is not offered either.
export function listedGroups(showArrivals = SHOW_MESSAGE_ARRIVALS) {
  return showArrivals ? typeGroups : typeGroups.filter((g) => !g.types.every((t) => MESSAGE_ARRIVAL_TYPES.includes(t)));
}

// Which SLA each breach notification is about (same table as header-summary.ts, the bell).
const SLA_KIND: Partial<Record<NotificationType, "FRT" | "NRT" | "RT">> = {
  sla_missed_first_response: "FRT",
  sla_missed_next_response: "NRT",
  sla_missed_resolution: "RT",
};

type LiveMeta = Record<number, Pick<ConversationMeta, "sla" | "priority"> | undefined>;

// An SLA breach shows only while that conversation's own SLA of the same kind is missed in the live inbox state
// (cw-store meta, from Settings > SLA). "Reply due in 50m" or no SLA at all means no breach, so nothing is shown.
export function isReal(n: InboxNotification, meta: LiveMeta): boolean {
  const kind = SLA_KIND[n.type];
  if (!kind) return true;
  const sla = meta[n.conversationId]?.sla;
  return sla?.state === "missed" && sla.kind === kind;
}

export type InboxTab = "unread" | "read" | "snoozed";

export const inboxTabs: { value: InboxTab; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "snoozed", label: "Snoozed" },
];

// A snoozed notification is under Snoozed until it returns, read or not; the rest by their read state.
export function tabOf(n: InboxNotification): InboxTab {
  if (n.snoozedUntil !== undefined) return "snoozed";
  return n.unread ? "unread" : "read";
}

export interface TabOptions {
  // Read or unread-again during this visit of the tab: they stay where they are until the tab changes (Chatwoot keeps
  // them in its store until the list is fetched again), so opening one does not make it jump out of the list.
  keep?: ReadonlySet<number>;
  showArrivals?: boolean; // default SHOW_MESSAGE_ARRIVALS
}

// The notifications that are real (and not about arriving messages), whatever their tab.
export function listable(items: InboxNotification[], meta: LiveMeta, showArrivals = SHOW_MESSAGE_ARRIVALS) {
  return items.filter((n) => (showArrivals || !MESSAGE_ARRIVAL_TYPES.includes(n.type)) && isReal(n, meta));
}

// One tab's notifications. A snoozed one never stays in Unread / Read, and one that returned never stays in Snoozed.
export function inTab(items: InboxNotification[], meta: LiveMeta, tab: InboxTab, opts: TabOptions = {}) {
  return listable(items, meta, opts.showArrivals).filter((n) => {
    const own = tabOf(n);
    if (own === tab) return true;
    return tab !== "snoozed" && own !== "snoozed" && Boolean(opts.keep?.has(n.id));
  });
}

export function tabCounts(
  items: InboxNotification[],
  meta: LiveMeta,
  showArrivals = SHOW_MESSAGE_ARRIVALS,
  feed: FeedEntry[] = [],
) {
  const counts: Record<InboxTab, number> = { unread: 0, read: 0, snoozed: 0 };
  for (const n of listable(items, meta, showArrivals)) counts[tabOf(n)]++;
  for (const f of feed) counts[f.unread ? "unread" : "read"]++; // F-10b: the activity-log notifications
  return counts;
}

// Returned from snooze and still unread: on top of Unread, the latest return first; the rest keep the list's order.
export function returnedFirst(rows: InboxNotification[]): InboxNotification[] {
  const back = rows.filter((n) => n.unread && n.returnedAt !== undefined);
  if (!back.length) return rows;
  back.sort((a, b) => (b.returnedAt ?? 0) - (a.returnedAt ?? 0));
  return [...back, ...rows.filter((n) => !back.includes(n))];
}

// The snoozed whose time has come (the exact return time included); nothing returns before it.
export function dueSnoozes(items: InboxNotification[], now: number): InboxNotification[] {
  return items.filter((n) => n.snoozedUntil !== undefined && n.snoozedUntil <= now);
}

// What a notification looks like once it returns: unread, out of Snoozed, marked with when it came back.
export function returned(n: InboxNotification): InboxNotification {
  return { ...n, unread: true, snoozedUntil: undefined, returnedAt: n.snoozedUntil };
}

// Snoozed filter: "all", "today", "tomorrow" or a picked day as "yyyy-mm-dd" (local time).
export type SnoozeDay = string;

export function dayKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(time: number, days: number) {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12).getTime();
}

export function snoozeDayMatches(until: number, day: SnoozeDay, now: number): boolean {
  if (day === "all") return true;
  if (day === "today") return dayKey(until) === dayKey(now);
  if (day === "tomorrow") return dayKey(until) === dayKey(addDays(now, 1));
  return dayKey(until) === day;
}

// "Today", "Tomorrow" or the date, for the day headers of Snoozed.
export function returnDayLabel(until: number, now: number): string {
  if (dayKey(until) === dayKey(now)) return "Today";
  if (dayKey(until) === dayKey(addDays(now, 1))) return "Tomorrow";
  const sameYear = new Date(until).getFullYear() === new Date(now).getFullYear();
  return new Date(until).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// Snoozed, soonest return first, in one group per return day.
export function snoozedByReturn(rows: InboxNotification[], day: SnoozeDay, now: number) {
  const list = rows
    .filter((n) => n.snoozedUntil !== undefined && snoozeDayMatches(n.snoozedUntil, day, now))
    .sort((a, b) => (a.snoozedUntil ?? 0) - (b.snoozedUntil ?? 0) || a.id - b.id);
  const groups: { key: string; label: string; items: InboxNotification[] }[] = [];
  for (const n of list) {
    const key = dayKey(n.snoozedUntil ?? 0);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(n);
    else groups.push({ key, label: returnDayLabel(n.snoozedUntil ?? 0, now), items: [n] });
  }
  return groups;
}

export interface ListFilters {
  type: string; // "all" or a typeGroups value
  inbox: string; // "all" or a channel id
  priority: string; // "all" or a priority value
  sort: SortKey;
}

export const defaultFilters: ListFilters = { type: "all", inbox: "all", priority: "all", sort: "newest" };

const priorityRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };

function priorityOf(n: InboxNotification, meta: LiveMeta) {
  return meta[n.conversationId]?.priority ?? "none";
}

export function filtered(list: InboxNotification[], meta: LiveMeta, f: ListFilters): InboxNotification[] {
  if (isFeedType(f.type)) return []; // Display > Type is on one of the activity-log categories
  const group = typeGroups.find((g) => g.value === f.type);
  const rows = list.filter(
    (n) =>
      (!group || group.types.includes(n.type)) &&
      (f.inbox === "all" || n.conversation.channel === f.inbox) &&
      (f.priority === "all" || priorityOf(n, meta) === f.priority),
  );
  return rows.sort((a, b) => {
    if (f.sort === "oldest") return b.minutesAgo - a.minutesAgo;
    if (f.sort === "priority")
      return priorityRank[priorityOf(b, meta)] - priorityRank[priorityOf(a, meta)] || a.minutesAgo - b.minutesAgo;
    return a.minutesAgo - b.minutesAgo;
  });
}

// How many of the listed notifications each type has (shown next to each type in the Display menu). `feed` is the
// activity-log notifications listed in the same tab (F-10b), counted per category.
export function typeCounts(
  list: InboxNotification[],
  showArrivals = SHOW_MESSAGE_ARRIVALS,
  feed: FeedEntry[] = [],
): Record<string, number> {
  const counts: Record<string, number> = { all: list.length + feed.length };
  for (const g of listedGroups(showArrivals)) counts[g.value] = list.filter((n) => g.types.includes(n.type)).length;
  for (const g of feedTypeGroups) counts[g.value] = feed.filter((e) => e.category === g.category).length;
  return counts;
}

// ---- F-10b: the activity-log notifications on this page --------------------------------------------------------

/** Display > Type has one entry per bell category, after the conversation kinds: value "cat:<category>". */
export const feedTypeGroups: { value: string; label: string; category: FeedCategory }[] = (
  Object.keys(CATEGORY_LABELS) as FeedCategory[]
).map((category) => ({ value: `cat:${category}`, label: CATEGORY_LABELS[category], category }));

export const isFeedType = (type: string) => feedTypeGroups.some((g) => g.value === type);

/** Minutes since the event, as the bell counts them. */
export const feedMinutes = (entry: Pick<FeedEntry, "time">, now = Date.now()) =>
  Math.max(0, (now - Date.parse(entry.time)) / 60_000);

/** The activity-log notifications of one tab: by read state, plus those read or unread-again during this visit of the
 *  tab (`keep`, as for conversation notifications). Snoozed has none: an activity-log notification cannot be snoozed. */
export function feedInTab(feed: FeedEntry[], tab: InboxTab, keep?: ReadonlySet<number>): FeedEntry[] {
  if (tab === "snoozed") return [];
  return feed.filter((f) => f.unread === (tab === "unread") || Boolean(keep?.has(f.id)));
}

/** Display filters on the activity-log notifications: they have no inbox or priority, so those filters leave them out. */
export function feedFiltered(list: FeedEntry[], f: ListFilters): FeedEntry[] {
  if (f.inbox !== "all" || f.priority !== "all") return [];
  if (f.type === "all") return list;
  const group = feedTypeGroups.find((g) => g.value === f.type);
  return group ? list.filter((e) => e.category === group.category) : [];
}

/** One line of the list: a conversation notification or an activity-log one. */
export type InboxRow =
  | { kind: "conversation"; id: number; item: InboxNotification; minutesAgo: number }
  | { kind: "feed"; id: number; entry: FeedEntry; minutesAgo: number };

export const conversationRows = (items: InboxNotification[]): InboxRow[] =>
  items.map((item) => ({ kind: "conversation", id: item.id, item, minutesAgo: item.minutesAgo }));

/** Both kinds in one list, ordered by the Display sort. An activity-log notification ranks as priority "none". */
export function mergeRows(
  conversations: InboxNotification[],
  feed: FeedEntry[],
  sort: SortKey,
  meta: LiveMeta,
  now = Date.now(),
): InboxRow[] {
  const rows: InboxRow[] = [
    ...conversationRows(conversations),
    ...feed.map((entry): InboxRow => ({ kind: "feed", id: entry.id, entry, minutesAgo: feedMinutes(entry, now) })),
  ];
  const rank = (row: InboxRow) => (row.kind === "conversation" ? priorityRank[priorityOf(row.item, meta)] : 0);
  return rows.sort((a, b) => {
    if (sort === "oldest") return b.minutesAgo - a.minutesAgo;
    if (sort === "priority") return rank(b) - rank(a) || a.minutesAgo - b.minutesAgo;
    return a.minutesAgo - b.minutesAgo;
  });
}

/** `returnedFirst` for rows: a conversation notification back from a snooze and still unread tops the list. */
export function returnedFirstRows(rows: InboxRow[]): InboxRow[] {
  const back = rows.filter((r) => r.kind === "conversation" && r.item.unread && r.item.returnedAt !== undefined);
  if (!back.length) return rows;
  const returnedAt = (r: InboxRow) => (r.kind === "conversation" ? (r.item.returnedAt ?? 0) : 0);
  back.sort((a, b) => returnedAt(b) - returnedAt(a));
  return [...back, ...rows.filter((r) => !back.includes(r))];
}
