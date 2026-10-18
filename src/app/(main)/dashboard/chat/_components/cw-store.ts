"use client";

// Local state for the Chatwoot conversations area (no backend). Lives in module state, so it survives
// moving between the conversation views in the sidebar and resets on reload.
// T-109: except folders, which are also saved to the preview server's disk (lib/cw/persistence, section "folders"),
// so a folder survives reload and opens on another device using the same preview server. Failures show an error.
import { toast } from "sonner";
import { create } from "zustand";

import type { DeliveryState } from "@/app/(main)/chat/_components/chat-thread-state";
import { addConversation, type Contact, contactIdOf, rowAge } from "@/app/(main)/chat/_components/data";
import { linkedSession, loadPreviewSection, SectionConflict, savePreviewSection } from "@/lib/cw/persistence/client";
import { currentViewer } from "@/lib/cw/view-as";

import {
  type AssigneeTab,
  baseConversations,
  type Conversation,
  type ConversationMeta,
  CURRENT_AGENT_ID,
  type CwAttachment,
  type CwMessage,
  type CwStatus,
  deletedMessageKey,
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
  setDeletedMessageKeys,
} from "./cw-data";

export type ContactNote = { id: number; author: string; time: string; text: string };

export interface LinkedCwAdapter {
  onFocus?: (id: number | null) => void;
  setStatus: (ids: number[], status: CwStatus, snoozedUntil?: string | null) => void;
  setPriority: (ids: number[], priority: Priority) => void;
  assignAgent: (ids: number[], assigneeId: number | null) => void;
  assignTeam: (ids: number[], teamId: string | null) => void;
  setParticipants: (id: number, participants: number[]) => void;
  markRead: (id: number) => void;
  markUnread: (id: number) => void;
  toggleMute: (id: number) => void;
  deleteConversation: (ids: number[]) => void;
  send: (
    id: number,
    message: {
      id?: string;
      kind: "outgoing" | "note";
      text: string;
      attachments?: CwAttachment[];
      replyTo?: string;
      time?: string;
    },
  ) => void;
  setConversationAttr: (id: number, key: string, value: string | null) => void;
  setContactAttr: (id: number, key: string, value: string | null) => void;
  addNote: (id: number, text: string) => void;
  deleteNote: (id: number, noteId: number) => void;
  editContact: (key: string, patch: Partial<Contact>) => void;
  refuseFolderOp: () => void;
}

let linkedAdapter: LinkedCwAdapter | null = null;

export function setLinkedCwAdapter(adapter: LinkedCwAdapter | null): void {
  linkedAdapter = adapter;
}

export function getLinkedCwAdapter(): LinkedCwAdapter | null {
  return linkedAdapter;
}

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
  // F-8: "<conversation id>:<message id>" of each deleted message (cw-data.ts deletedMessageKey), kept in the preview
  // by sim-thread-persist.ts deleteMessage.
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
  // F159 panel: Edit contact / inline edits in the contact panel, keyed by the person (contactKeyOf) so every
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
  // F161: Chatwoot starts on Mine (ChatList.vue activeAssigneeTab = ME). A view where Mine is empty shows Chatwoot's
  // empty state; the tab the agent picks stays while moving between views, as in Chatwoot.
  assigneeTab: "me",
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

export function restorePreviewCwState(): void {
  setDeletedMessageKeys([]);
  useCwStore.setState({
    meta: initialMeta,
    unread,
    readCounts: {},
    muted: {},
    deleted: [],
    sent: {},
    delivery: {},
    deletedMessages: [],
    selection: [],
    applied: null,
    search: "",
    conversationAttrs,
    contactAttrs,
    notes: {},
    focusId: null,
    contactEdits: {},
  });
}

// M129-A (after the T-285 judge, Fahad 125.7): a contact may have no email (James writes only on WhatsApp), so the
// person behind a conversation is keyed by their Contacts id; a conversation without one falls back to its email,
// then to the conversation itself.
export function contactKeyOf(conversation: Pick<Conversation, "id" | "contact">): string {
  const profile = contactIdOf(conversation.id);
  if (profile !== null) return `contact:${profile}`;
  return conversation.contact.email ? `email:${conversation.contact.email}` : `conversation:${conversation.id}`;
}

