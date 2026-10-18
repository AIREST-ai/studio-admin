"use client";

import * as React from "react";

import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { ArrowUpDown, MoreHorizontal, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionConflict } from "@/lib/cw/persistence/client";
import { useCwShared } from "@/lib/cw/store";

import {
  addTask,
  type BoardView,
  boardFromItems,
  defaultView,
  deleteTask,
  draftFromTask,
  findColumnOf,
  isViewActive,
  moveColumn,
  moveTask,
  nextTaskId,
  type SortMode,
  shiftTask,
  type TaskDraft,
  taskFromDraft,
  toSavedItems,
  updateTask,
  viewTasks,
} from "./board";
import { loadDodgeBoard, saveDodgeBoard } from "./board-api";
import { CardDialog } from "./card-dialog";
import { columnIds, columns } from "./data";
import { KanbanColumn } from "./kanban-column";
import { conversationChoices, lastExchange } from "./seed";
import { TaskCard } from "./task-card";
import type { BoardState, CardActions, ColumnActions, ColumnId, Task } from "./types";
import { findTask } from "./utils";

interface KanbanProps {
  /** Unused since F-9 (the board comes from the preview server); kept for pages that still pass it. */
  initialBoard?: BoardState;
}

type TaskDragData = {
  type: "task";
  task: Task;
  columnId: ColumnId;
};

type SaveState =
  | { kind: "loading" }
  | { kind: "marked" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string }
  | { kind: "blocked"; message: string };

type DialogState = { mode: "create" | "edit"; taskId?: string; draft: TaskDraft } | null;

const sortLabels: Record<SortMode, string> = { board: "Board order", due: "Due date", customer: "Customer A–Z" };

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && columnIds.includes(value as ColumnId);
}

function isTaskDragData(value: unknown): value is TaskDragData {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "task" &&
    "task" in value &&
    typeof value.task === "object" &&
    value.task !== null &&
    "columnId" in value &&
    isColumnId(value.columnId)
  );
}

