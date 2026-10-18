"use client";

// M129-A (Fahad 129.2): browser side of the simulated buttons' record (/api/preview-sim, see its store.ts). Every
// simulated action is shown at once and saved to the preview server's disk, so it is still there after a reload.
// A save that fails says so ("Not saved in the preview") instead of pretending. Nothing here talks to Chatwoot.
import { toast } from "sonner";
import { create } from "zustand";

import type { Contact as ChatContact } from "@/app/(main)/chat/_components/data";
import type { Contact } from "@/app/(main)/dashboard/contacts/_components/data";

import { LINKED_NO_PREVIEW_WRITE, linkedSession } from "./persistence/client";

const ENDPOINT = "/api/preview-sim";

/** The honest mark every simulated action carries. */
export const SIMULATED = "Preview — simulated";

export interface SimCall {
  id: string;
  convId: number;
  channel: "whatsapp" | "phone";
  outcome: "ended" | "cancelled";
  seconds: number;
  ringSeconds: number;
  at: string;
  /** F-5A: who placed it (the person the page was viewed as); unset on calls saved before. */
  by?: number;
  byName?: string;
}

export type ContactOp =
  // F-3: "Add contact" on /dashboard/contacts also keeps the social links typed in the dialog.
  | { id: string; at: string; op: "add"; contact: Contact; social?: Record<string, string> }
  // F-3 (rule 129.2): Block / Unblock contact on the contact page; `blocked` is the state it was set to.
  // F-5A: from a conversation's ⋮ menu it also names the newest block record of that contact it had read (`base`),
  // so a tab that is out of date cannot undo another tab's block or unblock (409, see api/preview-sim/store.ts).
  | { id: string; at: string; op: "block"; contactId: number; name: string; blocked: boolean; base?: string | null }
  | { id: string; at: string; op: "delete"; profileId: number | null; key: string; convIds: number[] }
  | {
      id: string;
      at: string;
      op: "merge";
      keptId: number | null;
      deletedId: number | null;
      /** contactKeyOf (chat cw-store.ts) of the kept and of the merged-away person. */
      keptKey: string;
      deletedKey: string;
      convIds: number[];
      merged: Partial<ChatContact>;
    };

export interface SimIssue {
  id: string;
  convId: number;
  kind: "created" | "linked";
  key: string;
  title: string;
  description: string;
  team: string;
  priority: string;
  state: string;
  at: string;
}

export interface CopilotEntry {
  id: string;
  convId: number;
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface SimUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  at: string;
}

/** F-1: a conversation made from "New conversation": it joins the inbox list with its first message. */
export interface SimConversation {
  id: string;
  /** The number it got in the inbox list (the next free one when it was made); a reload gives it the same one. */
  convId: number;
  /**
   * A conversation of the person it is addressed to: their name, details and Contacts page come from it. F-3: 0 when
   * the person has no conversation yet ("Send message" on a contact made on the Contacts page): then `contactId` (their
   * Contacts page) and `contact` (their details) name them.
   */
  fromId: number;
  contactId?: number;
  contact?: Pick<ChatContact, "name" | "email" | "phone" | "company" | "location">;
  /** The inbox it was sent through (the id the inbox's conversations use). */
  channel: string;
  subject: string;
  text: string;
  files: string[];
  at: string;
}

/** F-2: a "Send transcript" request: whom it was addressed to (the address is the one shown in the dialog). */
export interface SimTranscript {
  id: string;
  convId: number;
  target: "contact" | "agent" | "other";
  email: string;
  at: string;
}

/** F-5A: a file of a reply or note; its bytes are kept by /api/preview-sim/upload (`uploadId`) when it could be. */
export interface SimAttachment {
  type: "image" | "file" | "audio" | "video";
  name: string;
  size?: string;
  duration?: string;
  mime?: string;
  uploadId?: string;
  /** Why the file's bytes are not kept in the preview (too large, a type Chatwoot does not take, …). */
  notKept?: string;
}

