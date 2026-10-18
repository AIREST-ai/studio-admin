"use client";
// T-244: the one task store both views (cards and table) read and write. Everything goes through /api/tasks-board
// (see src/app/api/tasks-board/store.ts for the save contract); nothing is kept in browser storage.
import * as React from "react";

import type { BoardSnapshot, BoardTask, TaskChanges } from "./model";

export type SaveOutcome = { ok: true; task: BoardTask } | { ok: false; conflict?: BoardTask; message: string };

async function send(endpoint: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(endpoint, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

export function useTaskBoard(space: string) {
  const endpoint = `/api/tasks-board?space=${encodeURIComponent(space)}`;
  const [tasks, setTasks] = React.useState<BoardTask[] | null>(null);
  const [location, setLocation] = React.useState("");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(0);
  const tasksRef = React.useRef<BoardTask[]>([]);
  tasksRef.current = tasks ?? [];

  const reload = React.useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      const board = body as BoardSnapshot;
      setTasks(board.tasks);
      setLocation(board.location);
      setSavedAt(board.savedAt);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, [endpoint]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const put = React.useCallback((task: BoardTask) => {
    setTasks((current) => current?.map((each) => (each.id === task.id ? task : each)) ?? current);
  }, []);

  /** Saves changes made from `baseRev` (default: the revision on screen). Refused with the newer task if it moved on. */
  const save = React.useCallback(
    async (id: string, changes: TaskChanges, baseRev?: number): Promise<SaveOutcome> => {
      const base = baseRev ?? tasksRef.current.find((task) => task.id === id)?.rev ?? 0;
      setPending((n) => n + 1);
      try {
        const result = await send(endpoint, "PATCH", { id, baseRev: base, changes });
        if (result.status === 409)
          return { ok: false, conflict: result.body.current as BoardTask, message: result.body.error };
        if (result.status !== 200) return { ok: false, message: result.body.error ?? `HTTP ${result.status}` };
        const task = result.body.task as BoardTask;
        put(task);
        setSavedAt(task.updatedAt);
        return { ok: true, task };
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      } finally {
        setPending((n) => n - 1);
      }
    },
    [endpoint, put],
  );

  const create = React.useCallback(
    async (changes: TaskChanges): Promise<SaveOutcome> => {
      setPending((n) => n + 1);
      try {
        const result = await send(endpoint, "POST", { changes });
        if (result.status !== 201) return { ok: false, message: result.body.error ?? `HTTP ${result.status}` };
        const task = result.body.task as BoardTask;
        setTasks((current) => [...(current ?? []), task]);
        setSavedAt(task.updatedAt);
        return { ok: true, task };
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      } finally {
        setPending((n) => n - 1);
      }
    },
    [endpoint],
  );

  return { tasks, location, savedAt, loadError, saving: pending > 0, reload, save, create, put };
}
