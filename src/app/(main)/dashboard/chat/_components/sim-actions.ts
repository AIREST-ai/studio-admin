"use client";

// M129-A (Fahad 129.2): what the conversation's simulated buttons do to the preview's data, and how it comes back
// after a reload (lib/cw/preview-sim.ts keeps the record on the preview server's disk). Nothing reaches Chatwoot.
// - Call: a line in the thread for every simulated call (sim-call.tsx draws the call screen).
// - Save Contact (shared contact card): Chatwoot's Contact.vue looks the number up and creates the contact when it is
//   new; here it goes into the preview's Contacts.
// - Delete contact: Chatwoot deletes the contact with its conversations (app/models/contact.rb, v4.18.0:
//   has_many :conversations, dependent: :destroy_async); here both leave the preview's Contacts and inbox.
// - Merge contacts: Chatwoot's ContactMergeAction (app/actions/contact_merge_action.rb) moves the merged contact's
//   conversations to the kept one, fills the kept contact's empty attributes from it (the kept one wins a conflict)
//   and deletes it; here the same happens to the preview's Contacts and to how its conversations show the contact.
// - New conversation (F-1): Chatwoot sends the first message to the customer and opens the conversation; here the
//   conversation and its message are only made in the preview's inbox, with a line in the thread that says so.
// - Send transcript (F-2): Chatwoot emails the conversation's transcript (EmailTranscriptModal.vue); here the request
//   is only recorded, with a line in the thread that says nothing was emailed. It is still there after a reload.
import { toast } from "sonner";

import type { Contact as ChatContact } from "@/app/(main)/chat/_components/data";
import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import {
  type ContactOp,
  onPreviewSimLoaded,
  recordSim,
  SIMULATED,
  type SimCall,
  type SimConversation,
  type SimTranscript,
  simId,
  usePreviewSim,
} from "@/lib/cw/preview-sim";
import { currentViewer } from "@/lib/cw/view-as";

import { baseConversations, type Conversation, type CwMessage, contactIdOf } from "./cw-data";
import { contactKeyOf, cw, useCwStore } from "./cw-store";

const clock = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

