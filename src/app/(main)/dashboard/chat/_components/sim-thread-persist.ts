"use client";

// F-5A (sim1 problems 2, 3 and 6; Fahad 129.2, 99, 77.5): what is written in a conversation and its status are kept in
// the preview's simulation record (lib/cw/preview-sim.ts -> api/preview-sim, keys "messages" and "statuses"), so they
// are there after a reload and in another browser. Nothing reaches the customer or Chatwoot, and every line says so.
// - Replies and private notes (keepMessage): shown at once, their files' bytes kept by api/preview-sim/upload, then the
//   message saved. A reply never shows "Sent": its footer says "Simulated — not delivered to the customer".
// - Status (changeStatus): Resolve, Snooze with the time it reopens (Chatwoot snoozeHelpers.js findSnoozeTime), Reopen
//   and Mark as pending. A line goes into the thread with Chatwoot's activity text (config/locales/en.yml
//   conversations.activity.status.*) and the toast names it a simulation. Each change names the newest status record
//   of that conversation this tab read; when another tab or device changed it in between, the server answers 409,
//   nothing is written, the change is undone here and the page says "changed in another tab or device" with Reload
//   (the F-3 pattern).
// - Block / Unblock from the conversation (toggleBlock): Chatwoot mute! (models/concerns/conversation_mute_helpers.rb)
//   resolves the conversation and blocks the contact; unmute! only unblocks. Kept as the contact's block record (the
//   same one the Contacts page keeps, F-3), with the same 409 check, so both pages show it after a reload.
// - A snoozed conversation reopens once its time has passed (Chatwoot Conversations::ReopenSnoozedConversationsJob).
// - Delete on a message (deleteMessage, F-8; sim3: "Message deleted successfully" with no request, and the message came
//   back after a reload): kept as a delete record ("messageDeletes"), and only then shown: the message stays in the
//   thread as "This message was deleted" without its files, as Chatwoot does (messages_controller.rb#destroy). A delete
//   that is not kept says "Message not deleted" and the message stays as it was.
import { addHours, format, isSameYear, isToday } from "date-fns";
import { toast } from "sonner";
import { create } from "zustand";

import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import {
  addSavedSim,
  type ContactOp,
  onPreviewSimLoaded,
  SIMULATED,
  type SimAttachment,
  type SimMessage,
  type SimMessageDelete,
  type SimStatus,
  saveSim,
  simId,
} from "@/lib/cw/preview-sim";
import { currentViewer } from "@/lib/cw/view-as";

import { baseConversations, type CwAttachment, type CwMessage, type CwStatus, contactIdOf } from "./cw-data";
import { cw, useCwStore } from "./cw-store";

const clock = (at: string) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// ---- what the page says -------------------------------------------------------------------------------------------

/** The footer of a reply written in the preview, in place of a delivery tick. */
export const NOT_DELIVERED = "Simulated — not delivered to the customer";

function changedElsewhere(what: string) {
  console.warn(`[conversation] ${what} was changed in another tab or device; this change was not saved`);
  toast.error("Not saved: changed in another tab or device", {
    id: "conversation-changed-elsewhere",
    description: `${what} was changed in another tab or device. Reload the page to see the latest version, then make the change again.`,
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Reload", onClick: () => window.location.reload() },
  });
}

function notSaved(message: string, what: string) {
  console.error(`[conversation] ${what} not saved: ${message}`);
  toast.error("Not saved in the preview", {
    description: `${message}. This ${what} shows on this page only and will be gone after a reload.`,
    duration: Number.POSITIVE_INFINITY,
  });
}

// ---- thread lines -------------------------------------------------------------------------------------------------

function addLines(convId: number, lines: CwMessage[]) {
  useCwStore.setState((state) => ({ sent: { ...state.sent, [convId]: [...(state.sent[convId] ?? []), ...lines] } }));
}

function replaceLine(convId: number, id: string, line: CwMessage | null) {
  useCwStore.setState((state) => ({
    sent: {
      ...state.sent,
      [convId]: (state.sent[convId] ?? []).flatMap((m) => (m.id === id ? (line ? [line] : []) : [m])),
    },
  }));
}

