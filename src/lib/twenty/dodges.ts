// F-20 (Fahad, 15 Oct 15:20 and 15:25: the cards on a ready-made open-source engine of his own, nothing sent to a
// vendor's site): the Dodge board (/dashboard/kanban) is kept in the local tasks engine (the same install as the Tasks
// page, lib/twenty/server.ts), in a custom object of its own, "dodge", never mixed with the tasks (decision 96).
// Server side only (route handlers import it), so the engine's key never reaches the browser. The page keeps its own
// contract: a list of items + a revision, and 409 when the board changed elsewhere (app/api/dodge-board/route.ts).
//
// Sources (Twenty v2.46.0, the installed version):
// - custom objects get REST endpoints at once, and a "name" field:
//   https://docs.twenty.com/developers/extend/capabilities/apis
//   https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/metadata-modules/flat-object-metadata/utils/from-create-object-input-to-flat-object-metadata-and-flat-field-metadatas-to-create.util.ts
// - every custom object has the system fields id, createdAt, updatedAt, deletedAt, createdBy, updatedBy and position:
//   https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/metadata-modules/object-metadata/utils/build-reserved-system-flat-field-metadatas-for-custom-object.util.ts
//   position and NUMBER are float columns: .../workspace-migration-runner/utils/field-metadata-type-to-column-type.util.ts
// - object input (nameSingular, namePlural, labelSingular, labelPlural, icon, description):
//   https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/metadata-modules/object-metadata/dtos/create-object.input.ts
// - a Kanban view grouped by a Select field, its groups (fieldValue, position, isVisible) are the column order, as the
//   Tasks board reads its columns: .../metadata-modules/view/dtos/inputs/create-view.input.ts (mainGroupByFieldMetadataId)
//   and .../metadata-modules/view-group/dtos/inputs/create-view-group.input.ts
// - REST routes: POST batch/<plural> (up to 60 records), GET/POST/PATCH/DELETE <plural>:
//   https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/api/rest/core/controllers/rest-api-core.controller.ts
// - DELETE with soft_delete=true keeps the record in the engine's deleted records (see deleteTask in ./server.ts).

import { PRODUCT_NAME } from "@/config/app-config";

import { renameInEngine, saveViewId, siteView, TwentyError, tw } from "./server";

export const DODGE_OBJECT = "dodge";
const DODGE_PLURAL = "dodges";
// F-23 (Fahad 15 Oct 15:20: "even the internal names all change to my name"): the view's name and the object's
// description inside the engine come from PRODUCT_NAME. The view is found by the id saved at the last success, then by
// name (siteView in ./server.ts), and the engine is given the current wording, so a new PRODUCT_NAME never makes a
// second view.
const BOARD_VIEW = `${PRODUCT_NAME} dodge board`;
const EARLIER_BOARD_VIEWS = ["Dodge board"];
const DODGE_DESCRIPTION = `Dodge board cards: an agent reply that left a customer's problem unsolved, followed until solved. Written by the ${PRODUCT_NAME} preview.`;

/** The board's columns (kanban/_components/data.ts) and the engine's Stage options, in the default order. */
export const DODGE_STAGES = [
  { column: "detected", value: "DETECTED", label: "Dodge detected", color: "red" },
  { column: "in-progress", value: "IN_PROGRESS", label: "In progress", color: "blue" },
  { column: "waiting", value: "WAITING", label: "Waiting on customer", color: "orange" },
  { column: "solved", value: "SOLVED", label: "Solved", color: "green" },
] as const;
export type DodgeColumn = (typeof DODGE_STAGES)[number]["column"];
const COLUMN_IDS = DODGE_STAGES.map((stage) => stage.column) as DodgeColumn[];
const stageValueOf = (column: DodgeColumn) =>
  DODGE_STAGES.find((stage) => stage.column === column)?.value ?? "DETECTED";
const columnOf = (value: unknown): DodgeColumn | null =>
  DODGE_STAGES.find((stage) => stage.value === value)?.column ?? null;

