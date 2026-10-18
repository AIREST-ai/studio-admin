// T-68 preview persistence (server only): the shared Studio lists saved as one JSON file on the preview machine's disk.
// Survives page reloads and server restarts. Preview only: one file, no accounts, no per-user data, last write wins.
// T-109: the same file also holds named "sections" (folders today) beside `lists`. A section is saved on its own, with
// a revision number: a save based on an older revision is refused (conflict) instead of silently dropping the newer
// copy. Files written before T-109 have no `sections` and still load; their sections read as "never saved".
// To add a section (e.g. T-96 lifecycle): add its validator to PREVIEW_SECTIONS. Do not add keys to PREVIEW_LIST_KEYS.
// F-3 (Fahad 99, no false success): the lists have a revision too (`listsRev`), so an old page still open in another
// tab cannot save its whole copy of the lists over newer ones and bring deleted labels, teams or templates back. A lists
// save names the revision it was based on; a different revision on disk (or none named, from a page loaded before this
// check) is refused with a conflict and nothing is written.
// F-6B (Fahad 129.2, sim2 problem 6): one revision for all seven lists made any change to one list (a label) refuse a
// save of another (a new inbox) with 409. Each list now has its own revision (`listRevs`) and a page sends only the
// lists it changed, each with the revision it was based on (writePreviewLists). A save is refused, with nothing written,
// only when a list it sends was saved elsewhere since, so an old copy of that list still cannot bring deleted rows back.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Must match `CwLists` in ../store.ts. */
export const PREVIEW_LIST_KEYS = [
  "agents",
  "inboxes",
  "teams",
  "labels",
  "cannedResponses",
  "macros",
  "whatsappTemplates",
] as const;

export type PreviewListKey = (typeof PREVIEW_LIST_KEYS)[number];
export type PreviewLists = Record<PreviewListKey, Record<string, unknown>[]>;
/** F-6B: each list's own revision; 0 until that list is saved with one. */
export type PreviewListRevs = Record<PreviewListKey, number>;

export interface PreviewSection {
  /** 1 on the first save, +1 on every save. A section never saved has revision 0. */
  rev: number;
  savedAt: string;
  items: Record<string, unknown>[];
}

export interface PreviewState {
  version: 1;
  savedAt: string;
  /** `null` when only a section was saved so far: the lists keep their seed data. */
  lists: PreviewLists | null;
  /** F-3: 0 until the lists are saved with a revision (files written before F-3 too), +1 on every lists save. */
  listsRev: number;
  /** F-6B: +1 for a list each time a save changes it (files written before F-6B read 0 for every list). */
  listRevs: PreviewListRevs;
  sections: Record<string, PreviewSection>;
}

export const MAX_PREVIEW_STATE_BYTES = 2_000_000;

/** Bad input from the caller (shape or size); anything else thrown here is a disk/server fault. */
export class InvalidPreviewState extends Error {}

/** The section was saved by another tab or device after the caller loaded it. */
export class PreviewConflict extends Error {
  constructor(
    // F-6B: a lists conflict also names the lists (`conflicts`) and carries their saved copy and revisions.
    readonly current: { rev: number; savedAt: string | null; [extra: string]: unknown },
    message = "saved from another tab or device since this page loaded it",
  ) {
    super(message);
  }
}

export const DEFAULT_PREVIEW_STATE_FILE = path.join(process.cwd(), ".preview-state", "studio-preview-state.json");

/** Throws with a readable reason unless `value` has exactly the known lists, each an array of objects. */
export function validatePreviewLists(value: unknown): PreviewLists {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InvalidPreviewState("lists must be an object");
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).filter((key) => !(PREVIEW_LIST_KEYS as readonly string[]).includes(key));
  if (extra.length) throw new InvalidPreviewState(`unknown lists: ${extra.join(", ")}`);
  for (const key of PREVIEW_LIST_KEYS) {
    const list = record[key];
    if (!Array.isArray(list)) throw new InvalidPreviewState(`${key} must be an array`);
    if (list.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
      throw new InvalidPreviewState(`${key} must contain objects only`);
    }
  }
  return record as PreviewLists;
}