// ---- replies and notes --------------------------------------------------------------------------------------------

/** Save state of the replies and notes written on this page (absent: saved before this page loaded). */
export const useKeepState = create<Record<string, "saving" | "saved" | "failed">>(() => ({}));

/** F-8: how a save ended; `message` says why it failed. */
export type KeepOutcome = { ok: true } | { ok: false; message: string };
// F-8 (monitor: a macro said "saved" before its message was saved): the save of each reply or note written on this
// page, so a caller (runMacro) can wait for it before saying anything about it.
const keeping = new Map<string, Promise<KeepOutcome>>();
/** F-8: resolves when the reply or note `id` (keepMessage's answer) was saved, or says why it was not. */
export const whenKept = (id: string): Promise<KeepOutcome> =>
  keeping.get(id) ?? Promise.resolve({ ok: false, message: "this message was not written on this page" });

/** A file the reply box attaches; `file` is the browser's own file, whose bytes are kept with the message. */
export type OutgoingFile = CwAttachment & { file?: File };

export interface LinkedThreadAdapter {
  keepMessage: (
    convId: number,
    input: {
      kind: "outgoing" | "note";
      text: string;
      attachments?: OutgoingFile[];
      replyTo?: string;
      from?: { id: number; name: string };
    },
    keeping: Map<string, Promise<KeepOutcome>>,
    useKeepState: typeof useKeepStateStore,
  ) => string;
  deleteMessage: (convId: number, messageId: string) => Promise<boolean>;
  changeStatus: (
    ids: number[],
    status: CwStatus,
    options?: {
      snooze?: SnoozeKind | Date | null;
      quiet?: boolean;
      title?: string;
      label?: string;
    },
  ) => Promise<boolean>;
  toggleBlock: (convId: number) => Promise<KeepOutcome>;
}

const useKeepStateStore = useKeepState;
let linkedThreadAdapter: LinkedThreadAdapter | null = null;

export function setLinkedThreadAdapter(adapter: LinkedThreadAdapter | null): void {
  linkedThreadAdapter = adapter;
}

function toLine(record: SimMessage, previews?: (string | undefined)[]): CwMessage {
  return {
    id: record.id,
    kind: record.kind,
    text: record.text,
    time: clock(record.at),
    at: record.at,
    sender: record.byName,
    ...(record.replyTo ? { replyTo: record.replyTo } : {}),
    ...(record.kind === "outgoing" ? { simulated: true } : {}),
    ...(record.deleted ? { deleted: true } : {}),
    ...(record.attachments.length
      ? {
          attachments: record.attachments.map((file, index) => ({
            type: file.type,
            name: file.name,
            ...(file.size ? { size: file.size } : {}),
            ...(file.duration ? { duration: file.duration } : {}),
            ...(file.mime ? { mime: file.mime } : {}),
            ...(file.uploadId ? { uploadId: file.uploadId } : {}),
            ...(file.notKept ? { notKept: file.notKept } : {}),
            ...(previews?.[index] ? { previewUrl: previews[index] } : {}),
          })),
        }
      : {}),
  };
}

const attachmentType = (type: CwAttachment["type"]): SimAttachment["type"] =>
  type === "image" || type === "audio" || type === "video" ? type : "file";

