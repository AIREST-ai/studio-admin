"use client";

// Local state for the Chatwoot conversations area (no backend). Lives in module state, so it survives
// moving between the conversation views in the sidebar and resets on reload.
import { create } from "zustand";

import type { DeliveryState } from "@/app/(main)/chat/_components/chat-thread-state";
import type { Contact } from "@/app/(main)/chat/_components/data";

import {
  type AssigneeTab,
  baseConversations,
  type Conversation,
  type ConversationMeta,
  type CwAttachment,
  type CwMessage,
  type CwStatus,
  type FilterRow,
  type Folder,
  initialContactAttributes,
  initialContactNotes,
  initialConversationAttributes,
  initialFolders,
  initialMeta,
  type Priority,
  type SortKey,
  type StatusFilter,
} from "./cw-data";

export type ContactNote = { id: number; author: string; time: string; text: string };

interface CwState {
  meta: Record<number, ConversationMeta>;
  unread: Record<number, number>;
  // Unread count a conversation had when it was last marked read, so the open thread can still show Chatwoot's
  // "{n} Unread Messages" divider after clicking its card (conversation-pane.tsx).
  readCounts: Record<number, number>;
  muted: Record<number, boolean>;
  deleted: number[];
  sent: Record<number, CwMessage[]>;
  delivery: Record<string, DeliveryState>;
  deletedMessages: string[];
  folders: Folder[];
  selection: number[];
  assigneeTab: AssigneeTab;
  statusFilter: StatusFilter;
  sortBy: SortKey;
  applied: FilterRow[] | null;
  search: string;
  conversationAttrs: Record<number, Record<string, string>>;
  contactAttrs: Record<number, Record<string, string>>;
  notes: Record<number, ContactNote[]>;
  // A conversation opened from outside the list (Previous Conversations, older/newer chat links, ?conversation=).
  focusId: number | null;
  // F159 panel: Edit contact / inline edits in the contact panel, keyed by the contact's original email so every
  // conversation of the same person shows the new details (read them with useContactOf).
  contactEdits: Record<string, Partial<Contact>>;
}

const conversationAttrs = Object.fromEntries(baseConversations.map((c) => [c.id, initialConversationAttributes(c)]));
const contactAttrs = Object.fromEntries(baseConversations.map((c) => [c.id, initialContactAttributes(c)]));
const unread = Object.fromEntries(baseConversations.map((c) => [c.id, c.isUnread ? c.unreadCount : 0]));

export const useCwStore = create<CwState>(() => ({
  meta: initialMeta,
  unread,
  readCounts: {},
  muted: {},
  deleted: [],
  sent: {},
  delivery: {},
  deletedMessages: [],
  folders: initialFolders,
  selection: [],
  // F159: every view opens on the All tab, so no view opens empty and none differs from the others (Mine opened
  // where it had rows and All elsewhere: Unattended, Sales, Website Chat, Instagram, Facebook). Chatwoot itself
  // starts on Mine. A tab the agent picks stays while moving between views, as in Chatwoot.
  assigneeTab: "all",
  statusFilter: "open",
  sortBy: "last_activity_at_desc",
  applied: null,
  search: "",
  conversationAttrs,
  contactAttrs,
  notes: {},
  focusId: null,
  contactEdits: {},
}));

// F159 panel: the contact of a conversation with the agent's edits applied (Edit contact dialog, inline edits).
export function useContactOf(conversation: Conversation): Contact {
  const edits = useCwStore((s) => s.contactEdits[conversation.contact.email]);
  return edits ? { ...conversation.contact, ...edits } : conversation.contact;
}

const set = useCwStore.setState;
const get = useCwStore.getState;

function patchMeta(ids: number[], patch: Partial<ConversationMeta>) {
  set((state) => {
    const meta = { ...state.meta };
    for (const id of ids) if (meta[id]) meta[id] = { ...meta[id], ...patch };
    return { meta };
  });
}