/** F-6B: some of the lists (at least one), each an array of objects; the lists not named are left as they are. */
export function validatePartialLists(value: unknown): Partial<PreviewLists> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InvalidPreviewState("lists must be an object");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const extra = keys.filter((key) => !(PREVIEW_LIST_KEYS as readonly string[]).includes(key));
  if (extra.length) throw new InvalidPreviewState(`unknown lists: ${extra.join(", ")}`);
  if (!keys.length) throw new InvalidPreviewState("no list to save");
  for (const key of keys) {
    const list = record[key];
    if (!Array.isArray(list)) throw new InvalidPreviewState(`${key} must be an array`);
    if (list.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
      throw new InvalidPreviewState(`${key} must contain objects only`);
    }
  }
  return record as Partial<PreviewLists>;
}

const zeroRevs = (): PreviewListRevs => Object.fromEntries(PREVIEW_LIST_KEYS.map((key) => [key, 0])) as PreviewListRevs;

function readListRevs(value: unknown): PreviewListRevs {
  const revs = zeroRevs();
  if (!value || typeof value !== "object" || Array.isArray(value)) return revs; // written before F-6B
  for (const key of PREVIEW_LIST_KEYS) {
    const rev = (value as Record<string, unknown>)[key];
    if (Number.isInteger(rev) && (rev as number) >= 0) revs[key] = rev as number;
  }
  return revs;
}

/** F-6B: the revisions after `next` replaces `before`: +1 for each list whose content changed. */
function bumpChanged(revs: PreviewListRevs, before: PreviewLists | null, next: Partial<PreviewLists>): PreviewListRevs {
  const out = { ...revs };
  for (const key of Object.keys(next) as PreviewListKey[]) {
    if (!before || JSON.stringify(before[key]) !== JSON.stringify(next[key])) out[key] += 1;
  }
  return out;
}

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

