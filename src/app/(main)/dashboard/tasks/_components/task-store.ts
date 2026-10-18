"use client";
import * as React from "react";

import { z } from "zod";

import { type Task, taskSchema } from "./data";

/**
 * Demo save for the tasks page: there is no tasks backend yet, so the list is kept in this browser's localStorage.
 * It survives a reload in the same browser only; other browsers and devices still see the sample data.
 */
export const TASKS_STORAGE_KEY = "studio-admin:tasks:v1";

const savedTasksSchema = z.object({
  version: z.literal(1),
  savedAt: z.string(),
  tasks: z.array(taskSchema),
});

export type TaskDraft = Pick<Task, "title" | "status" | "label" | "priority">;

export type TaskSaveState =
  | { status: "loading" }
  | { status: "saved"; savedAt: string | null }
  // read: the saved copy is broken and is never overwritten; write: the last save failed and the next change retries.
  | { status: "error"; kind: "read" | "write"; message: string };

/** Every change reports whether it was saved; the list on screen only changes when it was. */
export type SaveResult = { ok: true } | { ok: false; message: string };

function reason(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function nextTaskId(tasks: Task[]) {
  const used = new Set(tasks.map((task) => task.id));
  let next = Math.max(0, ...tasks.map((task) => Number(task.id.replace(/^TASK-/, "")) || 0)) + 1;
  while (used.has(`TASK-${next}`)) next += 1;
  return `TASK-${next}`;
}

export function useTaskStore(sample: Task[]) {
  const [tasks, setTasks] = React.useState(sample);
  const [save, setSave] = React.useState<TaskSaveState>({ status: "loading" });

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TASKS_STORAGE_KEY);
      if (raw === null) {
        setSave({ status: "saved", savedAt: null });
        return;
      }
      const parsed = savedTasksSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error("unexpected format");
      setTasks(parsed.data.tasks);
      setSave({ status: "saved", savedAt: parsed.data.savedAt });
    } catch (error) {
      // Keep the broken copy untouched; saving stays off until the user resets the demo data.
      setSave({
        status: "error",
        kind: "read",
        message: `Saved tasks could not be read (${reason(error)}). Changes will not be saved until you reset the demo data.`,
      });
    }
  }, []);

  // Save first, then show: a change that could not be stored never appears on screen as if it were saved.
  const commit = (next: Task[]): SaveResult => {
    if (save.status === "loading") return { ok: false, message: "Saved tasks are still loading. Try again." };
    if (save.status === "error" && save.kind === "read") return { ok: false, message: save.message };
    const savedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ version: 1, savedAt, tasks: next }));
    } catch (error) {
      const message = `Could not save in this browser (${reason(error)}).`;
      setSave({ status: "error", kind: "write", message });
      return { ok: false, message };
    }
    setTasks(next);
    setSave({ status: "saved", savedAt });
    return { ok: true };
  };

  const update = (id: string, patch: Partial<Task>) =>
    commit(tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)));

  return {
    tasks,
    save,
    create(draft: TaskDraft) {
      const task: Task = { id: nextTaskId(tasks), ...draft };
      return { ...commit([task, ...tasks]), task };
    },
    update(id: string, draft: TaskDraft) {
      return update(id, draft);
    },
    duplicate(id: string) {
      const index = tasks.findIndex((task) => task.id === id);
      if (index < 0) return null;
      const copy: Task = {
        ...tasks[index],
        id: nextTaskId(tasks),
        title: `${tasks[index].title} (copy)`,
        favorite: false,
      };
      return { ...commit([...tasks.slice(0, index + 1), copy, ...tasks.slice(index + 1)]), task: copy };
    },
    toggleFavorite(id: string): SaveResult {
      const task = tasks.find((item) => item.id === id);
      return task
        ? update(id, { favorite: !task.favorite })
        : { ok: false, message: `${id} is no longer in the list.` };
    },
    setLabel(id: string, label: string) {
      return update(id, { label });
    },
    remove(id: string) {
      return commit(tasks.filter((task) => task.id !== id));
    },
    reset(): SaveResult {
      try {
        window.localStorage.removeItem(TASKS_STORAGE_KEY);
      } catch (error) {
        const message = `Could not reset the demo data (${reason(error)}).`;
        // A broken saved copy stays protected from overwrites until a reset really succeeds.
        setSave({ status: "error", kind: save.status === "error" ? save.kind : "write", message });
        return { ok: false, message };
      }
      setTasks(sample);
      setSave({ status: "saved", savedAt: null });
      return { ok: true };
    },
  };
}

export type TaskStore = ReturnType<typeof useTaskStore>;
