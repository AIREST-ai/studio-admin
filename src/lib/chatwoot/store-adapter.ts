"use client";

// U-2 (item 159): Single store adapter bridging the Studio's three stores
// (src/lib/cw/store.ts, src/app/(main)/dashboard/chat/_components/cw-store.ts,
// src/app/(main)/dashboard/contacts/_components/contacts-store.ts) to Chatwoot v4.18.0
// exclusively through the unified client (src/lib/chatwoot/unified-client.ts -> /api/cw/[...path]).
//
// Enforces all 8 mandatory conditions of U-2:
// 1. Single adapter reusing canonical mappers in src/lib/chatwoot/map.ts; zero UI button edits.
// 2. Single write path (/api/cw/... via unified-client.ts); never calls /api/chatwoot/*.
// 3. No silent fallback: supported writes hit Chatwoot and report real errors; unsupported gateway routes
//    show an honest refusal toast and never write to local preview stores.
// 4. Zero mixing between preview and linked: switching modes flushes/restores stores and blocks all writes
//    to .preview-state/ disk files while linked.
// 5. View-as permissions: real Chatwoot agents + inbox memberships work with src/lib/cw/view-as.ts.
// 6. Multi-page pagination for both /conversations (page=1, 2, ...) and /contacts (page=1, 2, ...).
import { toast } from "sonner";
import { create } from "zustand";

import {
  getConversationTags,
  replaceConversationTags,
  setLinkedTagWriter,
} from "@/app/(main)/chat/_components/chat-tags-store";
import {
  type Contact as ChatContact,
  type Conversation,
  contactIdOf,
  replaceConversations,
  restorePreviewConversations,
} from "@/app/(main)/chat/_components/data";
import type { LiveChatCampaign, OneOffCampaign } from "@/app/(main)/dashboard/campaigns/_components/data";
import { useCampaignsSave, useCampaignsStore } from "@/app/(main)/dashboard/campaigns/_components/store";
import {
  baseConversations,
  type ConversationMeta,
  type CwMessage,
  type CwStatus,
  type FilterRow,
  type Folder,
  getLinkedThread,
  type Priority,
  setLinkedAgentIds,
  setLinkedThread,
  setLinkedThreads,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import {
  type ContactNote as ConvContactNote,
  contactKeyOf,
  type LinkedCwAdapter,
  restorePreviewCwState,
  setLinkedCwAdapter,
  cw as studioCw,
  useCwStore,
} from "@/app/(main)/dashboard/chat/_components/cw-store";
import { setLinkedSimActionsAdapter } from "@/app/(main)/dashboard/chat/_components/sim-actions";
import { useLabelSaves } from "@/app/(main)/dashboard/chat/_components/sim-panel-persist";
import {
  type KeepOutcome,
  type OutgoingFile,
  setLinkedThreadAdapter,
  snoozeTime,
} from "@/app/(main)/dashboard/chat/_components/sim-thread-persist";
import {
  type ContactDraft,
  type ContactFilter,
  type ContactNote,
  restorePreviewContacts,
  type Segment,
  setLinkedContactsAdapter,
  showLinkedContacts,
  useContactsStore,
} from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import type { Contact as DirectoryContact } from "@/app/(main)/dashboard/contacts/_components/data";
import type { Article, Category, Locale, Portal } from "@/app/(main)/dashboard/help-center/_components/data";
// V-15: Help Center and Campaigns live data binding
import {
  replaceHelpCenterData,
  restorePreviewHelpCenter,
} from "@/app/(main)/dashboard/help-center/_components/hc-store";
import type {
  InboxNotification,
  NotificationType,
} from "@/app/(main)/dashboard/notifications/_components/notification-data";
import {
  setLinkedNotificationsAdapter,
  showLinkedNotifications,
} from "@/app/(main)/dashboard/notifications/_components/notifications-store";
import { FROZEN_LIVE_INBOX_IDS, TEST_CONVERSATION_ID, TEST_INBOX_ID } from "@/lib/chatwoot/gateway-policy";
import {
  toArticles,
  toCampaigns,
  toCategories,
  toCwMessage,
  toCwMessages,
  toDirectoryContact,
  toDirectoryContacts,
  toPortals,
  toSharedAgents,
  toSharedCanned,
  toSharedInboxes,
  toSharedLabels,
  toSharedTeams,
  toStudioConversations,
} from "@/lib/chatwoot/map";
import {
  createLinkedCustomFilter,
  deleteLinkedCustomFilter,
  fetchLinkedCustomFilters,
  handleRealtimeSettingsEvent,
  mapRawMacros,
  registerLabelIds,
} from "@/lib/chatwoot/settings-adapter";
import { formDataBody, scrubSecrets, cw as unifiedCw } from "@/lib/chatwoot/unified-client";
import { linkedSession, setLinkedSession } from "@/lib/cw/persistence/client";
import { showLinkedLists, useCwShared } from "@/lib/cw/store";
import { canSeeConversation, currentViewer } from "@/lib/cw/view-as";

export { linkedSession };

export interface LinkedAdapterStatus {
  active: boolean;
  loading: boolean;
  error: null | string;
  lastSyncedAt: string | null;
  lastReconciledAt: string | null;
  conversationsCount: number;
  contactsCount: number;
  realtimeConnected: boolean;
  lastEventSeq: number;
  lastSeq: number;
}

export const useLinkedAdapterStatus = create<LinkedAdapterStatus>(() => ({
  active: false,
  loading: false,
  error: null,
  lastSyncedAt: null,
  lastReconciledAt: null,
  conversationsCount: 0,
  contactsCount: 0,
  realtimeConnected: false,
  lastEventSeq: 0,
  lastSeq: 0,
}));

/** V-18: live staff viewing/typing from Chatwoot SSE (`conversation_typing_on` / `conversation.typing_on`). */
export interface LivePresenceOther {
  agentId: number;
  name: string;
  typing: boolean;
}

const LIVE_PRESENCE_TTL_MS = 20_000;

export const useLivePresenceStore = create<{ byConv: Record<number, LivePresenceOther[]> }>(() => ({
  byConv: {},
}));

const presenceExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function presenceTimerKey(convId: number, agentId: number): string {
  return `${convId}:${agentId}`;
}

function schedulePresenceExpiry(convId: number, agentId: number): void {
  const key = presenceTimerKey(convId, agentId);
  const previous = presenceExpiryTimers.get(key);
  if (previous) clearTimeout(previous);
  presenceExpiryTimers.set(
    key,
    setTimeout(() => {
      presenceExpiryTimers.delete(key);
      useLivePresenceStore.setState((state) => ({
        byConv: {
          ...state.byConv,
          [convId]: (state.byConv[convId] ?? []).filter((row) => row.agentId !== agentId),
        },
      }));
    }, LIVE_PRESENCE_TTL_MS),
  );
}

function clearLivePresenceStore(): void {
  for (const timer of presenceExpiryTimers.values()) clearTimeout(timer);
  presenceExpiryTimers.clear();
  useLivePresenceStore.setState({ byConv: {} });
}

function applyRealtimePresenceEvent(eventName: string, payload: Raw, conversationId: number | null): void {
  if (!linkedSession() || !useLinkedAdapterStatus.getState().active) return;
  const normalized = eventName.trim().replace(/\./g, "_");
  const typingOn = normalized === "conversation_typing_on";
  const typingOff = normalized === "conversation_typing_off";
  if (!typingOn && !typingOff) return;

  const convRaw = obj(payload.conversation);
  const convId =
    conversationId ?? num(convRaw.id) ?? num(convRaw.display_id) ?? num(payload.id) ?? num(payload.conversation_id);
  if (convId === null) return;

  const user = obj(payload.user);
  const userType = str(user.type);
  // Staff only: Chatwoot user.webhook_data is `{ type: "user" }`; contacts are `"contact"`.
  if (userType && userType !== "user") return;
  const agentId = num(user.id);
  const name = str(user.name);
  if (agentId === null || !Number.isInteger(agentId) || agentId <= 0 || !name) return;

  const viewer = currentViewer();
  if (agentId === viewer.id) return;

  useLivePresenceStore.setState((state) => {
    const current = state.byConv[convId] ?? [];
    const rest = current.filter((row) => row.agentId !== agentId);
    const next: LivePresenceOther = { agentId, name, typing: typingOn };
    return { byConv: { ...state.byConv, [convId]: [...rest, next] } };
  });
  schedulePresenceExpiry(convId, agentId);
}

/** V-2 Supervisor constraint 1: Mandatory >= 5000ms cooldown for auto-reconciliation on focus/visibilitychange. */
export const RECONCILE_COOLDOWN_MS = 5000;
const LAST_SEQ_SESSION_KEY = "studio:cw:lastSeq";

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

let agentNamesMap = new Map<number, string>();
let currentPersonOfMap: Record<number, number> = {};
/** V-16: conversation id → Chatwoot inbox id, filled on hydrate and live events. */
let conversationInboxById: Record<number, number> = {};
let activeRunId = 0;
const hydratedThreads = new Set<number>();
let activeEventSource: EventSource | null = null;
let lastSeq = 0;
let lastReceivedEventSeq = 0;
const processedClientEventSeqs = new Set<number>();
let lastReconcileAt = 0;
let lastFocusReconcileAt = 0;
let reconcileInFlight: Promise<boolean> | null = null;
let cleanupLifecycleListeners: (() => void) | null = null;

function readPersistedLastSeq(): number {
  if (typeof window === "undefined") return lastSeq;
  try {
    const raw = window.sessionStorage.getItem(LAST_SEQ_SESSION_KEY);
    if (!raw) return lastSeq;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > lastSeq ? parsed : lastSeq;
  } catch {
    return lastSeq;
  }
}

function setLastSeq(seq: number): void {
  if (!Number.isFinite(seq) || seq <= 0) return;
  if (seq > lastSeq) {
    lastSeq = seq;
    lastReceivedEventSeq = seq;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(LAST_SEQ_SESSION_KEY, String(seq));
      } catch {
        // Ignore sessionStorage quota/privacy errors
      }
    }
    useLinkedAdapterStatus.setState({ lastEventSeq: seq, lastSeq: seq });
  }
}

export function getLastSeq(): number {
  return lastSeq > 0 ? lastSeq : readPersistedLastSeq();
}

function formatGatewayError(err: unknown, status?: number): string {
  if (err && typeof err === "object") {
    const r = err as Record<string, unknown>;
    if (typeof r.error === "string" && r.error) return r.error;
    if (typeof r.message === "string" && r.message) return r.message;
  }
  if (err instanceof Error) return err.message;
  return status ? `HTTP ${status}` : "Request to linked Chatwoot server failed";
}

function refuseUnsupportedLinkedAction(feature: string, endpoint: string) {
  queueMicrotask(() => {
    toast.dismiss();
    toast.error(`${feature} is not available in linked mode`, {
      description: `${endpoint} is not enabled on the Studio gateway, so nothing was written to Chatwoot or to the local preview.`,
    });
  });
}

function rememberInboxMap(map: Record<number, number>): void {
  conversationInboxById = { ...conversationInboxById, ...map };
}

function toastFrozen(reason: string): void {
  queueMicrotask(() => {
    toast.dismiss();
    toast.error("Write refused during Meta review", { description: reason });
  });
}

function frozenConversationReason(convId: number, action: string): string | null {
  // V-17 r2: only conversation 2 in inbox 3 is allowed during Meta review.
  if (convId !== TEST_CONVERSATION_ID) {
    return `refused: ${action} is limited to Studio Test conversation 2 during Meta review (403)`;
  }
  const inboxId = conversationInboxById[convId];
  // If we know the inbox, it must be 3 (not 9 or 10). If unknown, allow through (gateway server-side will enforce).
  if (inboxId != null) {
    if (FROZEN_LIVE_INBOX_IDS.has(inboxId)) {
      return "refused: writing to frozen live inboxes 9 and 10 is blocked (403)";
    }
    if (inboxId !== TEST_INBOX_ID) {
      return `refused: ${action} is limited to Studio Test inbox 3 during Meta review (403)`;
    }
  }
  return null;
}

function frozenMergeReason(contactIds: number[]): string | null {
  for (const [convStr, contactId] of Object.entries(currentPersonOfMap)) {
    if (!contactIds.includes(contactId)) continue;
    const inboxId = conversationInboxById[Number(convStr)];
    if (inboxId != null && FROZEN_LIVE_INBOX_IDS.has(inboxId)) {
      return "refused: merging contacts of frozen live inboxes 9 and 10 is blocked (403)";
    }
  }
  return null;
}