export const cw = {
  focus(id: number | null) {
    set({ focusId: id });
  },
  setStatus(ids: number[], status: CwStatus, snoozedUntil: string | null = null) {
    patchMeta(ids, {
      status,
      snoozedUntil: status === "snoozed" ? (snoozedUntil ?? "Snoozed until next reply") : null,
    });
  },
  setPriority(ids: number[], priority: Priority) {
    patchMeta(ids, { priority });
  },
  assignAgent(ids: number[], assigneeId: number | null) {
    set((state) => {
      const meta = { ...state.meta };
      for (const id of ids) {
        const current = meta[id];
        if (!current) continue;
        const participants =
          assigneeId && !current.participants.includes(assigneeId)
            ? [...current.participants, assigneeId]
            : current.participants;
        meta[id] = { ...current, assigneeId, participants, unattended: assigneeId ? false : current.unattended };
      }
      return { meta };
    });
  },
  assignTeam(ids: number[], teamId: string | null) {
    patchMeta(ids, { teamId });
  },
  setParticipants(id: number, participants: number[]) {
    patchMeta([id], { participants });
  },
  markRead(id: number) {
    set((state) => ({
      unread: { ...state.unread, [id]: 0 },
      readCounts: { ...state.readCounts, [id]: state.unread[id] ?? 0 },
    }));
  },
  clearReadCount(id: number) {
    if (!(id in get().readCounts)) return;
    set((state) => {
      const readCounts = { ...state.readCounts };
      delete readCounts[id];
      return { readCounts };
    });
  },
  markUnread(id: number) {
    set((state) => ({ unread: { ...state.unread, [id]: Math.max(state.unread[id] ?? 0, 1) } }));
  },
  toggleMute(id: number) {
    set((state) => ({ muted: { ...state.muted, [id]: !state.muted[id] } }));
  },
  deleteConversation(ids: number[]) {
    set((state) => ({
      deleted: [...state.deleted, ...ids],
      selection: state.selection.filter((id) => !ids.includes(id)),
    }));
  },
  // Messages sent from the reply box. Delivery goes sent -> delivered -> read like the Studio chat thread.
  send(
    id: number,
    message: { kind: "outgoing" | "note"; text: string; attachments?: CwAttachment[]; replyTo?: string },
  ) {
    const key = `s-${id}-${Date.now().toString(36)}`;
    const entry: CwMessage = { id: key, time: "Just now", sender: "Arham Khan", ...message };
    set((state) => ({
      sent: { ...state.sent, [id]: [...(state.sent[id] ?? []), entry] },
      delivery: message.kind === "outgoing" ? { ...state.delivery, [key]: "sent" } : state.delivery,
    }));
    if (message.kind === "outgoing" && typeof window !== "undefined") {
      window.setTimeout(() => set((state) => ({ delivery: { ...state.delivery, [key]: "delivered" } })), 2000);
      window.setTimeout(() => set((state) => ({ delivery: { ...state.delivery, [key]: "read" } })), 6000);
    }
  },
  // Chatwoot MessageError "Retry": a failed message goes out again, then sent -> delivered like a new reply.
  retryMessage(messageId: string) {
    set((state) => ({ delivery: { ...state.delivery, [messageId]: "sent" } }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => set((state) => ({ delivery: { ...state.delivery, [messageId]: "delivered" } })), 2000);
    }
  },
  deleteMessage(messageId: string) {
    set((state) => ({ deletedMessages: [...state.deletedMessages, messageId] }));
  },
  toggleSelect(id: number) {
    set((state) => ({
      selection: state.selection.includes(id) ? state.selection.filter((x) => x !== id) : [...state.selection, id],
    }));
  },
  setSelection(ids: number[]) {
    set({ selection: ids });
  },
  setAssigneeTab(assigneeTab: AssigneeTab) {
    set({ assigneeTab, selection: [] });
  },
  setStatusFilter(statusFilter: StatusFilter) {
    set({ statusFilter, selection: [] });
  },
  setSort(sortBy: SortKey) {
    set({ sortBy });
  },
  applyFilters(rows: FilterRow[] | null) {
    set({ applied: rows && rows.length > 0 ? rows : null, selection: [] });
  },
  setSearch(search: string) {
    set({ search });
  },
  addFolder(name: string, filters: FilterRow[]): Folder {
    const folder: Folder = { id: `f-${Date.now().toString(36)}`, name: name.trim() || "Untitled folder", filters };
    set((state) => ({ folders: [...state.folders, folder], applied: null }));
    return folder;
  },
  updateFolder(id: string, name: string, filters: FilterRow[]) {
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === id ? { ...folder, name: name || folder.name, filters } : folder,
      ),
    }));
  },
  deleteFolder(id: string) {
    set((state) => ({ folders: state.folders.filter((folder) => folder.id !== id) }));
  },
  setConversationAttr(id: number, key: string, value: string | null) {
    set((state) => {
      const next = { ...(state.conversationAttrs[id] ?? {}) };
      if (value === null) delete next[key];
      else next[key] = value;
      return { conversationAttrs: { ...state.conversationAttrs, [id]: next } };
    });
  },
  setContactAttr(id: number, key: string, value: string | null) {
    set((state) => {
      const next = { ...(state.contactAttrs[id] ?? {}) };
      if (value === null) delete next[key];
      else next[key] = value;
      return { contactAttrs: { ...state.contactAttrs, [id]: next } };
    });
  },
  addNote(id: number, text: string) {
    const current = get().notes[id] ?? initialContactNotes;
    const note: ContactNote = { id: Date.now(), author: "Arham Khan", time: "Just now", text };
    set((state) => ({ notes: { ...state.notes, [id]: [note, ...current] } }));
  },
  deleteNote(id: number, noteId: number) {
    const current = get().notes[id] ?? initialContactNotes;
    set((state) => ({ notes: { ...state.notes, [id]: current.filter((note) => note.id !== noteId) } }));
  },
  editContact(email: string, patch: Partial<Contact>) {
    set((state) => ({
      contactEdits: { ...state.contactEdits, [email]: { ...(state.contactEdits[email] ?? {}), ...patch } },
    }));
  },
};
