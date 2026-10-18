// M129-A (Fahad 129.2: "make a simulation so the buttons work and show how they connect" instead of buttons disabled
// "after linking"): the preview's own record of what the simulated buttons did, saved as one JSON file on the preview
// machine's disk so it survives reloads and server restarts. Preview only: nothing here reaches Chatwoot, a phone
// network, Linear or an AI engine.
//
// Keys (each an append-only list, newest last):
// - calls: simulated calls placed from a conversation (the line they leave in the thread).
// - contactOps: contacts created by Save Contact, deleted or merged from a conversation, replayed in order on load.
//   F-3: also contacts created by "Add contact" on /dashboard/contacts (with their social links), and Block / Unblock
//   contact (`op: "block"`, the state it was set to), so they are still there after a reload (rule 129.2).
// - linearIssues: sample Linear issues created or linked from a conversation.
// - copilot: the Copilot questions asked in a conversation and the ready-made sample answers given.
// - uploads: files uploaded in the macro editor (the bytes are kept in UPLOAD_DIR, see ./upload/route.ts).
// - conversations: conversations made from "New conversation" (F-1), with their first message, replayed on load.
//   F-3: also to a person with no conversation yet ("Send message" on their Contacts page): fromId 0, contactId, contact.
// - transcripts: "Send transcript" requests (F-2): who it was addressed to and when, shown as a line in the thread.
//   No email is sent; the line and the dialog say so.
// - messages (F-5A, sim1 problem 3): replies and private notes written in a conversation, with their attachments (the
//   bytes are kept by ./upload/route.ts, the message keeps their upload ids). Nothing is delivered to the customer.
// - statuses (F-5A, sim1 problem 2): Resolve, Snooze (with the time it reopens), Reopen and Mark as pending, one record
//   per conversation and change. Each record names the record it replaces (`base`, the newest one the tab had read for
//   that conversation, null for none): when another tab or device changed that conversation's status in between, the
//   save is refused with 409 and nothing is written, as the lists and sections are since F-3 (rule 129.2, item 3).
//   contactOps `block` from a conversation carries the same `base` (the newest block record of that contact).
// - messageDeletes (F-8, sim3: "Message deleted successfully" with no request, and the message came back after a
//   reload): "Delete" on a message. The message stays in the thread as "This message was deleted", as Chatwoot's
//   messages_controller.rb#destroy does (content replaced by conversations.messages.deleted, content_attributes
//   deleted: true, attachments destroyed: https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/controllers/api/v1/accounts/conversations/messages_controller.rb).
//   When the deleted message is a reply or note kept here (`messages`), its text and files are replaced the same way in
//   the same write, and its kept file copies are removed (the route deletes their bytes).
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const SIM_FILE = path.join(process.cwd(), ".preview-state", "preview-sim.json");
export const UPLOAD_DIR = path.join(process.cwd(), ".preview-state", "preview-sim-uploads");
export const MAX_SIM_BYTES = 2_000_000;
const MAX_ITEMS = 500;

export const SIM_KEYS = [
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
] as const;
export type SimKey = (typeof SIM_KEYS)[number];
export type SimItem = Record<string, unknown>;
export type SimData = Record<SimKey, SimItem[]>;

export interface SimState {
  version: 1;
  savedAt: string | null;
  data: SimData;
}

export class InvalidSimItem extends Error {}

/** F-5A: the record a save was based on is no longer the newest one (another tab or device saved in between). */
export class SimConflict extends Error {
  constructor(
    message: string,
    readonly current: SimItem | null,
  ) {
    super(message);
  }
}

