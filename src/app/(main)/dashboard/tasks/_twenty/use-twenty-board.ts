"use client";
// M129-F (Fahad 129.6): the Tasks page's one store. Everything is read from and written to Twenty through this
// preview's own routes (/api/tasks-twenty/*), which call Twenty from the Next.js server; nothing is kept in the browser.
import * as React from "react";

import type { BoardTask, CustomFieldType, DeletedTask, TaskInput, TwentyBoard } from "@/lib/twenty/server";

export type Outcome<T = BoardTask> = { ok: true; value: T } | { ok: false; message: string };

async function call<T>(url: string, method: string, body?: unknown): Promise<Outcome<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, message: json.error ?? `HTTP ${response.status}` };
    return { ok: true, value: json as T };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export function useTwentyBoard() {
  const [board, setBoard] = React.useState<TwentyBoard | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(0);

  const reload = React.useCallback(async () => {
    const result = await call<TwentyBoard>("/api/tasks-twenty", "GET");
    if (result.ok) {
      setBoard(result.value);
      setLoadError(null);
    } else setLoadError(result.message);
    return result;
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const busy = React.useCallback(async <T>(work: () => Promise<T>) => {
    setPending((n) => n + 1);
    try {
      return await work();
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  const putTask = React.useCallback((task: BoardTask) => {
    setBoard((current) => {
      if (!current) return current;
      const exists = current.tasks.some((each) => each.id === task.id);
      return {
        ...current,
        tasks: exists ? current.tasks.map((each) => (each.id === task.id ? task : each)) : [...current.tasks, task],
      };
    });
  }, []);

  const create = React.useCallback(
    (task: TaskInput) =>
      busy(async (): Promise<Outcome> => {
        const result = await call<{ task: BoardTask }>("/api/tasks-twenty", "POST", { task });
        if (!result.ok) return result;
        putTask(result.value.task);
        return { ok: true, value: result.value.task };
      }),
    [busy, putTask],
  );

  const update = React.useCallback(
    (id: string, task: TaskInput) =>
      busy(async (): Promise<Outcome> => {
        const result = await call<{ task: BoardTask }>("/api/tasks-twenty", "PATCH", { id, task });
        if (!result.ok) return result;
        putTask(result.value.task);
        return { ok: true, value: result.value.task };
      }),
    [busy, putTask],
  );

  /**
   * F-5B: moves the task to Twenty's deleted records (DELETE /api/tasks-twenty/<id>, soft delete). The board drops
   * the card only after the server answered that Twenty confirmed it; on failure the board is left as it was.
   */
  const remove = React.useCallback(
    (id: string) =>
      busy(async (): Promise<Outcome<DeletedTask>> => {
        const result = await call<{ deleted: DeletedTask }>(`/api/tasks-twenty/${encodeURIComponent(id)}`, "DELETE");
        if (!result.ok) return result;
        setBoard((current) =>
          current ? { ...current, tasks: current.tasks.filter((each) => each.id !== id) } : current,
        );
        return { ok: true, value: result.value.deleted };
      }),
    [busy],
  );

  /** Card design: show or hide one field on every card (saved in the Twenty board view). */
  const setFieldVisible = React.useCallback(
    (fieldId: string, visible: boolean) =>
      busy(async (): Promise<Outcome<null>> => {
        setBoard((current) =>
          current
            ? { ...current, fields: current.fields.map((f) => (f.id === fieldId ? { ...f, visible } : f)) }
            : current,
        );
        const result = await call<{ ok: true }>("/api/tasks-twenty/layout", "PATCH", { fieldId, visible });
        if (!result.ok) {
          await reload();
          return result;
        }
        return { ok: true, value: null };
      }),
    [busy, reload],
  );

  const addField = React.useCallback(
    (label: string, type: CustomFieldType, options: string[]) =>
      busy(async (): Promise<Outcome<null>> => {
        const result = await call<{ field: unknown }>("/api/tasks-twenty/fields", "POST", { label, type, options });
        if (!result.ok) return result;
        await reload();
        return { ok: true, value: null };
      }),
    [busy, reload],
  );

  return { board, loadError, saving: pending > 0, reload, create, update, remove, setFieldVisible, addField };
}
