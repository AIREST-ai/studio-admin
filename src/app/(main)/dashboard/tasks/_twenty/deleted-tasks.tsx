"use client";
// F-18b (Fahad, 15 Oct 15:20: "ولا تنقل الروابط الى موقعهم"): deleted tasks and Restore inside the Tasks page. A task
// deleted from the page is moved to the tasks server's deleted records (soft delete, F-5B); until now it could only be
// restored in the tasks server's own app. The server restores it (REST PATCH /rest/tasks/:id/restore, v2.46.0:
// https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/api/rest/core/controllers/rest-api-core.controller.ts)
// through /api/tasks-twenty/deleted, then reads the task back to prove it.
import * as React from "react";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DeletedTaskRow } from "@/lib/twenty/extras";
import type { BoardStatus } from "@/lib/twenty/server";

import { formatDate, StatusPill } from "./twenty-card";

type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

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

/** The deleted tasks, read once when the page opens and again after a delete or a restore. */
export function useDeletedTasks() {
  const [tasks, setTasks] = React.useState<DeletedTaskRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const reload = React.useCallback(async () => {
    const result = await call<{ tasks: DeletedTaskRow[] }>("/api/tasks-twenty/deleted", "GET");
    if (result.ok) {
      setTasks(result.value.tasks);
      setError(null);
    } else setError(result.message);
  }, []);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  const restore = React.useCallback(async (id: string) => {
    const result = await call<{ restored: { id: string; title: string } }>("/api/tasks-twenty/deleted", "PATCH", {
      id,
    });
    if (result.ok) setTasks((current) => current?.filter((task) => task.id !== id) ?? current);
    return result;
  }, []);
  return { tasks, error, reload, restore };
}

const timeFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function DeletedTasks({
  store,
  statuses,
  onRestored,
}: {
  store: ReturnType<typeof useDeletedTasks>;
  statuses: BoardStatus[];
  onRestored: (title: string) => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function restore(task: DeletedTaskRow) {
    setBusy(task.id);
    setMessage(null);
    const result = await store.restore(task.id);
    setBusy(null);
    if (result.ok) {
      const status = statuses.find((s) => s.value === task.status)?.label ?? "its status";
      setMessage({
        tone: "ok",
        text: `Restored: "${result.value.restored.title || task.title}" is back in ${status}.`,
      });
      onRestored(result.value.restored.title || task.title);
    } else setMessage({ tone: "error", text: `Not restored: ${result.message}. Nothing was changed.` });
  }

  return (
    <section
      aria-label="Deleted tasks"
      data-open-section="deleted"
      className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-4 py-4 lg:px-6"
    >
      <div className="mb-3 space-y-1">
        <h2 className="font-medium text-base">{`Deleted · ${store.tasks?.length ?? "…"}`}</h2>
        <p className="text-muted-foreground text-sm">
          Deleted tasks stay here until they are restored. Restore puts a task back with its status, assignee and
          fields.
        </p>
      </div>
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "mb-3 text-destructive text-sm"
              : "mb-3 text-emerald-700 text-sm dark:text-emerald-400"
          }
        >
          {message.text}
        </p>
      ) : null}
      {store.error ? (
        <p role="alert" className="text-destructive text-sm">{`Deleted tasks could not be loaded: ${store.error}`}</p>
      ) : !store.tasks ? (
        <p className="text-muted-foreground text-sm">Loading deleted tasks…</p>
      ) : store.tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-8 text-center text-muted-foreground text-sm">
          No deleted tasks.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-4 py-2 text-start font-medium">
                  Title
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  Due date
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  Deleted
                </th>
                <th scope="col" className="px-4 py-2 text-end font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {store.tasks.map((task) => (
                <tr key={task.id} data-deleted-task={task.id} className="border-b last:border-b-0">
                  <td className="max-w-96 px-4 py-2 font-medium">
                    <span className="line-clamp-2 [unicode-bidi:plaintext]">{task.title || "Untitled"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusPill status={statuses.find((s) => s.value === task.status)} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {formatDate(task.dueAt) || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular-nums">
                    {timeFmt.format(new Date(task.deletedAt))}
                  </td>
                  <td className="px-4 py-2 text-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void restore(task)}
                      aria-label={`Restore ${task.title || "task"}`}
                    >
                      <RotateCcw data-icon="inline-start" />
                      {busy === task.id ? "Restoring…" : "Restore"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