function customFilterQuery(
  rows: { attribute: string; operator: string; value: string; join: "and" | "or" }[],
): Record<string, unknown> {
  return {
    payload: rows.map((row, index) => ({
      attribute_key: row.attribute,
      filter_operator: row.operator,
      values: row.value ? [row.value] : [],
      ...(index < rows.length - 1 ? { query_operator: rows[index + 1]?.join ?? "and" } : {}),
    })),
  };
}

function rowsFromCustomQuery(query: Record<string, unknown>): {
  attribute: string;
  operator: string;
  value: string;
  join: "and" | "or";
}[] {
  const payload = Array.isArray(query.payload) ? query.payload : [];
  return payload.map((item, index) => {
    const raw = obj(item);
    const values = Array.isArray(raw.values) ? raw.values : [];
    const prev = index > 0 ? obj(payload[index - 1]) : null;
    const join = prev && str(prev.query_operator) === "or" ? "or" : "and";
    return {
      attribute: str(raw.attribute_key) ?? "status",
      operator: str(raw.filter_operator) ?? "equal_to",
      value: values.length ? String(values[0]) : "",
      join,
    };
  });
}

function folderFromFilter(filter: { id: number; name: string; query: Record<string, unknown> }): Folder {
  return { id: String(filter.id), name: filter.name, filters: rowsFromCustomQuery(filter.query) as FilterRow[] };
}

function segmentFromFilter(filter: { id: number; name: string; query: Record<string, unknown> }): Segment {
  return { id: filter.id, name: filter.name, filters: rowsFromCustomQuery(filter.query) as ContactFilter[] };
}

function noteTime(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value > 1e11 ? value : value * 1000;
    return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return "Just now";
}

function mapCwNote(value: unknown): { id: number; author: string; time: string; content: string } | null {
  const raw = obj(value);
  const id = num(raw.id);
  if (id === null) return null;
  const user = obj(raw.user);
  return {
    id,
    author: str(user.name) ?? str(raw.user_name) ?? "Agent",
    time: noteTime(raw.created_at),
    content: str(raw.content) ?? "",
  };
}

function notesList(data: unknown): { id: number; author: string; time: string; content: string }[] {
  const raw = Array.isArray(data) ? data : Array.isArray(obj(data).payload) ? (obj(data).payload as unknown[]) : [];
  return raw.map(mapCwNote).filter((note): note is NonNullable<typeof note> => note !== null);
}

async function patchCustomFilter(
  id: number,
  name: string,
  query: Record<string, unknown>,
  filterType: "conversation" | "contact",
): Promise<void> {
  const res = await unifiedCw.PATCH("/custom_filters/{custom_filter_id}", {
    params: { path: { custom_filter_id: id } },
    body: {
      name,
      filter_type: filterType,
      query,
      custom_filter: { name, filter_type: filterType, query },
    } as never,
  });
  if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
}

async function mergeContactsOnServer(baseId: number, mergeeId: number): Promise<void> {
  const frozen = frozenMergeReason([baseId, mergeeId]);
  if (frozen) throw new Error(frozen);
  const res = await unifiedCw.POST("/actions/contact_merge", {
    body: { base_contact_id: baseId, mergee_contact_id: mergeeId },
  });
  if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
}

function applyLinkedContactMerge(primaryId: number, mergedId: number): void {
  const frozen = frozenMergeReason([primaryId, mergedId]);
  if (frozen) {
    toastFrozen(frozen);
    return;
  }
  const prevList = useContactsStore.getState().list;
  const prevNotes = useContactsStore.getState().notes;
  const primary = prevList.find((c) => c.id === primaryId);
  const merged = prevList.find((c) => c.id === mergedId);
  if (!primary || !merged) {
    toast.error("Contacts not merged", { description: "One of the contacts is not loaded." });
    return;
  }
  const combined = {
    ...primary,
    email: primary.email || merged.email,
    phone: primary.phone || merged.phone,
    company: primary.company || merged.company,
    city: primary.city || merged.city,
    country: primary.country || merged.country,
    bio: primary.bio || merged.bio,
    labels: Array.from(new Set([...primary.labels, ...merged.labels])),
  };
  useContactsStore.setState((state) => ({
    list: state.list.filter((c) => c.id !== mergedId).map((c) => (c.id === primaryId ? combined : c)),
    notes: { ...state.notes, [primaryId]: [...(state.notes[primaryId] ?? []), ...(state.notes[mergedId] ?? [])] },
  }));
  void mergeContactsOnServer(primaryId, mergedId)
    .then(() => {
      toast.success("Contacts merged in Chatwoot");
    })
    .catch((err) => {
      useContactsStore.setState({ list: prevList, notes: prevNotes });
      toast.error("Contacts not merged in Chatwoot", { description: formatGatewayError(err) });
    });
}

/** Condition 6: Paginate through GET /conversations?status=all&assignee_type=all&page=N until exhausted. */
async function fetchAllConversations(): Promise<unknown[]> {
  const all: unknown[] = [];
  const seen = new Set<number>();
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await unifiedCw.GET("/conversations", {
      params: {
        query: {
          status: "all",
          assignee_type: "all",
          page,
        },
      },
    });
    if (res.error || !res.data) {
      if (page === 1) {
        throw new Error(formatGatewayError(res.error, res.response?.status));
      }
      break;
    }
    const dataObj = obj(res.data);
    const innerData = obj(dataObj.data);
    const payload = Array.isArray(innerData.payload)
      ? innerData.payload
      : Array.isArray(dataObj.payload)
        ? dataObj.payload
        : [];
    if (payload.length === 0) break;

    let added = 0;
    for (const item of payload) {
      const id = num(obj(item).id);
      if (id !== null && !seen.has(id)) {
        seen.add(id);
        all.push(item);
        added++;
      }
    }
    // Chatwoot conversation index page size is 25
    if (payload.length < 25 || added === 0) break;
  }

  return all;
}

/** Condition 6: Paginate through GET /contacts?page=N until exhausted. */
async function fetchAllContacts(): Promise<{
  contacts: DirectoryContact[];
  attrs: Record<number, Record<string, string>>;
}> {
  const rawList: unknown[] = [];
  const seen = new Set<number>();
  const attrs: Record<number, Record<string, string>> = {};
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await unifiedCw.GET("/contacts", {
      params: {
        query: { page },
      },
    });
    if (res.error || !res.data) {
      if (page === 1) {
        throw new Error(formatGatewayError(res.error, res.response?.status));
      }
      break;
    }
    const body = obj(res.data);
    const payload = Array.isArray(body.payload) ? body.payload : [];
    const meta = obj(body.meta);
    const totalCount = num(meta.count);

    if (payload.length === 0) break;

    let added = 0;
    for (const item of payload) {
      const r = obj(item);
      const id = num(r.id);
      if (id !== null && !seen.has(id)) {
        seen.add(id);
        rawList.push(item);
        added++;
        const customRaw = obj(r.custom_attributes);
        const customMap: Record<string, string> = {};
        for (const [k, v] of Object.entries(customRaw)) {
          if (v !== null && v !== undefined) customMap[k] = String(v);
        }
        if (Object.keys(customMap).length > 0) attrs[id] = customMap;
      }
    }

    if (payload.length < 15 || added === 0 || (totalCount !== null && rawList.length >= totalCount)) {
      break;
    }
  }

  return { contacts: toDirectoryContacts(rawList), attrs };
}

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "conversation_mention",
  "conversation_assignment",
  "conversation_creation",
  "assigned_conversation_new_message",
  "participating_conversation_new_message",
  "sla_missed_first_response",
  "sla_missed_next_response",
  "sla_missed_resolution",
];

function asNotificationType(raw: string | null): NotificationType {
  return NOTIFICATION_TYPES.includes(raw as NotificationType)
    ? (raw as NotificationType)
    : "assigned_conversation_new_message";
}

function toUnixSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }
  return null;
}

function notificationRows(data: unknown): unknown[] {
  const scrubbed = obj(scrubSecrets(data));
  const inner = obj(scrubbed.data);
  if (Array.isArray(inner.payload)) return inner.payload;
  if (Array.isArray(scrubbed.payload)) return scrubbed.payload;
  if (Array.isArray(inner.notifications)) return inner.notifications;
  if (Array.isArray(scrubbed.notifications)) return scrubbed.notifications;
  return [];
}

/** V-14: paginate GET /notifications (Chatwoot RESULTS_PER_PAGE = 15). */
async function fetchAllNotifications(): Promise<unknown[]> {
  const all: unknown[] = [];
  const seen = new Set<number>();
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await unifiedCw.GET("/notifications", {
      params: { query: { page, includes: "read,snoozed" } },
    });
    if (res.error || !res.data) {
      if (page === 1) throw new Error(formatGatewayError(res.error, res.response?.status));
      break;
    }
    const payload = notificationRows(res.data);
    if (payload.length === 0) break;
    let added = 0;
    for (const item of payload) {
      const id = num(obj(item).id);
      if (id !== null && !seen.has(id)) {
        seen.add(id);
        all.push(item);
        added++;
      }
    }
    if (payload.length < 15 || added === 0) break;
  }

  return all;
}

function stubConversation(id: number, name: string, preview: string, minutesAgo: number): Conversation {
  return {
    id,
    group: minutesAgo < 24 * 60 ? "Today" : "Yesterday",
    name,
    subject: `Chat · #${id}`,
    preview,
    time: minutesAgo < 1 ? "Just now" : `${minutesAgo}m`,
    isUnread: true,
    unreadCount: 1,
    channel: "chat",
    contact: {
      name,
      role: "",
      company: "",
      email: "",
      phone: "",
      website: "",
      location: "",
      timezone: "UTC+3",
      status: "Lead",
      qualifiedAt: "",
      tags: [],
    },
    messages: [],
    ago: minutesAgo,
  };
}

function mapCwNotifications(
  rawItems: unknown[],
  conversations: Conversation[],
  metaByConvId: Record<number, ConversationMeta>,
  agentNames: Map<number, string>,
): InboxNotification[] {
  const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const out: InboxNotification[] = [];

  for (const item of rawItems) {
    const raw = obj(scrubSecrets(item));
    const id = num(raw.id);
    if (id === null) continue;
    const actor = obj(raw.primary_actor);
    const convId = num(actor.id) ?? num(actor.display_id) ?? num(raw.primary_actor_id);
    if (convId === null) continue;
    const createdSec = toUnixSeconds(raw.last_activity_at) ?? toUnixSeconds(raw.created_at);
    const minutes = createdSec ? Math.max(0, Math.floor((Date.now() / 1000 - createdSec) / 60)) : 0;
    const message =
      str(raw.push_message_title) ??
      str(raw.push_message_body) ??
      str(obj(raw.meta).message) ??
      `Conversation #${convId}`;
    const contactName =
      str(obj(obj(actor.meta).sender).name) ??
      str(obj(actor.meta).sender_name) ??
      str(actor.name) ??
      `Conversation #${convId}`;
    const conversation = byId.get(convId) ?? stubConversation(convId, contactName, message, minutes);
    const meta = metaByConvId[convId];
    const assigneeId = meta?.assigneeId ?? num(obj(obj(actor.meta).assignee).id);
    const snoozedUntilSec = toUnixSeconds(raw.snoozed_until);
    out.push({
      id,
      conversationId: convId,
      type: asNotificationType(str(raw.notification_type)),
      unread: raw.read_at == null || raw.read_at === "",
      conversation,
      contactName: conversation.contact?.name ?? conversation.name,
      assigneeId,
      assignee: assigneeId ? (agentNames.get(assigneeId) ?? null) : null,
      actor: str(obj(raw.secondary_actor).name) ?? contactName,
      message,
      minutesAgo: minutes,
      ...(snoozedUntilSec ? { snoozedUntil: snoozedUntilSec * 1000 } : {}),
    });
  }

  return out;
}

const markingNotificationRead = new Set<number>();
let markingAllNotifications = false;

function markLinkedNotificationRead(id: number): void {
  if (!linkedSession() || markingNotificationRead.has(id)) return;
  markingNotificationRead.add(id);
  void (async () => {
    try {
      const res = await unifiedCw.PATCH("/notifications/{id}", {
        params: { path: { id } },
        body: { read_at: new Date().toISOString() },
      });
      if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
    } catch (err) {
      toast.error("Notification not marked read in Chatwoot", {
        description: formatGatewayError(err),
      });
    } finally {
      markingNotificationRead.delete(id);
    }
  })();
}

