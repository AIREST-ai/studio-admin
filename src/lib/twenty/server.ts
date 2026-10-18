// M129-F (Fahad 129.6): server-side client for the local Twenty install (twentycrm/twenty:v2.46.0, docker project
// "twenty" on the colima "lab" machine, published on 127.0.0.1:3497 only). Only Next.js route handlers import this
// file, so the API key never reaches the browser. Key: TWENTY_API_KEY, else the 600 file next to the install.
// REST reference (served by the install itself): GET /rest/open-api/core and /rest/open-api/metadata
// Docs: https://docs.twenty.com/developers/extend/capabilities/apis
// Auth: "Authorization: Bearer <api key>".
// The Tasks page reads ONE Twenty view, the Kanban view named TWENTY_BOARD_VIEW on the Task object:
//   - its visible status groups are the board columns, its hidden groups are the sections opened by a button;
//   - its visible fields are the fields shown on a card (the card design, kept in Twenty, edited from the page).

import { PRODUCT_NAME } from "@/config/app-config";
import { readVaultSecret } from "@/lib/system-vault";

// F-8 (sim3 11.1c): a task given to a site agent keeps the agent's name in this Task field (see ./agents.ts).
import { AGENT_FIELD, AGENT_FIELD_LABEL } from "./agents";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const TWENTY_URL = process.env.TWENTY_URL ?? "http://127.0.0.1:3497";
export const TWENTY_PORT = 3497;
const KEY_FILE = process.env.TWENTY_API_KEY_FILE ?? "/Users/ali/lobehub-hub/twenty/preview-api-key.txt";
const VAULT_NAMES = ["twenty_api_key", "TWENTY_API_KEY"] as const;
// The board view's name inside the tasks engine (an internal record name, never shown on the site).
// F-23 (Fahad 15 Oct 15:20: "even the internal names all change to my name"): the name comes from PRODUCT_NAME alone.
// Renaming it in the code only broke the Tasks page at 17:14 on 15 Oct (502). So the page finds its view by the id it
// saved at the last success (siteView below), and only then by name; the engine is then given the current name
// (PATCH /rest/metadata/views/{id}, its own metadata API). A new PRODUCT_NAME needs no other change.
export const TWENTY_BOARD_VIEW = process.env.TWENTY_BOARD_VIEW ?? `${PRODUCT_NAME} board`;
const EARLIER_BOARD_VIEWS = ["Studio board"];
/** F-23: the ids of the views the site made in the engine, saved at each success (this preview server's own state). */
const VIEW_IDS_FILE = path.join(process.cwd(), ".preview-state", "twenty-views.json");

export class TwentyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let cachedKey: string | null = null;

async function apiKey() {
  if (cachedKey) return cachedKey;
  const vault = readVaultSecret(VAULT_NAMES);
  if (vault) {
    cachedKey = vault;
    return cachedKey;
  }
  if (process.env.TWENTY_API_KEY) return process.env.TWENTY_API_KEY;
  try {
    cachedKey = (await readFile(KEY_FILE, "utf8")).trim();
  } catch {
    throw new TwentyError("The tasks server's API key is not configured on the preview server", 503);
  }
  return cachedKey;
}

function errorText(body: unknown, status: number) {
  const b = body as { messages?: unknown; message?: unknown; error?: unknown } | null;
  if (Array.isArray(b?.messages) && b.messages.length) return b.messages.map(String).join("; ");
  if (typeof b?.message === "string") return b.message;
  if (Array.isArray(b?.message)) return b.message.map(String).join("; ");
  if (typeof b?.error === "string") return b.error;
  return `The tasks server answered ${status}`;
}