/** F-5A: a reply or a private note written in a conversation. Nothing is delivered to the customer. */
export interface SimMessage {
  id: string;
  convId: number;
  kind: "outgoing" | "note";
  text: string;
  attachments: SimAttachment[];
  /** F-8: deleted (see SimMessageDelete): the server replaced its text with "This message was deleted" and its files. */
  deleted?: true;
  replyTo?: string;
  /** The agent who wrote it (the one the page is viewed as). */
  by: number;
  byName: string;
  at: string;
}

/** F-5A: a conversation status change. `base` = the newest record of this conversation the tab had read (null: none). */
export interface SimStatus {
  id: string;
  convId: number;
  status: "open" | "resolved" | "pending" | "snoozed";
  /** When a snoozed conversation reopens (ISO); null = on the next reply from the customer. */
  snoozedUntil: string | null;
  /** The words the agent picked ("Snoozed until tomorrow"). */
  label: string | null;
  base: string | null;
  by: number;
  byName: string;
  at: string;
}

/**
 * F-8 (sim3: a deleted message came back after a reload): "Delete" on a message of a conversation. The message stays in
 * the thread as "This message was deleted", as Chatwoot does (messages_controller.rb#destroy keeps the message, replaces
 * its content with that text and destroys its attachments). `messageId` is the thread line's id: a sample message's
 * number, or the id of a reply or note kept in the preview (whose text and files the server then replaces too).
 */
export interface SimMessageDelete {
  id: string;
  convId: number;
  messageId: string;
  by: number;
  byName: string;
  at: string;
}

export interface SimData {
  calls: SimCall[];
  contactOps: ContactOp[];
  linearIssues: SimIssue[];
  copilot: CopilotEntry[];
  uploads: SimUpload[];
  conversations: SimConversation[];
  transcripts: SimTranscript[];
  messages: SimMessage[];
  statuses: SimStatus[];
  messageDeletes: SimMessageDelete[];
}
export type SimKey = keyof SimData;
const KEYS: SimKey[] = [
  "calls",
  "contactOps",
  "linearIssues",
  "copilot",
  "uploads",
  "conversations",
  "transcripts",
  "messages",
  "statuses",
  "messageDeletes",
];

interface PreviewSimState extends SimData {
  /** loading: the saved record is not read yet · ready · error: it could not be read (see `error`). */
  status: "loading" | "ready" | "error";
  error: string | null;
}

const empty = (): SimData => ({
  calls: [],
  contactOps: [],
  linearIssues: [],
  copilot: [],
  uploads: [],
  conversations: [],
  transcripts: [],
  messages: [],
  statuses: [],
  messageDeletes: [],
});

export const usePreviewSim = create<PreviewSimState>(() => ({ status: "loading", error: null, ...empty() }));

/** A new id for a simulated item: `call-…`, `op-…`, `lin-…`, `cop-…`, `conv-…`, `tr-…`, `msg-…`, `st-…`, `del-…`. */
export function simId(prefix: "call" | "op" | "lin" | "cop" | "conv" | "tr" | "msg" | "st" | "del"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Items recorded on this page. The saved copy read at load is replayed without them (they are applied already).
const recordedHere = new Set<string>();
let savedAtLoad: SimData | null = null;
const listeners: ((saved: SimData) => void)[] = [];

/**
 * Runs `apply` once with what was saved before this page loaded (or right away if that is known already), so a
 * store can replay it on top of its sample data: contacts added, deleted or merged, call lines, …
 */
export function onPreviewSimLoaded(apply: (saved: SimData) => void): void {
  // U-2 condition 4: in linked mode the preview's record is not replayed over the linked data (the page reloads when it
  // goes back to preview, so it is replayed then).
  if (savedAtLoad && !linkedSession()) apply(savedAtLoad);
  else if (!savedAtLoad) listeners.push(apply);
}

async function reason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return `${response.status} ${body?.error ?? response.statusText}`;
}