const emptyData = (): SimData => ({
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

export const isSimKey = (value: unknown): value is SimKey =>
  typeof value === "string" && (SIM_KEYS as readonly string[]).includes(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number, at: string, allowEmpty = true) => {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim()))
    throw new InvalidSimItem(`${at} must be text of at most ${max} characters`);
};
const whole = (value: unknown, min: number, max: number, at: string) => {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max)
    throw new InvalidSimItem(`${at} must be a whole number from ${min} to ${max}`);
};
const oneOf = (value: unknown, options: readonly string[], at: string) => {
  if (typeof value !== "string" || !options.includes(value))
    throw new InvalidSimItem(`${at} must be one of ${options.join(", ")}`);
};
const idOf = (value: unknown, prefix: string, at: string) => {
  if (typeof value !== "string" || !new RegExp(`^${prefix}-[a-z0-9-]{4,40}$`).test(value))
    throw new InvalidSimItem(`${at} is not ${/^[aeiou]/.test(prefix) ? "an" : "a"} ${prefix} id`);
};
const isoTime = (value: unknown, at: string) => {
  if (typeof value !== "string" || value.length > 40 || Number.isNaN(Date.parse(value)))
    throw new InvalidSimItem(`${at} must be an ISO time`);
};
const ids = (value: unknown, at: string) => {
  if (!Array.isArray(value) || value.length > 200 || value.some((v) => !Number.isInteger(v)))
    throw new InvalidSimItem(`${at} must be a list of whole numbers`);
};

const CONTACT_TEXT_FIELDS = [
  "name",
  "email",
  "phone",
  "company",
  "city",
  "country",
  "bio",
  "lastActivity",
  "createdAt",
];
const CHAT_CONTACT_FIELDS = ["name", "role", "company", "email", "phone", "website", "location", "timezone", "status"];

function validateContact(value: unknown, at: string) {
  if (!isObject(value)) throw new InvalidSimItem(`${at} must be an object`);
  whole(value.id, 1, 10_000_000, `${at}.id`);
  for (const field of CONTACT_TEXT_FIELDS) text(value[field], 2000, `${at}.${field}`);
  text(value.name, 200, `${at}.name`, false);
  if (typeof value.lastActivityMinutes !== "number") throw new InvalidSimItem(`${at}.lastActivityMinutes is missing`);
  if (!Array.isArray(value.labels) || value.labels.some((l) => typeof l !== "string"))
    throw new InvalidSimItem(`${at}.labels must be a list of text`);
}

function validateChatContact(value: unknown, at: string) {
  if (!isObject(value)) throw new InvalidSimItem(`${at} must be an object`);
  for (const field of CHAT_CONTACT_FIELDS) if (field in value) text(value[field], 2000, `${at}.${field}`);
}

