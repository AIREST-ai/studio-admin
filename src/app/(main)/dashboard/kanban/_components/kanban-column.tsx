"use client";

import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { ArrowLeft, ArrowRight, GripVertical, MoreVertical, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SortableTaskCard } from "./sortable-task-card";
import type { CardActions, Column, ColumnActions, Task } from "./types";

interface KanbanColumnProps {
  column: Column;
  index: number;
  columnCount: number;
  columns: Column[];
  tasks: Task[];
  totalCount: number;
  dragDisabled: boolean;
  cardActions: CardActions;
  columnActions: ColumnActions;
}

export function KanbanColumn({
  column,
  index,
  columnCount,
  columns,
  tasks,
  totalCount,
  dragDisabled,
  cardActions,
  columnActions,
}: KanbanColumnProps) {
  const columnSortable = useSortable({
    id: `column:${column.id}`,
    index,
    type: "column",
    accept: "column",
    group: "columns",
    data: { type: "column", columnId: column.id },
  });
  const taskDropTarget = useDroppable({
    id: column.id,
    type: "task-container",
    accept: "task",
    disabled: dragDisabled,
    collisionPriority: CollisionPriority.Low,
    data: { type: "task-container", columnId: column.id },
  });
  const cardWord = totalCount === 1 ? "card" : "cards";

  return (
    <section
      ref={columnSortable.ref}
      data-column-id={column.id}
      aria-label={column.title}
      className={cn(
        "flex min-h-0 flex-col rounded-t-xl border bg-muted/50 transition-colors",
        (columnSortable.isDropTarget || taskDropTarget.isDropTarget) && "bg-muted/70",
        columnSortable.isDragging && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-0.5">
            <Button
              ref={columnSortable.handleRef}
              variant="ghost"
              size="icon-xs"
              className="-ml-2 cursor-grab text-foreground/70 active:cursor-grabbing"
              aria-label={`Drag ${column.title} column`}
            >
              <GripVertical />
            </Button>
            <h2 className="truncate font-medium text-base leading-none">{column.title}</h2>
          </div>
          <p className="text-muted-foreground text-sm tabular-nums leading-none" data-card-count>
            {tasks.length === totalCount ? `${totalCount} ${cardWord}` : `${tasks.length} of ${totalCount} ${cardWord}`}
          </p>
          <p className="truncate text-muted-foreground text-xs leading-4">{column.hint}</p>
        </div>
        <div className="-mr-2 flex items-center gap-0.5 text-muted-foreground">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add card to ${column.title}`}
            onClick={() => columnActions.addCard(column.id)}
          >
            <Plus />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`${column.title} column actions`}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => columnActions.addCard(column.id)}>
                <Plus />
                Add card
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={index === 0} onSelect={() => columnActions.moveColumn(column.id, -1)}>
                <ArrowLeft />
                Move column left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === columnCount - 1}
                onSelect={() => columnActions.moveColumn(column.id, 1)}
              >
                <ArrowRight />
                Move column right
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={taskDropTarget.ref}
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1"
      >
        {tasks.map((task, taskIndex) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            columnId={column.id}
            index={taskIndex}
            columns={columns}
            actions={cardActions}
            dragDisabled={dragDisabled}
            isFirst={taskIndex === 0}
            isLast={taskIndex === tasks.length - 1}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
            {totalCount === 0 ? "No cards" : "No cards match"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