// F-9: what is saved (cards and column order), so an owner renamed in Settings > Agents is not a change to save.
const snapshot = (board: BoardState, columnOrder: ColumnId[]) => JSON.stringify(toSavedItems(board, columnOrder));
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// F-9: a new card starts from the first conversation of the inbox, its last agent reply and the question before it.
function emptyDraft(columnId: ColumnId): TaskDraft {
  const first = conversationChoices()[0]?.id ?? 0;
  return {
    conversationId: first,
    ...lastExchange(first),
    betterReply: "",
    dueDate: "",
    ownerId: null,
    columnId,
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function Kanban(_props: KanbanProps) {
  const agents = useCwShared((state) => state.agents);
  const ownerName = React.useCallback(
    (id: number | null) => (id === null ? "Unassigned" : (agents.find((a) => a.id === id)?.name ?? "Unassigned")),
    [agents],
  );
  const [board, setBoard] = React.useState<BoardState>({ detected: [], "in-progress": [], waiting: [], solved: [] });
  const [columnOrder, setColumnOrder] = React.useState<ColumnId[]>(columnIds);
  const [view, setView] = React.useState<BoardView>(defaultView);
  const [save, setSave] = React.useState<SaveState>({ kind: "loading" });
  const [dragging, setDragging] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const boardBeforeDrag = React.useRef<BoardState>(board);
  const lastSaved = React.useRef("");
  const rev = React.useRef(0);
  const queue = React.useRef<Promise<void>>(Promise.resolve());
  const orderedColumns = columnOrder.flatMap((columnId) => columns.find((column) => column.id === columnId) ?? []);
  const viewActive = isViewActive(view);
  const hydrated = save.kind !== "loading";
  const dragDisabled = viewActive || !hydrated || save.kind === "blocked";
  const allTasks = columnIds.flatMap((columnId) => board[columnId]);
  const channelOptions = [...new Set(allTasks.map((task) => task.channel))].sort();
  const ownerOptions = [...new Set(allTasks.map((task) => task.owner.name))].sort();

  // F-9: the board saved on the preview server, or the marked dodges until it is first saved.
  // F-20: read from /api/dodge-board (the board engine, board-api.ts), no longer the "dodgeBoard" section.
  const load = React.useCallback(async () => {
    try {
      const saved = await loadDodgeBoard<unknown>();
      const next = boardFromItems(saved.items, ownerName);
      rev.current = saved.rev;
      lastSaved.current = snapshot(next.board, next.columnOrder);
      setBoard(next.board);
      setColumnOrder(next.columnOrder);
      setSave(saved.items && saved.savedAt ? { kind: "saved", at: saved.savedAt } : { kind: "marked" });
    } catch (error) {
      setSave({ kind: "blocked", message: errorText(error) });
    }
  }, [ownerName]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loaded once; owner names follow the roster below.
  React.useEffect(() => {
    void load();
  }, []);

  // Owner names follow Settings > Agents (a renamed or new agent), without touching what is saved.
  React.useEffect(() => {
    setBoard((current) => {
      let changed = false;
      const next = Object.fromEntries(
        columnIds.map((columnId) => [
          columnId,
          current[columnId].map((task) => {
            const name = ownerName(task.ownerId);
            if (name === task.owner.name) return task;
            changed = true;
            return { ...task, owner: { ...task.owner, name } };
          }),
        ]),
      ) as BoardState;
      return changed ? next : current;
    });
  }, [ownerName]);

  // Save every finished change on top of the revision read last. Never while a drag is in flight, and never over a
  // board that could not be read. A board changed in another tab is not written over (409): the saved one is loaded.
  React.useEffect(() => {
    if (save.kind === "loading" || save.kind === "blocked" || dragging) return;
    const next = snapshot(board, columnOrder);
    if (next === lastSaved.current) return;
    lastSaved.current = next;
    const items = toSavedItems(board, columnOrder);
    setSave({ kind: "saving" });
    queue.current = queue.current.then(async () => {
      try {
        const saved = await saveDodgeBoard(items, rev.current);
        rev.current = saved.rev;
        setSave({ kind: "saved", at: saved.savedAt });
      } catch (error) {
        if (error instanceof SectionConflict) {
          toast.error("Not saved: the board was changed in another tab or device", {
            description: "The latest board is loaded now. Make the change again.",
          });
          await load();
          return;
        }
        console.error("Dodge board not saved", error);
        setSave({ kind: "error", message: errorText(error) });
      }
    });
  }, [board, columnOrder, dragging, save.kind, load]);

  // Coming back to the tab: read the saved board again, so a change made elsewhere shows without a reload.
  React.useEffect(() => {
    const onFocus = () => {
      if (!dragging && (save.kind === "saved" || save.kind === "marked")) void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dragging, save.kind, load]);

  function handleDragStart(event: DragStartEvent) {
    const { source } = event.operation;
    setDragging(true);

    if (source?.type === "task") {
      boardBeforeDrag.current = board;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.operation.source?.type === "task") {
      setBoard((currentBoard) => move(currentBoard, event));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation;
    setDragging(false);

    if (!source) {
      return;
    }

    if (event.canceled) {
      if (source.type === "task") {
        setBoard(boardBeforeDrag.current);
      }
      return;
    }

    if (source.type === "column") {
      setColumnOrder((currentOrder) => move(currentOrder, event));
    }
  }

  const cardActions: CardActions = {
    edit(id) {
      const columnId = findColumnOf(board, id);
      const task = findTask(board, id);
      if (columnId && task) setDialog({ mode: "edit", taskId: id, draft: draftFromTask(task, columnId) });
    },
    remove: setDeleteId,
    move: (id, columnId) => setBoard((current) => moveTask(current, id, columnId)),
    shift: (id, delta) => setBoard((current) => shiftTask(current, id, delta)),
  };

  const columnActions: ColumnActions = {
    addCard: (columnId) => setDialog({ mode: "create", draft: emptyDraft(columnId) }),
    moveColumn: (columnId, delta) => setColumnOrder((current) => moveColumn(current, columnId, delta)),
  };

  function handleDialogSubmit(draft: TaskDraft) {
    if (!dialog) return;
    const id = dialog.mode === "create" ? nextTaskId(draft.conversationId) : dialog.taskId;
    const task = id ? taskFromDraft(id, draft, ownerName) : null;
    if (task && dialog.mode === "create") setBoard((current) => addTask(current, draft.columnId, task));
    else if (task) setBoard((current) => updateTask(current, task, draft.columnId));
    setDialog(null);
  }

  // F-9: back to the dodges marked on the preview's conversations, saved for everyone like any other change.
  function handleReset() {
    const next = boardFromItems(null, ownerName);
    setBoard(next.board);
    setColumnOrder(next.columnOrder);
    setView(defaultView);
  }

  const deleteTarget = deleteId ? findTask(board, deleteId) : undefined;
  const filterCount = view.channels.length + view.owners.length;

  return (
    <div className="flex h-[calc(100dvh-var(--dashboard-header-height))] min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0 space-y-1">
          <h1 className="font-semibold text-xl leading-tight">Dodge board</h1>
          {/* F-9: what a dodge is, in AIREST's own words ("a reply that leaves the problem unsolved"). */}
          <p className="text-muted-foreground text-sm">
            A dodge is an agent reply that leaves the customer's problem unsolved. Each card is one, in a conversation
            of this preview, followed until the problem is solved.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center 2xl:justify-end">
          {/* F-13 (Fahad 125.4): a lens only; a click opens the box, closing it brings back the lens. */}
          <ExpandingSearch
            name="dodges"
            label="Search customers or problems"
            placeholder="Search customers"
            size="default"
            className="min-w-0 sm:w-64 2xl:w-56"
            value={view.query}
            onChange={(query) => setView((current) => ({ ...current, query }))}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <SlidersHorizontal data-icon="inline-start" />
                Filter
                {filterCount > 0 ? <span className="tabular-nums">({filterCount})</span> : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Channel</DropdownMenuLabel>
              {channelOptions.map((channel) => (
                <DropdownMenuCheckboxItem
                  key={channel}
                  checked={view.channels.includes(channel)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() =>
                    setView((current) => ({ ...current, channels: toggle(current.channels, channel) }))
                  }
                >
                  {channel}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Owner</DropdownMenuLabel>
              {ownerOptions.map((owner) => (
                <DropdownMenuCheckboxItem
                  key={owner}
                  checked={view.owners.includes(owner)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => setView((current) => ({ ...current, owners: toggle(current.owners, owner) }))}
                >
                  {owner}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={filterCount === 0}
                onSelect={() => setView((current) => ({ ...current, channels: [], owners: [] }))}
              >
                Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowUpDown data-icon="inline-start" />
                {view.sort === "board" ? "Sort" : `Sort: ${sortLabels[view.sort]}`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                value={view.sort}
                onValueChange={(value) => setView((current) => ({ ...current, sort: value as SortMode }))}
              >
                {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                  <DropdownMenuRadioItem key={mode} value={mode}>
                    {sortLabels[mode]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="w-full sm:w-auto" onClick={() => columnActions.addCard("detected")}>
            <Plus data-icon="inline-start" />
            New card
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Board actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setResetOpen(true)}>
                <RotateCcw />
                Reset to the marked dodges
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs lg:px-6">
        <p
          role="status"
          data-save-state={save.kind}
          className={cn(
            "text-muted-foreground",
            (save.kind === "error" || save.kind === "blocked") && "text-destructive",
          )}
        >
          {/* F-9: true to where the cards come from and where changes go (Fahad 99 and 129.2). */}
          {save.kind === "loading" && "Loading the board saved in this preview…"}
          {save.kind === "marked" &&
            "Preview — simulated: the dodges were marked by hand on this preview's conversations; no AI reviews conversations here. Changes are saved in this preview for everyone who opens it."}
          {save.kind === "saving" && "Saving in this preview…"}
          {save.kind === "saved" &&
            `Preview — simulated: dodges marked by hand on this preview's conversations. Saved in this preview at ${new Date(save.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, for everyone who opens it.`}
          {save.kind === "error" && `Not saved: ${save.message}. This change shows on this page only.`}
          {save.kind === "blocked" &&
            `The saved board could not be read (${save.message}). Nothing is saved on this page; reload to try again.`}
        </p>
        {save.kind === "blocked" ? (
          <Button variant="outline" size="xs" onClick={() => void load()}>
            Try again
          </Button>
        ) : null}
        {viewActive ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            Drag and Move up/down are off while search, filter or sort is on.
            <Button variant="link" size="xs" className="h-auto p-0" onClick={() => setView(defaultView)}>
              Show board order
            </Button>
          </p>
        ) : null}
      </div>

      <DragDropProvider onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden bg-muted/25 px-4 pt-4 pb-0 [scrollbar-color:var(--border)_transparent] lg:px-5 lg:pt-5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1">
          <div
            aria-busy={!hydrated}
            className={cn(
              "inline-grid h-full min-w-full grid-cols-[repeat(4,minmax(16rem,1fr))] gap-4",
              !hydrated && "invisible",
            )}
          >
            {orderedColumns.map((column, index) => (
              <KanbanColumn
                key={column.id}
                column={column}
                index={index}
                columnCount={orderedColumns.length}
                columns={orderedColumns}
                tasks={viewTasks(board[column.id], view)}
                totalCount={board[column.id].length}
                dragDisabled={dragDisabled}
                cardActions={cardActions}
                columnActions={columnActions}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {(source) => {
            if (source.type !== "task" || !isTaskDragData(source.data)) {
              return null;
            }

            const columnId = isSortable(source) && isColumnId(source.group) ? source.group : source.data.columnId;

            return <TaskCard task={source.data.task} columnId={columnId} isOverlay />;
          }}
        </DragOverlay>
      </DragDropProvider>

      {dialog ? (
        <CardDialog
          key={dialog.taskId ?? "new"}
          mode={dialog.mode}
          initialDraft={dialog.draft}
          agents={agents}
          onClose={() => setDialog(null)}
          onSubmit={handleDialogSubmit}
        />
      ) : null}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `${deleteTarget.customer}: ${deleteTarget.problem}. ` : ""}
              The card is removed from the board saved in this preview. The conversation is not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteId) setBoard((current) => deleteTask(current, deleteId));
                setDeleteId(null);
              }}
            >
              Delete card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to the marked dodges?</AlertDialogTitle>
            <AlertDialogDescription>
              The board saved in this preview goes back to the dodges marked on its conversations, in their first
              columns. Cards added here and the column order are replaced for everyone who opens the preview.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleReset}>
              Reset board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