const validators: Record<SimKey, (item: Record<string, unknown>) => void> = {
  calls(item) {
    idOf(item.id, "call", "call.id");
    whole(item.convId, 1, 10_000_000, "call.convId");
    oneOf(item.channel, ["whatsapp", "phone"], "call.channel");
    oneOf(item.outcome, ["ended", "cancelled"], "call.outcome");
    whole(item.seconds, 0, 86_400, "call.seconds");
    whole(item.ringSeconds, 0, 3_600, "call.ringSeconds");
    isoTime(item.at, "call.at");
  },
  contactOps(item) {
    idOf(item.id, "op", "contactOp.id");
    isoTime(item.at, "contactOp.at");
    oneOf(item.op, ["add", "delete", "merge", "block"], "contactOp.op");
    if (item.op === "add") {
      validateContact(item.contact, "contactOp.contact");
      if (item.social !== undefined) {
        if (!isObject(item.social)) throw new InvalidSimItem("contactOp.social must be an object");
        for (const [key, value] of Object.entries(item.social)) text(value, 2000, `contactOp.social.${key}`);
      }
    }
    if (item.op === "block") {
      whole(item.contactId, 1, 10_000_000, "contactOp.contactId");
      text(item.name, 200, "contactOp.name");
      if (typeof item.blocked !== "boolean") throw new InvalidSimItem("contactOp.blocked must be true or false");
      // F-5A: a block made from a conversation names the newest block record of that contact it had read.
      if ("base" in item && item.base !== null) idOf(item.base, "op", "contactOp.base");
    }
    if (item.op === "delete") {
      if (item.profileId !== null) whole(item.profileId, 1, 10_000_000, "contactOp.profileId");
      text(item.key, 400, "contactOp.key", false);
      ids(item.convIds, "contactOp.convIds");
    }
    if (item.op === "merge") {
      if (item.keptId !== null) whole(item.keptId, 1, 10_000_000, "contactOp.keptId");
      if (item.deletedId !== null) whole(item.deletedId, 1, 10_000_000, "contactOp.deletedId");
      text(item.keptKey, 400, "contactOp.keptKey", false);
      text(item.deletedKey, 400, "contactOp.deletedKey", false);
      ids(item.convIds, "contactOp.convIds");
      validateChatContact(item.merged, "contactOp.merged");
    }
  },
  linearIssues(item) {
    idOf(item.id, "lin", "issue.id");
    whole(item.convId, 1, 10_000_000, "issue.convId");
    oneOf(item.kind, ["created", "linked"], "issue.kind");
    text(item.key, 20, "issue.key", false);
    text(item.title, 300, "issue.title", false);
    text(item.description, 5000, "issue.description");
    text(item.team, 100, "issue.team");
    text(item.priority, 40, "issue.priority");
    text(item.state, 40, "issue.state");
    isoTime(item.at, "issue.at");
  },
  copilot(item) {
    idOf(item.id, "cop", "copilot.id");
    whole(item.convId, 1, 10_000_000, "copilot.convId");
    oneOf(item.role, ["user", "assistant"], "copilot.role");
    text(item.text, 4000, "copilot.text", false);
    isoTime(item.at, "copilot.at");
  },
  uploads(item) {
    idOf(item.id, "up", "upload.id");
    text(item.name, 255, "upload.name", false);
    whole(item.size, 0, 50 * 1024 * 1024, "upload.size");
    text(item.type, 150, "upload.type");
    isoTime(item.at, "upload.at");
  },
  conversations(item) {
    idOf(item.id, "conv", "conversation.id");
    whole(item.convId, 1, 10_000_000, "conversation.convId");
    // F-3: fromId 0 = a person with no conversation yet (made on the Contacts page): their Contacts id and details.
    if (item.fromId === 0) {
      whole(item.contactId, 1, 10_000_000, "conversation.contactId");
      validateChatContact(item.contact, "conversation.contact");
      text((item.contact as Record<string, unknown>).name, 200, "conversation.contact.name", false);
    } else whole(item.fromId, 1, 10_000_000, "conversation.fromId");
    text(item.channel, 60, "conversation.channel", false);
    text(item.subject, 300, "conversation.subject");
    text(item.text, 10_000, "conversation.text", false);
    if (
      !Array.isArray(item.files) ||
      item.files.length > 20 ||
      item.files.some((f) => typeof f !== "string" || f.length > 255)
    )
      throw new InvalidSimItem("conversation.files must be a list of at most 20 file names");
    isoTime(item.at, "conversation.at");
  },
  transcripts(item) {
    idOf(item.id, "tr", "transcript.id");
    whole(item.convId, 1, 10_000_000, "transcript.convId");
    oneOf(item.target, ["contact", "agent", "other"], "transcript.target");
    text(item.email, 320, "transcript.email", false);
    isoTime(item.at, "transcript.at");
  },
  // F-5A: a reply or a private note. Text, or at least one attachment.
  messages(item) {
    idOf(item.id, "msg", "message.id");
    whole(item.convId, 1, 10_000_000, "message.convId");
    oneOf(item.kind, ["outgoing", "note"], "message.kind");
    text(item.text, MAX_MESSAGE_CHARS, "message.text");
    if (!Array.isArray(item.attachments) || item.attachments.length > 20)
      throw new InvalidSimItem("message.attachments must be a list of at most 20 files");
    item.attachments.forEach((file, index) => {
      const at = `message.attachments[${index}]`;
      if (!isObject(file)) throw new InvalidSimItem(`${at} must be an object`);
      oneOf(file.type, ["image", "file", "audio", "video"], `${at}.type`);
      text(file.name, 255, `${at}.name`, false);
      for (const field of ["size", "duration", "mime", "notKept"] as const)
        if (file[field] !== undefined) text(file[field], field === "notKept" ? 300 : 150, `${at}.${field}`);
      if (file.uploadId !== undefined) idOf(file.uploadId, "up", `${at}.uploadId`);
    });
    if (!(item.text as string).trim() && item.attachments.length === 0)
      throw new InvalidSimItem("message needs text or an attachment");
    if (item.replyTo !== undefined) text(item.replyTo, 2000, "message.replyTo");
    if (item.deleted !== undefined && item.deleted !== true) throw new InvalidSimItem("message.deleted must be true");
    // F-19: a reply of the simulated bot (chat/_components/bot-reply-sim.tsx) is written by "Bot", agent id 0.
    const bot = item.kind === "outgoing" && item.by === 0 && item.byName === "Bot";
    if (!bot) whole(item.by, 1, 10_000_000, "message.by");
    text(item.byName, 200, "message.byName", false);
    isoTime(item.at, "message.at");
  },
  // F-5A: a conversation status change (Chatwoot Conversation status enum: open, resolved, pending, snoozed).
  statuses(item) {
    idOf(item.id, "st", "status.id");
    whole(item.convId, 1, 10_000_000, "status.convId");
    oneOf(item.status, ["open", "resolved", "pending", "snoozed"], "status.status");
    if (item.snoozedUntil !== null) isoTime(item.snoozedUntil, "status.snoozedUntil");
    if (item.status !== "snoozed" && item.snoozedUntil !== null)
      throw new InvalidSimItem("status.snoozedUntil is only for a snoozed conversation");
    if (item.label !== null) text(item.label, 120, "status.label");
    if (item.base !== null) idOf(item.base, "st", "status.base");
    whole(item.by, 1, 10_000_000, "status.by");
    text(item.byName, 200, "status.byName", false);
    isoTime(item.at, "status.at");
  },
  // F-8: a deleted message (see the top of this file). The thread line's id: letters, digits, "-", "_" and ":".
  messageDeletes(item) {
    idOf(item.id, "del", "messageDelete.id");
    whole(item.convId, 1, 10_000_000, "messageDelete.convId");
    if (typeof item.messageId !== "string" || !/^[A-Za-z0-9:_-]{1,120}$/.test(item.messageId))
      throw new InvalidSimItem("messageDelete.messageId is not a message id");
    whole(item.by, 1, 10_000_000, "messageDelete.by");
    text(item.byName, 200, "messageDelete.byName", false);
    isoTime(item.at, "messageDelete.at");
  },
};