export async function tw<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${TWENTY_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${await apiKey()}`,
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (error instanceof TwentyError) throw error;
    throw new TwentyError("The tasks server is not reachable", 502);
  }
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok)
    throw new TwentyError(errorText(body, response.status), response.status >= 500 ? 502 : response.status);
  return body as T;
}

/* ------------------------------------------------------------------ metadata ------------------------------------ */

interface MetaOption {
  id?: string;
  value: string;
  label: string;
  color?: string;
  position?: number;
}

interface MetaField {
  id: string;
  name: string;
  label: string;
  type: string;
  isCustom?: boolean;
  isSystem?: boolean;
  isActive?: boolean;
  applicationId?: string;
  description?: string | null;
  options?: MetaOption[] | null;
}

/**
 * Twenty v2.46 REST metadata has no isCustom flag: standard Task fields belong to Twenty's own application, fields a
 * workspace adds belong to the workspace's application (applicationId differs from the standard "title" field's).
 */
function customOf(object: MetaObject) {
  const standardApp = object.fields.find((field) => field.name === "title")?.applicationId;
  return (field: MetaField) =>
    !field.isSystem && (field.isCustom ?? (Boolean(field.applicationId) && field.applicationId !== standardApp));
}

interface MetaObject {
  id: string;
  nameSingular: string;
  fields: MetaField[];
}

interface MetaView {
  id: string;
  name: string;
  objectMetadataId: string;
  type: string;
  isCustom?: boolean;
}

interface MetaViewField {
  id: string;
  viewId: string;
  fieldMetadataId: string;
  isVisible: boolean;
  position: number;
}

interface MetaViewGroup {
  id: string;
  viewId: string;
  fieldValue: string;
  isVisible: boolean;
  position: number;
}

type ListBody<T> = { data: T[] | Record<string, T[]>; pageInfo?: { hasNextPage?: boolean; endCursor?: string } };

function rows<T>(body: ListBody<T>, key: string): T[] {
  if (Array.isArray(body.data)) return body.data;
  return (body.data?.[key] as T[] | undefined) ?? [];
}

async function listMeta<T>(resource: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const query = `limit=200${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`;
    const body = await tw<ListBody<T>>(`/rest/metadata/${resource}?${query}`);
    out.push(...rows(body, resource));
    if (!body.pageInfo?.hasNextPage || !body.pageInfo.endCursor) break;
    after = body.pageInfo.endCursor;
  }
  return out;
}

async function taskObject(): Promise<MetaObject> {
  const objects = await listMeta<MetaObject>("objects");
  const task = objects.find((object) => object.nameSingular === "task");
  if (!task) throw new TwentyError("The tasks server has no Task object", 502);
  return task;
}

/* ------------------------------------------------------------------ board --------------------------------------- */

/** Field types a client can add to the Task card from the preview (Twenty field types, docs link above). */
export const CUSTOM_FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** Task fields that may appear on a card (title is always shown, status is the column). */
const STANDARD_CARD_FIELDS = ["assignee", "dueAt", "bodyV2", "createdAt", "createdBy"];
const VALUE_TYPES = new Set([
  "TEXT",
  "NUMBER",
  "NUMERIC",
  "DATE",
  "DATE_TIME",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "RATING",
  "PHONES",
  "EMAILS",
  "LINKS",
  "CURRENCY",
  "RICH_TEXT",
  "ACTOR",
  "RELATION",
]);

export interface CardField {
  id: string;
  name: string;
  label: string;
  type: string;
  isCustom: boolean;
  options: { value: string; label: string; color: string }[];
  /** Shown on the card (a visible field of the Twenty board view). */
  visible: boolean;
  position: number;
}

export interface BoardStatus {
  value: string;
  label: string;
  color: string;
  /** true: a board column (visible group of the Twenty view); false: a section opened by its button. */
  onBoard: boolean;
  position: number;
}

export interface BoardMember {
  id: string;
  name: string;
  /** F-8: the member's sign-in email, to match a site agent (Settings > Agents) with the same email. */
  email: string;
}

export interface BoardTask {
  id: string;
  title: string;
  status: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Values of the custom fields, by field name. */
  custom: Record<string, unknown>;
}

export interface TwentyBoard {
  connected: true;
  server: string;
  viewId: string;
  viewName: string;
  statuses: BoardStatus[];
  members: BoardMember[];
  fields: CardField[];
  tasks: BoardTask[];
}

/**
 * F-23: a metadata item the site made inside the engine (a view, a field, an object) gets its current wording through
 * the engine's metadata API (PATCH /rest/metadata/{views|fields|objects}/{id}). A refusal is logged and the page goes
 * on with the item as it is: a name is never a reason for the Tasks page to fail.
 */
export async function renameInEngine(
  resource: "views" | "fields" | "objects",
  id: string,
  patch: Record<string, string>,
) {
  try {
    await tw(`/rest/metadata/${resource}/${id}`, { method: "PATCH", body: patch });
    return true;
  } catch (error) {
    console.error(`[F-23] the tasks server kept the old name of ${resource}/${id}:`, (error as Error).message);
    return false;
  }
}

type ViewKey = "taskBoard" | "dodgeBoard";

async function savedViewIds(): Promise<Partial<Record<ViewKey, string>>> {
  try {
    return JSON.parse(await readFile(VIEW_IDS_FILE, "utf8")) as Partial<Record<ViewKey, string>>;
  } catch {
    return {};
  }
}

export async function saveViewId(key: ViewKey, id: string) {
  try {
    const ids = await savedViewIds();
    if (ids[key] === id) return;
    await mkdir(path.dirname(VIEW_IDS_FILE), { recursive: true });
    const tmp = `${VIEW_IDS_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ ...ids, [key]: id }, null, 2)}\n`);
    await rename(tmp, VIEW_IDS_FILE);
  } catch (error) {
    console.error(`[F-23] the ${key} view id was not saved:`, (error as Error).message);
  }
}

/**
 * F-23 (round 2): the view the site made on an object (`views` = that object's views), found by, in order:
 * 1. the id saved at the last success; 2. its current name; 3. a name it had before; 4. the object's only Kanban view
 * that a workspace made (isCustom, in the engine's view DTO: TW metadata-modules/view/dtos/view.dto.ts) — the engine's
 * own Task views ("By Status") are not custom. It is given the current name in the engine and its id is saved again.
 * Undefined only when none of the four finds it (then the Tasks page answers 502; the Dodge board makes its view once).
 */
export async function siteView<V extends { id: string; name: string; type?: string; isCustom?: boolean }>(
  key: ViewKey,
  views: V[],
  name: string,
  earlierNames: string[],
): Promise<V | undefined> {
  const savedId = (await savedViewIds())[key];
  const customKanban = views.filter((each) => each.type === "KANBAN" && each.isCustom === true);
  const view =
    (savedId ? views.find((each) => each.id === savedId) : undefined) ??
    views.find((each) => each.name === name) ??
    views.find((each) => earlierNames.includes(each.name)) ??
    (customKanban.length === 1 ? customKanban[0] : undefined);
  if (!view) return undefined;
  await saveViewId(key, view.id);
  if (view.name !== name && (await renameInEngine("views", view.id, { name }))) return { ...view, name };
  return view;
}

async function boardView(objectId: string): Promise<MetaView> {
  const views = (await listMeta<MetaView>("views")).filter((each) => each.objectMetadataId === objectId);
  const view = await siteView("taskBoard", views, TWENTY_BOARD_VIEW, EARLIER_BOARD_VIEWS);
  if (!view) throw new TwentyError(`The tasks server has no Task view named "${TWENTY_BOARD_VIEW}"`, 502);
  return view;
}

function memberName(member: { name?: { firstName?: string; lastName?: string } | null; userEmail?: string }) {
  const name = `${member.name?.firstName ?? ""} ${member.name?.lastName ?? ""}`.trim();
  return name || member.userEmail || "Member";
}

interface RawTask {
  id: string;
  title?: string | null;
  status?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
  position?: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  bodyV2?: { markdown?: string | null } | null;
  createdBy?: { name?: string | null } | null;
  [key: string]: unknown;
}

/**
 * F-16 (Fahad 15 Oct 15:20: "even the internal names change to my name"): text this app itself wrote into the tasks
 * server before, shown in the product's name. The API key that writes tasks is named "Studio preview 8797 (server
 * side)" inside the tasks server (its "Created by"), and older descriptions say "… conversation in Studio." and
 * "Studio agent: …". Renaming the key itself is a change inside the tasks server, so it is listed in the F-16 result.
 */
const ownCreator = (name: string) => (/^Studio preview\b/.test(name) ? PRODUCT_NAME : name);
const ownBody = (text: string) =>
  text
    .replace(/^(Created from an? .+ conversation) in Studio\.$/m, `$1 in ${PRODUCT_NAME}.`)
    .replace(/^Studio agent: /m, `${AGENT_FIELD_LABEL}: `);

function toTask(raw: RawTask, customNames: string[]): BoardTask {
  const custom: Record<string, unknown> = {};
  for (const name of customNames) custom[name] = raw[name] ?? null;
  return {
    id: raw.id,
    title: raw.title ?? "",
    status: raw.status ?? null,
    assigneeId: raw.assigneeId ?? null,
    dueAt: raw.dueAt ?? null,
    body: ownBody(raw.bodyV2?.markdown ?? ""),
    position: typeof raw.position === "number" ? raw.position : 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: ownCreator(raw.createdBy?.name ?? ""),
    custom,
  };
}

async function listTasks(customNames: string[]): Promise<BoardTask[]> {
  const out: BoardTask[] = [];
  let after: string | undefined;
  for (let page = 0; page < 25; page++) {
    const query = `limit=200&order_by=position[AscNullsLast]${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`;
    const body = await tw<ListBody<RawTask>>(`/rest/tasks?${query}`);
    out.push(
      ...rows(body, "tasks")
        .filter((task) => !task.deletedAt)
        .map((task) => toTask(task, customNames)),
    );
    if (!body.pageInfo?.hasNextPage || !body.pageInfo.endCursor) break;
    after = body.pageInfo.endCursor;
  }
  return out;
}

async function listMembers(): Promise<BoardMember[]> {
  const body = await tw<ListBody<{ id: string; name?: { firstName?: string; lastName?: string }; userEmail?: string }>>(
    "/rest/workspaceMembers?limit=200",
  );
  return rows(body, "workspaceMembers")
    .map((member) => ({ id: member.id, name: memberName(member), email: (member.userEmail ?? "").toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The agent field's description inside the engine (written when the field is made, and kept current by F-23). */
const AGENT_FIELD_DESCRIPTION = `The site agent (Settings > Agents) this task is for. Set by the ${PRODUCT_NAME} preview.`;

/**
 * F-23: the agent field was first made as "Studio agent" ("… Set by the Studio preview."). Its label and description
 * inside the engine follow the ones a new field gets. The field's API name (AGENT_FIELD) is its key and stays: the
 * tasks keep their values under it. Its isLabelSyncedWithName is false, so a new label does not rename it.
 */
async function ownAgentField(task: MetaObject) {
  const field = task.fields.find((each) => each.name === AGENT_FIELD);
  if (!field || (field.label === AGENT_FIELD_LABEL && field.description === AGENT_FIELD_DESCRIPTION)) return;
  await renameInEngine("fields", field.id, { label: AGENT_FIELD_LABEL, description: AGENT_FIELD_DESCRIPTION });
}

export async function readBoard(): Promise<TwentyBoard> {
  const task = await taskObject();
  const [view] = await Promise.all([boardView(task.id), ownAgentField(task)]);
  const [viewFields, viewGroups, members] = await Promise.all([
    listMeta<MetaViewField>("viewFields"),
    listMeta<MetaViewGroup>("viewGroups"),
    listMembers(),
  ]);
  const statusField = task.fields.find((field) => field.name === "status");
  const groups = viewGroups.filter((group) => group.viewId === view.id);
  const statuses: BoardStatus[] = (statusField?.options ?? [])
    .map((option, index) => {
      const group = groups.find((each) => each.fieldValue === option.value);
      return {
        value: option.value,
        label: option.label,
        color: option.color ?? "gray",
        onBoard: group ? group.isVisible : true,
        position: group?.position ?? option.position ?? index,
      };
    })
    .sort((a, b) => a.position - b.position);

  const ownFields = viewFields.filter((each) => each.viewId === view.id);
  const isCustom = customOf(task);
  const fields: CardField[] = task.fields
    .filter(
      (field) =>
        field.isActive !== false &&
        VALUE_TYPES.has(field.type) &&
        (STANDARD_CARD_FIELDS.includes(field.name) || isCustom(field)),
    )
    .map((field) => {
      const viewField = ownFields.find((each) => each.fieldMetadataId === field.id);
      return {
        id: field.id,
        name: field.name,
        // F-16: the agent field was first made with the label "Studio agent"; the page shows it as AGENT_FIELD_LABEL.
        label: field.name === "bodyV2" ? "Description" : field.name === AGENT_FIELD ? AGENT_FIELD_LABEL : field.label,
        type: field.type,
        isCustom: isCustom(field),
        options: (field.options ?? []).map((option) => ({
          value: option.value,
          label: option.label,
          color: option.color ?? "gray",
        })),
        visible: viewField ? viewField.isVisible : false,
        position: viewField?.position ?? 100,
      };
    })
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));

  const customNames = fields.filter((field) => field.isCustom).map((field) => field.name);
  const tasks = await listTasks(customNames);
  return {
    connected: true,
    server: TWENTY_URL,
    viewId: view.id,
    viewName: view.name,
    statuses,
    members,
    fields,
    tasks,
  };
}

/* ------------------------------------------------------------------ writes -------------------------------------- */

export interface TaskInput {
  title?: string;
  status?: string;
  assigneeId?: string | null;
  dueAt?: string | null;
  body?: string;
  position?: number;
  custom?: Record<string, unknown>;
}

function taskPayload(input: TaskInput) {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.status !== undefined) payload.status = input.status;
  if (input.assigneeId !== undefined) payload.assigneeId = input.assigneeId;
  if (input.dueAt !== undefined) payload.dueAt = input.dueAt;
  if (input.position !== undefined) payload.position = input.position;
  if (input.body !== undefined) payload.bodyV2 = { markdown: input.body };
  for (const [name, value] of Object.entries(input.custom ?? {})) payload[name] = value;
  return payload;
}

async function customNamesNow() {
  const task = await taskObject();
  const isCustom = customOf(task);
  return task.fields.filter((field) => field.isActive !== false && isCustom(field)).map((field) => field.name);
}

/**
 * F-8: the site agent field (AGENT_FIELD) exists before a task names an agent in it: it is added to Task the first
 * time (a Text field, as "Card design > Add field" adds one). Clearing it when it was never made needs no field.
 */
async function withAgentField(input: TaskInput): Promise<TaskInput> {
  if (!input.custom || !(AGENT_FIELD in input.custom)) return input;
  const value = input.custom[AGENT_FIELD];
  const task = await taskObject();
  if (task.fields.some((field) => field.name === AGENT_FIELD)) return input;
  if (value === null || value === "") {
    const { [AGENT_FIELD]: _unused, ...custom } = input.custom;
    return { ...input, custom };
  }
  await tw("/rest/metadata/fields", {
    method: "POST",
    body: {
      objectMetadataId: task.id,
      type: "TEXT",
      name: AGENT_FIELD,
      label: AGENT_FIELD_LABEL,
      icon: "IconUser",
      description: AGENT_FIELD_DESCRIPTION,
    },
  });
  return input;
}

export async function createTask(input: TaskInput): Promise<BoardTask> {
  const ready = await withAgentField(input);
  const body = await tw<{ data: Record<string, RawTask> }>("/rest/tasks", { method: "POST", body: taskPayload(ready) });
  const raw = Object.values(body.data)[0];
  return toTask(raw, await customNamesNow());
}

export async function updateTask(id: string, input: TaskInput): Promise<BoardTask> {
  const ready = await withAgentField(input);
  const body = await tw<{ data: Record<string, RawTask> }>(`/rest/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: taskPayload(ready),
  });
  const raw = Object.values(body.data)[0];
  return toTask(raw, await customNamesNow());
}

