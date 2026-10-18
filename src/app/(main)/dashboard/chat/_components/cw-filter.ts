"use client";

import { useChannelFilter } from "@/app/(main)/chat/_components/chat-channel-filter-store";
import { pickedChannels, useChannelChoice } from "@/app/(main)/chat/_components/chat-channel-select-store";
import { useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import {
  stageIdOf,
  stageNameOf,
  useCustomerPath,
  useHydrateCustomerPath,
  useStageFilter,
} from "@/lib/cw/customer-path";
import { useCwShared } from "@/lib/cw/store";
import { assigneeTabsFor, canSeeConversation, useViewer } from "@/lib/cw/view-as";

import {
  type AssigneeTab,
  agentName,
  baseConversations,
  type Conversation,
  type ConversationMeta,
  type FilterRow,
  type Folder,
  inboxOf,
  liveInboxes,
  liveTeams,
  priorities,
  teamName,
  useLiveInboxes,
} from "./cw-data";
import { useCwStore } from "./cw-store";

export type ViewSpec =
  | { kind: "all" }
  | { kind: "mentions" }
  | { kind: "participating" }
  | { kind: "unattended" }
  | { kind: "folder"; id: string }
  | { kind: "team"; id: string }
  | { kind: "inbox"; id: string }
  | { kind: "label"; id: string };

type Ctx = { tags: string[]; attrs: Record<string, string> };

function fieldValue(conversation: Conversation, meta: ConversationMeta, row: FilterRow, ctx: Ctx): string | string[] {
  switch (row.attribute) {
    case "status":
      return meta.status === "closed" ? "resolved" : meta.status;
    case "assignee_id":
      return meta.assigneeId ? String(meta.assigneeId) : "";
    case "inbox_id":
      return conversation.channel;
    case "team_id":
      return meta.teamId ?? "";
    case "priority":
      return meta.priority === "none" ? "" : meta.priority;
    case "labels":
      return ctx.tags;
    case "customer_path":
      return stageIdOf(conversation.id);
    case "contact":
      return conversation.contact.name;
    case "display_id":
      return String(conversation.id);
    case "browser_language":
      return conversation.channel === "chat" ? "en" : "";
    case "country_code":
      return conversation.contact.location;
    case "referer":
      return conversation.channel === "chat" ? "https://weblabs.studio/pricing" : "";
    case "order_id":
      return ctx.attrs.order_id ?? "";
    case "feedback_type":
      return ctx.attrs.feedback_type ?? "";
    case "created_at":
      return dayKey(createdDate(meta.createdAt));
    case "last_activity_at":
      return dayKey(lastActivityDate(conversation));
    default:
      return "";
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;

// The mock "createdAt" is a short date ("Oct 12"); the sample year is 2026.
function createdDate(createdAt: string): Date {
  const [month, day] = createdAt.split(" ");
  const index = MONTHS.indexOf(month);
  return index < 0 ? new Date(Number.NaN) : new Date(2026, index, Number(day));
}

// Today rows carry "ago" minutes on the real clock; Yesterday rows were last active yesterday.
function lastActivityDate(conversation: Conversation): Date {
  if (typeof conversation.ago === "number") return new Date(Date.now() - conversation.ago * 60 * 1000);
  const yesterday = new Date(Date.now() - DAY_MS);
  return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
}

// "YYYY-MM-DD", the same form as the filter's date input, so dates compare as strings.
function dayKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Chatwoot "is x days before": the date is older than x days ago.
function isDaysBefore(day: string, days: string): boolean {
  const count = Number(days);
  if (!day || days.trim() === "" || !Number.isFinite(count)) return false;
  return day < dayKey(new Date(Date.now() - count * DAY_MS));
}

// Greater/less than: numbers compare as numbers, dates (YYYY-MM-DD) as text; a missing value never matches.
function compare(field: string, value: string): number | null {
  if (!field || !value) return null;
  const a = Number(field);
  const b = Number(value);
  if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
  return field < value ? -1 : field > value ? 1 : 0;
}

export function matchesRow(conversation: Conversation, meta: ConversationMeta, row: FilterRow, ctx: Ctx): boolean {
  const field = fieldValue(conversation, meta, row, ctx);
  const value = row.value.trim().toLowerCase();
  const list = Array.isArray(field) ? field.map((v) => v.toLowerCase()) : [field.toLowerCase()];
  const present = list.some((v) => v !== "");
  switch (row.operator) {
    case "equal_to":
      return list.includes(value);
    case "not_equal_to":
      return !list.includes(value);
    case "contains":
      return list.some((v) => v.includes(value));
    case "does_not_contain":
      return !list.some((v) => v.includes(value));
    case "is_present":
      return present;
    case "is_not_present":
      return !present;
    case "is_greater_than": {
      const diff = compare(list[0] ?? "", value);
      return diff !== null && diff > 0;
    }
    case "is_less_than": {
      const diff = compare(list[0] ?? "", value);
      return diff !== null && diff < 0;
    }
    case "days_before":
      return isDaysBefore(list[0] ?? "", value);
    default:
      return false;
  }
}

export function matchesFilters(
  conversation: Conversation,
  meta: ConversationMeta,
  rows: FilterRow[],
  ctx: Ctx,
): boolean {
  let result = true;
  rows.forEach((row, index) => {
    const ok = matchesRow(conversation, meta, row, ctx);
    if (index === 0) result = ok;
    else result = row.join === "or" ? result || ok : result && ok;
  });
  return result;
}

// Text shown for a filter value (used in folder chips and the filter dialog).
export function valueLabel(row: FilterRow): string {
  switch (row.attribute) {
    case "assignee_id":
      return agentName(Number(row.value)) ?? row.value;
    case "team_id":
      return teamName(row.value) ?? row.value;
    case "inbox_id":
      return liveInboxes().find((inbox) => inbox.id === row.value)?.name ?? row.value;
    case "priority":
      return priorities.find((p) => p.value === row.value)?.label ?? row.value;
    case "customer_path":
      return stageNameOf(row.value);
    default:
      return row.value;
  }
}

export function viewTitle(view: ViewSpec, folders: Folder[], tagLabel?: string): string {
  switch (view.kind) {
    case "mentions":
      return "Mentions";
    case "participating":
      return "Participating";
    case "unattended":
      return "Unattended";
    case "folder":
      return folders.find((folder) => folder.id === view.id)?.name ?? "Folder";
    case "team":
      return liveTeams().find((team) => team.id === view.id)?.name ?? "Team";
    case "inbox":
      return liveInboxes().find((inbox) => inbox.id === view.id)?.name ?? "Inbox";
    case "label":
      return tagLabel ? `#${tagLabel}` : "Label";
    default:
      return "Conversations";
  }
}

function activityIndex(id: number) {
  return baseConversations.findIndex((c) => c.id === id);
}

export function useConversationList(view: ViewSpec) {
  useHydrateCustomerPath();
  useCustomerPath((s) => s.assigned);
  // T-141: the Inbox bar's «مسار العميل» stage narrows this view; folder, team, channel and status stay as they are.
  const stageFilter = useStageFilter();
  const meta = useCwStore((s) => s.meta);
  const deleted = useCwStore((s) => s.deleted);
  const folders = useCwStore((s) => s.folders);
  const applied = useCwStore((s) => s.applied);
  const statusFilter = useCwStore((s) => s.statusFilter);
  // F-5A "View as": the conversations, the Mine tab and the tabs themselves are the viewed person's, by Chatwoot's rules
  // (src/lib/cw/view-as.ts: PermissionFilterService, ASSIGNEE_TYPE_TAB_PERMISSIONS). The signed-in admin sees all.
  const viewer = useViewer();
  const me = viewer.id;
  const sharedInboxes = useCwShared((s) => s.inboxes);
  const tabs = assigneeTabsFor(viewer);
  const pickedTab = useCwStore((s) => s.assigneeTab);
  const assigneeTab: AssigneeTab = tabs.includes(pickedTab) ? pickedTab : (tabs[0] ?? "me");
  const sortBy = useCwStore((s) => s.sortBy);
  const search = useCwStore((s) => s.search);
  const unread = useCwStore((s) => s.unread);
  const attrs = useCwStore((s) => s.conversationAttrs);
  const { byConv, filter, tags } = useChatTags();
  // The label of a label view counts from the first render (the Studio tag filter is synced right after).
  const labelFilter = view.kind === "label" ? (filter ?? view.id) : null;
  const channelView = useChannelFilter(labelFilter);
  // T-97: the channels checked in the picker above the list (null = all); a channel's own page is not narrowed.
  const picked = pickedChannels(
    useChannelChoice(),
    useLiveInboxes().map((inbox) => inbox.id),
  );

  const folder = view.kind === "folder" ? folders.find((f) => f.id === view.id) : undefined;
  const ctx = (c: Conversation): Ctx => ({ tags: byConv[String(c.id)] ?? [], attrs: attrs[c.id] ?? {} });

  const inView = baseConversations.filter((c) => {
    const m = meta[c.id];
    if (!m || deleted.includes(c.id)) return false;
    if (!canSeeConversation(viewer, c, m, sharedInboxes)) return false;
    switch (view.kind) {
      case "mentions":
        return m.mentioned;
      case "participating":
        return m.participants.includes(me);
      case "unattended":
        return m.unattended;
      case "folder":
        // An unknown or deleted folder shows nothing (Chatwoot does not fall back to every conversation).
        return folder ? matchesFilters(c, m, folder.filters, ctx(c)) : false;
      case "team":
        return m.teamId === view.id;
      case "inbox":
        return c.channel === view.id;
      case "label":
        return labelFilter ? (byConv[String(c.id)] ?? []).includes(labelFilter) : true;
      default:
        return true;
    }
  });

  // Label view: the Studio channel strip (brown) narrows the label's list to one channel.
  const byChannel = (
    view.kind === "label" && channelView.channel ? inView.filter((c) => c.channel === channelView.channel) : inView
  )
    .filter((c) => !picked || view.kind === "inbox" || picked.includes(c.channel))
    .filter((c) => !stageFilter || stageIdOf(c.id) === stageFilter);

  const hasAppliedFiltersOrFolder = Boolean(applied) || view.kind === "folder";
  const q = search.trim().toLowerCase();
  const filtered = byChannel.filter((c) => {
    const m = meta[c.id];
    if (applied && !matchesFilters(c, m, applied, ctx(c))) return false;
    if (!hasAppliedFiltersOrFolder && statusFilter !== "all") {
      const status = m.status === "closed" ? "resolved" : m.status;
      if (status !== statusFilter) return false;
    }
    if (q) {
      const haystack = [c.name, c.subject, c.preview, c.contact.email, String(c.id)].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const byTab = (tab: AssigneeTab) =>
    filtered.filter((c) => {
      const assignee = meta[c.id].assigneeId;
      if (tab === "me") return assignee === me;
      if (tab === "unassigned") return assignee === null;
      return true;
    });

  const counts = { me: byTab("me").length, unassigned: byTab("unassigned").length, all: filtered.length };

  // F161: the status menu (T-130: Open / Resolved / Pending / Snoozed / All, as Chatwoot) counts the view's
  // conversations in the current Mine / Unassigned / All tab, before the status is applied.
  const statusCounts = { all: 0, open: 0, pending: 0, snoozed: 0, resolved: 0 };
  for (const c of byChannel) {
    const m = meta[c.id];
    if (applied && !matchesFilters(c, m, applied, ctx(c))) continue;
    if (q && ![c.name, c.subject, c.preview, c.contact.email, String(c.id)].join(" ").toLowerCase().includes(q))
      continue;
    if (assigneeTab === "me" && m.assigneeId !== me) continue;
    if (assigneeTab === "unassigned" && m.assigneeId !== null) continue;
    statusCounts.all += 1;
    statusCounts[m.status === "closed" ? "resolved" : m.status] += 1;
  }
  const rank = (c: Conversation) => priorities.find((p) => p.value === meta[c.id].priority)?.rank ?? 0;

  // Chatwoot ChatList.vue: with a folder or an applied filter the assignee tabs are hidden and every match is listed.
  const rows = [...(hasAppliedFiltersOrFolder ? filtered : byTab(assigneeTab))].sort((a, b) => {
    switch (sortBy) {
      case "last_activity_at_asc":
        return activityIndex(b.id) - activityIndex(a.id);
      case "created_at_desc":
        return meta[b.id].createdRank - meta[a.id].createdRank;
      case "created_at_asc":
        return meta[a.id].createdRank - meta[b.id].createdRank;
      case "priority_desc":
        return rank(b) - rank(a) || activityIndex(a.id) - activityIndex(b.id);
      case "priority_asc":
        return rank(a) - rank(b) || activityIndex(a.id) - activityIndex(b.id);
      case "waiting_since_asc":
        return (
          Number(meta[b.id].unattended) - Number(meta[a.id].unattended) || activityIndex(b.id) - activityIndex(a.id)
        );
      case "waiting_since_desc":
        return (
          Number(meta[b.id].unattended) - Number(meta[a.id].unattended) || activityIndex(a.id) - activityIndex(b.id)
        );
      case "priority_desc_created_at_asc":
        return rank(b) - rank(a) || meta[a.id].createdRank - meta[b.id].createdRank;
      case "unread":
        return (unread[b.id] ?? 0) - (unread[a.id] ?? 0);
      default:
        return activityIndex(a.id) - activityIndex(b.id);
    }
  });

  return {
    rows,
    counts,
    // F-5A: the tabs the viewed person has, and the one shown (the picked one, or their first when they lack it).
    tabs,
    assigneeTab,
    statusCounts,
    folder,
    labelScoped: inView,
    channelView,
    hasAppliedFiltersOrFolder,
    tagLabel: tags.find((t) => t.id === labelFilter)?.label,
  };
}

export { inboxOf };