/** Folders (Chatwoot custom views, chat/_components/cw-data.ts `Folder`): id, name and the filter rows. */
function validateFolders(items: unknown[]): Record<string, unknown>[] {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const at = `folders[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new InvalidPreviewState(`${at} must be an object`);
    const { id, name, filters } = item as Record<string, unknown>;
    // folders/[id]/page.tsx only opens ids of this shape
    if (typeof id !== "string" || !/^f-[a-z0-9]+$/.test(id))
      throw new InvalidPreviewState(`${at}.id is not a folder id`);
    if (ids.has(id)) throw new InvalidPreviewState(`${at}.id ${id} is used twice`);
    ids.add(id);
    if (!isText(name, 200) || !name.trim()) throw new InvalidPreviewState(`${at}.name must be 1-200 characters`);
    if (!Array.isArray(filters)) throw new InvalidPreviewState(`${at}.filters must be an array`);
    filters.forEach((row, rowIndex) => {
      const r = row as Record<string, unknown> | null;
      const ok =
        r &&
        typeof r === "object" &&
        !Array.isArray(r) &&
        isText(r.attribute, 100) &&
        isText(r.operator, 100) &&
        isText(r.value, 1000) &&
        (r.join === "and" || r.join === "or");
      if (!ok) throw new InvalidPreviewState(`${at}.filters[${rowIndex}] must have attribute, operator, value, join`);
    });
  });
  return items as Record<string, unknown>[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isTextList = (value: unknown) => Array.isArray(value) && value.every((item) => isText(item, 10_000));

/**
 * T-139 Automation (settings/automation/_flow/model.ts AutomationItem): the rules the list and the text form edit,
 * `{ kind: "rule", rule }`, and the visual editor's flows, `{ kind: "flow", flow }`. Only the shape is checked;
 * fields this check does not name are kept as they are, so nothing a newer form adds is dropped.
 */
function validateAutomation(items: unknown[]): Record<string, unknown>[] {
  const ruleIds = new Set<number>();
  const flowIds = new Set<string>();
  items.forEach((item, index) => {
    const at = `automation[${index}]`;
    if (!isObject(item)) throw new InvalidPreviewState(`${at} must be an object`);
    if (item.kind === "rule") {
      const rule = item.rule;
      if (!isObject(rule)) throw new InvalidPreviewState(`${at}.rule must be an object`);
      if (!Number.isSafeInteger(rule.id)) throw new InvalidPreviewState(`${at}.rule.id must be a whole number`);
      if (ruleIds.has(rule.id as number)) throw new InvalidPreviewState(`${at}.rule.id ${rule.id} is used twice`);
      ruleIds.add(rule.id as number);
      const ok =
        isText(rule.name, 1000) &&
        isText(rule.description, 5000) &&
        typeof rule.active === "boolean" &&
        isText(rule.createdOn, 100) &&
        (rule.runType === "instant" || rule.runType === "delayed") &&
        isText(rule.event, 100);
      if (!ok)
        throw new InvalidPreviewState(`${at}.rule needs name, description, active, createdOn, runType and event`);
      const conditions = rule.conditions;
      if (
        !Array.isArray(conditions) ||
        !conditions.every(
          (c) =>
            isObject(c) &&
            isText(c.attribute, 200) &&
            isText(c.operator, 100) &&
            isTextList(c.values) &&
            (c.join === "and" || c.join === "or"),
        )
      )
        throw new InvalidPreviewState(`${at}.rule.conditions must be rows of attribute, operator, values, join`);
      const actions = rule.actions;
      if (
        !Array.isArray(actions) ||
        !actions.every(
          (a) =>
            isObject(a) &&
            isText(a.action, 100) &&
            isTextList(a.values) &&
            (a.message === undefined || isText(a.message, 10_000)),
        )
      )
        throw new InvalidPreviewState(`${at}.rule.actions must be rows of action and values`);
      const wait = rule.wait;
      if (
        wait !== undefined &&
        !(
          isObject(wait) &&
          isText(wait.trigger, 100) &&
          isText(wait.status, 100) &&
          typeof wait.amount === "number" &&
          Number.isFinite(wait.amount) &&
          (wait.unit === "minutes" || wait.unit === "hours" || wait.unit === "days") &&
          isTextList(wait.inboxes)
        )
      )
        throw new InvalidPreviewState(`${at}.rule.wait must have trigger, status, amount, unit, inboxes`);
      return;
    }
    if (item.kind === "flow") {
      const flow = item.flow;
      if (!isObject(flow)) throw new InvalidPreviewState(`${at}.flow must be an object`);
      if (typeof flow.id !== "string" || !/^flow-[a-z0-9]+$/.test(flow.id))
        throw new InvalidPreviewState(`${at}.flow.id is not a flow id`);
      if (flowIds.has(flow.id)) throw new InvalidPreviewState(`${at}.flow.id ${flow.id} is used twice`);
      flowIds.add(flow.id);
      if (!isText(flow.name, 1000) || !isText(flow.description, 5000))
        throw new InvalidPreviewState(`${at}.flow needs name and description`);
      if (!isText(flow.createdAt, 100) || !isText(flow.updatedAt, 100))
        throw new InvalidPreviewState(`${at}.flow needs createdAt and updatedAt`);
      if (flow.approvedAt !== null && !isText(flow.approvedAt, 100))
        throw new InvalidPreviewState(`${at}.flow.approvedAt must be a date or null`);
      if (!isObject(flow.ruleIds) || !Object.values(flow.ruleIds).every((id) => Number.isSafeInteger(id)))
        throw new InvalidPreviewState(`${at}.flow.ruleIds must map paths to rule ids`);
      const doc = flow.doc;
      const nodesOk =
        isObject(doc) &&
        Array.isArray(doc.nodes) &&
        doc.nodes.every(
          (n) =>
            isObject(n) &&
            isText(n.id, 100) &&
            // M129-B: the Studio simulator's steps (automation/_flow/model.ts SIM_KINDS) join the four Chatwoot ones
            ["trigger", "wait", "condition", "action", "ask", "delay", "split", "http", "goto"].includes(
              n.kind as string,
            ) &&
            isObject(n.position) &&
            Number.isFinite(n.position.x) &&
            Number.isFinite(n.position.y),
        );
      if (!nodesOk) throw new InvalidPreviewState(`${at}.flow.doc.nodes must be steps with id, kind and position`);
      const edgesOk =
        isObject(doc) &&
        Array.isArray(doc.edges) &&
        doc.edges.every(
          (e) =>
            isObject(e) &&
            isText(e.id, 200) &&
            isText(e.source, 100) &&
            isText(e.target, 100) &&
            // M129-B: Ask (replied / noreply), Random split (a / b) and HTTP request (success / failure) exits
            ["out", "yes", "no", "replied", "noreply", "a", "b", "success", "failure"].includes(e.handle as string),
        );
      if (!edgesOk) throw new InvalidPreviewState(`${at}.flow.doc.edges must be lines with source, handle, target`);
      return;
    }
    throw new InvalidPreviewState(`${at}.kind must be "rule" or "flow"`);
  });
  return items as Record<string, unknown>[];
}

/**
 * T-141 «مسار العميل» (lib/cw/customer-path.ts): the stages added in Settings, `{ kind: "stage", id, name, color }`
 * (the six starting stages live in code, so they are not saved), and each contact's stage,
 * `{ kind: "assignment", key, stageId }`. respond.io Lifecycle: up to 20 stages in total, so 14 added.
 * F-9: also `{ kind: "edit", id, name, color }` (a starting stage renamed or recoloured) and one
 * `{ kind: "order", ids }` (the order of all stages).
 */
function validateCustomerPath(items: unknown[]): Record<string, unknown>[] {
  const stageIds = new Set<string>();
  const keys = new Set<string>();
  const edited = new Set<string>();
  let orders = 0;
  items.forEach((item, index) => {
    const at = `customerPath[${index}]`;
    if (!isObject(item)) throw new InvalidPreviewState(`${at} must be an object`);
    // F-9: a starting stage's new name and colour, and the order of all stages (lib/cw/customer-path.ts).
    if (item.kind === "edit") {
      if (typeof item.id !== "string" || !/^[a-z][a-z-]{0,40}$/.test(item.id) || item.id.startsWith("stage-"))
        throw new InvalidPreviewState(`${at}.id is not a starting stage id`);
      if (edited.has(item.id)) throw new InvalidPreviewState(`${at}.id ${item.id} is edited twice`);
      edited.add(item.id);
      if (!isText(item.name, 60) || !item.name.trim())
        throw new InvalidPreviewState(`${at}.name must be 1-60 characters`);
      if (typeof item.color !== "string" || !/^#[0-9a-f]{6}$/i.test(item.color))
        throw new InvalidPreviewState(`${at}.color must be a #rrggbb colour`);
      return;
    }
    if (item.kind === "order") {
      if (++orders > 1) throw new InvalidPreviewState(`${at}: only one order`);
      if (
        !Array.isArray(item.ids) ||
        item.ids.length > 20 ||
        new Set(item.ids).size !== item.ids.length ||
        !item.ids.every((id) => typeof id === "string" && /^[a-z0-9-]{1,60}$/.test(id))
      )
        throw new InvalidPreviewState(`${at}.ids must be up to 20 different stage ids`);
      return;
    }
    if (item.kind === "stage") {
      if (typeof item.id !== "string" || !/^stage-[a-z0-9]{1,40}$/.test(item.id))
        throw new InvalidPreviewState(`${at}.id is not a stage id`);
      if (stageIds.has(item.id)) throw new InvalidPreviewState(`${at}.id ${item.id} is used twice`);
      stageIds.add(item.id);
      if (!isText(item.name, 60) || !item.name.trim())
        throw new InvalidPreviewState(`${at}.name must be 1-60 characters`);
      if (typeof item.color !== "string" || !/^#[0-9a-f]{6}$/i.test(item.color))
        throw new InvalidPreviewState(`${at}.color must be a #rrggbb colour`);
      return;
    }
    if (item.kind === "assignment") {
      if (typeof item.key !== "string" || !/^(contact|conversation)-\d{1,15}$/.test(item.key))
        throw new InvalidPreviewState(`${at}.key is not a contact or conversation key`);
      if (keys.has(item.key)) throw new InvalidPreviewState(`${at}.key ${item.key} is used twice`);
      keys.add(item.key);
      if (typeof item.stageId !== "string" || !/^[a-z0-9-]{1,60}$/.test(item.stageId))
        throw new InvalidPreviewState(`${at}.stageId is not a stage id`);
      return;
    }
    throw new InvalidPreviewState(`${at}.kind must be "stage", "edit", "order" or "assignment"`);
  });
  if (stageIds.size > 14) throw new InvalidPreviewState("customerPath has more than 14 added stages (20 in total)");
  return items as Record<string, unknown>[];
}

