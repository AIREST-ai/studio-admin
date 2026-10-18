// T-244 (Fahad items 94 and 96): one task record behind both views of the Tasks page, cards (default) and table.
// Shared by the page (task-board.tsx) and its own save route (src/app/api/tasks-board). Pure: no React, no fs.
// The Dodge board (/dashboard/kanban) is another feature: different record, route and file, never mixed in here.

import { PRODUCT_NAME } from "@/config/app-config";
import { agents } from "@/lib/cw/data";

import { tasks as sampleTasks } from "../_components/data";

/** The status columns, in board order (the same five statuses as the old tasks table). */
export const TASK_STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "Todo" },
  { id: "in progress", label: "In Progress" },
  { id: "done", label: "Done" },
  { id: "canceled", label: "Canceled" },
] as const;

export const TASK_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
] as const;

export const TASK_LABELS = [
  { id: "bug", label: "Bug" },
  { id: "feature", label: "Feature" },
  { id: "documentation", label: "Documentation" },
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];
export type TaskPriority = (typeof TASK_PRIORITIES)[number]["id"];
export type TaskLabel = (typeof TASK_LABELS)[number]["id"];

/** People who can own or follow a task: the Studio roster (src/lib/cw/data.ts), read only. */
export const TASK_PEOPLE = agents.map((agent) => ({ id: agent.id, name: agent.name }));

export const personName = (id: number | null) => TASK_PEOPLE.find((person) => person.id === id)?.name ?? null;

export interface BoardTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  label: TaskLabel;
  /** Decision 77.17: one owner (or nobody yet) ... */
  ownerId: number | null;
  /** ... and any number of followers, never including the owner. */
  followerIds: number[];
  /** yyyy-mm-dd or null. */
  dueDate: string | null;
  /** Position inside its status column, smallest first. */
  order: number;
  /** Decision 77.18 (no edit lost): +1 on every save; a save based on an older revision is refused (409). 0 = seed. */
  rev: number;
  updatedAt: string | null;
}

/** What the client may change on a task. Everything else (id, rev, updatedAt) belongs to the save route. */
export type TaskChanges = Partial<
  Pick<
    BoardTask,
    "title" | "description" | "status" | "priority" | "label" | "ownerId" | "followerIds" | "dueDate" | "order"
  >
>;

export interface BoardSnapshot {
  space: string;
  /** Where these tasks are saved, shown on the page (decision 77.18: the owner of the save sees and picks it). */
  location: string;
  savedAt: string | null;
  tasks: BoardTask[];
}

/** The save route answers 409 with this when the task was saved by someone else after the caller loaded it. */
export interface TaskConflict {
  error: string;
  current: BoardTask;
}

/** One board per space; `main` is the page. Tests use their own space so they never touch `main`. */
export const DEFAULT_SPACE = "main";
const SPACE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function parseSpace(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return DEFAULT_SPACE;
  return SPACE_PATTERN.test(value) ? value : null;
}

export class InvalidTask extends Error {}

const statusIds = TASK_STATUSES.map((status) => status.id) as string[];
const priorityIds = TASK_PRIORITIES.map((priority) => priority.id) as string[];
const labelIds = TASK_LABELS.map((label) => label.id) as string[];
const personIds = new Set(TASK_PEOPLE.map((person) => person.id));

function text(value: unknown, field: string, max: number, required: boolean): string {
  if (typeof value !== "string") throw new InvalidTask(`${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new InvalidTask(`${field} is required`);
  if (trimmed.length > max) throw new InvalidTask(`${field} is longer than ${max} characters`);
  return trimmed;
}

function oneOf<T extends string>(value: unknown, field: string, allowed: string[]): T {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new InvalidTask(`${field} is not one of ${allowed.join(", ")}`);
  return value as T;
}

function person(value: unknown, field: string): number {
  if (typeof value !== "number" || !personIds.has(value))
    throw new InvalidTask(`${field} is not a ${PRODUCT_NAME} member`);
  return value;
}

/** Throws InvalidTask unless every given field is valid. Unknown fields are refused, not ignored. */
export function validateChanges(input: unknown): TaskChanges {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InvalidTask("changes must be an object");
  const record = input as Record<string, unknown>;
  const allowed = ["title", "description", "status", "priority", "label", "ownerId", "followerIds", "dueDate", "order"];
  const extra = Object.keys(record).filter((key) => !allowed.includes(key));
  if (extra.length) throw new InvalidTask(`unknown fields: ${extra.join(", ")}`);
  const changes: TaskChanges = {};
  if ("title" in record) changes.title = text(record.title, "title", 300, true);
  if ("description" in record) changes.description = text(record.description, "description", 5000, false);
  if ("status" in record) changes.status = oneOf<TaskStatus>(record.status, "status", statusIds);
  if ("priority" in record) changes.priority = oneOf<TaskPriority>(record.priority, "priority", priorityIds);
  if ("label" in record) changes.label = oneOf<TaskLabel>(record.label, "label", labelIds);
  if ("ownerId" in record) changes.ownerId = record.ownerId === null ? null : person(record.ownerId, "ownerId");
  if ("followerIds" in record) {
    if (!Array.isArray(record.followerIds)) throw new InvalidTask("followerIds must be a list");
    changes.followerIds = [...new Set(record.followerIds.map((id) => person(id, "followerIds")))];
  }
  if ("dueDate" in record) {
    if (record.dueDate !== null && (typeof record.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.dueDate)))
      throw new InvalidTask("dueDate must be yyyy-mm-dd or null");
    changes.dueDate = record.dueDate as string | null;
  }
  if ("order" in record) {
    if (typeof record.order !== "number" || !Number.isFinite(record.order))
      throw new InvalidTask("order must be a number");
    changes.order = record.order;
  }
  return changes;
}

/** Applies validated changes; the owner is never also a follower. */
export function applyChanges(task: BoardTask, changes: TaskChanges): BoardTask {
  const next = { ...task, ...changes };
  next.followerIds = next.followerIds.filter((id) => id !== next.ownerId);
  return next;
}

/** First values of a board never saved: the sample tasks of the old table, nobody assigned yet (no browser data). */
export function seedTasks(): BoardTask[] {
  const perStatus = new Map<string, number>();
  return sampleTasks.map((task) => {
    const order = (perStatus.get(task.status) ?? 0) + 1;
    perStatus.set(task.status, order);
    return {
      id: task.id,
      title: task.title,
      description: "",
      status: task.status as TaskStatus,
      priority: task.priority as TaskPriority,
      label: task.label as TaskLabel,
      ownerId: null,
      followerIds: [],
      dueDate: null,
      order,
      rev: 0,
      updatedAt: null,
    };
  });
}

export function nextTaskId(tasks: BoardTask[]): string {
  const used = new Set(tasks.map((task) => task.id));
  let next = Math.max(0, ...tasks.map((task) => Number(task.id.replace(/^TASK-/, "")) || 0)) + 1;
  while (used.has(`TASK-${next}`)) next += 1;
  return `TASK-${next}`;
}
