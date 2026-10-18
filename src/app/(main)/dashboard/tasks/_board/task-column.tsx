"use client";
// T-244 round 2: copy of dashboard/kanban/_components/kanban-column.tsx for the task status columns. The status
// columns are fixed (no column drag or reorder); cards drop on the column the same way as on Studio's board.
import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { cn } from "cn";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { BoardTask, TaskStatus } from "./model";
import { SortableTaskCard } from "./sortable-task-card";

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  tasks: BoardTask[];
  dragDisabled: boolean;
  onOpen: (id: string) => void;
  onAdd: (status: TaskStatus) => void;
}

export function TaskColumn({ status, title, tasks, dragDisabled, onOpen, onAdd }: TaskColumnProps) {
  const dropTarget = useDroppable({
    id: status,
    type: "task-container",
    accept: "task",
    disabled: dragDisabled,
    collisionPriority: CollisionPriority.Low,
    data: { type: "task-container", status },
  });

  return (
    <section
      data-column-id={status}
      aria-label={title}
      className={cn(
        "flex min-h-0 flex-col rounded-t-xl border bg-muted/50 transition-colors",
        dropTarget.isDropTarget && "bg-muted/70",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate font-medium text-base leading-none">{title}</h2>
          <p className="text-muted-foreground text-sm tabular-nums leading-none" data-card-count>
            {`${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-2 text-muted-foreground"
          aria-label={`Add task to ${title}`}
          onClick={() => onAdd(status)}
        >
          <Plus />
        </Button>
      </div>

      <div
        ref={dropTarget.ref}
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1"
      >
        {tasks.map((task, index) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            status={status}
            index={index}
            dragDisabled={dragDisabled}
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