const NOTIFICATION_FIELDS = ["id", "unread", "snoozedUntil", "returnedAt"];

/**
 * T-289 (Fahad 129.2: the simulation is kept in the preview state) My Inbox (dashboard/notifications/_components/
 * notifications-store.ts): each notification's read state, snooze return time and the time it came back from a snooze
 * ("Returned from snooze"), `{ id, unread, snoozedUntil?, returnedAt? }`, times in epoch milliseconds. A notification
 * not listed keeps its starting state.
 */
function validateNotifications(items: unknown[]): Record<string, unknown>[] {
  if (items.length > 1000) throw new InvalidPreviewState("notifications has more than 1000 items");
  const ids = new Set<number>();
  items.forEach((item, index) => {
    const at = `notifications[${index}]`;
    if (!isObject(item)) throw new InvalidPreviewState(`${at} must be an object`);
    const extra = Object.keys(item).filter((key) => !NOTIFICATION_FIELDS.includes(key));
    if (extra.length) throw new InvalidPreviewState(`${at} has unknown fields: ${extra.join(", ")}`);
    const id = item.id;
    if (!Number.isSafeInteger(id) || (id as number) < 1)
      throw new InvalidPreviewState(`${at}.id must be a whole number from 1`);
    if (ids.has(id as number)) throw new InvalidPreviewState(`${at}.id ${id} is used twice`);
    ids.add(id as number);
    if (typeof item.unread !== "boolean") throw new InvalidPreviewState(`${at}.unread must be true or false`);
    for (const key of ["snoozedUntil", "returnedAt"]) {
      const time = item[key];
      if (time !== undefined && !(typeof time === "number" && Number.isFinite(time) && time > 0))
        throw new InvalidPreviewState(`${at}.${key} must be a time in milliseconds`);
    }
  });
  return items as Record<string, unknown>[];
}