/** F-8: Chatwoot's text for a deleted message (config/locales/en.yml conversations.messages.deleted). */
export const DELETED_MESSAGE_TEXT = "This message was deleted";

/**
 * F-8: a delete of a reply or note kept here replaces that message's text and files, as Chatwoot does, and drops the
 * upload records of its files. Returns the upload ids whose bytes the caller removes.
 */
function blankDeletedMessage(state: SimState, item: SimItem): string[] {
  const index = state.data.messages.findIndex((row) => row.id === item.messageId && row.convId === item.convId);
  if (index < 0) return [];
  const message = state.data.messages[index];
  const uploads = (Array.isArray(message.attachments) ? message.attachments : [])
    .map((file) => (isObject(file) && typeof file.uploadId === "string" ? file.uploadId : null))
    .filter((id): id is string => !!id);
  state.data.messages[index] = { ...message, text: DELETED_MESSAGE_TEXT, attachments: [], deleted: true };
  state.data.uploads = state.data.uploads.filter((row) => !uploads.includes(row.id as string));
  return uploads;
}

/** F-5A: the longest reply or note text kept (the POST body itself is limited to 40,000 characters in ./route.ts). */
export const MAX_MESSAGE_CHARS = 15_000;

/**
 * F-5A: the newest record a status change or a conversation's block must name as its `base`: the last status record of
 * that conversation, or the last block record of that contact. Null when there is none yet.
 */