/** The fields of the dodge object, what each card keeps (kanban/_components/seed.ts SavedCard). */
const FIELDS = [
  { name: "cardKey", label: "Card key", type: "TEXT", icon: "IconKey", description: "The card's id on the board." },
  { name: "stage", label: "Stage", type: "SELECT", icon: "IconProgress", description: "The board column." },
  {
    name: "conversationId",
    label: "Conversation",
    type: "NUMBER",
    icon: "IconMessages",
    description: "The conversation the dodge is in (/dashboard/chat/conversations/<id>).",
  },
  {
    name: "problem",
    label: "Problem",
    type: "TEXT",
    icon: "IconHelp",
    description: "The customer's message the reply did not solve.",
  },
  {
    name: "dodgeReply",
    label: "Dodge",
    type: "TEXT",
    icon: "IconMessageX",
    description: "The agent's reply that left the problem open.",
  },
  {
    name: "betterReply",
    label: "Better reply",
    type: "TEXT",
    icon: "IconNotes",
    description: "The note written on the card: the reply that would have solved it.",
  },
  { name: "dueAt", label: "Due date", type: "DATE", icon: "IconCalendar", description: "When it should be solved." },
  {
    name: "ownerAgentId",
    label: "Owner",
    type: "NUMBER",
    icon: "IconUser",
    description: "The site agent (Settings > Agents) who follows the dodge.",
  },
] as const;

/* ------------------------------------------------------------------ the saved board, as the page knows it -------- */

export interface DodgeCard {
  kind: "card";
  id: string;
  column: DodgeColumn;
  conversationId: number;
  problem: string;
  dodge: string;
  betterReply: string;
  dueDate: string;
  ownerId: number | null;
}

export interface DodgeColumns {
  kind: "columns";
  ids: DodgeColumn[];
}

export type DodgeItem = DodgeCard | DodgeColumns;

export interface DodgeBoard {
  items: DodgeItem[];
  rev: number;
  savedAt: string | null;
}

export class DodgeConflict extends Error {
  constructor(readonly rev: number) {
    super("the board was changed in another tab or device");
  }
}

/* ------------------------------------------------------------------ metadata ------------------------------------ */