const CAMPAIGN_LISTS = ["live", "sms", "whatsapp", "instagram", "messenger"];
const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "completed", "failed"];

/**
 * M129-C (Fahad 129.3: campaigns stay after a reload) Campaigns (dashboard/campaigns/_components/store.ts): every
 * campaign of every list, `{ list, id, title, … }`. Live chat rows need their Chatwoot fields; one-off rows need a
 * known status, and the composer's audience, run and history are checked for shape and size only. Fields this check
 * does not name are kept as they are.
 */
function validateCampaigns(items: unknown[]): Record<string, unknown>[] {
  if (items.length > 500) throw new InvalidPreviewState("campaigns has more than 500 items");
  const keys = new Set<string>();
  items.forEach((item, index) => {
    const at = `campaigns[${index}]`;
    if (!isObject(item)) throw new InvalidPreviewState(`${at} must be an object`);
    const { list, id } = item;
    if (typeof list !== "string" || !CAMPAIGN_LISTS.includes(list))
      throw new InvalidPreviewState(`${at}.list must be one of ${CAMPAIGN_LISTS.join(", ")}`);
    if (!Number.isSafeInteger(id) || (id as number) < 1)
      throw new InvalidPreviewState(`${at}.id must be a whole number from 1`);
    const key = `${list}:${id}`;
    if (keys.has(key)) throw new InvalidPreviewState(`${at}: ${key} is used twice`);
    keys.add(key);
    if (!isText(item.title, 200) || !item.title.trim())
      throw new InvalidPreviewState(`${at}.title must be 1-200 characters`);
    if (!isText(item.message, 5000)) throw new InvalidPreviewState(`${at}.message must be text`);
    if (!isText(item.inbox, 200)) throw new InvalidPreviewState(`${at}.inbox must be text`);
    if (list === "live") {
      const ok =
        typeof item.enabled === "boolean" &&
        (item.sender === null || isText(item.sender, 200)) &&
        isText(item.url, 2000) &&
        typeof item.timeOnPage === "number" &&
        typeof item.businessHoursOnly === "boolean";
      if (!ok) throw new InvalidPreviewState(`${at} needs enabled, sender, url, timeOnPage and businessHoursOnly`);
      return;
    }
    if (typeof item.status !== "string" || !CAMPAIGN_STATUSES.includes(item.status))
      throw new InvalidPreviewState(`${at}.status must be one of ${CAMPAIGN_STATUSES.join(", ")}`);
    if (!isText(item.scheduledAt, 200)) throw new InvalidPreviewState(`${at}.scheduledAt must be text`);
    if (!isTextList(item.audience)) throw new InvalidPreviewState(`${at}.audience must be a list of labels`);
    if (item.channel !== undefined && item.channel !== list)
      throw new InvalidPreviewState(`${at}.channel must match its list`);
    const spec = item.audienceSpec;
    if (spec !== undefined) {
      if (!isObject(spec) || !["labels", "segment", "csv"].includes(spec.mode as string))
        throw new InvalidPreviewState(`${at}.audienceSpec.mode must be labels, segment or csv`);
      if (spec.mode === "csv" && (!Array.isArray(spec.rows) || spec.rows.length > 500))
        throw new InvalidPreviewState(`${at}.audienceSpec.rows must be a list of at most 500 rows`);
    }
    const run = item.run;
    if (run !== undefined) {
      const ok =
        isObject(run) &&
        Number.isFinite(run.startedAt) &&
        Number.isFinite(run.endsAt) &&
        Number.isSafeInteger(run.attempt) &&
        Array.isArray(run.results) &&
        run.results.length <= 2000 &&
        run.results.every((r) => isObject(r) && isText(r.key, 300) && isText(r.status, 20));
      if (!ok) throw new InvalidPreviewState(`${at}.run must have startedAt, endsAt, attempt and up to 2000 results`);
    }
    if (item.history !== undefined && !(Array.isArray(item.history) && item.history.length <= 100))
      throw new InvalidPreviewState(`${at}.history must be a list of at most 100 lines`);
  });
  return items as Record<string, unknown>[];
}