function newestOf(state: SimState, key: SimKey, item: SimItem): SimItem | null {
  if (key === "statuses") return state.data.statuses.findLast((row) => row.convId === item.convId) ?? null;
  if (key === "contactOps" && item.op === "block" && "base" in item)
    return state.data.contactOps.findLast((row) => row.op === "block" && row.contactId === item.contactId) ?? null;
  return null;
}

function checkBase(state: SimState, key: SimKey, item: SimItem) {
  const checked = key === "statuses" || (key === "contactOps" && item.op === "block" && "base" in item);
  if (!checked) return;
  const newest = newestOf(state, key, item);
  if ((newest?.id ?? null) !== item.base)
    throw new SimConflict(
      key === "statuses"
        ? `conversation #${String(item.convId)} status was changed in another tab or device`
        : `contact #${String(item.contactId)} was blocked or unblocked in another tab or device`,
      newest,
    );
}

export function validateSimItem(key: SimKey, item: unknown): SimItem {
  if (!isObject(item)) throw new InvalidSimItem(`${key} item must be an object`);
  validators[key](item);
  return item;
}

/** Nothing saved yet reads as empty lists. A corrupt file throws instead of silently resetting. */
export async function readSimState(file = SIM_FILE): Promise<SimState> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, savedAt: null, data: emptyData() };
    throw error;
  }
  const parsed = JSON.parse(raw) as Partial<SimState>;
  if (parsed.version !== 1 || !isObject(parsed.data)) throw new Error("unsupported preview-sim file");
  const data = emptyData();
  for (const key of SIM_KEYS) {
    const list = (parsed.data as Record<string, unknown>)[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw new Error(`${key} is damaged`);
    data[key] = list as SimItem[];
  }
  return { version: 1, savedAt: parsed.savedAt ?? null, data };
}

// One read-modify-write at a time (one preview server process).
let writing: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = writing.then(task, task);
  writing = run.catch(() => undefined);
  return run;
}

async function writeSimState(state: SimState, file = SIM_FILE) {
  const body = JSON.stringify(state);
  if (Buffer.byteLength(body) > MAX_SIM_BYTES) throw new InvalidSimItem("preview simulation record is full");
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, body);
  await rename(temp, file);
}

/**
 * Appends one checked item to `key`; an item with the same id is replaced instead of added twice.
 * F-8: `removedUploads` = the upload ids a message delete dropped (their bytes are the caller's to remove).
 */
export function appendSimItem(
  key: SimKey,
  item: unknown,
  file = SIM_FILE,
): Promise<SimState & { removedUploads: string[] }> {
  const valid = validateSimItem(key, item);
  return serial(async () => {
    const state = await readSimState(file);
    // F-5A: the same item sent again (a retried save) is not a conflict with itself.
    if (!state.data[key].some((existing) => existing.id === valid.id)) checkBase(state, key, valid);
    const list = state.data[key].filter((existing) => existing.id !== valid.id);
    if (list.length >= MAX_ITEMS) throw new InvalidSimItem(`${key} already has ${MAX_ITEMS} items`);
    state.data[key] = [...list, valid];
    const removedUploads = key === "messageDeletes" ? blankDeletedMessage(state, valid) : [];
    state.savedAt = new Date().toISOString();
    await writeSimState(state, file);
    return { ...state, removedUploads };
  });
}

/** Removes one item by id (used by the checks that clean up after themselves). Returns the removed item. */
export function removeSimItem(key: SimKey, id: string, file = SIM_FILE): Promise<SimItem | null> {
  return serial(async () => {
    const state = await readSimState(file);
    const removed = state.data[key].find((item) => item.id === id) ?? null;
    if (!removed) return null;
    state.data[key] = state.data[key].filter((item) => item.id !== id);
    state.savedAt = new Date().toISOString();
    await writeSimState(state, file);
    return removed;
  });
}
