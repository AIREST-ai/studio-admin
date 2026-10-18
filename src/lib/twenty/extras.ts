// F-18b (Fahad, 15 Oct 15:20: "المهام يجب أن تنقل كلها لدي ولا تنقل الروابط الى موقعهم"): the parts of the tasks
// server (Twenty v2.46.0) that the Tasks page did not show yet, read and written from the Next.js server only, so the
// page needs no link to the tasks server's own app:
//   - deleted tasks and Restore: REST PATCH /rest/tasks/:id/restore
//     https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/api/rest/core/controllers/rest-api-core.controller.ts
//   - a task's history (timelineActivities, actions created/updated/deleted/restored/linked/unlinked)
//     https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/modules/timeline/standard-objects/timeline-activity.workspace-entity.ts
//     https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-shared/src/timeline/TimelineActivityAction.ts
//   - who or what a task is about (taskTargets: a person, a company or an opportunity) and its files (attachments)
//     https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/modules/task/standard-objects/task-target.workspace-entity.ts
// Only the route handlers under /api/tasks-twenty import this file (the API key stays on the server, see ./server.ts).
import { TwentyError, tw } from "./server";

type ListBody<T> = { data: T[] | Record<string, T[]> };

function rowsOf<T>(body: ListBody<T>, key: string): T[] {
  if (Array.isArray(body.data)) return body.data;
  return (body.data?.[key] as T[] | undefined) ?? [];
}

const quoted = (id: string) => `"${id.replace(/"/g, "")}"`;

/* ------------------------------------------------------------------ deleted tasks + restore ------------------- */

export interface DeletedTaskRow {
  id: string;
  title: string;
  status: string | null;
  dueAt: string | null;
  deletedAt: string;
  createdAt: string;
}

interface RawTask {
  id: string;
  title?: string | null;
  status?: string | null;
  dueAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

/** Tasks moved to the deleted records (soft delete), newest first. A filter on deletedAt lists them (v2.46.0). */
export async function listDeletedTasks(): Promise<DeletedTaskRow[]> {
  const filter = encodeURIComponent("deletedAt[is]:NOT_NULL");
  const body = await tw<ListBody<RawTask>>(
    `/rest/tasks?depth=0&limit=200&filter=${filter}&order_by=deletedAt[DescNullsLast]`,
  );
  return rowsOf(body, "tasks")
    .filter((task) => task.deletedAt)
    .map((task) => ({
      id: task.id,
      title: task.title ?? "",
      status: task.status ?? null,
      dueAt: task.dueAt ?? null,
      deletedAt: task.deletedAt as string,
      createdAt: task.createdAt,
    }));
}

/** Brings a deleted task back, then reads it back to prove it is no longer deleted. */
export async function restoreTask(id: string): Promise<{ id: string; title: string; status: string | null }> {
  await tw(`/rest/tasks/${encodeURIComponent(id)}/restore`, { method: "PATCH" });
  const filter = encodeURIComponent(`id[eq]:${quoted(id)}`);
  const check = await tw<ListBody<RawTask>>(`/rest/tasks?depth=0&limit=1&filter=${filter}`);
  const task = rowsOf(check, "tasks")[0];
  if (!task || task.deletedAt) throw new TwentyError("it answered the restore, but the task is still deleted", 502);
  return { id: task.id, title: task.title ?? "", status: task.status ?? null };
}

/* ------------------------------------------------------------------ one task: history, links, files ----------- */

export interface ActivityEntry {
  id: string;
  happensAt: string;
  /** created | updated | deleted | restored | linked | unlinked */
  action: string;
  /** The workspace member who did it, when the tasks server recorded one. */
  by: string | null;
  /** What changed, one line per field ("Status: To do → In progress"). */
  changes: string[];
  /** The linked record's name for linked/unlinked entries. */
  linked: string | null;
}

export interface TaskRelation {
  kind: "person" | "company" | "opportunity";
  name: string;
  detail: string;
}

export interface TaskFile {
  id: string;
  name: string;
  type: string;
  createdAt: string;
}

export interface TaskActivity {
  history: ActivityEntry[];
  relations: TaskRelation[];
  files: TaskFile[];
}

interface RawActivity {
  id: string;
  happensAt?: string | null;
  createdAt: string;
  name?: string | null;
  timelineActivityTypeSnapshot?: { name?: string | null; action?: string | null } | null;
  properties?: Record<string, unknown> | null;
  workspaceMemberId?: string | null;
  linkedRecordCachedName?: string | null;
}

const ACTIONS = ["created", "updated", "deleted", "restored", "linked", "unlinked"];

/** Field names of a Task as a person reads them (custom fields keep their own label from the metadata). */
const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  status: "Status",
  dueAt: "Due date",
  assigneeId: "Assignee",
  assignee: "Assignee",
  bodyV2: "Description",
  position: "Position",
};
const HIDDEN_FIELDS = new Set(["position", "updatedAt", "createdAt", "searchVector", "updatedBy", "createdBy", "id"]);

function valueText(value: unknown, field: string, names: Map<string, string>): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (field === "assigneeId" || field === "assignee") return names.get(String(value)) ?? "a user";
  if (field === "bodyV2" && typeof value === "object")
    return String((value as { markdown?: string }).markdown ?? "").slice(0, 60) || "empty";
  if (field === "dueAt" && typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }
  if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
  return String(value).slice(0, 80);
}