export interface DeletedTask {
  id: string;
  title: string;
  status: string | null;
  deletedAt: string;
}

/**
 * F-5B: moves a task to Twenty's deleted records (soft delete), then reads it back to prove it.
 * REST DELETE /rest/tasks/:id?soft_delete=true. Without soft_delete=true Twenty v2.46.0 DESTROYS the record
 * (permanent): https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/api/rest/core/services/rest-api-core.service.ts#L80-L94
 * and https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/api/rest/input-request-parsers/soft-delete-parser-utils/parse-soft-delete-rest-request.util.ts#L5-L13
 * Twenty answers { data: { deleteTask: { id } } } (rest-api-delete-one.handler.ts, same tag). A soft-deleted record
 * is listed in Twenty under Command menu -> "See deleted records" and can be restored there:
 * https://docs.twenty.com/user-guide/data-migration/capabilities/uniqueness-constraints
 */
export async function deleteTask(id: string): Promise<DeletedTask> {
  const path = `/rest/tasks/${encodeURIComponent(id)}`;
  const body = await tw<{ data?: { deleteTask?: { id?: string } } } | null>(`${path}?soft_delete=true`, {
    method: "DELETE",
  });
  if (body?.data?.deleteTask?.id !== id) throw new TwentyError("its answer did not name this task", 502);
  // A deleted record is hidden from normal reads; a filter on deletedAt lists it (checked on v2.46.0).
  const filter = encodeURIComponent(`and(id[eq]:"${id}",deletedAt[is]:NOT_NULL)`);
  const check = await tw<ListBody<RawTask>>(`/rest/tasks?depth=0&limit=1&filter=${filter}`);
  const raw = rows(check, "tasks")[0];
  if (!raw?.deletedAt) throw new TwentyError("it answered the delete, but the task is not in its deleted records", 502);
  return { id: raw.id, title: raw.title ?? "", status: raw.status ?? null, deletedAt: raw.deletedAt };
}

