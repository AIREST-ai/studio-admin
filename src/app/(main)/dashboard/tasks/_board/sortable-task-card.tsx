"use client";
// T-244 round 2: copy of dashboard/kanban/_components/sortable-task-card.tsx for task cards (same dnd-kit pattern,
// the whole card drags). dnd-kit makes the card a button (role, tabindex, drag instructions), so the card holds no
// other button or menu (axe nested-interactive): Enter or a click opens the task, Space then arrows drag it, and the
// status can also be changed in the editor. No delete here: tasks are never removed from this page.
import type * as React from "react";

import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";

import type { BoardTask, TaskStatus } from "./model";
import { TaskCard } from "./task-card";

interface SortableTaskCardProps {
  task: BoardTask;
  status: TaskStatus;
  index: number;
  dragDisabled: boolean;
  onOpen: (id: string) => void;
}

export function SortableTaskCard({ task, status, index, dragDisabled, onOpen }: SortableTaskCardProps) {
  const { isDragging, ref } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: "task",
    group: status,
    disabled: dragDisabled,
    data: { type: "task", task, status },
  });

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.target !== event.currentTarget) return;
    event.preventDefault();
    onOpen(task.id);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: dnd-kit gives this element role=button and tabindex; a <button> cannot hold the card's block content.
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      data-card-id={task.id}
      data-task-open={task.id}
      onClick={() => onOpen(task.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-grab touch-none rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <TaskCard task={task} />
    </div>
  );
}