function changesOf(
  properties: Record<string, unknown> | null | undefined,
  labels: Map<string, string>,
  optionLabels: Map<string, Map<string, string>>,
  names: Map<string, string>,
) {
  const diff = (properties?.diff ?? null) as Record<string, { before?: unknown; after?: unknown }> | null;
  if (!diff || typeof diff !== "object") return [];
  return (
    Object.entries(diff)
      .filter(([field]) => !HIDDEN_FIELDS.has(field))
      .map(([field, change]) => {
        const label = FIELD_LABEL[field] ?? labels.get(field) ?? field;
        if (field === "bodyV2") return `${label} changed`;
        const options = optionLabels.get(field);
        const text = (value: unknown) =>
          options && typeof value === "string" ? (options.get(value) ?? value) : valueText(value, field, names);
        let before = text(change?.before);
        let after = text(change?.after);
        // a due date moved within the same day: show the times too
        if (
          field === "dueAt" &&
          before === after &&
          typeof change?.before === "string" &&
          typeof change?.after === "string"
        ) {
          before = change.before.slice(0, 16).replace("T", " ");
          after = change.after.slice(0, 16).replace("T", " ");
        }
        return before === after ? "" : `${label}: ${before} → ${after}`;
      })
      // F-18b round 2: a change that left the value as it was (the same due time written again) says nothing
      .filter(Boolean)
  );
}

interface MetaObject {
  nameSingular: string;
  fields: { name: string; label: string; options?: { value: string; label: string }[] | null }[];
}

async function taskLabels() {
  const body = await tw<ListBody<MetaObject>>("/rest/metadata/objects?limit=200");
  const task = rowsOf(body, "objects").find((object) => object.nameSingular === "task");
  const labels = new Map((task?.fields ?? []).map((field) => [field.name, field.label]));
  // Select fields (Status, Channel, …) are stored by value ("IN_PROGRESS") and read by their label ("In progress")
  const optionLabels = new Map(
    (task?.fields ?? [])
      .filter((field) => field.options?.length)
      .map((field) => [field.name, new Map((field.options ?? []).map((option) => [option.value, option.label]))]),
  );
  return { labels, optionLabels };
}

async function memberNames() {
  const body = await tw<
    ListBody<{ id: string; name?: { firstName?: string; lastName?: string } | null; userEmail?: string }>
  >("/rest/workspaceMembers?limit=200");
  return new Map(
    rowsOf(body, "workspaceMembers").map((member) => [
      member.id,
      `${member.name?.firstName ?? ""} ${member.name?.lastName ?? ""}`.trim() || member.userEmail || "a user",
    ]),
  );
}

interface RawTarget {
  id: string;
  targetPerson?: {
    name?: { firstName?: string; lastName?: string } | null;
    emails?: { primaryEmail?: string } | null;
    phones?: { primaryPhoneNumber?: string } | null;
  } | null;
  targetCompany?: { name?: string | null; domainName?: { primaryLinkUrl?: string } | null } | null;
  targetOpportunity?: { name?: string | null; stage?: string | null } | null;
}

interface RawAttachment {
  id: string;
  name?: string | null;
  fileCategory?: string | null;
  type?: string | null;
  file?: { label?: string; extension?: string }[] | null;
  createdAt: string;
}

export async function taskActivity(id: string): Promise<TaskActivity> {
  const taskFilter = (field: string) => encodeURIComponent(`${field}[eq]:${quoted(id)}`);
  const [activities, targets, attachments, names, meta] = await Promise.all([
    tw<ListBody<RawActivity>>(
      `/rest/timelineActivities?depth=0&limit=60&filter=${taskFilter("targetTaskId")}&order_by=happensAt[DescNullsLast]`,
    ),
    tw<ListBody<RawTarget>>(`/rest/taskTargets?depth=1&limit=50&filter=${taskFilter("taskId")}`),
    tw<ListBody<RawAttachment>>(`/rest/attachments?depth=0&limit=50&filter=${taskFilter("targetTaskId")}`),
    memberNames(),
    taskLabels(),
  ]);

  const history = rowsOf(activities, "timelineActivities").map((raw): ActivityEntry => {
    const name = raw.timelineActivityTypeSnapshot?.name ?? raw.name ?? "";
    const fromName = name.split(".")[1] ?? "";
    const action = raw.timelineActivityTypeSnapshot?.action ?? (ACTIONS.includes(fromName) ? fromName : "linked");
    return {
      id: raw.id,
      happensAt: raw.happensAt ?? raw.createdAt,
      action,
      by: raw.workspaceMemberId ? (names.get(raw.workspaceMemberId) ?? null) : null,
      changes: changesOf(raw.properties, meta.labels, meta.optionLabels, names),
      linked: raw.linkedRecordCachedName ?? null,
    };
  });

  const relations = rowsOf(targets, "taskTargets").flatMap((target): TaskRelation[] => {
    if (target.targetPerson) {
      const p = target.targetPerson;
      const name = `${p.name?.firstName ?? ""} ${p.name?.lastName ?? ""}`.trim() || p.emails?.primaryEmail || "Person";
      const detail = [p.emails?.primaryEmail, p.phones?.primaryPhoneNumber].filter(Boolean).join(" · ");
      return [{ kind: "person", name, detail }];
    }
    if (target.targetCompany)
      return [
        {
          kind: "company",
          name: target.targetCompany.name ?? "Company",
          detail: target.targetCompany.domainName?.primaryLinkUrl ?? "",
        },
      ];
    if (target.targetOpportunity)
      return [
        {
          kind: "opportunity",
          name: target.targetOpportunity.name ?? "Opportunity",
          detail: target.targetOpportunity.stage ?? "",
        },
      ];
    return [];
  });

  const files = rowsOf(attachments, "attachments").map(
    (file): TaskFile => ({
      id: file.id,
      name: file.file?.[0]?.label ?? file.name ?? "File",
      type: file.file?.[0]?.extension ?? file.fileCategory ?? file.type ?? "",
      createdAt: file.createdAt,
    }),
  );

  return { history, relations, files };
}