/** Shows `item` at once and saves it. Resolves false (with an error toast) when the preview could not save it. */
export async function recordSim<K extends SimKey>(key: K, item: SimData[K][number]): Promise<boolean> {
  const result = await saveSim(key, item);
  if (result.ok) return true;
  console.error(`[preview-sim] ${key} not saved: ${result.message}`);
  toast.error("Not saved in the preview", {
    description: `${result.message}. This change shows on this page only and will be gone after a reload.`,
    duration: Number.POSITIVE_INFINITY,
  });
  return false;
}

export type SimSaveResult =
  | { ok: true }
  /** conflict: 409, another tab or device saved a newer record first (`current`); nothing was written. */
  | { ok: false; conflict: true; message: string; current: unknown }
  | { ok: false; conflict: false; message: string };

/**
 * F-5A: like recordSim (the item shows at once, then is saved) but says how it went instead of showing a toast, so the
 * caller can tell a 409 (changed in another tab or device: nothing was written) from any other failure.
 */
export async function saveSim<K extends SimKey>(key: K, item: SimData[K][number]): Promise<SimSaveResult> {
  // U-2 condition 4: nothing is written to the preview's record while Chatwoot is linked.
  if (linkedSession()) return { ok: false, conflict: false, message: LINKED_NO_PREVIEW_WRITE };
  recordedHere.add(item.id);
  usePreviewSim.setState(
    (state) =>
      ({
        [key]: [...(state[key] as { id: string }[]).filter((x) => x.id !== item.id), item],
      }) as Partial<PreviewSimState>,
  );
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, item }),
    });
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as { error?: string; current?: unknown } | null;
      // Not kept: it leaves this page's copy of the record too.
      usePreviewSim.setState(
        (state) =>
          ({ [key]: (state[key] as { id: string }[]).filter((x) => x.id !== item.id) }) as Partial<PreviewSimState>,
      );
      return {
        ok: false,
        conflict: true,
        message: `409 ${body?.error ?? "changed elsewhere"}`,
        current: body?.current,
      };
    }
    if (!response.ok) throw new Error(await reason(response));
    return { ok: true };
  } catch (error) {
    return { ok: false, conflict: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Shows an item the server already saved (e.g. an upload, saved by its own route) without saving it again. */
export function addSavedSim<K extends SimKey>(key: K, item: SimData[K][number]): void {
  recordedHere.add(item.id);
  usePreviewSim.setState((state) => ({ [key]: [...state[key], item] }) as Partial<PreviewSimState>);
}

async function load() {
  let saved = empty();
  try {
    const response = await fetch(ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(await reason(response));
    const body = (await response.json()) as { data?: Partial<SimData> };
    for (const key of KEYS) {
      const list = (body.data?.[key] ?? []) as SimData[typeof key];
      (saved[key] as unknown[]) = list.filter((item) => !recordedHere.has(item.id));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[preview-sim] saved record not loaded: ${message}`);
    saved = empty();
    usePreviewSim.setState({ status: "error", error: message });
  }
  savedAtLoad = saved;
  // Stores replay the saved record before the pages are told it is ready. U-2: not in linked mode (see above).
  for (const apply of linkedSession() ? [] : listeners.splice(0)) {
    try {
      apply(saved);
    } catch (error) {
      console.error("[preview-sim] replay failed", error);
    }
  }
  if (usePreviewSim.getState().status === "error") return;
  usePreviewSim.setState((state) => {
    const next: Partial<PreviewSimState> = { status: "ready", error: null };
    for (const key of KEYS) {
      const here = (state[key] as { id: string }[]).filter((item) => recordedHere.has(item.id));
      (next as Record<string, unknown>)[key] = [...saved[key], ...here];
    }
    return next;
  });
}

if (typeof window !== "undefined") void load();

/** True once the saved record was read (or could not be read): pages can stop waiting for it. */
export function usePreviewSimSettled(): boolean {
  return usePreviewSim((state) => state.status !== "loading");
}
