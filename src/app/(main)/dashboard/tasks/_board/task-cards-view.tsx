"use client";
// T-244 round 2: the cards view, on the drag pattern of Studio's own board (dashboard/kanban/_components/kanban.tsx):
// dnd-kit DragDropProvider, `move` while dragging, DragOverlay. Unlike the Dodge board, a drop is saved on the
// server (via onMove) and the card goes back where it was if the save is refused.
import * as React from "react";

import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
} from "@dnd-kit/react";

import { type BoardTask, TASK_STATUSES, type TaskStatus } from "./model";
import { TaskCard } from "./task-card";
import { TaskColumn } from "./task-column";

type Board = Record<TaskStatus, BoardTask[]>;

export function groupByStatus(tasks: BoardTask[]): Board {
  const board = Object.fromEntries(TASK_STATUSES.map((status) => [status.id, [] as BoardTask[]])) as Board;
  for (const task of tasks) board[task.status]?.push(task);
  for (const status of TASK_STATUSES) board[status.id].sort((a, b) => a.order - b.order);
  return board;
}

function locate(board: Board, id: string): { status: TaskStatus; index: number } | null {
  for (const status of TASK_STATUSES) {
    const index = board[status.id].findIndex((task) => task.id === id);
    if (index >= 0) return { status: status.id, index };
  }
  return null;
}

/** A position between the neighbours the card was dropped between (orders are never renumbered). */
function orderBetween(before: BoardTask | undefined, after: BoardTask | undefined) {
  if (before && after) return (before.order + after.order) / 2;
  if (before) return before.order + 1;
  if (after) return after.order - 1;
  return 1;
}

// Enter opens a card, so only Space picks it up and drops it from the keyboard (arrows move it, Escape cancels).
const sensors = [
  PointerSensor,
  KeyboardSensor.configure({
    keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ["Space"], end: ["Space", "Tab"] },
  }),
];

function isTaskData(value: unknown): value is { type: "task"; task: BoardTask } {
  return typeof value === "object" && value !== null && "type" in value && value.type === "task" && "task" in value;
}

interface TaskCardsViewProps {
  tasks: BoardTask[];
  onOpen: (id: string) => void;
  onMove: (id: string, status: TaskStatus, order: number) => void;
  onAdd: (status: TaskStatus) => void;
}

export function TaskCardsView({ tasks, onOpen, onMove, onAdd }: TaskCardsViewProps) {
  const [board, setBoard] = React.useState<Board>(() => groupByStatus(tasks));
  const [dragging, setDragging] = React.useState(false);
  const before = React.useRef<Board>(board);
  const latest = React.useRef<Board>(board);

  // The store is the truth: show its tasks whenever they change, except in the middle of a drag.
  React.useEffect(() => {
    if (!dragging) setBoard(groupByStatus(tasks));
  }, [tasks, dragging]);

  function handleDragStart(event: DragStartEvent) {
    setDragging(true);
    if (event.operation.source?.type === "task") {
      before.current = board;
      latest.current = board;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.operation.source?.type !== "task") return;
    setBoard((current) => {
      latest.current = move(current, event);
      return latest.current;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation;
    setDragging(false);
    if (source?.type !== "task") return;
    if (event.canceled) {
      setBoard(before.current);
      return;
    }
    const id = String(source.id);
    const from = locate(before.current, id);
    const to = locate(latest.current, id);
    if (!from || !to || (from.status === to.status && from.index === to.index)) return;
    const column = latest.current[to.status];
    onMove(id, to.status, orderBetween(column[to.index - 1], column[to.index + 1]));
  }

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden bg-muted/25 px-4 pt-4 pb-0 [scrollbar-color:var(--border)_transparent] lg:px-5 lg:pt-5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1">
        <div className="inline-grid h-full min-w-full grid-cols-[repeat(5,minmax(16rem,1fr))] gap-4">
          {TASK_STATUSES.map((status) => (
            <TaskColumn
              key={status.id}
              status={status.id}
              title={status.label}
              tasks={board[status.id]}
              dragDisabled={false}
              onOpen={onOpen}
              onAdd={onAdd}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {(source) =>
          source.type === "task" && isTaskData(source.data) ? <TaskCard task={source.data.task} isOverlay /> : null
        }
      </DragOverlay>
    </DragDropProvider>
  );
}