// F159 panel: the contact of a conversation with the agent's edits applied (Edit contact dialog, inline edits).
export function useContactOf(conversation: Conversation): Contact {
  const edits = useCwStore((s) => s.contactEdits[contactKeyOf(conversation)]);
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dismissPreviewToastNextTick() {
  queueMicrotask(() => toast.dismiss());
}

export const cw = {
  focus(id: number | null) {
    set({ focusId: id });
    linkedAdapter?.onFocus?.(id);
  },
  // F161: Chatwoot NewConversation creates the conversation in the chosen inbox, assigned to the agent who started
  // it, with the message as its first reply; the list and the thread show it right away. Returns its id.
  // F-1: `saved` brings back a conversation the preview kept (sim-actions.ts): the id it had and when it was made, so
  // after a reload its age, its day group and its message time come from then, not from now.
  // F-3: `contactId` names the person's Contacts page when they have no conversation yet (`from` is then only their
  // details, with id 0).
  createConversation(input: {
    from: Pick<Conversation, "id" | "contact">;
    contactId?: number;
    channel: string;
    subject: string;
    text: string;
    files?: string[];
    saved?: { id: number; at: string };
    /** F-8: the first message's id, the same on every load (from the saved record), so a delete of it is kept. */
    messageId?: string;
  }): number {
    const id = input.saved?.id ?? Math.max(...baseConversations.map((c) => c.id)) + 1;
    // F-5A: assigned to the person the page is viewed as ("View as"), the agent who started it in Chatwoot's terms.
    const starter = input.saved ? CURRENT_AGENT_ID : currentViewer().id;
    const now = input.saved ? new Date(input.saved.at) : new Date();
    const ago = Math.max(0, Math.floor((Date.now() - now.getTime()) / 60_000));
    const conversation: Conversation = {
      id,
      group: now.toDateString() === new Date().toDateString() ? "Today" : "Yesterday",
      name: input.from.contact.name,
      subject: input.subject.trim() || input.text.trim().split("\n")[0].slice(0, 80),
      preview: input.text.trim(),
      time: rowAge(ago),
      isUnread: false,
      unreadCount: 0,
      channel: input.channel,
      contact: input.from.contact,
      messages: [],
      ago,
    };
    addConversation(conversation, input.contactId ?? contactIdOf(input.from.id));
    const createdRank = Math.max(...Object.values(get().meta).map((m) => m.createdRank)) + 1;
    set((state) => ({
      meta: {
        ...state.meta,
        [id]: {
          status: "open",
          priority: "none",
          assigneeId: starter,
          teamId: null,
          unattended: false,
          mentioned: false,
          participants: [starter],
          snoozedUntil: null,
          sla: null,
          createdRank,
          createdAt: `${MONTHS[now.getMonth()]} ${now.getDate()}`,
        },
      },
      unread: { ...state.unread, [id]: 0 },
      conversationAttrs: { ...state.conversationAttrs, [id]: {} },
      contactAttrs: { ...state.contactAttrs, [id]: state.contactAttrs[input.from.id] ?? {} },
    }));
    const attachments = (input.files ?? []).map((name): CwAttachment => ({ type: "file", name }));
    cw.send(id, {
      ...(input.messageId ? { id: input.messageId } : {}),
      kind: "outgoing",
      text: input.text.trim(),
      ...(attachments.length ? { attachments } : {}),
      ...(input.saved ? { time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) } : {}),
    });
    return id;
  },
  setStatus(ids: number[], status: CwStatus, snoozedUntil: string | null = null) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.setStatus(ids, status, snoozedUntil);
      return;
    }
    patchMeta(ids, {
      status,
      snoozedUntil: status === "snoozed" ? (snoozedUntil ?? "Snoozed until next reply") : null,
    });
  },
  setPriority(ids: number[], priority: Priority) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.setPriority(ids, priority);
      return;
    }
    patchMeta(ids, { priority });
  },
  assignAgent(ids: number[], assigneeId: number | null) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.assignAgent(ids, assigneeId);
      return;
    }
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
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.assignTeam(ids, teamId);
      return;
    }
    patchMeta(ids, { teamId });
  },
  setParticipants(id: number, participants: number[]) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.setParticipants(id, participants);
      return;
    }
    patchMeta([id], { participants });
  },
  markRead(id: number) {
    if (linkedAdapter) {
      linkedAdapter.markRead(id);
      return;
    }
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
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.markUnread(id);
      return;
    }
    set((state) => ({ unread: { ...state.unread, [id]: Math.max(state.unread[id] ?? 0, 1) } }));
  },
  // T-130: Chatwoot "Block Contact" (MoreActions.vue -> conversation mute!, conversation_mute_helpers.rb) resolves the
  // conversation and blocks the contact, so every conversation of that person offers "Unblock Contact". Unblocking
  // keeps the status (Chatwoot unmute! does not reopen).
  toggleMute(id: number) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.toggleMute(id);
      return;
    }
    set((state) => {
      const blocked = !state.muted[id];
      const person = contactIdOf(id);
      const ids =
        person === null
          ? [id]
          : Object.keys(state.meta)
              .map(Number)
              .filter((other) => other === id || contactIdOf(other) === person);
      const muted = { ...state.muted };
      for (const other of ids) muted[other] = blocked;
      const current = state.meta[id];
      if (!blocked || !current) return { muted };
      return { muted, meta: { ...state.meta, [id]: { ...current, status: "resolved", snoozedUntil: null } } };
    });
  },
  deleteConversation(ids: number[]) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.deleteConversation(ids);
      return;
    }
    set((state) => ({
      deleted: [...state.deleted, ...ids],
      selection: state.selection.filter((id) => !ids.includes(id)),
    }));
  },
  // A message shown in the thread without being kept (the first message of a conversation made in the preview, which
  // the conversation's own record keeps). F-5A: this preview has no channel provider behind it, so a reply is never
  // "Sent": it is marked simulated and its footer says it was not delivered (conversation-pane.tsx). Replies and notes
  // from the reply box are kept by sim-thread-persist.ts keepMessage instead.
  send(
    id: number,
    {
      id: messageId,
      ...message
    }: {
      id?: string;
      kind: "outgoing" | "note";
      text: string;
      attachments?: CwAttachment[];
      replyTo?: string;
      time?: string;
    },
  ) {
    if (linkedAdapter) {
      linkedAdapter.send(id, { id: messageId, ...message });
      return;
    }
    const key = messageId ?? `s-${id}-${Date.now().toString(36)}`;
    const entry: CwMessage = {
      id: key,
      time: "Just now",
      sender: currentViewer().name,
      ...message,
      ...(message.kind === "outgoing" ? { simulated: true } : {}),
    };
    set((state) => ({ sent: { ...state.sent, [id]: [...(state.sent[id] ?? []), entry] } }));
  },
  // Chatwoot MessageError "Retry" hands the message to the provider again. There is no provider here, and the
  // provider's reason (recipient unreachable) has not changed, so the retry fails and the message stays failed.
  retryMessage(_messageId: string): boolean {
    return false;
  },
  /** F-8: shows the message as deleted (sim-thread-persist.ts deleteMessage calls this once the preview kept it). */
  deleteMessages(items: { convId: number; messageId: string }[]) {
    const keys = items.map((item) => deletedMessageKey(item.convId, item.messageId));
    const next = [...new Set([...get().deletedMessages, ...keys])];
    setDeletedMessageKeys(next);
    set({ deletedMessages: next });
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
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.refuseFolderOp();
      return folder;
    }
    set((state) => ({ folders: [...state.folders, folder], applied: null }));
    return folder;
  },
  updateFolder(id: string, name: string, filters: FilterRow[]) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.refuseFolderOp();
      return;
    }
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === id ? { ...folder, name: name || folder.name, filters } : folder,
      ),
    }));
  },
  deleteFolder(id: string) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.refuseFolderOp();
      return;
    }
    set((state) => ({ folders: state.folders.filter((folder) => folder.id !== id) }));
  },
  setConversationAttr(id: number, key: string, value: string | null) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.setConversationAttr(id, key, value);
      return;
    }
    set((state) => {
      const next = { ...(state.conversationAttrs[id] ?? {}) };
      if (value === null) delete next[key];
      else next[key] = value;
      return { conversationAttrs: { ...state.conversationAttrs, [id]: next } };
    });
  },
  setContactAttr(id: number, key: string, value: string | null) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.setContactAttr(id, key, value);
      return;
    }
    set((state) => {
      const next = { ...(state.contactAttrs[id] ?? {}) };
      if (value === null) delete next[key];
      else next[key] = value;
      return { contactAttrs: { ...state.contactAttrs, [id]: next } };
    });
  },
  addNote(id: number, text: string) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.addNote(id, text);
      return;
    }
    const current = get().notes[id] ?? initialContactNotes;
    const note: ContactNote = { id: Date.now(), author: currentViewer().name, time: "Just now", text };
    set((state) => ({ notes: { ...state.notes, [id]: [note, ...current] } }));
  },
  deleteNote(id: number, noteId: number) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.deleteNote(id, noteId);
      return;
    }
    const current = get().notes[id] ?? initialContactNotes;
    set((state) => ({ notes: { ...state.notes, [id]: current.filter((note) => note.id !== noteId) } }));
  },
  /** `key` is contactKeyOf(conversation). */
  editContact(key: string, patch: Partial<Contact>) {
    if (linkedAdapter) {
      dismissPreviewToastNextTick();
      linkedAdapter.editContact(key, patch);
      return;
    }
    set((state) => ({
      contactEdits: { ...state.contactEdits, [key]: { ...(state.contactEdits[key] ?? {}), ...patch } },
    }));
  },
};