/** Shows or hides a field on the card: the field's isVisible in the Twenty board view (created when missing). */
export async function setCardField(fieldId: string, visible: boolean) {
  const task = await taskObject();
  if (!task.fields.some((field) => field.id === fieldId)) throw new TwentyError("unknown Task field", 400);
  const view = await boardView(task.id);
  const existing = (await listMeta<MetaViewField>("viewFields")).find(
    (each) => each.viewId === view.id && each.fieldMetadataId === fieldId,
  );
  if (existing) {
    await tw(`/rest/metadata/viewFields/${existing.id}`, { method: "PATCH", body: { isVisible: visible } });
  } else {
    await tw("/rest/metadata/viewFields", {
      method: "POST",
      body: { viewId: view.id, fieldMetadataId: fieldId, isVisible: visible, position: 50 },
    });
  }
}

const camel = (label: string) => {
  const words = label
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const name = words
    .map((word, index) => (index ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()))
    .join("");
  return /^[a-z]/.test(name) ? name : `field${name}`;
};

/** A new custom field on the Task object (Twenty data model), shown on the card right away. */
export async function addCustomField(label: string, type: CustomFieldType, options: string[]) {
  const task = await taskObject();
  const name = camel(label);
  if (!name || name === "field") throw new TwentyError("the field name needs Latin letters or digits", 400);
  if (task.fields.some((field) => field.name === name))
    throw new TwentyError(`a field named "${label}" already exists`, 409);
  const body: Record<string, unknown> = { objectMetadataId: task.id, type, name, label, icon: "IconForms" };
  if (type === "SELECT") {
    const colors = ["blue", "green", "amber", "purple", "red", "gray"];
    body.options = options.map((option, index) => ({
      label: option,
      value:
        option
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_")
          .replace(/^_|_$/g, "") || `OPTION_${index + 1}`,
      color: colors[index % colors.length],
      position: index,
    }));
  }
  // Twenty answers the created field itself (no "data" wrapper), checked on v2.46.0.
  const created = await tw<MetaField | { data: MetaField }>("/rest/metadata/fields", { method: "POST", body });
  const field = ("id" in created ? created : created.data) as MetaField;
  await setCardField(field.id, true);
  return { id: field.id, name: field.name, label: field.label, type: field.type };
}