function markAllLinkedNotificationsRead(): void {
  if (!linkedSession() || markingAllNotifications) return;
  markingAllNotifications = true;
  void (async () => {
    try {
      const res = await unifiedCw.POST("/notifications/read_all", {
        body: {},
      });
      if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
    } catch (err) {
      toast.error("Notifications not marked read in Chatwoot", {
        description: formatGatewayError(err),
      });
    } finally {
      markingAllNotifications = false;
    }
  })();
}

function triggerThreadRerender(convId: number, thread: CwMessage[]) {
  const nonActivity = thread.filter((m) => m.kind === "incoming" || m.kind === "outgoing");
  const lastMsg = nonActivity.at(-1) ?? thread.at(-1);
  const idx = baseConversations.findIndex((c) => c.id === convId);
  if (idx >= 0) {
    const cur = baseConversations[idx];
    const nextConv = {
      ...cur,
      ...(lastMsg && (lastMsg.kind === "incoming" || lastMsg.kind === "outgoing") && lastMsg.text.trim()
        ? { preview: lastMsg.text, time: "now" }
        : {}),
      messages: nonActivity.map((m, mIdx) => ({
        id: Number.parseInt(m.id, 10) || convId * 100 + mIdx + 1,
        align: (m.kind === "incoming" ? "start" : "end") as "start" | "end",
        text: m.text,
        time: m.time,
        ago: cur.ago ?? 0,
      })),
    };
    const nextList = [...baseConversations];
    nextList[idx] = nextConv;
    replaceConversations(nextList, currentPersonOfMap);
  }
  useCwStore.setState((state) => ({
    meta: state.meta[convId] ? { ...state.meta, [convId]: { ...state.meta[convId] } } : state.meta,
    sent: { ...state.sent, [convId]: [] },
  }));
}

/** Fetch full message history for a conversation from GET /conversations/{conversation_id}/messages. */
export async function hydrateConversationThread(convId: number, runId = activeRunId): Promise<void> {
  if (!useLinkedAdapterStatus.getState().active || runId !== activeRunId) return;
  try {
    const res = await unifiedCw.GET("/conversations/{conversation_id}/messages", {
      params: { path: { conversation_id: convId } },
    });
    if (!useLinkedAdapterStatus.getState().active || runId !== activeRunId) return;
    if (res.error || !res.data) return;

    const fetched = toCwMessages(res.data, agentNamesMap);
    const existing = getLinkedThread(convId) ?? [];
    const pendingOptimistic = existing.filter(
      (m) =>
        m.id.startsWith("cw-pending-") && !fetched.some((f) => f.kind === m.kind && f.text.trim() === m.text.trim()),
    );
    const merged = [...fetched, ...pendingOptimistic];
    hydratedThreads.add(convId);
    setLinkedThread(convId, merged);
    triggerThreadRerender(convId, merged);
  } catch {
    // Ignore background hydration errors; the initial snippet remains visible
  }
}

function upsertLinkedMessage(convId: number, msg: CwMessage, replaceTempId?: string) {
  const existing = getLinkedThread(convId) ?? [];
  const working = replaceTempId ? existing.filter((m) => m.id !== replaceTempId) : [...existing];

  // Condition 4: If this is a real server message (not cw-pending-*), remove any matching optimistic pending entry
  if (!msg.id.startsWith("cw-pending-")) {
    const pendingIdx = working.findIndex(
      (m) => m.id.startsWith("cw-pending-") && m.kind === msg.kind && m.text.trim() === msg.text.trim(),
    );
    if (pendingIdx >= 0) {
      working.splice(pendingIdx, 1);
    }
  }

  const existingIdx = working.findIndex((m) => m.id === msg.id);
  if (existingIdx >= 0) {
    working[existingIdx] = msg;
  } else {
    working.push(msg);
  }

  setLinkedThread(convId, working);
  triggerThreadRerender(convId, working);
}

function appendToLinkedThread(convId: number, msg: CwMessage) {
  upsertLinkedMessage(convId, msg);
}

function removeFromLinkedThread(convId: number, msgId: string) {
  const existing = getLinkedThread(convId) ?? [];
  const next = existing.filter((m) => m.id !== msgId);
  setLinkedThread(convId, next);
  triggerThreadRerender(convId, next);
}

function resolveContactIdFromKey(key: string): number | null {
  if (key.startsWith("contact:")) {
    const n = Number.parseInt(key.slice("contact:".length), 10);
    return Number.isFinite(n) ? n : null;
  }
  if (key.startsWith("conversation:")) {
    const convId = Number.parseInt(key.slice("conversation:".length), 10);
    return Number.isFinite(convId) ? contactIdOf(convId) : null;
  }
  if (key.startsWith("email:")) {
    const email = key.slice("email:".length).toLowerCase();
    const match = useContactsStore.getState().list.find((c) => c.email.toLowerCase() === email);
    return match?.id ?? null;
  }
  return null;
}