export interface FolderPersistence {
  /** loading · ready: nothing pending · saving · error: see `error`; the folders on this page may not be saved. */
  status: "loading" | "ready" | "saving" | "error";
  error: string | null;
  savedAt: string | null;
}

/** T-109: save status of the folders, for any view that wants to show "saved" / "not saved". */
export const useFolderPersistence = create<FolderPersistence>(() => ({
  status: "loading",
  error: null,
  savedAt: null,
}));

function folderSaveFailed(message: string, changedElsewhere = false) {
  // a 409 is expected and shown to the user, so it is not logged as a page error
  if (changedElsewhere) console.warn(`[cw folders] ${message}`);
  else console.error(`[cw folders] ${message}`);
  useFolderPersistence.setState({ status: "error", error: message });
  // F-3: on a 409 the page already said "deleted" or "saved" for this change; take that back before saying it was not.
  if (changedElsewhere) toast.dismiss();
  toast.error("Folder not saved", {
    id: changedElsewhere ? "cw-folders-changed-elsewhere" : undefined,
    description: message,
    duration: Number.POSITIVE_INFINITY,
    action: changedElsewhere ? { label: "Reload", onClick: () => window.location.reload() } : undefined,
  });
}

// Same pattern as lib/cw/store.ts startPersistence, for the folders section, plus a revision: a save based on an
// older revision (another tab or device saved in between) is refused and reported, never overwritten silently.
function startFolderPersistence() {
  let loaded = false;
  let loadFailed = false;
  let editedBeforeLoad = false;
  let applyingSaved = false;
  let pending = false;
  let rev = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();

  const save = (keepalive = false) => {
    clearTimeout(timer);
    pending = false;
    useFolderPersistence.setState({ status: "saving" });
    queue = queue
      .then(() => savePreviewFolders(keepalive))
      .catch((error) =>
        folderSaveFailed(
          error instanceof SectionConflict
            ? "Folders were changed in another tab or device. Reload the page to see them; this change was not saved."
            : `${error instanceof Error ? error.message : String(error)}. This folder will be gone after a reload.`,
          error instanceof SectionConflict,
        ),
      );
  };
  const savePreviewFolders = async (keepalive: boolean) => {
    const saved = await savePreviewSection("folders", get().folders, rev, keepalive);
    rev = saved.rev;
    if (!pending) useFolderPersistence.setState({ status: "ready", error: null, savedAt: saved.savedAt });
  };

  useCwStore.subscribe((state, previous) => {
    if (linkedSession() || state.folders === previous.folders || applyingSaved) return;
    if (loadFailed) {
      folderSaveFailed("Saved folders could not be loaded, so saving is off on this page. Reload to try again.");
      return;
    }
    if (!loaded) {
      editedBeforeLoad = true;
      return;
    }
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(save, 300);
  });
  window.addEventListener("pagehide", () => {
    if (pending && !linkedSession()) save(true);
  });

  loadPreviewSection<Folder>("folders")
    .then((saved) => {
      rev = saved.rev;
      // A folder made while loading is added after the saved ones (never replaces them) and saved right away.
      if (saved.items) {
        const savedIds = new Set(saved.items.map((folder) => folder.id));
        const madeWhileLoading = get().folders.filter((folder) => !savedIds.has(folder.id));
        applyingSaved = true;
        set({ folders: [...saved.items, ...madeWhileLoading] });
        applyingSaved = false;
      }
      loaded = true;
      useFolderPersistence.setState({ status: "ready", error: null, savedAt: saved.savedAt });
      if (editedBeforeLoad) save();
    })
    // Without the saved copy we must not overwrite it, so saving stays off for this page load.
    .catch((error) => {
      loadFailed = true;
      const message = `Saved folders could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[cw folders] ${message}`);
      useFolderPersistence.setState({ status: "error", error: message });
    });
}

if (typeof window !== "undefined") startFolderPersistence();