/* ------------------------------------------------------------------ message -> task ----------------------------- */

export interface MessageTaskInput {
  title: string;
  assigneeId: string | null;
  /** F-8: a site agent (Settings > Agents) the task is for, kept in AGENT_FIELD. */
  agentName: string;
  messageText: string;
  sender: string;
  time: string;
  conversationId: number;
  conversationUrl: string;
  channel: string;
  /** F-8: the inbox's channel type ("Email", "WhatsApp", "Website", ...), matched with the task's Channel options. */
  channelType: string;
  /** F-8: the conversation's order number (its "Order number" or "Order ID" attribute), when it has one. */
  orderNumber: string;
  contact: { name: string; email: string; phone: string; company: string };
}

/** F-8: what the Channel, Order number and agent fields of a task made from a message got, in words. */
export interface MessageTaskFields {
  channel: string | null;
  orderNumber: string | null;
  agent: string | null;
  notes: string[];
}

const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * F-8 (sim3 8.12b: a task from an email conversation had Channel "Not set" and no Order number): the task's own
 * Channel (Select) and Order number (Text) fields, found by name or label on Twenty's Task object, take the
 * conversation's channel and order number. A channel with no matching option is left empty and said so.
 */
async function messageTaskCustom(input: MessageTaskInput) {
  const task = await taskObject();
  const isCustom = customOf(task);
  const fields = task.fields.filter((field) => field.isActive !== false && isCustom(field));
  const named = (...names: string[]) =>
    fields.find((field) => names.some((name) => plain(field.name) === name || plain(field.label) === name));
  const custom: Record<string, unknown> = {};
  const set: MessageTaskFields = { channel: null, orderNumber: null, agent: null, notes: [] };
  const channelField = named("channel");
  const channelName = input.channelType || input.channel;
  if (channelField?.type === "SELECT") {
    const wanted = [plain(input.channelType), plain(input.channel)].filter(Boolean);
    const option = (channelField.options ?? []).find(
      (each) => wanted.includes(plain(each.value)) || wanted.includes(plain(each.label)),
    );
    if (option) {
      custom[channelField.name] = option.value;
      set.channel = option.label;
    } else
      set.notes.push(
        `Channel: the task's Channel field has no "${channelName}" option, so it was left empty (the channel is in the description).`,
      );
  } else if (channelField) {
    custom[channelField.name] = channelName;
    set.channel = channelName;
  } else set.notes.push("Channel: tasks have no Channel field, so the channel is only in the description.");
  if (input.orderNumber) {
    const orderField = named("ordernumber", "orderid", "order");
    if (orderField && ["TEXT", "NUMBER"].includes(orderField.type)) {
      const value = orderField.type === "NUMBER" ? Number(input.orderNumber.replace(/[^\d.]/g, "")) : input.orderNumber;
      if (orderField.type === "NUMBER" && !Number.isFinite(value))
        set.notes.push(`Order number: "${input.orderNumber}" is not a number, so the number field was left empty.`);
      else {
        custom[orderField.name] = value;
        set.orderNumber = input.orderNumber;
      }
    } else set.notes.push("Order number: tasks have no Order number field, so it is only in the description.");
  }
  if (input.agentName) {
    custom[AGENT_FIELD] = input.agentName;
    set.agent = input.agentName;
  }
  return { custom, set };
}

