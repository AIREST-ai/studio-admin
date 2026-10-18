"use client";
// M129-F (Fahad 129.6): the Tasks page on Twenty (twentyhq/twenty v2.46.0, AGPL-3.0, local install), the ready task
// system Fahad asked for ("نظام مهام جاهز كامل من GitHub"). Tasks are read from and written to Twenty by this
// preview's server (/api/tasks-twenty); the browser never calls Twenty itself.
// - The board shows the running work: the status groups that are visible in the Twenty board view (TWENTY_BOARD_VIEW
//   in lib/twenty/server.ts, "AIREST board" since F-23).
// - Done, Canceled and On hold are separate sections, each opened by its own button (Fahad: "بأقسام يضغط زر فتظهر").
// - Filter by employee, with "All" first. F-8 (sim3 11.1c): the site's agents (Settings > Agents) first, then the
//   Twenty users who are not one of them (lib/twenty/agents.ts).
// - Card design: the client picks the fields on the card and adds custom fields (card-designer.tsx).
// - No link out to the Twenty app (F-16); what it has is on this page (F-18b: list views, Deleted with Restore).
// Drag pattern copied from the previous board (_board/task-cards-view.tsx, dnd-kit).
// F-18b (Fahad, 15 Oct 15:20: "المهام يجب أن تنقل كلها لدي ولا تنقل الروابط الى موقعهم"): the tasks server's own Task
// views are now tabs of this page: Board (its "By Status"), All tasks (its "All Tasks" table) and Assigned to me (its
// "Assigned to Me", grouped by status), next to the Done / On hold / Canceled sections, plus Deleted with Restore.
// Above them, summary numbers counted from the tasks just read (task-summary.tsx, task-table.tsx, deleted-tasks.tsx).
import * as React from "react";

import { CollisionPriority } from "@dnd-kit/abstract";
import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
} from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { LayoutTemplate, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CURRENT_USER_ID } from "@/lib/cw/data";
import { useCwShared } from "@/lib/cw/store";
import { assigneeChoices, assigneeValueOf, normalizeAssignee } from "@/lib/twenty/agents";
import type { BoardMember, BoardStatus, BoardTask, CardField } from "@/lib/twenty/server";

import { CardDesigner } from "./card-designer";
import { DeletedTasks, useDeletedTasks } from "./deleted-tasks";
import { type SummaryPick, TaskSummary } from "./task-summary";
import { EMPTY_FILTER, type TableFilter, TaskTable } from "./task-table";
import { dotClass, TwentyCard } from "./twenty-card";
import { AssigneeSelect, draftFrom, inputFrom, type TwentyDraft, TwentyTaskDialog } from "./twenty-task-dialog";
import { useTwentyBoard } from "./use-twenty-board";

// F-16 (Fahad 15 Oct 15:05 and 15:20): no link out to Twenty's own web app (it asks for its own sign-in) and no
// "Twenty" in the text. Everything is done on this page through /api/tasks-twenty.

type Columns = Record<string, BoardTask[]>;
const ALL = "all";
const UNASSIGNED = "unassigned";
// F-18b: the page's own tabs (the other sections are status values)
const LIST = "list";
const MINE = "mine";
const DELETED = "deleted";

function group(tasks: BoardTask[], statuses: BoardStatus[]): Columns {
  const columns: Columns = Object.fromEntries(statuses.map((s) => [s.value, [] as BoardTask[]]));
  for (const task of tasks) if (task.status && columns[task.status]) columns[task.status].push(task);
  for (const list of Object.values(columns))
    list.sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  return columns;
}

function locate(columns: Columns, id: string) {
  for (const [status, list] of Object.entries(columns)) {
    const index = list.findIndex((task) => task.id === id);
    if (index >= 0) return { status, index };
  }
  return null;
}

function positionBetween(before: BoardTask | undefined, after: BoardTask | undefined) {
  if (before && after) return (before.position + after.position) / 2;
  if (before) return before.position + 1;
  if (after) return after.position - 1;
  return 0;
}

const sensors = [
  PointerSensor,
  KeyboardSensor.configure({
    keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ["Space"], end: ["Space", "Tab"] },
  }),
];

