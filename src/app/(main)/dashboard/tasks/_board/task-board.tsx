"use client";
// T-244 (Fahad items 94 and 96): the Tasks page. One task store (use-task-board.ts, saved by /api/tasks-board),
// two views of it: cards in status columns (default, built on Studio's own board components and dnd-kit) and a table.
// Round 2 replaced SVAR React Kanban with Studio's components (monitor 15:53/15:58, judge 16:54); SVAR is not used.
import * as React from "react";

import { cn } from "cn";
import { Columns3, Plus, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { TaskStatus } from "./model";
import { TaskCardsView } from "./task-cards-view";
import {
  changesFromDraft,
  draftFromTask,
  emptyDraft,
  type TaskConflictView,
  TaskDialog,
  type TaskDraft,
} from "./task-dialog";
import { TaskTableView } from "./task-table-view";
import { useTaskBoard } from "./use-task-board";

type View = "cards" | "table";
type DialogState = { mode: "create" | "edit"; taskId?: string; draft: TaskDraft } | null;

export function TaskBoard({ space }: { space: string }) {
  const store = useTaskBoard(space);
  const [view, setView] = React.useState<View>("cards");
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [conflict, setConflict] = React.useState<TaskConflictView | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function openDialog(next: DialogState) {
    setConflict(null);
    setDialogError(null);
    setDialog(next);
  }

  function openTask(id: string) {
    const task = store.tasks?.find((each) => each.id === id);
    if (task) openDialog({ mode: "edit", taskId: id, draft: draftFromTask(task) });
  }

  async function handleSubmit(draft: TaskDraft) {
    if (!dialog) return;
    const result =
      dialog.mode === "create" || !dialog.taskId
        ? await store.create(changesFromDraft(draft))
        : await store.save(dialog.taskId, changesFromDraft(draft));
    if (result.ok) setDialog(null);
    else if (result.conflict) setConflict({ theirs: result.conflict });
    else setDialogError(result.message);
  }

  async function handleSaveOnTop(draft: TaskDraft) {
    if (!dialog?.taskId || !conflict) return;
    const result = await store.save(dialog.taskId, changesFromDraft(draft), conflict.theirs.rev);
    if (result.ok) setDialog(null);
    else if (result.conflict) setConflict({ theirs: result.conflict });
    else setDialogError(result.message);
  }

  function handleKeepTheirs() {
    if (conflict) store.put(conflict.theirs);
    setDialog(null);
  }

  async function handleMove(id: string, status: TaskStatus, order: number) {
    const result = await store.save(id, { status, order });
    if (result.ok) {
      setNotice(null);
      return;
    }
    setNotice(
      result.conflict
        ? `${id} was changed by someone else, so the tasks were reloaded. Move it again if still needed.`
        : `Not saved: ${result.message}. The tasks were reloaded.`,
    );
    await store.reload();
  }

  let saveText = "Loading tasks…";
  if (store.tasks) {
    const when = store.savedAt
      ? `Last saved ${new Date(store.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
      : "Sample tasks, nothing saved yet";
    saveText = `${store.saving ? "Saving… · " : ""}Saved to: ${store.location} · ${when}`;
  }

  return (
    <div className="flex h-[calc(100dvh-var(--dashboard-header-height))] min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0 space-y-1">
          <h1 className="font-semibold text-xl leading-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">Drag a card to change its status. Open a task to edit it.</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(value) => value && setView(value as View)}
            aria-label="Tasks view"
          >
            <ToggleGroupItem value="cards" aria-label="Cards view">
              <Columns3 />
              Cards
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <Table2 />
              Table
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => openDialog({ mode: "create", draft: emptyDraft("backlog") })} disabled={!store.tasks}>
            <Plus data-icon="inline-start" />
            New task
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs lg:px-6">
        <p role="status" data-testid="tasks-save-state" className="text-muted-foreground">
          {saveText}
        </p>
        {notice ? (
          <p role="alert" className="text-destructive">
            {notice}
          </p>
        ) : null}
      </div>

      {store.loadError ? (
        <p role="alert" className="px-4 py-6 text-destructive text-sm lg:px-6">
          {`Tasks could not be loaded: ${store.loadError}. Nothing was changed.`}
        </p>
      ) : null}

      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !store.tasks && "invisible")} aria-busy={!store.tasks}>
        {store.tasks && view === "cards" ? (
          <TaskCardsView
            tasks={store.tasks}
            onOpen={openTask}
            onMove={handleMove}
            onAdd={(status) => openDialog({ mode: "create", draft: emptyDraft(status) })}
          />
        ) : null}
        {store.tasks && view === "table" ? <TaskTableView tasks={store.tasks} onOpen={openTask} /> : null}
      </div>

      {dialog ? (
        <TaskDialog
          key={dialog.taskId ?? "new"}
          mode={dialog.mode}
          taskId={dialog.taskId}
          initialDraft={dialog.draft}
          conflict={conflict}
          error={dialogError}
          busy={store.saving}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
          onKeepTheirs={handleKeepTheirs}
          onSaveOnTop={handleSaveOnTop}
        />
      ) : null}
    </div>
  );
}