/**
 * M129-C round 2 (judge: delete templates) WhatsApp templates deleted in Settings > Templates while approved,
 * `{ name, code, deletedAt }`: Meta does not let a new template take the name of a deleted approved one for 30 days
 * (templates/template-management), so the builder checks the name against this list.
 */
function validateTemplateDeletions(items: unknown[]): Record<string, unknown>[] {
  if (items.length > 500) throw new InvalidPreviewState("templateDeletions has more than 500 items");
  items.forEach((item, index) => {
    const at = `templateDeletions[${index}]`;
    if (!isObject(item)) throw new InvalidPreviewState(`${at} must be an object`);
    if (typeof item.name !== "string" || !/^[a-z0-9_]{1,512}$/.test(item.name))
      throw new InvalidPreviewState(`${at}.name is not a template name`);
    if (!isText(item.code, 20)) throw new InvalidPreviewState(`${at}.code must be a language code`);
    if (typeof item.deletedAt !== "string" || Number.isNaN(Date.parse(item.deletedAt)))
      throw new InvalidPreviewState(`${at}.deletedAt must be a date`);
  });
  return items as Record<string, unknown>[];
}

/**
 * F-9 the Dodge board (dashboard/kanban/_components/board.ts): each card in board order,
 * `{ kind: "card", id, column, conversationId, problem, dodge, betterReply, dueDate, ownerId }` (its customer,
 * channel and link are read from the conversation), and one `{ kind: "columns", ids }` with the column order.
 */
function validateDodgeBoard(items: unknown[]): Record<string, unknown>[] {
  const columns = ["detected", "in-progress", "waiting", "solved"];
  if (items.length > 501) throw new InvalidPreviewState("dodgeBoard has more than 500 cards");
  const ids = new Set<string>();
  let orders = 0;
  items.forEach((item, index) => {
    const at = `dodgeBoard[${index}]`;
    if (!isObject(item)) throw new InvalidPreviewState(`${at} must be an object`);
    if (item.kind === "columns") {
      if (++orders > 1) throw new InvalidPreviewState(`${at}: only one column order`);
      if (
        !Array.isArray(item.ids) ||
        item.ids.length !== columns.length ||
        !columns.every((id) => (item.ids as unknown[]).includes(id))
      )
        throw new InvalidPreviewState(`${at}.ids must be the four columns once each`);
      return;
    }
    if (item.kind !== "card") throw new InvalidPreviewState(`${at}.kind must be "card" or "columns"`);
    if (typeof item.id !== "string" || !/^dodge-[a-z0-9-]{1,60}$/.test(item.id))
      throw new InvalidPreviewState(`${at}.id is not a card id`);
    if (ids.has(item.id)) throw new InvalidPreviewState(`${at}.id ${item.id} is used twice`);
    ids.add(item.id);
    if (!columns.includes(item.column as string)) throw new InvalidPreviewState(`${at}.column is not a column`);
    if (!Number.isInteger(item.conversationId) || (item.conversationId as number) < 1)
      throw new InvalidPreviewState(`${at}.conversationId is not a conversation`);
    for (const field of ["problem", "dodge", "betterReply"] as const)
      if (!isText(item[field], 2000))
        throw new InvalidPreviewState(`${at}.${field} must be text of up to 2000 characters`);
    if (!(item.problem as string).trim() || !(item.dodge as string).trim())
      throw new InvalidPreviewState(`${at}: problem and dodge are required`);
    if (item.dueDate !== "" && (typeof item.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)))
      throw new InvalidPreviewState(`${at}.dueDate must be YYYY-MM-DD or empty`);
    if (item.ownerId !== null && !Number.isInteger(item.ownerId))
      throw new InvalidPreviewState(`${at}.ownerId must be an agent id or null`);
  });
  return items as Record<string, unknown>[];
}

/**
 * F-17 (T-91) the owner's changes to the site's sections (src/lib/owner/site-sections.ts), `{ id, shown, changedAt, by }`,
 * one per section whose state differs from its default. Saved only through /api/owner-console.
 */
