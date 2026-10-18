// T-244 (Fahad item 94, decision 77.18): where the Tasks board is saved. Server only.
// One JSON file per space in .preview-state/tasks-board/ on the preview machine's disk; it never reads or writes
// .preview-state/studio-preview-state.json (the shared lists) or any browser storage (decision 78.2: no import).
//
// The contract that keeps every edit (also written in lobehub-team/claude-1/tasks94-svar-cards/CONTRACT.md):
// - every task carries `rev`; a save names the `baseRev` it was made from;
// - the save is refused (TaskConflictError -> 409 with the current task) when the task was saved since, so a client
//   holding an old copy can never overwrite the first save; the client keeps its edit and shows both;
// - saves are serialised per file and written to a temporary file then renamed, so a crash leaves the old or the new
//   file, never half of one; a file that cannot be read is never overwritten (writes stop until it is looked at).
// To move the tasks to another store later, keep these four functions and their errors; the route and page stay.

import {
  applyChanges,
  type BoardSnapshot,
  type BoardTask,
  InvalidTask,
  nextTaskId,
  seedTasks,
  type TaskChanges,
} from "@/app/(main)/dashboard/tasks/_board/model";
import { PRODUCT_NAME } from "@/config/app-config";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const TASKS_BOARD_DIR = path.join(process.cwd(), ".preview-state", "tasks-board");
export const LOCATION_LABEL = `${PRODUCT_NAME} preview server (this Mac's disk), shared by every browser`;

interface SavedBoard {
  version: 1;
  space: string;
  savedAt: string;
  tasks: BoardTask[];
}

export class TaskConflictError extends Error {
  constructor(readonly current: BoardTask) {
    super("this task was saved from another tab or device after you opened it");
  }
}

export class TaskNotFoundError extends Error {}

const fileOf = (space: string) => path.join(TASKS_BOARD_DIR, `${space}.json`);

async function readBoard(space: string): Promise<SavedBoard | null> {
  let raw: string;
  try {
    raw = await readFile(fileOf(space), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = (JSON.parse(raw) ?? {}) as SavedBoard;
  if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) throw new Error("saved tasks file has an unknown format");
  return parsed;
}

async function writeBoard(board: SavedBoard) {
  await mkdir(TASKS_BOARD_DIR, { recursive: true });
  const file = fileOf(board.space);
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(board, null, 2)}\n`, "utf8");
  await rename(temp, file);
}

// One queue per space: a save reads, checks the revision and writes before the next save starts.
const queues = new Map<string, Promise<unknown>>();
function serialised<T>(space: string, work: () => Promise<T>): Promise<T> {
  const run = (queues.get(space) ?? Promise.resolve()).then(work, work);
  queues.set(
    space,
    run.catch(() => undefined),
  );
  return run;
}

export async function loadBoard(space: string): Promise<BoardSnapshot> {
  const saved = await readBoard(space);
  return { space, location: LOCATION_LABEL, savedAt: saved?.savedAt ?? null, tasks: saved?.tasks ?? seedTasks() };
}

export function createTask(space: string, changes: TaskChanges): Promise<BoardTask> {
  return serialised(space, async () => {
    const saved = await readBoard(space);
    const tasks = saved?.tasks ?? seedTasks();
    if (!changes.title) throw new InvalidTask("title is required");
    const status = changes.status ?? "backlog";
    const now = new Date().toISOString();
    const lastOrder = Math.max(0, ...tasks.filter((task) => task.status === status).map((task) => task.order));
    const task = applyChanges(
      {
        id: nextTaskId(tasks),
        title: changes.title,
        description: "",
        status,
        priority: "medium",
        label: "feature",
        ownerId: null,
        followerIds: [],
        dueDate: null,
        order: lastOrder + 1,
        rev: 1,
        updatedAt: now,
      },
      { ...changes, status },
    );
    await writeBoard({ version: 1, space, savedAt: now, tasks: [...tasks, task] });
    return task;
  });
}

export function updateTask(space: string, id: string, baseRev: number, changes: TaskChanges): Promise<BoardTask> {
  return serialised(space, async () => {
    const saved = await readBoard(space);
    const tasks = saved?.tasks ?? seedTasks();
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new TaskNotFoundError(`no task ${id}`);
    if (current.rev !== baseRev) throw new TaskConflictError(current);
    const now = new Date().toISOString();
    const task = { ...applyChanges(current, changes), rev: current.rev + 1, updatedAt: now };
    await writeBoard({ version: 1, space, savedAt: now, tasks: tasks.map((each) => (each.id === id ? task : each)) });
    return task;
  });
}
