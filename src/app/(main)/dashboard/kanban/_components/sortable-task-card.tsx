"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { ArrowDown, ArrowRightLeft, ArrowUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TaskCard } from "./task-card";
import type { CardActions, Column, ColumnId, Task } from "./types";

interface SortableTaskCardProps {
  task: Task;
  columnId: ColumnId;
  index: number;
  columns: Column[];
  actions: CardActions;
  dragDisabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export function SortableTaskCard({
  task,
  columnId,
  index,
  columns,
  actions,
  dragDisabled,
  isFirst,
  isLast,
}: SortableTaskCardProps) {
  const { isDragging, ref } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: "task",
    group: columnId,
    disabled: dragDisabled,
    data: { type: "task", task, columnId },
  });

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="-mr-1.5 -my-1 text-muted-foreground"
          aria-label={`Actions for ${task.customer}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => actions.edit(task.id)}>
          <Pencil />
          Edit card
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRightLeft />
            Move to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {columns.map((column) => (
              <DropdownMenuItem
                key={column.id}
                disabled={column.id === columnId}
                onSelect={() => actions.move(task.id, column.id)}
              >
                {column.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem disabled={dragDisabled || isFirst} onSelect={() => actions.shift(task.id, -1)}>
          <ArrowUp />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={dragDisabled || isLast} onSelect={() => actions.shift(task.id, 1)}>
          <ArrowDown />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(task.id)}>
          <Trash2 />
          Delete card
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      ref={ref}
      data-card-id={task.id}
      className={cn(
        "touch-none rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isDragging && "opacity-30",
      )}
    >
      <TaskCard task={task} columnId={columnId} menu={menu} />
    </div>
  );
}