function validateSiteSections(items: unknown[]): Record<string, unknown>[] {
  if (items.length > 50) throw new InvalidPreviewState("siteSections has more than 50 items");
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const at = `siteSections[${index}]`;
    if (!isObject(item)) throw new InvalidPreviewState(`${at} must be an object`);
    if (typeof item.id !== "string" || !/^[a-z][a-z-]{0,39}$/.test(item.id))
      throw new InvalidPreviewState(`${at}.id is not a section id`);
    if (ids.has(item.id)) throw new InvalidPreviewState(`${at}.id ${item.id} is used twice`);
    ids.add(item.id);
    if (typeof item.shown !== "boolean") throw new InvalidPreviewState(`${at}.shown must be true or false`);
    if (typeof item.changedAt !== "string" || Number.isNaN(Date.parse(item.changedAt)))
      throw new InvalidPreviewState(`${at}.changedAt must be a date`);
    if (!isText(item.by, 200)) throw new InvalidPreviewState(`${at}.by must be a name`);
  });
  return items as Record<string, unknown>[];
}

/** Known sections and how each one's items are checked. */
export const PREVIEW_SECTIONS: Record<string, (items: unknown[]) => Record<string, unknown>[]> = {
  folders: validateFolders,
  automation: validateAutomation,
  customerPath: validateCustomerPath,
  notifications: validateNotifications,
  campaigns: validateCampaigns,
  templateDeletions: validateTemplateDeletions,
  dodgeBoard: validateDodgeBoard,
  siteSections: validateSiteSections,
};

function validateSectionItems(name: string, items: unknown): Record<string, unknown>[] {
  const validate = PREVIEW_SECTIONS[name];
  if (!validate) throw new InvalidPreviewState(`unknown section: ${name}`);
  if (!Array.isArray(items)) throw new InvalidPreviewState(`${name} must be an array`);
  return validate(items);
}

function readSections(value: unknown): Record<string, PreviewSection> {
  if (value === undefined) return {}; // written before T-109
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("sections must be an object");
  const sections: Record<string, PreviewSection> = {};
  for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
    const section = raw as Partial<PreviewSection> | null;
    if (!section || !Number.isInteger(section.rev) || typeof section.savedAt !== "string")
      throw new Error(`section ${name} is damaged`);
    // A section this code does not know (written by a newer build) is kept as it is, not dropped.
    const items = PREVIEW_SECTIONS[name] ? validateSectionItems(name, section.items) : (section.items ?? []);
    sections[name] = { rev: section.rev as number, savedAt: section.savedAt, items };
  }
  return sections;
}

/** `null` when nothing was saved yet. A corrupt or invalid file throws instead of silently resetting. */
export async function readPreviewState(file = DEFAULT_PREVIEW_STATE_FILE): Promise<PreviewState | null> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = JSON.parse(text) as Partial<PreviewState>;
  if (parsed.version !== 1 || typeof parsed.savedAt !== "string") throw new Error("unsupported preview state file");
  const listsRev = parsed.listsRev;
  return {
    version: 1,
    savedAt: parsed.savedAt,
    lists: parsed.lists === null ? null : validatePreviewLists(parsed.lists),
    listsRev: Number.isInteger(listsRev) && (listsRev as number) >= 0 ? (listsRev as number) : 0,
    listRevs: readListRevs(parsed.listRevs),
    sections: readSections(parsed.sections),
  };
}

// One read-modify-write at a time (this preview runs one server process), so a lists save and a section save that
// arrive together cannot overwrite each other's part of the file.
let writing: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = writing.then(task, task);
  writing = run.catch(() => undefined);
  return run;
}

/** Writes atomically (temp file + rename) so a crash never leaves half a file. */
async function writeState(file: string, state: PreviewState): Promise<PreviewState> {
  const text = JSON.stringify(state);
  if (Buffer.byteLength(text) > MAX_PREVIEW_STATE_BYTES) throw new InvalidPreviewState("preview state too large");
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, text);
  await rename(temp, file);
  return state;
}

/**
 * Replaces the lists if the caller's `baseRev` is the lists revision on disk; otherwise throws PreviewConflict and
 * writes nothing. The saved sections stay as they are.
 */