function isTaskData(value: unknown): value is { type: "task"; task: BoardTask } {
  return typeof value === "object" && value !== null && "type" in value && value.type === "task" && "task" in value;
}

function SortableCard({
  task,
  status,
  index,
  fields,
  members,
  onOpen,
}: {
  task: BoardTask;
  status: string;
  index: number;
  fields: CardField[];
  members: BoardMember[];
  onOpen: (id: string) => void;
}) {
  const { isDragging, ref } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: "task",
    group: status,
    data: { type: "task", task, status },
  });
  return (
    // biome-ignore lint/a11y/useSemanticElements: dnd-kit gives this element role=button and tabindex; a <button> cannot hold the card's block content.
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          onOpen(task.id);
        }
      }}
      className={cn(
        "cursor-grab touch-none rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <TwentyCard task={task} fields={fields} members={members} />
    </div>
  );
}

function Column({
  status,
  tasks,
  fields,
  members,
  onOpen,
  onAdd,
}: {
  status: BoardStatus;
  tasks: BoardTask[];
  fields: CardField[];
  members: BoardMember[];
  onOpen: (id: string) => void;
  onAdd: (status: string) => void;
}) {
  const drop = useDroppable({
    id: status.value,
    type: "task-container",
    accept: "task",
    collisionPriority: CollisionPriority.Low,
    data: { type: "task-container", status: status.value },
  });
  return (
    <section
      aria-label={status.label}
      data-column={status.value}
      className={cn("flex min-h-0 flex-col rounded-t-xl border bg-muted/50", drop.isDropTarget && "bg-muted/70")}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 space-y-1.5">
          <h2 className="flex items-center gap-2 font-medium text-base leading-none">
            <span className={cn("size-2 rounded-full", dotClass(status.color))} aria-hidden />
            {status.label}
          </h2>
          <p className="text-muted-foreground text-sm tabular-nums leading-none">
            {`${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-2 text-muted-foreground"
          aria-label={`Add task to ${status.label}`}
          onClick={() => onAdd(status.value)}
        >
          <Plus />
        </Button>
      </div>
      <div ref={drop.ref} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        {tasks.map((task, index) => (
          <SortableCard
            key={task.id}
            task={task}
            status={status.value}
            index={index}
            fields={fields}
            members={members}
            onOpen={onOpen}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
            No tasks
          </p>
        ) : null}
      </div>
    </section>
  );
}

type DialogState = { mode: "create" | "edit"; task: BoardTask | null; draft: TwentyDraft } | null;

export function TwentyBoard() {
  const store = useTwentyBoard();
  const board = store.board;
  const [assignee, setAssignee] = React.useState<string>(ALL);
  const [section, setSection] = React.useState<string>("board");
  const [designOpen, setDesignOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  // F-18b: the All tasks list's search and filters, and the deleted tasks
  const [tableFilter, setTableFilter] = React.useState<TableFilter>(EMPTY_FILTER);
  const deleted = useDeletedTasks();

  // ?section=<status> and ?assignee=<agent:id | member:id> keep the open section and the filter in the address (no
  // browser storage). A bare Twenty user id (an older link) still works.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("section");
    const a = params.get("assignee");
    if (s) setSection(s);
    if (a) setAssignee(normalizeAssignee(a));
  }, []);
  // F-8: the site's agents, for the Assignee lists.
  const agents = useCwShared((state) => state.agents);
  const members = React.useMemo(() => board?.members ?? [], [board?.members]);
  const lists = React.useMemo(() => ({ agents, members }), [agents, members]);
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (section === "board") url.searchParams.delete("section");
    else url.searchParams.set("section", section);
    if (assignee === ALL) url.searchParams.delete("assignee");
    else url.searchParams.set("assignee", assignee);
    window.history.replaceState(null, "", url);
  }, [section, assignee]);

  const statuses = React.useMemo(() => board?.statuses ?? [], [board?.statuses]);
  const boardStatuses = statuses.filter((s) => s.onBoard);
  const sectionStatuses = statuses.filter((s) => !s.onBoard);
  const visibleTasks = React.useMemo(() => {
    const tasks = board?.tasks ?? [];
    if (assignee === ALL) return tasks;
    const wanted = assignee === UNASSIGNED ? "" : assignee;
    return tasks.filter((task) => assigneeValueOf(task, lists.agents, lists.members) === wanted);
  }, [board?.tasks, assignee, lists]);

  const [columns, setColumns] = React.useState<Columns>({});
  const before = React.useRef<Columns>({});
  const latest = React.useRef<Columns>({});
  React.useEffect(() => {
    if (!dragging) setColumns(group(visibleTasks, statuses));
  }, [visibleTasks, statuses, dragging]);

  function openTask(id: string) {
    const task = board?.tasks.find((each) => each.id === id);
    if (!task) return;
    setDialogError(null);
    setDialog({ mode: "edit", task, draft: draftFrom(task, task.status ?? "TODO", "", lists) });
  }

  function openNew(status: string) {
    setDialogError(null);
    const owner = assignee !== ALL && assignee !== UNASSIGNED ? assignee : "";
    setDialog({ mode: "create", task: null, draft: draftFrom(null, status, owner, lists) });
  }

  async function submit(draft: TwentyDraft) {
    if (!dialog || !board) return;
    const input = inputFrom(draft, board.fields, lists);
    const result = dialog.task ? await store.update(dialog.task.id, input) : await store.create(input);
    if (result.ok) {
      setDialog(null);
      const status = statuses.find((s) => s.value === result.value.status);
      if (status && !status.onBoard && section === "board")
        setNotice(`"${result.value.title}" is now in ${status.label}. Open the ${status.label} section to see it.`);
      else setNotice(null);
    } else setDialogError(result.message);
  }

  // F-5B: Delete task (from the task dialog, after its confirmation). The notice repeats what Twenty confirmed.
  async function remove(task: BoardTask): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await store.remove(task.id);
    if (!result.ok) return result;
    setDialog(null);
    // F-18b: Restore is on this page now (the Deleted tab)
    setNotice(`Deleted: "${result.value.title || task.title}". It can be restored from the Deleted tab.`);
    void deleted.reload();
    return { ok: true };
  }

  function onDragStart(event: DragStartEvent) {
    setDragging(true);
    if (event.operation.source?.type === "task") {
      before.current = columns;
      latest.current = columns;
    }
  }

  function onDragOver(event: DragOverEvent) {
    if (event.operation.source?.type !== "task") return;
    setColumns((current) => {
      latest.current = move(current, event);
      return latest.current;
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { source } = event.operation;
    setDragging(false);
    if (source?.type !== "task") return;
    if (event.canceled) {
      setColumns(before.current);
      return;
    }
    const id = String(source.id);
    const from = locate(before.current, id);
    const to = locate(latest.current, id);
    if (!from || !to || (from.status === to.status && from.index === to.index)) return;
    const list = latest.current[to.status];
    const result = await store.update(id, {
      status: to.status,
      position: positionBetween(list[to.index - 1], list[to.index + 1]),
    });
    if (!result.ok) {
      setNotice(`Not saved on the tasks server: ${result.message}. The tasks were reloaded.`);
      await store.reload();
    } else setNotice(null);
  }

  const countOf = (status: string) => visibleTasks.filter((task) => task.status === status).length;
  // F-18b: "Assigned to me" is the signed-in person's tasks (the preview's signed-in sample person, CURRENT_USER_ID),
  // as the tasks server's own view filters "Assignee is me".
  const me = agents.find((agent) => agent.id === CURRENT_USER_ID);
  const mineTasks = (board?.tasks ?? []).filter(
    (task) => assigneeValueOf(task, lists.agents, lists.members) === `agent:${CURRENT_USER_ID}`,
  );
  const isUnassigned = (task: BoardTask) => assigneeValueOf(task, lists.agents, lists.members) === "";
  function pick(choice: SummaryPick) {
    const filter: TableFilter = { ...EMPTY_FILTER };
    if (choice.kind === "open") filter.status = "open";
    if (choice.kind === "status") filter.status = choice.status;
    if (choice.kind === "overdue") filter.due = "overdue";
    if (choice.kind === "week") filter.due = "week";
    if (choice.kind === "unassigned") {
      filter.status = "open";
      filter.unassignedOnly = true;
    }
    setTableFilter(filter);
    setSection(LIST);
  }
  // F-18b round 2 (judge: "Assigned to me" opened with the filters of a summary card, "0 of 0"): a tab opens with no
  // filter; only a summary card opens the list with its own filter (pick above).
  function openTab(next: string) {
    setTableFilter(EMPTY_FILTER);
    setSection(next);
  }
  const openSection = sectionStatuses.find((s) => s.value === section);
  const sectionTasks = openSection ? (columns[openSection.value] ?? []) : [];

  return (
    <div className="flex h-[calc(100dvh-var(--dashboard-header-height))] min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0 space-y-1">
          <h1 className="font-semibold text-xl leading-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            Board, full list and your own tasks. Done, On hold and Canceled have their own sections.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setDesignOpen(true)} disabled={!board}>
            <LayoutTemplate data-icon="inline-start" />
            Card design
          </Button>
          <Button onClick={() => openNew(boardStatuses[0]?.value ?? "TODO")} disabled={!board}>
            <Plus data-icon="inline-start" />
            New task
          </Button>
        </div>
      </div>

      {board ? (
        <TaskSummary tasks={visibleTasks} statuses={statuses} isUnassigned={isUnassigned} onPick={pick} />
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 lg:px-6">
        <div role="group" aria-label="Sections" className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={section === "board" ? "secondary" : "ghost"}
            aria-pressed={section === "board"}
            onClick={() => openTab("board")}
          >
            Board
            <span className="text-muted-foreground tabular-nums">
              {boardStatuses.reduce((sum, s) => sum + countOf(s.value), 0)}
            </span>
          </Button>
          <Button
            size="sm"
            variant={section === LIST ? "secondary" : "ghost"}
            aria-pressed={section === LIST}
            data-section={LIST}
            onClick={() => openTab(LIST)}
          >
            All tasks
            <span className="text-muted-foreground tabular-nums">{visibleTasks.length}</span>
          </Button>
          <Button
            size="sm"
            variant={section === MINE ? "secondary" : "ghost"}
            aria-pressed={section === MINE}
            data-section={MINE}
            onClick={() => openTab(MINE)}
          >
            Assigned to me
            <span className="text-muted-foreground tabular-nums">{mineTasks.length}</span>
          </Button>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          {sectionStatuses.map((status) => (
            <Button
              key={status.value}
              size="sm"
              variant={section === status.value ? "secondary" : "ghost"}
              aria-pressed={section === status.value}
              data-section={status.value}
              onClick={() => openTab(section === status.value ? "board" : status.value)}
            >
              <span className={cn("size-2 rounded-full", dotClass(status.color))} aria-hidden />
              {status.label}
              <span className="text-muted-foreground tabular-nums">{countOf(status.value)}</span>
            </Button>
          ))}
          <Button
            size="sm"
            variant={section === DELETED ? "secondary" : "ghost"}
            aria-pressed={section === DELETED}
            data-section={DELETED}
            onClick={() => openTab(section === DELETED ? "board" : DELETED)}
          >
            Deleted
            <span className="text-muted-foreground tabular-nums">{deleted.tasks?.length ?? "…"}</span>
          </Button>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <label htmlFor="tasks-assignee" className="text-muted-foreground text-sm">
            Assignee
          </label>
          <AssigneeSelect
            id="tasks-assignee"
            size="sm"
            value={assignee}
            choices={assigneeChoices(agents, members)}
            first={[
              { value: ALL, label: "All" },
              { value: UNASSIGNED, label: "Unassigned" },
            ]}
            onChange={setAssignee}
            className="min-w-40"
          />
          <Button variant="ghost" size="icon-sm" aria-label="Reload tasks" onClick={() => void store.reload()}>
            <RefreshCw className={cn(store.saving && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs lg:px-6">
        <p role="status" data-testid="tasks-source" className="text-muted-foreground">
          {board
            ? `${store.saving ? "Saving… · " : ""}Saved on the tasks server · ${board.tasks.length} tasks`
            : store.loadError
              ? "The tasks server is not answering"
              : "Loading tasks…"}
        </p>
        {notice ? (
          <p role="alert" className="text-amber-700 dark:text-amber-400">
            {notice}
          </p>
        ) : null}
      </div>

      {store.loadError ? (
        <p role="alert" className="px-4 py-6 text-destructive text-sm lg:px-6">
          {`Tasks could not be loaded from the tasks server: ${store.loadError}. Nothing was changed.`}
        </p>
      ) : null}

      {board && section === "board" ? (
        <DragDropProvider sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden bg-muted/25 px-4 pt-4 lg:px-5 lg:pt-5">
            <div
              className="inline-grid h-full min-w-full gap-4"
              style={{ gridTemplateColumns: `repeat(${Math.max(boardStatuses.length, 1)}, minmax(17rem, 1fr))` }}
            >
              {boardStatuses.map((status) => (
                <Column
                  key={status.value}
                  status={status}
                  tasks={columns[status.value] ?? []}
                  fields={board.fields}
                  members={board.members}
                  onOpen={openTask}
                  onAdd={openNew}
                />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {(source) =>
              source.type === "task" && isTaskData(source.data) ? (
                <TwentyCard task={source.data.task} fields={board.fields} members={board.members} isOverlay />
              ) : null
            }
          </DragOverlay>
        </DragDropProvider>
      ) : null}

      {board && (section === LIST || section === MINE) ? (
        <TaskTable
          key={section}
          tasks={section === MINE ? mineTasks : visibleTasks}
          statuses={statuses}
          fields={board.fields}
          members={board.members}
          filter={tableFilter}
          onFilterChange={setTableFilter}
          groupDefault={section === MINE}
          title={section === MINE ? "Assigned to me" : "All tasks"}
          emptyText={
            section === MINE
              ? `No task is assigned to ${me?.name ?? "you"} yet. Pick ${me?.name ?? "yourself"} as the Assignee of a task to see it here.`
              : "No tasks yet."
          }
          onOpen={openTask}
        />
      ) : null}

      {board && section === DELETED ? (
        <DeletedTasks
          store={deleted}
          statuses={statuses}
          onRestored={(title) => {
            setNotice(`Restored: "${title}" is back with its status.`);
            void store.reload();
          }}
        />
      ) : null}

      {board && openSection ? (
        <section
          aria-label={`${openSection.label} section`}
          data-open-section={openSection.value}
          className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-4 py-4 lg:px-6"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium text-base">{`${openSection.label} · ${sectionTasks.length}`}</h2>
            <Button size="sm" variant="ghost" onClick={() => setSection("board")}>
              Back to the board
            </Button>
          </div>
          {sectionTasks.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
              {sectionTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  data-task-id={task.id}
                  className="rounded-xl text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => openTask(task.id)}
                >
                  <TwentyCard
                    task={task}
                    fields={board.fields}
                    members={board.members}
                    status={openSection}
                    showStatus
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed px-3 py-8 text-center text-muted-foreground text-sm">
              {`No ${openSection.label.toLowerCase()} tasks${assignee !== ALL ? " for this assignee" : ""}.`}
            </p>
          )}
        </section>
      ) : null}

      {board ? (
        <CardDesigner
          open={designOpen}
          onOpenChange={setDesignOpen}
          fields={board.fields}
          members={board.members}
          statuses={board.statuses}
          example={board.tasks.find((task) => task.status && boardStatuses.some((s) => s.value === task.status))}
          busy={store.saving}
          onToggle={async (fieldId, visible) => {
            const r = await store.setFieldVisible(fieldId, visible);
            return r.ok ? { ok: true } : { ok: false, message: r.message };
          }}
          onAdd={async (label, type, options) => {
            const r = await store.addField(label, type, options);
            return r.ok ? { ok: true } : { ok: false, message: r.message };
          }}
        />
      ) : null}

      {dialog && board ? (
        <TwentyTaskDialog
          key={dialog.task?.id ?? "new"}
          mode={dialog.mode}
          task={dialog.task}
          initial={dialog.draft}
          statuses={board.statuses}
          members={board.members}
          fields={board.fields}
          busy={store.saving}
          error={dialogError}
          onClose={() => setDialog(null)}
          onSubmit={(draft) => void submit(draft)}
          onDelete={dialog.task ? () => remove(dialog.task as BoardTask) : undefined}
        />
      ) : null}
    </div>
  );
}