async function keepBytes(file: File): Promise<Pick<SimAttachment, "uploadId" | "notKept">> {
  const form = new FormData();
  form.append("file", file);
  try {
    const response = await fetch("/api/preview-sim/upload", { method: "POST", body: form });
    const body = (await response.json().catch(() => null)) as {
      id?: string;
      name?: string;
      size?: number;
      type?: string;
      at?: string;
      error?: string;
    } | null;
    if (!response.ok || !body?.id)
      return {
        notKept: `The file is not kept in the preview: ${body?.error ?? `${response.status} ${response.statusText}`}`,
      };
    addSavedSim("uploads", {
      id: body.id,
      name: body.name ?? file.name,
      size: body.size ?? file.size,
      type: body.type ?? file.type,
      at: body.at ?? new Date().toISOString(),
    });
    return { uploadId: body.id };
  } catch (error) {
    return {
      notKept: `The file is not kept in the preview: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * A reply or a private note from the reply box (or a macro): it shows in the thread at once, written by the person the
 * page is viewed as; its files' bytes are kept, then the message itself. Nothing is sent to the customer.
 */
export function keepMessage(
  convId: number,
  input: {
    kind: "outgoing" | "note";
    text: string;
    attachments?: OutgoingFile[];
    replyTo?: string;
    /** F-19: written by someone other than the viewer: the simulated bot ({ id: 0, name: "Bot" }, bot-reply-sim.tsx). */
    from?: { id: number; name: string };
  },
): string {
  if (linkedThreadAdapter) {
    return linkedThreadAdapter.keepMessage(convId, input, keeping, useKeepState);
  }
  const viewer = input.from ?? currentViewer();
  const files = input.attachments ?? [];
  const record: SimMessage = {
    id: simId("msg"),
    convId,
    kind: input.kind,
    text: input.text,
    attachments: files.map((file) => ({
      type: attachmentType(file.type),
      name: file.name.slice(0, 255),
      ...(file.size ? { size: file.size } : {}),
      ...(file.duration ? { duration: file.duration } : {}),
      ...(file.file?.type ? { mime: file.file.type.slice(0, 150) } : {}),
    })),
    ...(input.replyTo ? { replyTo: input.replyTo.slice(0, 2000) } : {}),
    by: viewer.id,
    byName: viewer.name,
    at: new Date().toISOString(),
  };
  const previews = files.map((file) => file.previewUrl);
  addLines(convId, [toLine(record, previews)]);
  useKeepState.setState({ [record.id]: "saving" });
  const what = input.kind === "note" ? "note" : "reply";
  const saved = (async (): Promise<KeepOutcome> => {
    for (const [index, file] of files.entries()) {
      if (!file.file) {
        record.attachments[index].notKept = "The file is not kept in the preview: only its name was attached";
        continue;
      }
      Object.assign(record.attachments[index], await keepBytes(file.file));
    }
    replaceLine(convId, record.id, toLine(record, previews));
    const result = await saveSim("messages", record);
    useKeepState.setState({ [record.id]: result.ok ? "saved" : "failed" });
    if (!result.ok) notSaved(result.message, what);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  })();
  keeping.set(record.id, saved);
  return record.id;
}

// ---- delete a message ---------------------------------------------------------------------------------------------

/**
 * F-8: "Delete" on a message of conversation `convId`. The delete is saved first; only then the message shows as
 * deleted and the toast says so. Resolves true when the preview kept it.
 */
export async function deleteMessage(convId: number, messageId: string): Promise<boolean> {
  if (linkedThreadAdapter) {
    return linkedThreadAdapter.deleteMessage(convId, messageId);
  }
  const viewer = currentViewer();
  const record: SimMessageDelete = {
    id: simId("del"),
    convId,
    messageId,
    by: viewer.id,
    byName: viewer.name,
    at: new Date().toISOString(),
  };
  const result = await saveSim("messageDeletes", record);
  if (!result.ok) {
    console.error(`[conversation] message not deleted: ${result.message}`);
    toast.error("Message not deleted", {
      description: `${result.message}. The preview did not keep the delete, so the message is unchanged.`,
      duration: Number.POSITIVE_INFINITY,
    });
    return false;
  }
  cw.deleteMessages([{ convId, messageId }]);
  toast.success("Message deleted successfully", {
    description: `${SIMULATED}: deleted in this preview; it shows as “This message was deleted”, as in the engine. Nothing was changed in the engine or sent to the customer.`,
  });
  return true;
}

// ---- status -------------------------------------------------------------------------------------------------------

// The newest status record of each conversation this page has read or saved (what a change names as its `base`).
const newestStatus = new Map<number, string>();
// When each snoozed conversation reopens (ms), from its newest record.
const snoozeEnds = new Map<number, number>();

export type SnoozeKind = "next_reply" | "an_hour_from_now" | "tomorrow" | "next_week" | "next_month";

const atNine = (date: Date) => {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);
  return next;
};
const plusDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const nextMonday = (from: Date) => plusDays(from, (8 - from.getDay()) % 7 || 7);

/**
 * Chatwoot snoozeHelpers.js findSnoozeTime: an hour from now; tomorrow 9 AM; next week's Monday 9 AM; the first Monday
 * of next month 9 AM (the 1st when it is a Monday). "Next reply" has no time: it reopens when the customer writes.
 */
export function snoozeTime(kind: SnoozeKind, now = new Date()): Date | null {
  switch (kind) {
    case "an_hour_from_now":
      return addHours(now, 1);
    case "tomorrow":
      return atNine(plusDays(now, 1));
    case "next_week": {
      // startOfWeek(addWeeks(now, 1)) is next week's Sunday; Chatwoot moves it to that week's Monday.
      const sunday = plusDays(now, 7 - now.getDay());
      return atNine(plusDays(sunday, 1));
    }
    case "next_month": {
      const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return atNine(first.getDay() === 1 ? first : nextMonday(first));
    }
    default:
      return null;
  }
}

/** Chatwoot snoozedReopenTime: "9.00am" today, "16 Oct, 9.00am" this year, else with the year. */
export function reopenTime(at: Date): string {
  if (isToday(at)) return format(at, "h.mmaaa");
  if (!isSameYear(at, new Date())) return format(at, "d MMM yyyy, h.mmaaa");
  return format(at, "d MMM, h.mmaaa");
}

const snoozeText = (until: string | null) =>
  until ? `Snoozed until ${reopenTime(new Date(until))}` : "Snoozed until next reply";

/** Chatwoot conversations.activity.status.* (config/locales/en.yml), marked as the preview's. */
function statusLine(record: SimStatus): CwMessage {
  const by = record.byName;
  // F-19: an open set by the preview itself names why, in Chatwoot's words (label, see changeStatus `label`).
  const text =
    record.status === "open" && record.label
      ? record.label
      : {
          resolved: `Conversation was marked resolved by ${by}`,
          open: `Conversation was reopened by ${by}`,
          pending: `Conversation was marked as pending by ${by}`,
          snoozed: `Conversation was snoozed by ${by}${record.snoozedUntil ? ` until ${reopenTime(new Date(record.snoozedUntil))}` : " until the next reply"}`,
        }[record.status];
  return {
    id: record.id,
    kind: "activity",
    text: `${text} · ${SIMULATED}, not changed in the engine`,
    time: clock(record.at),
    at: record.at,
  };
}

function applyStatus(record: Pick<SimStatus, "convId" | "status" | "snoozedUntil" | "at">) {
  if (record.status === "snoozed" && record.snoozedUntil)
    snoozeEnds.set(record.convId, Date.parse(record.snoozedUntil));
  else snoozeEnds.delete(record.convId);
  const expired = record.status === "snoozed" && record.snoozedUntil && Date.parse(record.snoozedUntil) <= Date.now();
  useCwStore.setState((state) => {
    const current = state.meta[record.convId];
    if (!current) return {};
    const status: CwStatus = expired ? "open" : record.status;
    return {
      meta: {
        ...state.meta,
        [record.convId]: {
          ...current,
          status,
          snoozedUntil: status === "snoozed" ? snoozeText(record.snoozedUntil) : null,
          statusAt: record.at,
        },
      },
    };
  });
}

/**
 * Resolve, Snooze, Reopen or Mark as pending, for one conversation or a selection. Shows at once; the toast comes
 * once the preview kept it. `snooze`: when it reopens (null = on the next reply).
 */
export function changeStatus(
  ids: number[],
  status: CwStatus,
  options: {
    snooze?: SnoozeKind | Date | null;
    quiet?: boolean;
    title?: string;
    /** F-19: the activity text of an open the preview made itself (Chatwoot's Captain auto-open after an agent reply). */
    label?: string;
  } = {},
): Promise<boolean> {
  if (linkedThreadAdapter) {
    return linkedThreadAdapter.changeStatus(ids, status, options);
  }
  const viewer = currentViewer();
  const next: SimStatus["status"] = status === "closed" ? "resolved" : status;
  const openLabel = next === "open" && options.label ? options.label.slice(0, 120) : null;
  let until: Date | null = null;
  if (next === "snoozed")
    until = options.snooze instanceof Date ? options.snooze : snoozeTime(options.snooze ?? "next_reply");
  const saves = ids.flatMap((convId) => {
    const before = useCwStore.getState().meta[convId];
    if (!before) return [];
    const record: SimStatus = {
      id: simId("st"),
      convId,
      status: next,
      snoozedUntil: until ? until.toISOString() : null,
      label: next === "snoozed" ? snoozeText(until ? until.toISOString() : null) : openLabel,
      base: newestStatus.get(convId) ?? null,
      by: viewer.id,
      byName: viewer.name,
      at: new Date().toISOString(),
    };
    const endBefore = snoozeEnds.get(convId);
    applyStatus(record);
    addLines(convId, [statusLine(record)]);
    return [
      saveSim("statuses", record).then((result) => {
        if (result.ok) {
          newestStatus.set(convId, record.id);
          return "ok" as const;
        }
        if (!result.conflict) return result.message;
        // Not written: this page's change is taken back.
        replaceLine(convId, record.id, null);
        if (endBefore === undefined) snoozeEnds.delete(convId);
        else snoozeEnds.set(convId, endBefore);
        useCwStore.setState((state) => ({
          meta: {
            ...state.meta,
            [convId]: {
              ...state.meta[convId],
              status: before.status,
              snoozedUntil: before.snoozedUntil,
              statusAt: before.statusAt,
            },
          },
        }));
        return "conflict" as const;
      }),
    ];
  });
  return Promise.all(saves).then((outcomes) => {
    const conflicts = outcomes.filter((outcome) => outcome === "conflict").length;
    const failure = outcomes.find((outcome) => outcome !== "ok" && outcome !== "conflict");
    if (conflicts)
      changedElsewhere(
        conflicts === 1 && ids.length === 1
          ? "This conversation's status"
          : `The status of ${conflicts} of these conversations`,
      );
    else if (failure) notSaved(failure, "status change");
    else if (!options.quiet && outcomes.length)
      toast.success(options.title ?? "Conversation status changed", {
        description: `${SIMULATED}: saved in this preview${next === "snoozed" ? ` (${snoozeText(until ? until.toISOString() : null).toLowerCase()})` : ""}. Nothing was changed in the engine.`,
      });
    return outcomes.length > 0 && outcomes.every((outcome) => outcome === "ok");
  });
}

// Chatwoot ReopenSnoozedConversationsJob: a snoozed conversation whose time has passed is open again.
function reopenDue() {
  const now = Date.now();
  for (const [convId, end] of snoozeEnds) {
    if (end > now) continue;
    snoozeEnds.delete(convId);
    useCwStore.setState((state) => {
      const current = state.meta[convId];
      if (!current || current.status !== "snoozed") return {};
      return { meta: { ...state.meta, [convId]: { ...current, status: "open", snoozedUntil: null } } };
    });
  }
}

// ---- block / unblock ----------------------------------------------------------------------------------------------

// The newest block record of each contact this page has read or saved.
const newestBlock = new Map<number, string>();

function setBlocked(contactId: number, blocked: boolean) {
  useCwStore.setState((state) => {
    const muted = { ...state.muted };
    for (const id of Object.keys(state.meta).map(Number)) if (contactIdOf(id) === contactId) muted[id] = blocked;
    return { muted };
  });
  const others = useContactsStore.getState().blocked.filter((id) => id !== contactId);
  useContactsStore.setState({ blocked: blocked ? [...others, contactId] : others });
}

/**
 * The conversation's ⋮ Block Contact / Unblock Contact. F-8: resolves with how its save ended (a macro's "Mute
 * Conversation" waits for it).
 */
export function toggleBlock(convId: number): Promise<KeepOutcome> {
  if (linkedThreadAdapter) {
    return linkedThreadAdapter.toggleBlock(convId);
  }
  const blocked = !useCwStore.getState().muted[convId];
  const contactId = contactIdOf(convId);
  const conversation = baseConversations.find((c) => c.id === convId);
  if (contactId === null || !conversation) {
    toast.error("Not blocked", { description: "This conversation has no contact in Contacts to block." });
    return Promise.resolve({ ok: false, message: "this conversation has no contact in Contacts to block" });
  }
  const viewer = currentViewer();
  const op: Extract<ContactOp, { op: "block" }> = {
    id: simId("op"),
    at: new Date().toISOString(),
    op: "block",
    contactId,
    name: conversation.contact.name,
    blocked,
    base: newestBlock.get(contactId) ?? null,
  };
  setBlocked(contactId, blocked);
  const line: CwMessage = {
    id: `${op.id}-line`,
    kind: "activity",
    text: `${viewer.name} has ${blocked ? "muted" : "unmuted"} the conversation · ${SIMULATED}, the contact was ${blocked ? "blocked" : "unblocked"} in this preview only`,
    time: clock(op.at),
    at: op.at,
  };
  addLines(convId, [line]);
  return saveSim("contactOps", op).then(async (result): Promise<KeepOutcome> => {
    if (result.ok) {
      newestBlock.set(contactId, op.id);
      // Chatwoot mute! also resolves the conversation. F-8: the toast says so only when that was saved too.
      const resolved = blocked ? await changeStatus([convId], "resolved", { quiet: true }) : true;
      toast.success(blocked ? "This contact is blocked successfully" : "This contact is unblocked successfully", {
        description: `${SIMULATED}: saved in this preview's data${blocked ? (resolved ? "; the conversation was resolved" : "; the conversation was not resolved (see the other message)") : ""}. Nothing was changed in the engine.`,
      });
      return resolved
        ? { ok: true }
        : { ok: false, message: "the contact was blocked, but resolving the conversation was not saved" };
    }
    replaceLine(convId, line.id, null);
    setBlocked(contactId, !blocked);
    if (result.conflict) changedElsewhere("This contact's block");
    else notSaved(result.message, blocked ? "block" : "unblock");
    return { ok: false, message: result.message };
  });
}