interface MetaField {
  id: string;
  name: string;
  label?: string;
  type: string;
  isActive?: boolean;
  isSystem?: boolean;
  options?: Array<{ value: string; label: string; position?: number }> | null;
}
interface MetaObject {
  id: string;
  nameSingular: string;
  namePlural?: string;
  labelSingular?: string;
  labelPlural?: string;
  description?: string | null;
  fields: MetaField[];
}
interface MetaView {
  id: string;
  name: string;
  objectMetadataId: string;
  type?: string;
  isCustom?: boolean;
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

/** The engine answers a created metadata item either bare or in a "data" wrapper. */
const unwrap = <T extends { id: string }>(body: T | { data: T }) => ("id" in body ? body : body.data) as T;

interface Model {
  objectId: string;
  viewId: string;
}

let model: Model | null = null;
let ensuring: Promise<Model> | null = null;

async function dodgeObject(): Promise<MetaObject | undefined> {
  return (await listMeta<MetaObject>("objects")).find((object) => object.nameSingular === DODGE_OBJECT);
}

/**
 * The dodge object, its fields and its Kanban view (grouped by Stage), created through the engine's metadata API the
 * first time and found again afterwards. Nothing that exists is changed, except the view's name and the object's
 * description (F-23: their wording follows PRODUCT_NAME).
 */
async function ensureModelNow(): Promise<Model> {
  let object = await dodgeObject();
  if (!object) {
    await tw("/rest/metadata/objects", {
      method: "POST",
      body: {
        nameSingular: DODGE_OBJECT,
        namePlural: DODGE_PLURAL,
        labelSingular: "Dodge",
        labelPlural: "Dodges",
        icon: "IconMessageExclamation",
        description: DODGE_DESCRIPTION,
      },
    });
    object = await dodgeObject();
    if (!object) throw new TwentyError("the dodge object was not created", 502);
  }
  if (object.description !== DODGE_DESCRIPTION)
    await renameInEngine("objects", object.id, { description: DODGE_DESCRIPTION });
  for (const field of FIELDS) {
    if (object.fields.some((each) => each.name === field.name)) continue;
    const body: Record<string, unknown> = { objectMetadataId: object.id, ...field };
    if (field.type === "SELECT")
      body.options = DODGE_STAGES.map((stage, position) => ({
        value: stage.value,
        label: stage.label,
        color: stage.color,
        position,
      }));
    await tw("/rest/metadata/fields", { method: "POST", body });
  }
  object = (await dodgeObject()) ?? object;
  const stage = object.fields.find((field) => field.name === "stage");
  if (!stage) throw new TwentyError("the dodge object has no Stage field", 502);

  const views = (await listMeta<MetaView>("views")).filter((each) => each.objectMetadataId === object.id);
  let view = await siteView("dodgeBoard", views, BOARD_VIEW, EARLIER_BOARD_VIEWS);
  if (!view) {
    view = unwrap(
      await tw<MetaView | { data: MetaView }>("/rest/metadata/views", {
        method: "POST",
        body: {
          name: BOARD_VIEW,
          objectMetadataId: object.id,
          type: "KANBAN",
          icon: "IconLayoutKanban",
          mainGroupByFieldMetadataId: stage.id,
        },
      }),
    );
    await saveViewId("dodgeBoard", view.id);
  }
  const groups = (await listMeta<MetaViewGroup>("viewGroups")).filter((group) => group.viewId === view.id);
  for (const [position, option] of DODGE_STAGES.entries()) {
    if (groups.some((group) => group.fieldValue === option.value)) continue;
    await tw("/rest/metadata/viewGroups", {
      method: "POST",
      body: { viewId: view.id, fieldValue: option.value, position, isVisible: true },
    });
  }
  return { objectId: object.id, viewId: view.id };
}

async function ensureModel(): Promise<Model> {
  if (model) return model;
  ensuring ??= ensureModelNow().finally(() => {
    ensuring = null;
  });
  model = await ensuring;
  return model;
}

/* ------------------------------------------------------------------ records ------------------------------------- */

interface RawDodge {
  id: string;
  name?: string | null;
  cardKey?: string | null;
  stage?: string | null;
  conversationId?: number | null;
  problem?: string | null;
  dodgeReply?: string | null;
  betterReply?: string | null;
  dueAt?: string | null;
  ownerAgentId?: number | null;
  position?: number | null;
  updatedAt: string;
  deletedAt?: string | null;
}

async function listDodges(): Promise<RawDodge[]> {
  const out: RawDodge[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const query = `depth=0&limit=200&order_by=position[AscNullsLast]${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`;
    const body = await tw<ListBody<RawDodge>>(`/rest/${DODGE_PLURAL}?${query}`);
    out.push(...rows(body, DODGE_PLURAL).filter((record) => !record.deletedAt));
    if (!body.pageInfo?.hasNextPage || !body.pageInfo.endCursor) break;
    after = body.pageInfo.endCursor;
  }
  return out;
}

async function boardGroups(viewId: string): Promise<MetaViewGroup[]> {
  return (await listMeta<MetaViewGroup>("viewGroups")).filter((group) => group.viewId === viewId);
}

/** When a card was last deleted (moved to the deleted records), so "saved at" counts deletes too. */
async function lastDelete(): Promise<string | null> {
  const filter = encodeURIComponent("deletedAt[is]:NOT_NULL");
  const body = await tw<ListBody<RawDodge>>(
    `/rest/${DODGE_PLURAL}?depth=0&limit=1&order_by=deletedAt[DescNullsLast]&filter=${filter}`,
  );
  return rows(body, DODGE_PLURAL)[0]?.deletedAt ?? null;
}

function columnOrderOf(groups: MetaViewGroup[]): DodgeColumn[] {
  const order = DODGE_STAGES.map((stage, index) => ({
    column: stage.column,
    position: groups.find((group) => group.fieldValue === stage.value)?.position ?? index,
    index,
  }));
  return order.sort((a, b) => a.position - b.position || a.index - b.index).map((each) => each.column);
}

const dateOnly = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");
const position = (record: RawDodge) => (typeof record.position === "number" ? record.position : 0);

function cardOf(record: RawDodge): DodgeCard | null {
  const column = columnOf(record.stage);
  if (!record.cardKey || !column || typeof record.conversationId !== "number") return null;
  return {
    kind: "card",
    id: record.cardKey,
    column,
    conversationId: record.conversationId,
    problem: record.problem ?? "",
    dodge: record.dodgeReply ?? "",
    betterReply: record.betterReply ?? "",
    dueDate: dateOnly(record.dueAt),
    ownerId: typeof record.ownerAgentId === "number" ? record.ownerAgentId : null,
  };
}

/** FNV-1a: the board's revision is a digest of every card's last change and the column order. */
function digest(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 1;
}

function revisionOf(records: RawDodge[], groups: MetaViewGroup[]) {
  const cards = records.map((record) => `${record.id}@${record.updatedAt}`).sort();
  const columns = columnOrderOf(groups);
  return digest(`${cards.join("|")}#${columns.join(",")}`);
}

function boardOf(records: RawDodge[], groups: MetaViewGroup[], deletedAt: string | null): DodgeBoard {
  // Column by column (default column order), each column by position: the order the board saved its items in (F-9).
  const cards = records
    .flatMap((record) => {
      const card = cardOf(record);
      return card ? [{ card, at: position(record) }] : [];
    })
    .sort((a, b) => COLUMN_IDS.indexOf(a.card.column) - COLUMN_IDS.indexOf(b.card.column) || a.at - b.at)
    .map(({ card }) => card);
  const latest = records.reduce<string | null>(
    (max, record) => (!max || record.updatedAt > max ? record.updatedAt : max),
    deletedAt,
  );
  return {
    items: [...cards, { kind: "columns", ids: columnOrderOf(groups) }],
    rev: revisionOf(records, groups),
    savedAt: latest,
  };
}

export async function readDodgeBoard(): Promise<DodgeBoard> {
  const { viewId } = await ensureModel();
  const [records, groups, deletedAt] = await Promise.all([listDodges(), boardGroups(viewId), lastDelete()]);
  return boardOf(records, groups, deletedAt);
}

/**
 * What the board is kept in, read back from the engine's metadata (no ids, no addresses): the object, its own fields
 * and the system fields the board uses (position = order in a column, updatedAt = the revision), and the column groups.
 */
export async function describeDodgeModel() {
  const { viewId } = await ensureModel();
  const object = await dodgeObject();
  if (!object) throw new TwentyError("the dodge object is missing", 502);
  const own = new Set<string>([...FIELDS.map((field) => field.name), "name", "position", "updatedAt", "deletedAt"]);
  const groups = await boardGroups(viewId);
  return {
    object: {
      nameSingular: object.nameSingular,
      namePlural: object.namePlural,
      labelSingular: object.labelSingular,
      labelPlural: object.labelPlural,
    },
    fields: object.fields
      .filter((field) => own.has(field.name))
      .map((field) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        ...(field.options?.length
          ? { options: [...field.options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((o) => o.value) }
          : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    view: BOARD_VIEW,
    columnGroups: [...groups]
      .filter((group) => group.fieldValue)
      .sort((a, b) => a.position - b.position)
      .map((group) => ({ stage: group.fieldValue, position: group.position, visible: group.isVisible })),
  };
}

/* ------------------------------------------------------------------ save ---------------------------------------- */

/**
 * New positions for one column, changing as few cards as possible: the cards whose current positions already rise in
 * the wanted order (the longest such run) keep them; the others get positions between their kept neighbours.
 */
function placeColumn(order: Array<number | undefined>): number[] {
  const n = order.length;
  const length = new Array<number>(n).fill(0);
  const before = new Array<number>(n).fill(-1);
  let best = -1;
  for (let i = 0; i < n; i++) {
    const own = order[i];
    if (own === undefined) continue;
    length[i] = 1;
    for (let j = 0; j < i; j++) {
      const other = order[j];
      if (other !== undefined && other < own && length[j] + 1 > length[i]) {
        length[i] = length[j] + 1;
        before[i] = j;
      }
    }
    if (best < 0 || length[i] > length[best]) best = i;
  }
  const kept = new Set<number>();
  for (let i = best; i >= 0; i = before[i]) kept.add(i);
  const out = new Array<number>(n);
  let i = 0;
  while (i < n) {
    if (kept.has(i)) {
      out[i] = order[i] as number;
      i++;
      continue;
    }
    let end = i;
    while (end < n && !kept.has(end)) end++;
    const low = i > 0 ? out[i - 1] : undefined;
    const high = end < n ? (order[end] as number) : undefined;
    const count = end - i;
    for (let k = 0; k < count; k++) {
      if (low !== undefined && high !== undefined) out[i + k] = low + ((high - low) * (k + 1)) / (count + 1);
      else if (low !== undefined) out[i + k] = low + k + 1;
      else if (high !== undefined) out[i + k] = high - (count - k);
      else out[i + k] = k;
    }
    i = end;
  }
  return out;
}

function payloadOf(card: DodgeCard, at: number) {
  return {
    name: `#${card.conversationId}: ${card.problem}`.slice(0, 120),
    cardKey: card.id,
    stage: stageValueOf(card.column),
    conversationId: card.conversationId,
    problem: card.problem,
    dodgeReply: card.dodge,
    betterReply: card.betterReply,
    dueAt: card.dueDate || null,
    ownerAgentId: card.ownerId,
    position: at,
  };
}

function changes(record: RawDodge, wanted: ReturnType<typeof payloadOf>) {
  const now = {
    name: record.name ?? "",
    cardKey: record.cardKey ?? "",
    stage: record.stage ?? null,
    conversationId: record.conversationId ?? null,
    problem: record.problem ?? "",
    dodgeReply: record.dodgeReply ?? "",
    betterReply: record.betterReply ?? "",
    dueAt: dateOnly(record.dueAt) || null,
    ownerAgentId: typeof record.ownerAgentId === "number" ? record.ownerAgentId : null,
    position: position(record),
  };
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(wanted)) if (now[key as keyof typeof now] !== value) patch[key] = value;
  return patch;
}

let writing: Promise<unknown> = Promise.resolve();

/** One save at a time, so two tabs saving together cannot both pass the revision check. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = writing.then(work, work);
  writing = run.catch(() => undefined);
  return run;
}

/**
 * Saves the board over revision `baseRev`: creates, changes and removes (into the engine's deleted records) only the
 * cards that differ, and moves the column groups when the column order changed. A board changed since `baseRev` is not
 * written over: DodgeConflict, with the revision now saved.
 */
export function saveDodgeBoard(cards: DodgeCard[], columnOrder: DodgeColumn[] | null, baseRev: number) {
  return serial(async (): Promise<DodgeBoard & { written: number }> => {
    const { viewId } = await ensureModel();
    const [records, groups] = await Promise.all([listDodges(), boardGroups(viewId)]);
    const rev = revisionOf(records, groups);
    if (rev !== baseRev) throw new DodgeConflict(rev);

    const byKey = new Map<string, RawDodge>();
    const extra: RawDodge[] = [];
    for (const record of records) {
      if (record.cardKey && !byKey.has(record.cardKey)) byKey.set(record.cardKey, record);
      else extra.push(record);
    }

    const creates: Array<ReturnType<typeof payloadOf>> = [];
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    for (const column of COLUMN_IDS) {
      const inColumn = cards.filter((card) => card.column === column);
      const placed = placeColumn(inColumn.map((card) => byKey.get(card.id)?.position ?? undefined));
      inColumn.forEach((card, index) => {
        const wanted = payloadOf(card, placed[index]);
        const record = byKey.get(card.id);
        if (!record) {
          creates.push(wanted);
          return;
        }
        const patch = changes(record, wanted);
        if (Object.keys(patch).length) updates.push({ id: record.id, patch });
      });
    }
    const keep = new Set(cards.map((card) => card.id));
    const removes = [
      ...extra.map((record) => record.id),
      ...[...byKey.entries()].filter(([key]) => !keep.has(key)).map(([, record]) => record.id),
    ];

    for (let start = 0; start < creates.length; start += 60)
      await tw(`/rest/batch/${DODGE_PLURAL}`, { method: "POST", body: creates.slice(start, start + 60) });
    for (const { id, patch } of updates)
      await tw(`/rest/${DODGE_PLURAL}/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
    for (const id of removes)
      await tw(`/rest/${DODGE_PLURAL}/${encodeURIComponent(id)}?soft_delete=true`, { method: "DELETE" });

    let groupMoves = 0;
    if (columnOrder) {
      for (const [index, column] of columnOrder.entries()) {
        const group = groups.find((each) => each.fieldValue === stageValueOf(column));
        if (group && group.position !== index) {
          await tw(`/rest/metadata/viewGroups/${group.id}`, { method: "PATCH", body: { position: index } });
          groupMoves++;
        }
      }
    }

    const written = creates.length + updates.length + removes.length + groupMoves;
    if (!written) return { ...boardOf(records, groups, await lastDelete()), written };
    const [nextRecords, nextGroups] = await Promise.all([listDodges(), boardGroups(viewId)]);
    return { ...boardOf(nextRecords, nextGroups, null), savedAt: new Date().toISOString(), written };
  });
}

export const DODGE_COLUMNS = COLUMN_IDS;
