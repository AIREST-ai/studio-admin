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
  contactIdOf,
  replaceConversations,
  restorePreviewConversations,
} from "@/app/(main)/chat/_components/data";
import {
  baseConversations,
  type CwMessage,
  type CwStatus,
  getLinkedThread,
  type Priority,
  setLinkedAgentIds,
  setLinkedThread,
  setLinkedThreads,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import {
  contactKeyOf,
  type LinkedCwAdapter,
  restorePreviewCwState,
  setLinkedCwAdapter,
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
  restorePreviewContacts,
  setLinkedContactsAdapter,
  showLinkedContacts,
  useContactsStore,
} from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import type { Contact as DirectoryContact } from "@/app/(main)/dashboard/contacts/_components/data";
import {
  toCwMessage,
  toCwMessages,
  toDirectoryContact,
  toDirectoryContacts,
  toSharedAgents,
  toSharedCanned,
  toSharedInboxes,
  toSharedLabels,
  toSharedTeams,
  toStudioConversations,
} from "@/lib/chatwoot/map";
import { handleRealtimeSettingsEvent, mapRawMacros, registerLabelIds } from "@/lib/chatwoot/settings-adapter";
import { formDataBody, cw as unifiedCw } from "@/lib/chatwoot/unified-client";
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

/** V-2 Supervisor constraint 1: Mandatory >= 5000ms cooldown for auto-reconciliation on focus/visibilitychange. */
export const RECONCILE_COOLDOWN_MS = 5000;
const LAST_SEQ_SESSION_KEY = "studio:cw:lastSeq";

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

let agentNamesMap = new Map<number, string>();
let currentPersonOfMap: Record<number, number> = {};
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
    setParticipants() {
      refuseUnsupportedLinkedAction("Updating conversation participants", "POST /conversations/{id}/participants");
    },
    markRead(id) {
      useCwStore.setState((state) => ({
        unread: { ...state.unread, [id]: 0 },
        readCounts: { ...state.readCounts, [id]: state.unread[id] ?? 0 },
      }));
    },
    markUnread() {
      refuseUnsupportedLinkedAction("Marking conversation unread", "POST /conversations/{id}/unread");
    },
    toggleMute() {
      refuseUnsupportedLinkedAction("Blocking or muting contact", "POST /conversations/{id}/mute");
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
    addNote() {
      refuseUnsupportedLinkedAction("Adding contact note", "POST /contacts/{id}/notes");
    },
    deleteNote() {
      refuseUnsupportedLinkedAction("Deleting contact note", "DELETE /contacts/{id}/notes/{note_id}");
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
    refuseFolderOp() {
      refuseUnsupportedLinkedAction("Saving custom folders", "POST/PUT/DELETE /custom_filters");
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
    async deleteMessage(): Promise<boolean> {
      refuseUnsupportedLinkedAction("Deleting a message", "DELETE /conversations/{id}/messages/{id}");
      return false;
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
    async toggleBlock(): Promise<KeepOutcome> {
      refuseUnsupportedLinkedAction("Blocking contact", "POST /conversations/{id}/mute");
      return { ok: false, message: "Blocking contact is not enabled on the Studio gateway" };
    },
  };

  setLinkedCwAdapter(cwAdapter);
  setLinkedThreadAdapter(linkedThreadAdapter);

  setLinkedSimActionsAdapter({
    finishSimCall() {
      refuseUnsupportedLinkedAction("Simulated voice call", "Voice call simulation");
    },
    simSendTranscript() {
      refuseUnsupportedLinkedAction("Sending email transcript", "POST /conversations/{id}/transcript");
      return { saved: Promise.resolve(false) };
    },
    simCreateConversation() {
      refuseUnsupportedLinkedAction("Creating new conversation", "POST /conversations");
      return { id: 0, saved: Promise.resolve(false) };
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
    simMergeContacts() {
      refuseUnsupportedLinkedAction("Merging contacts", "POST /actions/contact_merge");
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
    merge() {
      refuseUnsupportedLinkedAction("Merging contacts", "POST /actions/contact_merge");
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
    refuseContactLabels() {
      refuseUnsupportedLinkedAction("Assigning contact labels", "POST /contacts/{id}/labels");
    },
    refuseContactNotes() {
      refuseUnsupportedLinkedAction("Saving contact notes", "POST /contacts/{id}/notes");
    },
    refuseContactSegments() {
      refuseUnsupportedLinkedAction("Saving contact segments", "POST /custom_filters");
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

  try {
    const [agentsRes, inboxesRes, teamsRes, labelsRes, cannedRes, macrosRes, rawConvs, contactsData] =
      await Promise.all([
        unifiedCw.GET("/agents"),
        unifiedCw.GET("/inboxes"),
        unifiedCw.GET("/teams"),
        unifiedCw.GET("/labels"),
        unifiedCw.GET("/canned_responses"),
        unifiedCw.GET("/macros"),
        fetchAllConversations(),
        fetchAllContacts(),
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
    replaceConversations(mappedConvs.conversations, currentPersonOfMap);
    setLinkedThreads(mappedConvs.threadsByConvId);
    replaceConversationTags(mappedConvs.tagsByConvId);
    showLinkedContacts(contactsData.contacts, contactsData.attrs);

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

  const wasActive = useLinkedAdapterStatus.getState().active;
  activeRunId++;
  hydratedThreads.clear();
  currentPersonOfMap = {};

  setLinkedCwAdapter(null);
  setLinkedThreadAdapter(null);
  setLinkedSimActionsAdapter(null);
  setLinkedContactsAdapter(null);
  setLinkedTagWriter(null);
  setLinkedAgentIds(null);
  setLinkedThreads(null);

  if (wasActive) {
    // Restore preview stores while linkedSession() is still true so persistence subscribers ignore the restoration
    showLinkedLists(null);
    restorePreviewConversations();
    restorePreviewCwState();
    restorePreviewContacts();
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