// ---- after a reload -----------------------------------------------------------------------------------------------

const timeOf = (line: CwMessage): number | null => {
  if (line.at) return Date.parse(line.at);
  // simId: "<prefix>-<Date.now() in base 36>-<random>" (calls, transcripts, new conversations).
  const match = /^(?:call|tr|conv|op|msg|st)-([a-z0-9]+)-/.exec(line.id);
  return match ? Number.parseInt(match[1], 36) : null;
};

/** Puts each thread's preview lines back in the order they happened (each kind is replayed on its own). */
function sortThreads() {
  useCwStore.setState((state) => {
    const sent: typeof state.sent = {};
    for (const [convId, lines] of Object.entries(state.sent)) {
      let last = 0;
      const timed = lines.map((line, index) => {
        last = timeOf(line) ?? last;
        return { line, index, at: last };
      });
      timed.sort((a, b) => a.at - b.at || a.index - b.index);
      sent[Number(convId)] = timed.map((item) => item.line);
    }
    return { sent };
  });
}

if (typeof window !== "undefined") {
  onPreviewSimLoaded((saved) => {
    // After the other replays (sim-actions.ts makes the conversations started in the preview first).
    setTimeout(() => {
      for (const op of saved.contactOps) {
        if (op.op !== "block") continue;
        newestBlock.set(op.contactId, op.id);
        setBlocked(op.contactId, op.blocked);
      }
      const newest = new Map<number, SimStatus>();
      for (const record of saved.statuses) {
        newestStatus.set(record.convId, record.id);
        newest.set(record.convId, record);
        addLines(record.convId, [statusLine(record)]);
      }
      for (const record of newest.values()) applyStatus(record);
      for (const record of saved.messages) addLines(record.convId, [toLine(record)]);
      // F-8: messages deleted before this page loaded.
      if (saved.messageDeletes.length) cw.deleteMessages(saved.messageDeletes);
      sortThreads();
    }, 0);
  });
  window.setInterval(reopenDue, 30_000);
}