function installLinkedAdapters() {
  const cwAdapter: LinkedCwAdapter = {
    onFocus(id) {
      if (id !== null && !hydratedThreads.has(id)) {
        void hydrateConversationThread(id);
      }
    },
    setStatus(ids, status, snoozedUntil = null) {
      void linkedThreadAdapter.changeStatus(ids, status, {
        snooze: snoozedUntil ? "tomorrow" : "next_reply",
      });
    },
    setPriority(ids, priority) {
      const prevMeta = useCwStore.getState().meta;
      useCwStore.setState((state) => {
        const meta = { ...state.meta };
        for (const id of ids) if (meta[id]) meta[id] = { ...meta[id], priority };
        return { meta };
      });

      void Promise.all(
        ids.map(async (convId) => {
          const res = await unifiedCw.POST("/conversations/{conversation_id}/toggle_priority", {
            params: { path: { conversation_id: convId } },
            body: {
              priority: priority === "none" ? null : priority,
            },
          });
          if (res.error) {
            throw new Error(formatGatewayError(res.error, res.response?.status));
          }
        }),
      )
        .then(() => {
          toast.success("Priority updated in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => {
            const meta = { ...state.meta };
            for (const id of ids) if (prevMeta[id]) meta[id] = prevMeta[id];
            return { meta };
          });
          toast.error("Priority not updated in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    assignAgent(ids, assigneeId) {
      const prevMeta = useCwStore.getState().meta;
      useCwStore.setState((state) => {
        const meta = { ...state.meta };
        for (const id of ids) {
          const cur = meta[id];
          if (!cur) continue;
          const participants =
            assigneeId && !cur.participants.includes(assigneeId) ? [...cur.participants, assigneeId] : cur.participants;
          meta[id] = { ...cur, assigneeId, participants, unattended: assigneeId ? false : cur.unattended };
        }
        return { meta };
      });

      void Promise.all(
        ids.map(async (convId) => {
          const res = await unifiedCw.POST("/conversations/{conversation_id}/assignments", {
            params: { path: { conversation_id: convId } },
            body: { assignee_id: assigneeId ?? 0 },
          });
          if (res.error) {
            throw new Error(formatGatewayError(res.error, res.response?.status));
          }
        }),
      )
        .then(() => {
          toast.success(assigneeId ? "Assigned agent in Chatwoot" : "Unassigned agent in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => {
            const meta = { ...state.meta };
            for (const id of ids) if (prevMeta[id]) meta[id] = prevMeta[id];
            return { meta };
          });
          toast.error("Agent assignment failed in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    assignTeam(ids, teamSlug) {
      const prevMeta = useCwStore.getState().meta;
      const teams = useCwShared.getState().teams;
      const matchedTeam = teamSlug ? teams.find((t) => t.slug === teamSlug) : null;
      if (teamSlug && !matchedTeam) {
        toast.error("Team not found in Chatwoot", {
          description: `No Chatwoot team matches "${teamSlug}".`,
        });
        return;
      }

      useCwStore.setState((state) => {
        const meta = { ...state.meta };
        for (const id of ids) if (meta[id]) meta[id] = { ...meta[id], teamId: teamSlug };
        return { meta };
      });

      void Promise.all(
        ids.map(async (convId) => {
          const res = await unifiedCw.POST("/conversations/{conversation_id}/assignments", {
            params: { path: { conversation_id: convId } },
            body: { team_id: matchedTeam ? matchedTeam.id : 0 },
          });
          if (res.error) {
            throw new Error(formatGatewayError(res.error, res.response?.status));
          }
        }),
      )
        .then(() => {
          toast.success(matchedTeam ? `Assigned to ${matchedTeam.name} in Chatwoot` : "Unassigned team in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => {
            const meta = { ...state.meta };
            for (const id of ids) if (prevMeta[id]) meta[id] = prevMeta[id];
            return { meta };
          });
          toast.error("Team assignment failed in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    setParticipants(id, participants) {
      const prevMeta = useCwStore.getState().meta[id];
      useCwStore.setState((state) => {
        const cur = state.meta[id];
        if (!cur) return state;
        return { meta: { ...state.meta, [id]: { ...cur, participants } } };
      });
      void unifiedCw
        .PATCH("/conversations/{conversation_id}/participants", {
          params: { path: { conversation_id: id } },
          body: { user_ids: participants },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success("Participants updated in Chatwoot");
        })
        .catch((err) => {
          if (prevMeta) {
            useCwStore.setState((state) => ({ meta: { ...state.meta, [id]: prevMeta } }));
          }
          toast.error("Participants not updated in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    markRead(id) {
      useCwStore.setState((state) => ({
        unread: { ...state.unread, [id]: 0 },
        readCounts: { ...state.readCounts, [id]: state.unread[id] ?? 0 },
      }));
    },
    markUnread(id) {
      const prev = useCwStore.getState().unread[id] ?? 0;
      useCwStore.setState((state) => ({ unread: { ...state.unread, [id]: Math.max(prev, 1) } }));
      void unifiedCw
        .POST("/conversations/{conversation_id}/unread", {
          params: { path: { conversation_id: id } },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success("Conversation marked unread in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => ({ unread: { ...state.unread, [id]: prev } }));
          toast.error("Conversation not marked unread in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    toggleMute(id) {
      const frozen = frozenConversationReason(id, "mute/unmute");
      if (frozen) {
        toastFrozen(frozen);
        return;
      }
      const wasMuted = useCwStore.getState().muted[id] === true;
      const prevMeta = useCwStore.getState().meta[id];
      useCwStore.setState((state) => {
        const muted = { ...state.muted, [id]: !wasMuted };
        const cur = state.meta[id];
        if (!wasMuted && cur) {
          return { muted, meta: { ...state.meta, [id]: { ...cur, status: "resolved", snoozedUntil: null } } };
        }
        return { muted };
      });
      const path = wasMuted ? "/conversations/{conversation_id}/unmute" : "/conversations/{conversation_id}/mute";
      void unifiedCw
        .POST(path, { params: { path: { conversation_id: id } } })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success(wasMuted ? "Conversation unmuted in Chatwoot" : "Conversation muted in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => {
            const muted = { ...state.muted, [id]: wasMuted };
            if (prevMeta) return { muted, meta: { ...state.meta, [id]: prevMeta } };
            return { muted };
          });
          toast.error("Mute not updated in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    deleteConversation() {
      refuseUnsupportedLinkedAction("Deleting conversation", "DELETE /conversations/{id}");
    },
    send(id, message) {
      void linkedThreadAdapter.keepMessage(
        id,
        {
          kind: message.kind,
          text: message.text,
          attachments: message.attachments,
          replyTo: message.replyTo,
        },
        new Map(),
        // biome-ignore lint/suspicious/noExplicitAny: internal fallback store
        { setState: () => undefined } as any,
      );
    },
    setConversationAttr() {
      refuseUnsupportedLinkedAction(
        "Updating conversation custom attributes",
        "POST /conversations/{id}/custom_attributes",
      );
    },
    setContactAttr(convId, key, value) {
      const cId = contactIdOf(convId);
      if (cId === null) {
        toast.error("Contact attribute not updated", {
          description: "This conversation has no linked contact ID.",
        });
        return;
      }
      const prevConvAttrs = useCwStore.getState().contactAttrs[convId] ?? {};
      const nextAttrs = { ...prevConvAttrs };
      if (value === null) delete nextAttrs[key];
      else nextAttrs[key] = value;

      useCwStore.setState((state) => ({
        contactAttrs: { ...state.contactAttrs, [convId]: nextAttrs },
      }));
      useContactsStore.setState((state) => ({
        attrs: { ...state.attrs, [cId]: nextAttrs },
      }));

      const contact = useContactsStore.getState().list.find((c) => c.id === cId);
      void unifiedCw
        .PUT("/contacts/{id}", {
          params: { path: { id: cId } },
          body: {
            name: contact?.name,
            custom_attributes: nextAttrs as unknown as Record<string, never>,
          },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success("Contact attribute saved in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => ({
            contactAttrs: { ...state.contactAttrs, [convId]: prevConvAttrs },
          }));
          useContactsStore.setState((state) => ({
            attrs: { ...state.attrs, [cId]: prevConvAttrs },
          }));
          toast.error("Contact attribute not saved in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    addNote(convId, text) {
      const contactId = currentPersonOfMap[convId] ?? contactIdOf(convId);
      if (contactId === null) {
        toast.error("Note not saved", { description: "This conversation has no linked contact ID." });
        return;
      }
      const tempId = Date.now();
      const optimistic: ConvContactNote = {
        id: tempId,
        author: currentViewer().name,
        time: "Just now",
        text,
      };
      useCwStore.setState((state) => ({
        notes: { ...state.notes, [convId]: [optimistic, ...(state.notes[convId] ?? [])] },
      }));
      void unifiedCw
        .POST("/contacts/{id}/notes", {
          params: { path: { id: contactId } },
          body: { note: { content: text }, content: text },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          const mapped = mapCwNote(obj(res.data).payload ?? res.data);
          if (mapped) {
            const saved: ConvContactNote = {
              id: mapped.id,
              author: mapped.author,
              time: mapped.time,
              text: mapped.content,
            };
            useCwStore.setState((state) => ({
              notes: {
                ...state.notes,
                [convId]: (state.notes[convId] ?? []).map((note) => (note.id === tempId ? saved : note)),
              },
            }));
          }
          toast.success("Note saved in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => ({
            notes: {
              ...state.notes,
              [convId]: (state.notes[convId] ?? []).filter((note) => note.id !== tempId),
            },
          }));
          toast.error("Note not saved in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    deleteNote(convId, noteId) {
      const contactId = currentPersonOfMap[convId] ?? contactIdOf(convId);
      if (contactId === null) {
        toast.error("Note not deleted", { description: "This conversation has no linked contact ID." });
        return;
      }
      const prev = useCwStore.getState().notes[convId] ?? [];
      useCwStore.setState((state) => ({
        notes: { ...state.notes, [convId]: (state.notes[convId] ?? []).filter((note) => note.id !== noteId) },
      }));
      void unifiedCw
        .DELETE("/contacts/{id}/notes/{note_id}", {
          params: { path: { id: contactId, note_id: noteId } },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success("Note deleted in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => ({ notes: { ...state.notes, [convId]: prev } }));
          toast.error("Note not deleted in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    editContact(key, patch) {
      const cId = resolveContactIdFromKey(key);
      if (cId === null) {
        toast.error("Contact not updated", {
          description: "Could not resolve Chatwoot contact ID for this conversation.",
        });
        return;
      }
      const existing = useContactsStore.getState().list.find((c) => c.id === cId);
      const name = patch.name ?? existing?.name ?? `Contact #${cId}`;
      const email = patch.email ?? existing?.email ?? "";
      const phone = patch.phone ?? existing?.phone ?? "";
      const company = patch.company ?? existing?.company ?? "";
      const locationParts = (patch.location ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const city = locationParts[0] ?? existing?.city ?? "";
      const country = locationParts[1] ?? existing?.country ?? "";

      const prevEdits = useCwStore.getState().contactEdits[key];
      useCwStore.setState((state) => ({
        contactEdits: { ...state.contactEdits, [key]: { ...(state.contactEdits[key] ?? {}), ...patch } },
      }));

      void unifiedCw
        .PUT("/contacts/{id}", {
          params: { path: { id: cId } },
          body: {
            name,
            ...(email ? { email } : {}),
            ...(phone ? { phone_number: phone } : {}),
            additional_attributes: {
              company_name: company,
              city,
              country,
              description: patch.role ?? existing?.bio ?? "",
            } as unknown as Record<string, never>,
          },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          const payload = obj(res.data).payload ?? res.data;
          const updated = toDirectoryContact(payload);
          useContactsStore.setState((state) => ({
            list: state.list.map((c) => (c.id === cId ? updated : c)),
          }));
          toast.success("Contact updated in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => {
            const nextEdits = { ...state.contactEdits };
            if (prevEdits === undefined) delete nextEdits[key];
            else nextEdits[key] = prevEdits;
            return { contactEdits: nextEdits };
          });
          toast.error("Contact update failed in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    addFolder(name, filters) {
      const tempId = `f-${Date.now().toString(36)}`;
      const folder: Folder = { id: tempId, name: name.trim() || "Untitled folder", filters };
      useCwStore.setState((state) => ({ folders: [...state.folders, folder], applied: null }));
      void createLinkedCustomFilter(folder.name, customFilterQuery(filters), "conversation")
        .then((created) => {
          const saved = folderFromFilter(created);
          useCwStore.setState((state) => ({
            folders: state.folders.map((item) => (item.id === tempId ? saved : item)),
          }));
          toast.success("Folder saved in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState((state) => ({
            folders: state.folders.filter((item) => item.id !== tempId),
          }));
          toast.error("Folder not saved in Chatwoot", { description: formatGatewayError(err) });
        });
      return folder;
    },
    updateFolder(id, name, filters) {
      const numericId = Number.parseInt(id, 10);
      if (!Number.isFinite(numericId)) {
        toast.error("Folder not updated", { description: "This folder has no Chatwoot id yet." });
        return;
      }
      const prev = useCwStore.getState().folders;
      useCwStore.setState((state) => ({
        folders: state.folders.map((folder) =>
          folder.id === id ? { ...folder, name: name || folder.name, filters } : folder,
        ),
      }));
      const nextName = name.trim() || prev.find((folder) => folder.id === id)?.name || "Untitled folder";
      void patchCustomFilter(numericId, nextName, customFilterQuery(filters), "conversation")
        .then(() => {
          toast.success("Folder updated in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState({ folders: prev });
          toast.error("Folder not updated in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    deleteFolder(id) {
      const numericId = Number.parseInt(id, 10);
      if (!Number.isFinite(numericId)) {
        toast.error("Folder not deleted", { description: "This folder has no Chatwoot id yet." });
        return;
      }
      const prev = useCwStore.getState().folders;
      useCwStore.setState((state) => ({ folders: state.folders.filter((folder) => folder.id !== id) }));
      void deleteLinkedCustomFilter(numericId)
        .then(() => {
          toast.success("Folder deleted in Chatwoot");
        })
        .catch((err) => {
          useCwStore.setState({ folders: prev });
          toast.error("Folder not deleted in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    // V-17 r2: Retry a failed message — send it again through the unified gateway.
    // Guard: must be conversation 2 in inbox 3; live inboxes 9/10 rejected with 403.
    // The message keeps status "failed" until a real 200 response arrives from Chatwoot (zero fake success).
    async retryMessage(convId: number, messageId: string): Promise<boolean> {
      const frozen = frozenConversationReason(convId, "retrying a message");
      if (frozen) {
        toastFrozen(frozen);
        return false;
      }
      const thread = getLinkedThread(convId) ?? [];
      const failedMsg = thread.find((m) => m.id === messageId);
      if (!failedMsg) {
        toast.error("Message not found for retry");
        return false;
      }
      // V-17 r2: add a "retrying…" indicator without removing the failed status.
      // The original message stays in the thread with status "failed" until the server confirms.
      const retryIndicator: CwMessage = {
        ...failedMsg,
        error: "Retrying…",
      };
      upsertLinkedMessage(convId, retryIndicator, messageId);
      try {
        const res = await unifiedCw.POST("/conversations/{conversation_id}/messages", {
          params: { path: { conversation_id: convId } },
          body: {
            content: failedMsg.text,
            message_type: "outgoing",
            private: failedMsg.kind === "note",
            ...(failedMsg.replyTo && Number.isFinite(Number(failedMsg.replyTo))
              ? { content_attributes: { in_reply_to: Number(failedMsg.replyTo) } as unknown as Record<string, never> }
              : {}),
          },
        });
        if (res.error || !res.data) {
          throw new Error(formatGatewayError(res.error, res.response?.status));
        }
        // Only now, after a real 200, do we replace the failed entry with the delivered message.
        const mapped = toCwMessage(res.data, agentNamesMap);
        upsertLinkedMessage(convId, mapped, messageId);
        toast.success("Message sent — retry succeeded");
        return true;
      } catch (err) {
        const msg = formatGatewayError(err);
        // Restore the failed state — the message shows "failed" again with the error reason.
        upsertLinkedMessage(convId, { ...failedMsg, error: msg }, messageId);
        toast.error("Message retry failed", { description: msg });
        return false;
      }
    },
  };

  const linkedThreadAdapter = {
    keepMessage(
      convId: number,
      input: {
        kind: "outgoing" | "note";
        text: string;
        attachments?: OutgoingFile[];
        replyTo?: string;
        from?: { id: number; name: string };
      },
      keeping: Map<string, Promise<KeepOutcome>>,
      useKeepState: { setState: (partial: Record<string, "saving" | "saved" | "failed">) => void },
    ): string {
      const tempId = `cw-pending-${convId}-${Date.now().toString(36)}`;
      const viewer = input.from ?? currentViewer();
      const files = input.attachments ?? [];
      const optimistic: CwMessage = {
        id: tempId,
        kind: input.kind,
        text: input.text,
        time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        at: new Date().toISOString(),
        sender: viewer.name,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(files.length
          ? {
              attachments: files.map((f) => ({
                type: f.type,
                name: f.name,
                size: f.size,
                duration: f.duration,
                previewUrl: f.previewUrl,
              })),
            }
          : {}),
      };

      appendToLinkedThread(convId, optimistic);
      useKeepState.setState({ [tempId]: "saving" });

      const realFiles = files.filter((f): f is OutgoingFile & { file: File } => Boolean(f.file));
      const promise = (async (): Promise<KeepOutcome> => {
        try {
          let res: { data?: unknown; error?: unknown; response?: Response };
          if (realFiles.length > 0) {
            const form = new FormData();
            form.append("content", input.text);
            form.append("message_type", "outgoing");
            form.append("private", input.kind === "note" ? "true" : "false");
            for (const f of realFiles) {
              form.append("attachments[]", f.file, f.file.name);
            }
            res = await unifiedCw.POST("/conversations/{conversation_id}/messages", {
              params: { path: { conversation_id: convId } },
              // biome-ignore lint/suspicious/noExplicitAny: FormData body serialized by formDataBody
              body: form as any,
              ...formDataBody,
            });
          } else {
            res = await unifiedCw.POST("/conversations/{conversation_id}/messages", {
              params: { path: { conversation_id: convId } },
              body: {
                content: input.text,
                message_type: "outgoing",
                private: input.kind === "note",
                ...(input.replyTo && Number.isFinite(Number(input.replyTo))
                  ? {
                      content_attributes: {
                        in_reply_to: Number(input.replyTo),
                      } as unknown as Record<string, never>,
                    }
                  : {}),
              },
            });
          }

          if (res.error || !res.data) {
            throw new Error(formatGatewayError(res.error, res.response?.status));
          }

          const mapped = toCwMessage(res.data, agentNamesMap);
          upsertLinkedMessage(convId, mapped, tempId);
          useKeepState.setState({ [tempId]: "saved", [mapped.id]: "saved" });
          return { ok: true };
        } catch (err) {
          const msg = formatGatewayError(err);
          removeFromLinkedThread(convId, tempId);
          useKeepState.setState({ [tempId]: "failed" });
          toast.error(input.kind === "note" ? "Private note not sent to Chatwoot" : "Reply not sent to Chatwoot", {
            description: msg,
          });
          return { ok: false, message: msg };
        }
      })();

      keeping.set(tempId, promise);
      return tempId;
    },
    async deleteMessage(convId: number, messageId: string): Promise<boolean> {
      const frozen = frozenConversationReason(convId, "deleting a message");
      if (frozen) {
        toastFrozen(frozen);
        return false;
      }
      const numericId = Number.parseInt(messageId, 10);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        toast.error("Message not deleted", { description: "This message has no Chatwoot id yet." });
        return false;
      }
      try {
        const res = await unifiedCw.DELETE("/conversations/{conversation_id}/messages/{message_id}", {
          params: { path: { conversation_id: convId, message_id: numericId } },
        });
        if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
        studioCw.deleteMessages([{ convId, messageId }]);
        toast.success("Message deleted in Chatwoot");
        return true;
      } catch (err) {
        toast.error("Message not deleted in Chatwoot", { description: formatGatewayError(err) });
        return false;
      }
    },
    async changeStatus(
      ids: number[],
      status: CwStatus,
      options: {
        snooze?: "next_reply" | "an_hour_from_now" | "tomorrow" | "next_week" | "next_month" | Date | null;
        quiet?: boolean;
        title?: string;
        label?: string;
      } = {},
    ): Promise<boolean> {
      const nextStatus: "open" | "resolved" | "pending" | "snoozed" = status === "closed" ? "resolved" : status;
      const untilDate =
        nextStatus === "snoozed"
          ? options.snooze instanceof Date
            ? options.snooze
            : snoozeTime(options.snooze ?? "next_reply")
          : null;
      const snoozedUntilSec = untilDate ? Math.floor(untilDate.getTime() / 1000) : undefined;

      const prevMeta = useCwStore.getState().meta;
      useCwStore.setState((state) => {
        const meta = { ...state.meta };
        for (const id of ids) {
          if (!meta[id]) continue;
          meta[id] = {
            ...meta[id],
            status: nextStatus,
            snoozedUntil:
              nextStatus === "snoozed"
                ? untilDate
                  ? `Snoozed until ${untilDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "Snoozed until next reply"
                : null,
          };
        }
        return { meta };
      });

      try {
        await Promise.all(
          ids.map(async (convId) => {
            const res = await unifiedCw.POST("/conversations/{conversation_id}/toggle_status", {
              params: { path: { conversation_id: convId } },
              body: {
                status: nextStatus,
                ...(snoozedUntilSec ? { snoozed_until: snoozedUntilSec } : {}),
              } as { status: "open" | "resolved" | "pending" },
            });
            if (res.error) {
              throw new Error(formatGatewayError(res.error, res.response?.status));
            }
          }),
        );
        if (!options.quiet) {
          toast.success(options.title ?? `Conversation marked ${nextStatus} in Chatwoot`);
        }
        return true;
      } catch (err) {
        useCwStore.setState((state) => {
          const meta = { ...state.meta };
          for (const id of ids) if (prevMeta[id]) meta[id] = prevMeta[id];
          return { meta };
        });
        toast.error("Status not updated in Chatwoot", {
          description: formatGatewayError(err),
        });
        return false;
      }
    },
    async toggleBlock(convId: number): Promise<KeepOutcome> {
      const frozen = frozenConversationReason(convId, "mute/unmute");
      if (frozen) {
        toastFrozen(frozen);
        return { ok: false, message: frozen };
      }
      const wasMuted = useCwStore.getState().muted[convId] === true;
      const prevMeta = useCwStore.getState().meta[convId];
      useCwStore.setState((state) => {
        const muted = { ...state.muted, [convId]: !wasMuted };
        const cur = state.meta[convId];
        if (!wasMuted && cur) {
          return { muted, meta: { ...state.meta, [convId]: { ...cur, status: "resolved", snoozedUntil: null } } };
        }
        return { muted };
      });
      const path = wasMuted ? "/conversations/{conversation_id}/unmute" : "/conversations/{conversation_id}/mute";
      try {
        const res = await unifiedCw.POST(path, { params: { path: { conversation_id: convId } } });
        if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
        toast.success(wasMuted ? "Conversation unmuted in Chatwoot" : "Conversation muted in Chatwoot");
        return { ok: true };
      } catch (err) {
        useCwStore.setState((state) => {
          const muted = { ...state.muted, [convId]: wasMuted };
          if (prevMeta) return { muted, meta: { ...state.meta, [convId]: prevMeta } };
          return { muted };
        });
        const message = formatGatewayError(err);
        toast.error("Mute not updated in Chatwoot", { description: message });
        return { ok: false, message };
      }
    },
  };

  setLinkedCwAdapter(cwAdapter);
  setLinkedThreadAdapter(linkedThreadAdapter);

  setLinkedSimActionsAdapter({
    finishSimCall() {
      refuseUnsupportedLinkedAction("Simulated voice call", "Voice call simulation");
    },
    simSendTranscript(input) {
      const frozen = frozenConversationReason(input.convId, "transcript");
      if (frozen) {
        toastFrozen(frozen);
        return { saved: Promise.resolve(false) };
      }
      const saved = (async () => {
        try {
          const res = await unifiedCw.POST("/conversations/{conversation_id}/transcript", {
            params: { path: { conversation_id: input.convId } },
            body: { email: input.email },
          });
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success("Transcript sent in Chatwoot", { description: `Sent to ${input.email}.` });
          return true;
        } catch (err) {
          toast.error("Transcript not sent in Chatwoot", { description: formatGatewayError(err) });
          return false;
        }
      })();
      return { saved };
    },
    simCreateConversation(input) {
      const contactId =
        input.person?.contactId ??
        (input.from ? (currentPersonOfMap[input.from.id] ?? contactIdOf(input.from.id)) : null);
      if (contactId === null) {
        toast.error("Conversation not created", { description: "No Chatwoot contact id for this person." });
        return { id: 0, saved: Promise.resolve(false) };
      }
      const saved = (async () => {
        try {
          const res = await unifiedCw.POST("/conversations", {
            body: {
              source_id: `studio-test-${contactId}`,
              inbox_id: TEST_INBOX_ID,
              contact_id: contactId,
              message: { content: input.text || input.subject || "New conversation" },
            },
          });
          if (res.error || !res.data) throw new Error(formatGatewayError(res.error, res.response?.status));
          const createdId = num(obj(res.data).id) ?? 0;
          if (createdId > 0) conversationInboxById[createdId] = TEST_INBOX_ID;
          toast.success("Conversation created in Chatwoot", {
            description: createdId ? `Conversation #${createdId} on Studio Test inbox 3.` : undefined,
          });
          return createdId > 0;
        } catch (err) {
          toast.error("Conversation not created in Chatwoot", { description: formatGatewayError(err) });
          return false;
        }
      })();
      return { id: 0, saved };
    },
    simSaveContact(name, phone) {
      const digits = phone.replace(/\D/g, "");
      const existing = digits
        ? useContactsStore.getState().list.find((c) => c.phone.replace(/\D/g, "") === digits)
        : undefined;
      if (existing) return { id: existing.id, existed: true };
      const created = useContactsStore.getState().add({
        name,
        email: "",
        phone: digits ? `+${digits}` : phone,
        company: "",
        city: "",
        country: "",
        bio: "",
      });
      return { id: created.id, existed: false };
    },
    simDeleteContact(convId) {
      const cId = contactIdOf(convId);
      if (cId === null) {
        toast.error("Contact not deleted", {
          description: "This conversation has no linked contact ID.",
        });
        return 0;
      }
      const convIds = baseConversations.filter((c) => contactIdOf(c.id) === cId).map((c) => c.id);
      useContactsStore.getState().remove([cId]);
      return convIds.length;
    },
    simMergeContacts(convId, keptKey) {
      const mergeeId = currentPersonOfMap[convId] ?? contactIdOf(convId);
      const keptConv = baseConversations.find((c) => contactKeyOf(c) === keptKey);
      const keptId = keptConv ? (currentPersonOfMap[keptConv.id] ?? contactIdOf(keptConv.id)) : null;
      if (mergeeId === null || keptId === null) {
        toast.error("Contacts not merged", { description: "Could not resolve Chatwoot contact ids." });
        return;
      }
      applyLinkedContactMerge(keptId, mergeeId);
    },
  });

  setLinkedContactsAdapter({
    add(draft: ContactDraft): DirectoryContact {
      const tempId = Math.max(10_000, ...useContactsStore.getState().list.map((c) => c.id)) + 1;
      const optimistic: DirectoryContact = {
        id: tempId,
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        company: draft.company,
        city: draft.city,
        country: draft.country,
        bio: draft.bio,
        lastActivity: "Just now",
        lastActivityMinutes: 1,
        createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        labels: [],
      };
      useContactsStore.setState((state) => ({
        list: [optimistic, ...state.list],
      }));

      void unifiedCw
        .POST("/contacts", {
          body: {
            name: draft.name,
            ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
            ...(draft.phone.trim() ? { phone_number: draft.phone.trim() } : {}),
            additional_attributes: {
              company_name: draft.company,
              city: draft.city,
              country: draft.country,
              description: draft.bio,
            } as unknown as Record<string, never>,
          } as unknown as { inbox_id: number; name: string },
        })
        .then((res) => {
          if (res.error || !res.data) {
            throw new Error(formatGatewayError(res.error, res.response?.status));
          }
          const rawPayload = obj(res.data).payload ?? res.data;
          const contactRaw = obj(rawPayload).contact ?? rawPayload;
          const created = toDirectoryContact(contactRaw);
          useContactsStore.setState((state) => ({
            list: state.list.map((c) => (c.id === tempId ? created : c)),
          }));
          toast.success("Contact created in Chatwoot", {
            description: `${created.name} (#${created.id}) was saved to the linked Chatwoot server.`,
          });
        })
        .catch((err) => {
          useContactsStore.setState((state) => ({
            list: state.list.filter((c) => c.id !== tempId),
          }));
          toast.error("Contact not created in Chatwoot", {
            description: formatGatewayError(err),
          });
        });

      return optimistic;
    },
    update(id: number, draft: ContactDraft) {
      const prev = useContactsStore.getState().list.find((c) => c.id === id);
      useContactsStore.setState((state) => ({
        list: state.list.map((c) =>
          c.id === id
            ? {
                ...c,
                name: draft.name,
                email: draft.email,
                phone: draft.phone,
                company: draft.company,
                city: draft.city,
                country: draft.country,
                bio: draft.bio,
              }
            : c,
        ),
      }));

      void unifiedCw
        .PUT("/contacts/{id}", {
          params: { path: { id } },
          body: {
            name: draft.name,
            ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
            ...(draft.phone.trim() ? { phone_number: draft.phone.trim() } : {}),
            additional_attributes: {
              company_name: draft.company,
              city: draft.city,
              country: draft.country,
              description: draft.bio,
            } as unknown as Record<string, never>,
          },
        })
        .then((res) => {
          if (res.error || !res.data) {
            throw new Error(formatGatewayError(res.error, res.response?.status));
          }
          const payload = obj(res.data).payload ?? res.data;
          const updated = toDirectoryContact(payload);
          useContactsStore.setState((state) => ({
            list: state.list.map((c) => (c.id === id ? updated : c)),
          }));
          // Also sync conversation contactEdits for any conversation belonging to this contact
          const key = `contact:${id}`;
          useCwStore.setState((state) => ({
            contactEdits: {
              ...state.contactEdits,
              [key]: {
                ...(state.contactEdits[key] ?? {}),
                name: updated.name,
                email: updated.email,
                phone: updated.phone,
                company: updated.company,
                location: [updated.city, updated.country].filter(Boolean).join(", "),
              },
            },
          }));
          toast.success("Contact updated in Chatwoot");
        })
        .catch((err) => {
          if (prev) {
            useContactsStore.setState((state) => ({
              list: state.list.map((c) => (c.id === id ? prev : c)),
            }));
          }
          toast.error("Contact not updated in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    remove(ids: number[]) {
      const prevList = useContactsStore.getState().list;
      const convIds = baseConversations
        .filter((c) => {
          const cid = contactIdOf(c.id);
          return cid !== null && ids.includes(cid);
        })
        .map((c) => c.id);

      useContactsStore.setState((state) => ({
        list: state.list.filter((c) => !ids.includes(c.id)),
      }));
      if (convIds.length > 0) {
        useCwStore.setState((state) => ({
          deleted: [...new Set([...state.deleted, ...convIds])],
        }));
      }

      void Promise.all(
        ids.map(async (id) => {
          const res = await unifiedCw.DELETE("/contacts/{id}", {
            params: { path: { id } },
          });
          if (res.error) {
            throw new Error(formatGatewayError(res.error, res.response?.status));
          }
        }),
      )
        .then(() => {
          toast.success(ids.length === 1 ? "Contact deleted from Chatwoot" : "Contacts deleted from Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState({ list: prevList });
          if (convIds.length > 0) {
            useCwStore.setState((state) => ({
              deleted: state.deleted.filter((id) => !convIds.includes(id)),
            }));
          }
          toast.error("Contact deletion failed in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    merge(primaryId, mergedId) {
      applyLinkedContactMerge(primaryId, mergedId);
    },
    toggleBlock() {
      refuseUnsupportedLinkedAction("Blocking contact", "PUT /contacts/{id} (blocked)");
      return { blocked: false, saved: Promise.resolve(false) };
    },
    setAttr(id: number, key: string, value: string | null) {
      const prevAttrs = useContactsStore.getState().attrs[id] ?? {};
      const nextAttrs = { ...prevAttrs };
      if (value === null) delete nextAttrs[key];
      else nextAttrs[key] = value;

      useContactsStore.setState((state) => ({
        attrs: { ...state.attrs, [id]: nextAttrs },
      }));

      const contact = useContactsStore.getState().list.find((c) => c.id === id);
      void unifiedCw
        .PUT("/contacts/{id}", {
          params: { path: { id } },
          body: {
            name: contact?.name,
            custom_attributes: nextAttrs as unknown as Record<string, never>,
          },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success("Contact attribute saved in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState((state) => ({
            attrs: { ...state.attrs, [id]: prevAttrs },
          }));
          toast.error("Contact attribute not saved in Chatwoot", {
            description: formatGatewayError(err),
          });
        });
    },
    addLabels(ids, labels) {
      const prevList = useContactsStore.getState().list;
      useContactsStore.setState((state) => ({
        list: state.list.map((c) =>
          ids.includes(c.id) ? { ...c, labels: Array.from(new Set([...c.labels, ...labels])) } : c,
        ),
      }));
      void Promise.all(
        ids.map(async (id) => {
          const next = useContactsStore.getState().list.find((c) => c.id === id)?.labels ?? labels;
          const res = await unifiedCw.POST("/contacts/{id}/labels", {
            params: { path: { id } },
            body: { labels: next },
          });
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
        }),
      )
        .then(() => {
          toast.success("Labels saved in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState({ list: prevList });
          toast.error("Labels not saved in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    removeLabels(ids, labels) {
      const prevList = useContactsStore.getState().list;
      useContactsStore.setState((state) => ({
        list: state.list.map((c) =>
          ids.includes(c.id) ? { ...c, labels: c.labels.filter((label) => !labels.includes(label)) } : c,
        ),
      }));
      void Promise.all(
        ids.map(async (id) => {
          const next = useContactsStore.getState().list.find((c) => c.id === id)?.labels ?? [];
          const res = await unifiedCw.POST("/contacts/{id}/labels", {
            params: { path: { id } },
            body: { labels: next },
          });
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
        }),
      )
        .then(() => {
          toast.success("Labels updated in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState({ list: prevList });
          toast.error("Labels not updated in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    addNote(id, body) {
      const tempId = Date.now();
      const optimistic: ContactNote = { id: tempId, author: currentViewer().name, time: "Just now", body };
      useContactsStore.setState((state) => ({
        notes: { ...state.notes, [id]: [optimistic, ...(state.notes[id] ?? [])] },
      }));
      void unifiedCw
        .POST("/contacts/{id}/notes", {
          params: { path: { id } },
          body: { note: { content: body }, content: body },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          const mapped = mapCwNote(obj(res.data).payload ?? res.data);
          if (mapped) {
            const saved: ContactNote = {
              id: mapped.id,
              author: mapped.author,
              time: mapped.time,
              body: mapped.content,
            };
            useContactsStore.setState((state) => ({
              notes: {
                ...state.notes,
                [id]: (state.notes[id] ?? []).map((note) => (note.id === tempId ? saved : note)),
              },
            }));
          }
          toast.success("Note saved in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState((state) => ({
            notes: { ...state.notes, [id]: (state.notes[id] ?? []).filter((note) => note.id !== tempId) },
          }));
          toast.error("Note not saved in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    deleteNote(id, noteId) {
      const prev = useContactsStore.getState().notes[id] ?? [];
      useContactsStore.setState((state) => ({
        notes: { ...state.notes, [id]: (state.notes[id] ?? []).filter((note) => note.id !== noteId) },
      }));
      void unifiedCw
        .DELETE("/contacts/{id}/notes/{note_id}", {
          params: { path: { id, note_id: noteId } },
        })
        .then((res) => {
          if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
          toast.success("Note deleted in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState((state) => ({ notes: { ...state.notes, [id]: prev } }));
          toast.error("Note not deleted in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    addSegment(name, filters) {
      const tempId = Math.max(0, ...useContactsStore.getState().segments.map((s) => s.id)) + 1;
      const segment: Segment = { id: tempId, name, filters };
      useContactsStore.setState((state) => ({ segments: [...state.segments, segment] }));
      void createLinkedCustomFilter(name, customFilterQuery(filters), "contact")
        .then((created) => {
          const saved = segmentFromFilter(created);
          useContactsStore.setState((state) => ({
            segments: state.segments.map((item) => (item.id === tempId ? saved : item)),
          }));
          toast.success("Segment saved in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState((state) => ({
            segments: state.segments.filter((item) => item.id !== tempId),
          }));
          toast.error("Segment not saved in Chatwoot", { description: formatGatewayError(err) });
        });
      return segment;
    },
    updateSegment(id, filters) {
      const prev = useContactsStore.getState().segments;
      const current = prev.find((item) => item.id === id);
      if (!current) return;
      useContactsStore.setState((state) => ({
        segments: state.segments.map((item) => (item.id === id ? { ...item, filters } : item)),
      }));
      void patchCustomFilter(id, current.name, customFilterQuery(filters), "contact")
        .then(() => {
          toast.success("Segment updated in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState({ segments: prev });
          toast.error("Segment not updated in Chatwoot", { description: formatGatewayError(err) });
        });
    },
    deleteSegment(id) {
      const prev = useContactsStore.getState().segments;
      useContactsStore.setState((state) => ({ segments: state.segments.filter((item) => item.id !== id) }));
      void deleteLinkedCustomFilter(id)
        .then(() => {
          toast.success("Segment deleted in Chatwoot");
        })
        .catch((err) => {
          useContactsStore.setState({ segments: prev });
          toast.error("Segment not deleted in Chatwoot", { description: formatGatewayError(err) });
        });
    },
  });

  const syncConversationLabels = (convIdStr: string, nextLabels: string[], prevLabels: string[]) => {
    const convId = Number.parseInt(convIdStr, 10);
    if (!Number.isFinite(convId)) return;

    replaceConversationTags({
      ...getConversationTags(),
      [convIdStr]: nextLabels,
    });
    useLabelSaves.setState({ [convIdStr]: { state: "saving" } });

    void unifiedCw
      .POST("/conversations/{conversation_id}/labels", {
        params: { path: { conversation_id: convId } },
        body: { labels: nextLabels },
      })
      .then((res) => {
        if (res.error) throw new Error(formatGatewayError(res.error, res.response?.status));
        const payload = obj(res.data).payload;
        const confirmed = Array.isArray(payload)
          ? payload.filter((l): l is string => typeof l === "string")
          : nextLabels;
        replaceConversationTags({
          ...getConversationTags(),
          [convIdStr]: confirmed,
        });
        useLabelSaves.setState({
          [convIdStr]: { state: "saved", at: new Date().toISOString() },
        });
      })
      .catch((err) => {
        const msg = formatGatewayError(err);
        replaceConversationTags({
          ...getConversationTags(),
          [convIdStr]: prevLabels,
        });
        useLabelSaves.setState({
          [convIdStr]: { state: "failed", message: msg },
        });
        toast.error("Labels not saved in Chatwoot", {
          description: msg,
        });
      });
  };

  setLinkedTagWriter({
    setLabels(conversationId: string, next: string[]) {
      const current = getConversationTags()[conversationId] ?? [];
      syncConversationLabels(conversationId, next, current);
    },
    addLabel(rawTitle: string) {
      const title = rawTitle.trim().replace(/\s+/g, "-");
      if (!title) return null;
      const shared = useCwShared.getState();
      if (!shared.labels.some((l) => l.id === title || l.title === title)) {
        showLinkedLists({
          ...shared,
          labels: [
            ...shared.labels,
            {
              id: title,
              title,
              description: "",
              color: "#6366f1",
              showOnSidebar: true,
            },
          ],
        });
      }
      return null;
    },
  });

  setLinkedNotificationsAdapter({
    markRead: markLinkedNotificationRead,
    markAllRead: markAllLinkedNotificationsRead,
  });
}

/* ------------------------------------------------------------------ V-15: Help Center & Campaigns Live Data ------ */

async function fetchLinkedPortalsData(): Promise<{
  portals: Portal[];
  articles: Article[];
  categories: Category[];
  locales: Locale[];
}> {
  const empty = {
    portals: [] as Portal[],
    articles: [] as Article[],
    categories: [] as Category[],
    locales: [] as Locale[],
  };

  try {
    // Fetch portals list
    const portalsRes = await unifiedCw.GET("/portals");
    if (portalsRes.error || !portalsRes.data) return empty;

    const linkedPortals = toPortals(portalsRes.data);
    if (linkedPortals.length === 0) return empty;

    // Map LinkedPortal to the shape the UI expects (Portal from data.ts)
    const portals: Portal[] = linkedPortals.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      customDomain: p.customDomain,
      articles: p.articles,
      color: p.color,
      pageTitle: p.pageTitle,
      headerText: p.headerText,
      homePageLink: p.homePageLink,
    }));

    // Use the first portal for fetching articles and categories
    const portalId = linkedPortals[0].id;

    const [articlesRes, categoriesRes] = await Promise.all([
      unifiedCw.GET("/portals/{portal_id}/articles", { params: { path: { portal_id: portalId } } }),
      unifiedCw.GET("/portals/{portal_id}/categories", { params: { path: { portal_id: portalId } } }),
    ]);

    const linkedArticles = articlesRes.data && !articlesRes.error ? toArticles(articlesRes.data) : [];
    const linkedCategories = categoriesRes.data && !categoriesRes.error ? toCategories(categoriesRes.data) : [];

    const articles: Article[] = linkedArticles.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status as Article["status"],
      authorId: a.authorId,
      categoryId: a.categoryId,
      views: a.views,
      updated: a.updated,
      locale: a.locale,
      metaDescription: a.metaDescription,
      metaTags: a.metaTags,
    }));

    const categories: Category[] = linkedCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      description: c.description,
      articles: c.articles,
    }));

    // Build locales from articles
    const localeSet = new Map<string, { code: string; name: string; count: number; catCount: number }>();
    for (const a of linkedArticles) {
      const code = a.locale ?? "en";
      const name = code === "en" ? "English" : code === "ar" ? "Arabic" : code === "ur" ? "Urdu" : code;
      const entry = localeSet.get(code);
      if (entry) {
        entry.count++;
      } else {
        localeSet.set(code, { code, name, count: 1, catCount: 0 });
      }
    }
    // Count categories per locale (Chatwoot categories have locale field)
    for (const c of linkedCategories) {
      // linkedCategory doesn't have locale, but Chatwoot categories do
      // We infer from articles in each category
    }
    const locales: Locale[] = [...localeSet.values()].map((l) => ({
      code: l.code,
      name: l.name,
      articles: l.count,
      categories: l.catCount || categories.length,
      isDefault: l.code === "en",
    }));
    if (locales.length === 0) {
      locales.push({
        code: "en",
        name: "English",
        articles: articles.length,
        categories: categories.length,
        isDefault: true,
      });
    }

    return { portals, articles, categories, locales };
  } catch {
    return empty;
  }
}

async function fetchLinkedCampaignsData(): Promise<{
  live: LiveChatCampaign[];
  sms: OneOffCampaign[];
  whatsapp: OneOffCampaign[];
}> {
  const empty = { live: [] as LiveChatCampaign[], sms: [] as OneOffCampaign[], whatsapp: [] as OneOffCampaign[] };

  try {
    const res = await unifiedCw.GET("/campaigns");
    if (res.error || !res.data) return empty;

    const linkedCampaigns = toCampaigns(res.data);
    if (linkedCampaigns.length === 0) return empty;

    const live: LiveChatCampaign[] = linkedCampaigns.map((c) => ({
      id: c.id,
      title: c.title,
      message: c.message,
      enabled: c.enabled,
      sender: c.sender,
      inbox: c.inbox,
      url: c.url,
      timeOnPage: c.timeOnPage,
      businessHoursOnly: c.businessHoursOnly,
    }));

    // Campaigns from Chatwoot are live chat campaigns; SMS/WhatsApp remain empty until their endpoints are opened
    return { live, sms: [], whatsapp: [] };
  } catch {
    return empty;
  }
}

/** Enable linked mode across all 3 stores and load live data from /api/cw/... */
export async function enableLinkedStoreAdapter(): Promise<void> {
  const runId = ++activeRunId;
  hydratedThreads.clear();

  // Condition 4: Immediately block preview persistence and install adapters
  setLinkedSession(true);
  installLinkedAdapters();

  useLinkedAdapterStatus.setState({
    active: true,
    loading: true,
    error: null,
  });

  // Wait one macrotask so any React Suspense boundary (e.g. ContactsList using useSearchParams) finishes hydration
  // before we flush the in-memory preview stores.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (runId !== activeRunId) return;

  replaceConversations([], {});
  setLinkedThreads({});
  replaceConversationTags({});
  useLabelSaves.setState({});
  useCwStore.setState({
    meta: {},
    unread: {},
    readCounts: {},
    muted: {},
    deleted: [],
    sent: {},
    delivery: {},
    deletedMessages: [],
    folders: [],
    selection: [],
    conversationAttrs: {},
    contactAttrs: {},
    notes: {},
    focusId: null,
    contactEdits: {},
  });
  showLinkedContacts([], {});
  showLinkedNotifications([]);

  try {
    const [
      agentsRes,
      inboxesRes,
      teamsRes,
      labelsRes,
      cannedRes,
      macrosRes,
      rawConvs,
      contactsData,
      portalsData,
      campaignsData,
    ] = await Promise.all([
      unifiedCw.GET("/agents"),
      unifiedCw.GET("/inboxes"),
      unifiedCw.GET("/teams"),
      unifiedCw.GET("/labels"),
      unifiedCw.GET("/canned_responses"),
      unifiedCw.GET("/macros"),
      fetchAllConversations(),
      fetchAllContacts(),
      fetchLinkedPortalsData(),
      fetchLinkedCampaignsData(),
    ]);

    if (runId !== activeRunId || !useLinkedAdapterStatus.getState().active) return;

    const firstError =
      agentsRes.error ?? inboxesRes.error ?? teamsRes.error ?? labelsRes.error ?? cannedRes.error ?? macrosRes.error;
    if (firstError) {
      throw new Error(formatGatewayError(firstError));
    }

    const { agents, realAgentIds } = toSharedAgents(agentsRes.data);
    agentNamesMap = new Map(agents.map((a) => [a.id, a.name]));
    setLinkedAgentIds(realAgentIds);

    const inboxes = toSharedInboxes(inboxesRes.data, realAgentIds);
    const teams = toSharedTeams(teamsRes.data, realAgentIds);
    const cannedResponses = toSharedCanned(cannedRes.data);
    const macros = mapRawMacros(macrosRes.data, agents, teams);

    registerLabelIds(labelsRes.data);
    const mappedConvs = toStudioConversations(rawConvs, inboxes, teams, agentNamesMap);
    const extraLabels = Object.values(mappedConvs.tagsByConvId).flat();
    const labels = toSharedLabels(labelsRes.data, extraLabels);

    showLinkedLists({
      agents,
      inboxes,
      teams,
      labels,
      cannedResponses,
      macros,
    });

    currentPersonOfMap = { ...mappedConvs.personOfMap };
    // V-17 r2: fill the inbox map so frozenConversationReason can enforce the guard.
    rememberInboxMap(mappedConvs.inboxIdByConvId);
    replaceConversations(mappedConvs.conversations, currentPersonOfMap);
    setLinkedThreads(mappedConvs.threadsByConvId);
    replaceConversationTags(mappedConvs.tagsByConvId);
    showLinkedContacts(contactsData.contacts, contactsData.attrs);

    // V-15: Bind help center and campaigns live data — always update from live data (even empty, shows honest 0 count)
    replaceHelpCenterData(portalsData.portals, portalsData.articles, portalsData.categories, portalsData.locales);
    useCampaignsStore.setState({
      live: campaignsData.live,
      sms: campaignsData.sms,
      whatsapp: campaignsData.whatsapp,
      instagram: [],
      messenger: [],
    });
    useCampaignsSave.setState({ phase: "ready", savedAt: new Date().toISOString(), error: null });

    useCwStore.setState({
      meta: mappedConvs.metaByConvId,
      unread: mappedConvs.unreadByConvId,
      readCounts: {},
      muted: {},
      deleted: [],
      sent: {},
      delivery: {},
      deletedMessages: [],
      folders: [],
      selection: [],
      conversationAttrs: mappedConvs.conversationAttrsByConvId,
      contactAttrs: mappedConvs.contactAttrsByConvId,
      notes: {},
      focusId: mappedConvs.conversations[0]?.id ?? null,
      contactEdits: {},
    });

    useLinkedAdapterStatus.setState({
      active: true,
      loading: false,
      error: null,
      lastSyncedAt: new Date().toISOString(),
      conversationsCount: mappedConvs.conversations.length,
      contactsCount: contactsData.contacts.length,
    });

    try {
      const rawNotes = await fetchAllNotifications();
      if (runId !== activeRunId || !useLinkedAdapterStatus.getState().active) return;
      showLinkedNotifications(
        mapCwNotifications(rawNotes, mappedConvs.conversations, mappedConvs.metaByConvId, agentNamesMap),
      );
    } catch (noteErr) {
      if (runId !== activeRunId) return;
      showLinkedNotifications([]);
      toast.error("Live notifications could not be loaded", {
        description: formatGatewayError(noteErr),
      });
    }

    // Hydrate full message history for each loaded conversation in the background
    for (const conv of mappedConvs.conversations) {
      void hydrateConversationThread(conv.id, runId);
    }

    // Condition 3 & 5: Open the SSE stream (/api/cw/events) only in linked mode
    openRealtimeEventStream(runId);
  } catch (err) {
    if (runId !== activeRunId) return;
    const message = formatGatewayError(err);
    useLinkedAdapterStatus.setState({
      active: true,
      loading: false,
      error: message,
    });
    toast.error("Linked Chatwoot server error", {
      description: message,
    });
  }
}

/* ------------------------------------------------------------------ U-4: Realtime SSE Stream & Event Merger ----- */

function applyRealtimeConversationEvent(eventName: string, rawConv: Raw): void {
  if (!linkedSession() || !useLinkedAdapterStatus.getState().active) return;
  const convId = num(rawConv.id) ?? num(rawConv.display_id);
  if (convId === null) return;

  const shared = useCwShared.getState();
  const mapped = toStudioConversations([rawConv], shared.inboxes, shared.teams, agentNamesMap);
  const mappedConv = mapped.conversations[0];
  const mappedMeta = mapped.metaByConvId[convId];
  if (!mappedConv || !mappedMeta) return;

  // Condition 4: Filter by View as permissions (canSeeConversation)
  const existingMeta = useCwStore.getState().meta[convId];
  const permMeta = {
    assigneeId: mappedMeta.assigneeId,
    participants: existingMeta?.participants ?? mappedMeta.participants,
  };
  if (!canSeeConversation(currentViewer(), { channel: mappedConv.channel }, permMeta, shared.inboxes)) {
    return;
  }

  currentPersonOfMap = {
    ...currentPersonOfMap,
    [convId]: mapped.personOfMap[convId] ?? convId,
  };
  // V-17 r2: keep inbox map up to date on realtime events too.
  if (mapped.inboxIdByConvId[convId] != null) {
    rememberInboxMap({ [convId]: mapped.inboxIdByConvId[convId] });
  }

  const existingIdx = baseConversations.findIndex((c) => c.id === convId);
  if (existingIdx >= 0) {
    const cur = baseConversations[existingIdx];
    const nextConv = {
      ...cur,
      ...mappedConv,
      // Keep hydrated message list if already loaded; only update preview/time if mappedConv has a message
      preview: mappedConv.preview !== "No Messages" ? mappedConv.preview : cur.preview,
      time: "now",
      messages: cur.messages.length >= mappedConv.messages.length ? cur.messages : mappedConv.messages,
    };
    const nextList = [...baseConversations];
    nextList[existingIdx] = nextConv;
    replaceConversations(nextList, currentPersonOfMap);

    if (!hydratedThreads.has(convId)) {
      const snippet = mapped.threadsByConvId[convId] ?? [];
      if (snippet.length > 0) setLinkedThread(convId, snippet);
    }
  } else {
    setLinkedThread(convId, mapped.threadsByConvId[convId] ?? []);
    replaceConversations([mappedConv, ...baseConversations], currentPersonOfMap);
    void hydrateConversationThread(convId, activeRunId);
  }

  const nextLabels = mapped.tagsByConvId[String(convId)];
  if (nextLabels) {
    replaceConversationTags({
      ...getConversationTags(),
      [String(convId)]: nextLabels,
    });
  }

  useCwStore.setState((state) => {
    const prev = state.meta[convId];
    const mergedParticipants = mappedMeta.assigneeId
      ? Array.from(new Set([...(prev?.participants ?? []), mappedMeta.assigneeId]))
      : (prev?.participants ?? []);
    const nextMeta = {
      ...state.meta,
      [convId]: {
        ...(prev ?? mappedMeta),
        status: mappedMeta.status,
        priority: mappedMeta.priority,
        assigneeId: mappedMeta.assigneeId,
        teamId: mappedMeta.teamId,
        snoozedUntil: mappedMeta.snoozedUntil,
        unattended: mappedMeta.unattended,
        participants: mergedParticipants,
      },
    };
    return {
      meta: nextMeta,
      unread: { ...state.unread, [convId]: mapped.unreadByConvId[convId] ?? state.unread[convId] ?? 0 },
      conversationAttrs: {
        ...state.conversationAttrs,
        [convId]: mapped.conversationAttrsByConvId[convId] ?? state.conversationAttrs[convId] ?? {},
      },
      contactAttrs: {
        ...state.contactAttrs,
        [convId]: mapped.contactAttrsByConvId[convId] ?? state.contactAttrs[convId] ?? {},
      },
      focusId: state.focusId ?? baseConversations[0]?.id ?? convId,
    };
  });

  useLinkedAdapterStatus.setState({
    lastSyncedAt: new Date().toISOString(),
    conversationsCount: baseConversations.length,
  });

  handleRealtimeSettingsEvent(eventName, rawConv);

  if (eventName === "conversation_status_changed" && hydratedThreads.has(convId)) {
    const runId = activeRunId;
    setTimeout(() => {
      void hydrateConversationThread(convId, runId);
    }, 250);
  }
}

function applyRealtimeMessageEvent(eventName: string, rawMsg: Raw): void {
  if (!linkedSession() || !useLinkedAdapterStatus.getState().active) return;

  const convRaw = obj(rawMsg.conversation);
  const convId = num(convRaw.id) ?? num(convRaw.display_id) ?? num(rawMsg.conversation_id);
  if (convId === null) return;

  // If the webhook carries full conversation data, sync conversation status/meta first
  if (Object.keys(convRaw).length > 0 && (num(convRaw.id) !== null || num(convRaw.display_id) !== null)) {
    applyRealtimeConversationEvent("conversation_updated", {
      ...convRaw,
      id: convId,
    });
  }

  const shared = useCwShared.getState();
  const existingConv = baseConversations.find((c) => c.id === convId);
  const inboxId = num(convRaw.inbox_id) ?? num(obj(rawMsg.inbox).id) ?? 1;
  const matchedInbox = shared.inboxes.find((i) => i.id === inboxId);
  const channelSlug = existingConv?.channel ?? matchedInbox?.slug ?? "chat";
  const convMeta = useCwStore.getState().meta[convId];

  // Condition 4: Filter by View as permissions (canSeeConversation)
  if (!canSeeConversation(currentViewer(), { channel: channelSlug }, convMeta, shared.inboxes)) {
    return;
  }

  const mappedMsg = toCwMessage(rawMsg, agentNamesMap);
  upsertLinkedMessage(convId, mappedMsg);

  useLinkedAdapterStatus.setState({
    lastSyncedAt: new Date().toISOString(),
  });

  handleRealtimeSettingsEvent(eventName, rawMsg);
}

function applyRealtimeContactEvent(_eventName: string, rawContact: Raw): void {
  if (!linkedSession() || !useLinkedAdapterStatus.getState().active) return;
  const contactId = num(rawContact.id);
  if (contactId === null) return;

  const mapped = toDirectoryContact(rawContact);
  const customRaw = obj(rawContact.custom_attributes);
  const customMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(customRaw)) {
    if (v !== null && v !== undefined) customMap[k] = String(v);
  }

  useContactsStore.setState((state) => {
    const existingIdx = state.list.findIndex((c) => c.id === contactId);
    let nextList: DirectoryContact[];
    if (existingIdx >= 0) {
      nextList = [...state.list];
      nextList[existingIdx] = mapped;
    } else {
      // Condition 4: Replace optimistic contact (id >= 10_000) if name/email/phone matches
      const optIdx = state.list.findIndex(
        (c) =>
          c.id >= 10_000 &&
          ((mapped.email && c.email.toLowerCase() === mapped.email.toLowerCase()) ||
            (mapped.phone && c.phone === mapped.phone) ||
            c.name.trim().toLowerCase() === mapped.name.trim().toLowerCase()),
      );
      if (optIdx >= 0) {
        nextList = [...state.list];
        nextList[optIdx] = mapped;
      } else {
        nextList = [mapped, ...state.list];
      }
    }
    return {
      list: nextList,
      attrs: Object.keys(customMap).length > 0 ? { ...state.attrs, [contactId]: customMap } : state.attrs,
    };
  });

  const key = `contact:${contactId}`;
  useCwStore.setState((state) => ({
    contactEdits: {
      ...state.contactEdits,
      [key]: {
        ...(state.contactEdits[key] ?? {}),
        name: mapped.name,
        email: mapped.email,
        phone: mapped.phone,
        company: mapped.company,
        location: [mapped.city, mapped.country].filter(Boolean).join(", "),
      },
    },
  }));

  useLinkedAdapterStatus.setState({
    lastSyncedAt: new Date().toISOString(),
    contactsCount: useContactsStore.getState().list.length,
  });
}

function handleRealtimeEventEnvelope(rawEnvelope: unknown): void {
  if (!linkedSession() || !useLinkedAdapterStatus.getState().active) return;
  const env = obj(rawEnvelope);

  const eventType = str(env.type) ?? str(env.event) ?? "";
  if (eventType === "reconcile_required") {
    const latestFromNotice = num(env.latestSeq);
    if (latestFromNotice !== null && latestFromNotice > 0) {
      setLastSeq(latestFromNotice);
    }
    void refreshFromServer("reconcile_required");
    return;
  }

  const seq = num(env.seq);
  if (seq !== null) {
    if (processedClientEventSeqs.has(seq)) return;
    const prevSeq = getLastSeq();
    if (prevSeq > 0 && seq > prevSeq + 1) {
      // V-2 Requirement 3.2: Sequence gap detected -> trigger automatic reconciliation
      void refreshFromServer("seq_gap");
    }
    processedClientEventSeqs.add(seq);
    if (processedClientEventSeqs.size > 1000) {
      const oldest = processedClientEventSeqs.values().next().value;
      if (oldest !== undefined) processedClientEventSeqs.delete(oldest);
    }
    if (seq > prevSeq) {
      setLastSeq(seq);
    }
  }

  const payload = obj(env.payload);
  const eventName = str(env.event) ?? str(payload.event) ?? "";
  if (!eventName) return;

  if (eventName === "message_created" || eventName === "message_updated") {
    applyRealtimeMessageEvent(eventName, payload);
  } else if (
    eventName === "conversation_created" ||
    eventName === "conversation_updated" ||
    eventName === "conversation_status_changed"
  ) {
    applyRealtimeConversationEvent(eventName, payload);
  } else if (eventName === "contact_created" || eventName === "contact_updated") {
    applyRealtimeContactEvent(eventName, payload);
  } else if (
    eventName === "conversation_typing_on" ||
    eventName === "conversation_typing_off" ||
    eventName === "conversation.typing_on" ||
    eventName === "conversation.typing_off"
  ) {
    applyRealtimePresenceEvent(eventName, payload, num(env.conversationId));
  } else {
    handleRealtimeSettingsEvent(eventName, payload);
  }
}

/**
 * Condition 3: Lightweight catch-up sync executed when the SSE stream connects or reconnects
 * after a temporary disconnect so no message or status change is missed.
 */
async function catchUpMissedState(runId: number): Promise<void> {
  if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) return;
  try {
    const res = await unifiedCw.GET("/conversations", {
      params: {
        query: {
          status: "all",
          assignee_type: "all",
          page: 1,
        },
      },
    });
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) return;
    if (!res.error && res.data) {
      const dataObj = obj(res.data);
      const innerData = obj(dataObj.data);
      const payload = Array.isArray(innerData.payload)
        ? innerData.payload
        : Array.isArray(dataObj.payload)
          ? dataObj.payload
          : [];
      for (const item of payload) {
        applyRealtimeConversationEvent("conversation_updated", obj(item));
      }
    }

    const focusId = useCwStore.getState().focusId ?? baseConversations[0]?.id ?? null;
    if (focusId !== null) {
      await hydrateConversationThread(focusId, runId);
    }
  } catch {
    // Ignore transient catch-up errors
  }
}

export type ReconcileTriggerReason =
  | "reconcile_required"
  | "seq_gap"
  | "focus"
  | "visibilitychange"
  | "online"
  | "reconnect"
  | "manual";

/**
 * V-2 Requirement 3.2 & Supervisor Constraint 1:
 * Automatic reconciliation (`refreshFromServer`) upon `reconcile_required`, sequence gap, window focus/visibility
 * return, or network recovery. Enforces a mandatory >= 5000ms cooldown (`RECONCILE_COOLDOWN_MS = 5000`) on
 * focus/visibilitychange triggers to prevent flooding live Chatwoot on port 3200.
 */
export async function refreshFromServer(reason: ReconcileTriggerReason = "manual"): Promise<boolean> {
  if (!linkedSession() || !useLinkedAdapterStatus.getState().active) return false;
  const now = Date.now();
  const isFocusTrigger = reason === "focus" || reason === "visibilitychange";

  if (isFocusTrigger && now - lastFocusReconcileAt < RECONCILE_COOLDOWN_MS) {
    return false;
  }
  if (now - lastReconcileAt < RECONCILE_COOLDOWN_MS && reason !== "reconcile_required" && reason !== "seq_gap") {
    return false;
  }
  if (reconcileInFlight) {
    return reconcileInFlight;
  }

  lastReconcileAt = now;
  lastFocusReconcileAt = now;

  const runId = activeRunId;
  reconcileInFlight = (async () => {
    try {
      await catchUpMissedState(runId);
      if (linkedSession() && useLinkedAdapterStatus.getState().active && runId === activeRunId) {
        const syncedAt = new Date().toISOString();
        useLinkedAdapterStatus.setState({
          lastSyncedAt: syncedAt,
          lastReconciledAt: syncedAt,
        });
      }
      return true;
    } catch {
      return false;
    } finally {
      reconcileInFlight = null;
    }
  })();

  return reconcileInFlight;
}

function removeReconcileLifecycleListeners(): void {
  if (cleanupLifecycleListeners) {
    try {
      cleanupLifecycleListeners();
    } catch {
      // Ignore listener removal errors
    }
    cleanupLifecycleListeners = null;
  }
}

function installReconcileLifecycleListeners(runId: number): void {
  removeReconcileLifecycleListeners();
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const onFocus = () => {
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) return;
    if (!useLinkedAdapterStatus.getState().realtimeConnected) {
      openRealtimeEventStream(runId);
    }
    void refreshFromServer("focus");
  };

  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) return;
    if (!useLinkedAdapterStatus.getState().realtimeConnected) {
      openRealtimeEventStream(runId);
    }
    void refreshFromServer("visibilitychange");
  };

  const onOnline = () => {
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) return;
    openRealtimeEventStream(runId);
    void refreshFromServer("online");
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", onOnline);

  cleanupLifecycleListeners = () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", onOnline);
  };
}

function closeRealtimeEventStream(): void {
  if (activeEventSource) {
    try {
      activeEventSource.close();
    } catch {
      // Ignore close error
    }
    activeEventSource = null;
  }
  useLinkedAdapterStatus.setState({ realtimeConnected: false });
}

function openRealtimeEventStream(runId: number): void {
  // Condition 5: Never open /api/cw/events in preview mode
  if (
    typeof window === "undefined" ||
    typeof EventSource === "undefined" ||
    !linkedSession() ||
    !useLinkedAdapterStatus.getState().active ||
    runId !== activeRunId
  ) {
    return;
  }

  closeRealtimeEventStream();
  installReconcileLifecycleListeners(runId);

  const sinceSeq = getLastSeq();
  const url = sinceSeq > 0 ? `/api/cw/events?since=${sinceSeq}` : "/api/cw/events";
  const es = new EventSource(url);
  activeEventSource = es;
  let reconnecting = false;

  es.addEventListener("ready", (event) => {
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) {
      closeRealtimeEventStream();
      return;
    }
    let readyReconcileRequired = false;
    try {
      const data = JSON.parse((event as MessageEvent).data ?? "{}") as {
        latestSeq?: unknown;
        reconcileRequired?: unknown;
      };
      if (getLastSeq() === 0 && typeof data.latestSeq === "number" && data.latestSeq > 0) {
        setLastSeq(data.latestSeq);
      }
      if (data.reconcileRequired === true) {
        readyReconcileRequired = true;
      }
    } catch {
      // Ignore malformed ready frame
    }
    const currentSeq = getLastSeq();
    useLinkedAdapterStatus.setState({
      realtimeConnected: true,
      lastEventSeq: currentSeq,
      lastSeq: currentSeq,
    });
    if (readyReconcileRequired) {
      void refreshFromServer("reconcile_required");
    } else if (reconnecting) {
      reconnecting = false;
      void refreshFromServer("reconnect");
    }
  });

  es.addEventListener("reconcile_required", (event) => {
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) {
      closeRealtimeEventStream();
      return;
    }
    try {
      const parsed = JSON.parse((event as MessageEvent).data ?? "{}");
      handleRealtimeEventEnvelope({ ...obj(parsed), type: "reconcile_required" });
    } catch {
      void refreshFromServer("reconcile_required");
    }
  });

  es.onmessage = (event) => {
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) {
      closeRealtimeEventStream();
      return;
    }
    try {
      const parsed = JSON.parse(event.data);
      handleRealtimeEventEnvelope(parsed);
    } catch {
      // Ignore malformed SSE frame
    }
  };

  es.onerror = () => {
    if (!linkedSession() || !useLinkedAdapterStatus.getState().active || runId !== activeRunId) {
      closeRealtimeEventStream();
      return;
    }
    reconnecting = true;
    useLinkedAdapterStatus.setState({ realtimeConnected: false });
  };
}

/** Disable linked mode and cleanly restore preview stores (Condition 4 & Condition 5). */
export function disableLinkedStoreAdapter(): void {
  // Condition 5: Close EventSource and lifecycle listeners immediately upon switching from linked to preview mode
  removeReconcileLifecycleListeners();
  closeRealtimeEventStream();
  clearLivePresenceStore();

  const wasActive = useLinkedAdapterStatus.getState().active;
  activeRunId++;
  hydratedThreads.clear();
  currentPersonOfMap = {};

  setLinkedCwAdapter(null);
  setLinkedThreadAdapter(null);
  setLinkedSimActionsAdapter(null);
  setLinkedContactsAdapter(null);
  setLinkedNotificationsAdapter(null);
  setLinkedTagWriter(null);
  setLinkedAgentIds(null);
  setLinkedThreads(null);

  if (wasActive) {
    // Restore preview stores while linkedSession() is still true so persistence subscribers ignore the restoration
    showLinkedLists(null);
    restorePreviewConversations();
    restorePreviewCwState();
    restorePreviewContacts();
    restorePreviewHelpCenter();
    showLinkedNotifications(null);
    replaceConversationTags({});
    useLabelSaves.setState({});
  }

  setLinkedSession(false);

  useLinkedAdapterStatus.setState({
    active: false,
    loading: false,
    error: null,
    lastSyncedAt: null,
    lastReconciledAt: null,
    conversationsCount: 0,
    contactsCount: 0,
    realtimeConnected: false,
  });
}