/** The contact as a Twenty Person (found by email, else created), so the task links to them. */
async function ensurePerson(contact: MessageTaskInput["contact"]): Promise<string | null> {
  if (!contact.name && !contact.email) return null;
  if (contact.email) {
    const found = await tw<ListBody<{ id: string }>>(
      `/rest/people?limit=1&filter=${encodeURIComponent(`emails.primaryEmail[eq]:"${contact.email}"`)}`,
    );
    const person = rows(found, "people")[0];
    if (person) return person.id;
  }
  const [firstName, ...rest] = (contact.name || contact.email).split(/\s+/);
  const payload: Record<string, unknown> = { name: { firstName, lastName: rest.join(" ") } };
  if (contact.email) payload.emails = { primaryEmail: contact.email };
  if (contact.phone) payload.phones = { primaryPhoneNumber: contact.phone.replace(/[^\d+]/g, "") };
  const created = await tw<{ data: Record<string, { id: string }> }>("/rest/people", { method: "POST", body: payload });
  return Object.values(created.data)[0]?.id ?? null;
}

export async function taskFromMessage(input: MessageTaskInput) {
  const channelName = input.channelType || input.channel;
  const lines = [
    `Created from ${/^[aeiou]/i.test(channelName) ? "an" : "a"} ${channelName} conversation in ${PRODUCT_NAME}.`,
    "",
    `> ${input.messageText.replace(/\n/g, "\n> ")}`,
    "",
    `Message from: ${input.sender} (${input.time})`,
    `Conversation: ${input.conversationUrl}`,
    `Channel: ${channelName}`,
    ...(input.orderNumber ? [`Order number: ${input.orderNumber}`] : []),
    ...(input.agentName ? [`${AGENT_FIELD_LABEL}: ${input.agentName}`] : []),
    `Contact: ${[input.contact.name, input.contact.email, input.contact.phone, input.contact.company].filter(Boolean).join(" · ")}`,
  ];
  const { custom, set } = await messageTaskCustom(input);
  const task = await createTask({
    title: input.title,
    status: "TODO",
    assigneeId: input.assigneeId,
    body: lines.join("\n"),
    custom,
  });
  let personId: string | null = null;
  try {
    personId = await ensurePerson(input.contact);
    // taskTarget.targetPerson is a MORPH_RELATION; its join column is targetPersonId.
    if (personId)
      await tw("/rest/taskTargets", { method: "POST", body: { taskId: task.id, targetPersonId: personId } });
  } catch {
    personId = null; // the task itself is saved; the contact stays written in its body
  }
  // F-8 (monitor: no "success" for what was not done): the window says when the contact was not linked.
  if (!personId && (input.contact.name || input.contact.email))
    set.notes.push("Contact: not linked as a person on the tasks server, so it is only written in the description.");
  return { task, personId, fields: set };
}