function callLine(call: SimCall): CwMessage {
  const what = call.channel === "whatsapp" ? "Outgoing WhatsApp call" : "Outgoing call";
  const result =
    call.outcome === "ended" ? `ended · ${clock(call.seconds)}` : `not answered · rang ${clock(call.ringSeconds)}`;
  const time = new Date(call.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { id: call.id, kind: "activity", text: `${what} ${result} · ${SIMULATED}, no call was placed`, time };
}

function addCallLine(call: SimCall) {
  useCwStore.setState((state) => ({
    sent: { ...state.sent, [call.convId]: [...(state.sent[call.convId] ?? []), callLine(call)] },
  }));
}

export interface LinkedSimActionsAdapter {
  finishSimCall: (call: Omit<SimCall, "id" | "at">) => void;
  simSendTranscript: (input: Pick<SimTranscript, "convId" | "target" | "email">) => { saved: Promise<boolean> };
  simCreateConversation: (input: {
    from?: Conversation;
    person?: { contactId: number; contact: NonNullable<SimConversation["contact"]> };
    channel: string;
    subject: string;
    text: string;
    files: string[];
  }) => { id: number; saved: Promise<boolean> };
  simSaveContact: (name: string, phone: string) => { id: number; existed: boolean };
  simDeleteContact: (convId: number) => number;
  simMergeContacts: (convId: number, keptKey: string) => void;
}

let linkedSimActionsAdapter: LinkedSimActionsAdapter | null = null;

export function setLinkedSimActionsAdapter(adapter: LinkedSimActionsAdapter | null): void {
  linkedSimActionsAdapter = adapter;
}

/** Ends a simulated call: its line goes into the thread and the preview keeps it (F-5A: Calls lists it too). */
export function finishSimCall(call: Omit<SimCall, "id" | "at">) {
  if (linkedSimActionsAdapter) {
    linkedSimActionsAdapter.finishSimCall(call);
    return;
  }
  const viewer = currentViewer();
  const saved: SimCall = {
    ...call,
    id: simId("call"),
    at: new Date().toISOString(),
    by: viewer.id,
    byName: viewer.name,
  };
  addCallLine(saved);
  void recordSim("calls", saved);
}

// ---- transcript ----

function transcriptLine(transcript: SimTranscript): CwMessage {
  return {
    id: transcript.id,
    kind: "activity",
    text: `Transcript for ${transcript.email} recorded in the preview · ${SIMULATED}, nothing was emailed`,
    time: new Date(transcript.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function addTranscriptLine(transcript: SimTranscript) {
  useCwStore.setState((state) => ({
    sent: {
      ...state.sent,
      [transcript.convId]: [...(state.sent[transcript.convId] ?? []), transcriptLine(transcript)],
    },
  }));
}

/**
 * "Send transcript" → Submit: the request goes into the conversation's thread as a line and the preview keeps it
 * (`saved` resolves true once it is on the preview server's disk, false after an error toast). No email is sent.
 */
export function simSendTranscript(input: Pick<SimTranscript, "convId" | "target" | "email">): {
  saved: Promise<boolean>;
} {
  if (linkedSimActionsAdapter) {
    return linkedSimActionsAdapter.simSendTranscript(input);
  }
  const transcript: SimTranscript = { id: simId("tr"), ...input, at: new Date().toISOString() };
  addTranscriptLine(transcript);
  return { saved: recordSim("transcripts", transcript) };
}

// ---- new conversation ----

const clockOf = (at: string) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** F-3: the details of a person with no conversation yet (a contact made on the Contacts page), as a conversation shows them. */
export function chatContactOf(contact: NonNullable<SimConversation["contact"]>): ChatContact {
  return { role: "", website: "", timezone: "", status: "", qualifiedAt: "", tags: [], ...contact };
}

function fromOf(record: SimConversation): Pick<Conversation, "id" | "contact"> | undefined {
  if (record.fromId === 0) return record.contact ? { id: 0, contact: chatContactOf(record.contact) } : undefined;
  return baseConversations.find((c) => c.id === record.fromId);
}

/** Makes the conversation of `record` in the inbox, with the line that says nothing was sent. `replay`: from the saved record. */
function startConversation(record: SimConversation, replay: boolean): number | null {
  const from = fromOf(record);
  if (!from || (replay && baseConversations.some((c) => c.id === record.convId))) {
    console.error(
      `[preview-sim] conversation #${record.convId} not restored: ${from ? "its number is taken" : "its contact is gone"}`,
    );
    return null;
  }
  const id = cw.createConversation({
    from,
    ...(record.fromId === 0 ? { contactId: record.contactId } : {}),
    channel: record.channel,
    subject: record.subject,
    text: record.text,
    files: record.files,
    ...(replay ? { saved: { id: record.convId, at: record.at } } : {}),
    // F-8: the first message keeps one id on every load, so deleting it is kept (sim-thread-persist.ts deleteMessage).
    messageId: `${record.id}-m`,
  });
  const line: CwMessage = {
    id: `sim-conv-${id}`,
    kind: "activity",
    text: `Conversation created in the preview · ${SIMULATED}, no real customer was contacted`,
    time: clockOf(record.at),
  };
  useCwStore.setState((state) => ({ sent: { ...state.sent, [id]: [line, ...(state.sent[id] ?? [])] } }));
  return id;
}

/**
 * "New conversation" → Send: the conversation joins the preview's inbox with its message, and the preview keeps it
 * (`saved` resolves true once it is on the preview server's disk, false after an error toast). No customer is contacted.
 * F-3: `person` instead of `from` for someone with no conversation yet (their Contacts id and details).
 */
export function simCreateConversation(input: {
  from?: Conversation;
  person?: { contactId: number; contact: NonNullable<SimConversation["contact"]> };
  channel: string;
  subject: string;
  text: string;
  files: string[];
}): { id: number; saved: Promise<boolean> } {
  if (linkedSimActionsAdapter) {
    return linkedSimActionsAdapter.simCreateConversation(input);
  }
  const at = new Date().toISOString();
  // The number it will get is the next free one; the record keeps it so a reload gives the same one.
  const convId = Math.max(...baseConversations.map((c) => c.id)) + 1;
  // The record names the person by their oldest conversation (a sample one, which is always there), never by another
  // conversation made in the preview, so each saved conversation stands on its own after a reload.
  const root = input.from
    ? (baseConversations.findLast((c) => c.contact.name === input.from?.contact.name) ?? input.from)
    : undefined;
  const record: SimConversation = {
    id: simId("conv"),
    convId,
    fromId: root?.id ?? 0,
    ...(root ? {} : { contactId: input.person?.contactId, contact: input.person?.contact }),
    channel: input.channel,
    subject: input.subject,
    text: input.text.trim(),
    files: input.files,
    at,
  };
  const id = startConversation(record, false) ?? convId;
  return { id, saved: recordSim("conversations", record) };
}

// ---- contacts ----

const contactOf = (convId: number): ChatContact | undefined => {
  const conversation = baseConversations.find((c) => c.id === convId);
  if (!conversation) return undefined;
  return { ...conversation.contact, ...useCwStore.getState().contactEdits[contactKeyOf(conversation)] };
};

/** Every conversation of the person in `convId` (the same contactKeyOf: Contacts id, else email). */
function conversationsOf(convId: number): number[] {
  const conversation = baseConversations.find((c) => c.id === convId);
  if (!conversation) return [];
  const person = contactKeyOf(conversation);
  return baseConversations.filter((c) => contactKeyOf(c) === person).map((c) => c.id);
}

const CHAT_FIELDS = ["name", "role", "company", "email", "phone", "website", "location", "timezone", "status"] as const;

function applyToChat(op: ContactOp) {
  if (op.op === "delete") cw.deleteConversation(op.convIds.filter((id) => !useCwStore.getState().deleted.includes(id)));
  if (op.op === "merge") {
    cw.editContact(op.deletedKey, op.merged);
    cw.editContact(op.keptKey, op.merged);
  }
}

function applyToContacts(op: ContactOp) {
  const store = useContactsStore.getState();
  if (op.op === "delete" && op.profileId !== null) store.remove([op.profileId]);
  if (op.op === "merge" && op.keptId !== null && op.deletedId !== null && op.keptId !== op.deletedId)
    store.merge(op.keptId, op.deletedId);
}

/** Chatwoot Contact.vue "Save Contact": the contact with this number, or a new one in the preview's Contacts. */
export function simSaveContact(name: string, phone: string): { id: number; existed: boolean } {
  if (linkedSimActionsAdapter) {
    return linkedSimActionsAdapter.simSaveContact(name, phone);
  }
  const digits = phone.replace(/\D/g, "");
  const store = useContactsStore.getState();
  const existing = digits ? store.list.find((c) => c.phone.replace(/\D/g, "") === digits) : undefined;
  if (existing) return { id: existing.id, existed: true };
  // Chatwoot sends { name, phone_number: "+" + digits } and nothing else.
  const contact = store.add({ name, email: "", phone: `+${digits}`, company: "", city: "", country: "", bio: "" });
  void recordSim("contactOps", { id: simId("op"), at: new Date().toISOString(), op: "add", contact });
  return { id: contact.id, existed: false };
}

/** Deletes the contact of `convId` and its conversations from the preview. Returns how many conversations went. */
export function simDeleteContact(convId: number): number {
  if (linkedSimActionsAdapter) {
    return linkedSimActionsAdapter.simDeleteContact(convId);
  }
  const conversation = baseConversations.find((c) => c.id === convId);
  const contact = contactOf(convId);
  if (!contact || !conversation) return 0;
  const op: ContactOp = {
    id: simId("op"),
    at: new Date().toISOString(),
    op: "delete",
    profileId: contactIdOf(convId),
    key: contactKeyOf(conversation),
    convIds: conversationsOf(convId),
  };
  applyToContacts(op);
  applyToChat(op);
  void recordSim("contactOps", op);
  toast.success("Contact deleted successfully", {
    description: `${SIMULATED}: ${contact.name} and ${op.convIds.length} conversation${op.convIds.length === 1 ? "" : "s"} left this preview's data. Nothing was deleted in the engine.`,
  });
  return op.convIds.length;
}

/** Merges the contact of `convId` (deleted) into the person `keptKey` (kept, contactKeyOf), as Chatwoot's merge does. */
export function simMergeContacts(convId: number, keptKey: string) {
  if (linkedSimActionsAdapter) {
    linkedSimActionsAdapter.simMergeContacts(convId, keptKey);
    return;
  }
  const conversation = baseConversations.find((c) => c.id === convId);
  const mergee = contactOf(convId);
  const keptConversation = baseConversations.find((c) => contactKeyOf(c) === keptKey);
  const kept = keptConversation ? contactOf(keptConversation.id) : undefined;
  if (!conversation || !mergee || !kept || !keptConversation) return;
  const merged: Partial<ChatContact> = {};
  for (const field of CHAT_FIELDS) merged[field] = kept[field] || mergee[field];
  const op: ContactOp = {
    id: simId("op"),
    at: new Date().toISOString(),
    op: "merge",
    keptId: contactIdOf(keptConversation.id),
    deletedId: contactIdOf(convId),
    keptKey,
    deletedKey: contactKeyOf(conversation),
    convIds: conversationsOf(convId),
    merged,
  };
  applyToContacts(op);
  applyToChat(op);
  void recordSim("contactOps", op);
  toast.success("Contact merged successfully", {
    description: `${SIMULATED}: ${mergee.name} was merged into ${kept.name} in this preview's data. Nothing was merged in the engine.`,
  });
}

/** People (contactKeyOf) merged into another contact; the merge list no longer offers them. */
export function useMergedAwayKeys(): string[] {
  const ops = usePreviewSim((s) => s.contactOps);
  return ops.flatMap((op) => (op.op === "merge" ? [op.deletedKey] : []));
}

/** After a merge, the conversation's contact is the kept one: its Contacts page. */
export function useSimProfileId(convId: number): number | null | undefined {
  const ops = usePreviewSim((s) => s.contactOps);
  const merge = ops.findLast((op) => op.op === "merge" && op.convIds.includes(convId));
  return merge?.op === "merge" ? merge.keptId : undefined;
}

// Replays what was saved before this page loaded: the conversations made here, call lines into their threads,
// deletions and merges into the inbox. (contacts-store.ts replays the same record into the Contacts list.)
if (typeof window !== "undefined") {
  onPreviewSimLoaded((saved) => {
    for (const conversation of saved.conversations) startConversation(conversation, true);
    for (const call of saved.calls) addCallLine(call);
    for (const transcript of saved.transcripts) addTranscriptLine(transcript);
    for (const op of saved.contactOps) applyToChat(op);
  });
}