export function writePreviewState(file: string, lists: unknown, baseRev?: unknown): Promise<PreviewState> {
  const valid = validatePreviewLists(lists);
  if (baseRev !== undefined && (!Number.isInteger(baseRev) || (baseRev as number) < 0))
    throw new InvalidPreviewState("baseRev must be a whole number");
  return serial(async () => {
    const current = await readPreviewState(file);
    const rev = current?.listsRev ?? 0;
    const savedAt = current?.savedAt ?? null;
    // A page loaded before F-3 sends its whole copy with no revision: it cannot know what changed since, so refuse it.
    if (baseRev === undefined)
      throw new PreviewConflict({ rev, savedAt }, "this page was opened before saves were checked; reload it");
    if (rev !== baseRev) throw new PreviewConflict({ rev, savedAt });
    return writeState(file, {
      version: 1,
      savedAt: new Date().toISOString(),
      lists: valid,
      listsRev: rev + 1,
      listRevs: bumpChanged(current?.listRevs ?? zeroRevs(), current?.lists ?? null, valid),
      sections: current?.sections ?? {},
    });
  });
}

/**
 * F-6B: saves only the lists in `lists`, each over its own revision in `baseRevs`. When any list sent was saved
 * elsewhere since (its revision on disk is not the one named), nothing is written and PreviewConflict names those
 * lists (`conflicts`) and carries their saved copy (`lists`) and every list's revision (`revs`). The lists not sent
 * keep what is on disk, so a change to labels in one tab no longer refuses a new inbox in another. The very first save
 * (no lists on disk yet) must hold all seven lists.
 */
export function writePreviewLists(file: string, lists: unknown, baseRevs: unknown): Promise<PreviewState> {
  const valid = validatePartialLists(lists);
  const keys = Object.keys(valid) as PreviewListKey[];
  if (!baseRevs || typeof baseRevs !== "object" || Array.isArray(baseRevs))
    throw new InvalidPreviewState("baseRevs must be an object");
  for (const key of keys) {
    const rev = (baseRevs as Record<string, unknown>)[key];
    if (!Number.isInteger(rev) || (rev as number) < 0)
      throw new InvalidPreviewState(`baseRevs.${key} must be a whole number`);
  }
  const base = baseRevs as Record<PreviewListKey, number>;
  return serial(async () => {
    const current = await readPreviewState(file);
    const revs = current?.listRevs ?? zeroRevs();
    const savedLists = current?.lists ?? null;
    if (!savedLists && keys.length !== PREVIEW_LIST_KEYS.length)
      throw new InvalidPreviewState("the first save of the lists must hold every list");
    const conflicts = keys.filter((key) => revs[key] !== base[key]);
    if (conflicts.length) {
      const names = conflicts.join(", ");
      throw new PreviewConflict(
        {
          rev: current?.listsRev ?? 0,
          savedAt: current?.savedAt ?? null,
          revs,
          conflicts,
          lists: Object.fromEntries(conflicts.map((key) => [key, savedLists?.[key] ?? null])),
        },
        `${names} saved from another tab or device since this page loaded ${conflicts.length > 1 ? "them" : "it"}`,
      );
    }
    const merged = { ...(savedLists as PreviewLists), ...valid } as PreviewLists;
    return writeState(file, {
      version: 1,
      savedAt: new Date().toISOString(),
      lists: merged,
      listsRev: (current?.listsRev ?? 0) + 1,
      listRevs: bumpChanged(revs, savedLists, valid),
      sections: current?.sections ?? {},
    });
  });
}

/**
 * Replaces one section's items if the caller's `baseRev` is the revision on disk (0 = never saved); otherwise throws
 * PreviewConflict. The lists and the other sections stay as they are.
 */
export function writePreviewSection(
  file: string,
  name: string,
  items: unknown,
  baseRev: unknown,
): Promise<PreviewSection> {
  const valid = validateSectionItems(name, items);
  if (!Number.isInteger(baseRev) || (baseRev as number) < 0)
    throw new InvalidPreviewState("baseRev must be a whole number");
  return serial(async () => {
    const current = await readPreviewState(file);
    const existing = current?.sections[name];
    if ((existing?.rev ?? 0) !== baseRev)
      throw new PreviewConflict({ rev: existing?.rev ?? 0, savedAt: existing?.savedAt ?? null });
    const savedAt = new Date().toISOString();
    const section: PreviewSection = { rev: (existing?.rev ?? 0) + 1, savedAt, items: valid };
    await writeState(file, {
      version: 1,
      savedAt,
      lists: current?.lists ?? null,
      listsRev: current?.listsRev ?? 0,
      listRevs: current?.listRevs ?? zeroRevs(),
      sections: { ...(current?.sections ?? {}), [name]: section },
    });
    return section;
  });
}
