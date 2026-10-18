"use client";
import * as React from "react";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { cn } from "cn";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, RotateCcw, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/lib/data-table-features";

import { labels, priorities, statuses, type Task } from "./data";

export interface TaskRowActions {
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onToggleFavorite: (task: Task) => void;
  onLabelChange: (task: Task, label: string) => void;
  onDelete: (task: Task) => void;
}

export const TaskRowActionsContext = React.createContext<TaskRowActions | null>(null);

function TaskRowMenu({ task }: { task: Task }) {
  const actions = React.useContext(TaskRowActionsContext);
  // Edit/Delete open their dialog only once this menu has fully closed (after its exit animation). Opened earlier, the
  // closing menu still takes focus on pointer leave, the dialog's focus trap pulls it back and re-selects the title, and
  // the first typed character is replaced. Waiting also lets the menu hand focus back to its trigger first.
  const afterClose = React.useRef<(() => void) | null>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground data-[state=open]:bg-muted"
          data-task-menu={task.id}
        >
          <MoreHorizontal />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onCloseAutoFocus={() => {
          const run = afterClose.current;
          afterClose.current = null;
          run?.();
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            afterClose.current = () => actions?.onEdit(task);
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions?.onDuplicate(task)}>Make a copy</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions?.onToggleFavorite(task)}>
          {task.favorite ? "Remove from favorites" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Labels</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={task.label} onValueChange={(label) => actions?.onLabelChange(task, label)}>
              {labels.map((label) => (
                <DropdownMenuRadioItem key={label.value} value={label.value}>
                  {label.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            afterClose.current = () => actions?.onDelete(task);
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const statusStyles: Record<string, string> = {
  backlog: "border-muted-foreground/20 bg-muted text-muted-foreground",
  todo: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "in progress": "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300",
  canceled: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

function SortIcon({ sortDirection }: { sortDirection: false | "asc" | "desc" }) {
  if (sortDirection === "desc") {
    return <ArrowDown data-icon="inline-end" />;
  }

  if (sortDirection === "asc") {
    return <ArrowUp data-icon="inline-end" />;
  }

  return <ArrowUpDown data-icon="inline-end" />;
}

function TitleColumnHeader({ column }: { column: Column<DataTableFeatures, Task, unknown> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground data-[state=open]:bg-accent">
          Title
          <SortIcon sortDirection={column.getIsSorted()} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
          <ArrowUp />
          Asc
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
          <ArrowDown />
          Desc
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => column.clearSorting()}>
          <RotateCcw />
          Reset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const columns: ColumnDef<DataTableFeatures, Task>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Subscribe
        source={table.atoms.rowSelection}
        selector={() =>
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")
        }
      >
        {(checked) => (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-0.5"
          />
        )}
      </Subscribe>
    ),
    cell: ({ row }) => (
      <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
        {(checked) => (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-0.5"
          />
        )}
      </Subscribe>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "Task",
    cell: ({ row }) => <div className="w-20 font-mono text-muted-foreground text-sm">{row.getValue("id")}</div>,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => <TitleColumnHeader column={column} />,
    cell: ({ row }) => {
      const label = labels.find((label) => label.value === row.original.label);

      return (
        <div className="flex min-w-0 items-center gap-2">
          {row.original.favorite && (
            <span role="img" aria-label="Favorite" title="Favorite" className="shrink-0">
              <Star className="size-4 fill-amber-400 text-amber-400" />
            </span>
          )}
          {label && (
            <Badge className="rounded-sm bg-transparent" variant="outline">
              {label.label}
            </Badge>
          )}
          <span className="max-w-lg truncate font-medium text-sm">{row.getValue("title")}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = statuses.find((status) => status.value === row.getValue("status"));

      if (!status) {
        return null;
      }

      return (
        <Badge className={cn("gap-1.5 rounded-sm border font-medium", statusStyles[status.value])} variant="outline">
          {status.icon && <status.icon className="size-4" />}
          {status.label}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => {
      const priority = priorities.find((priority) => priority.value === row.getValue("priority"));

      if (!priority) {
        return null;
      }

      return (
        <div className="flex items-center gap-2 text-sm">
          {priority.icon && <priority.icon className="size-4 text-muted-foreground" />}
          {priority.label}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="text-right">
        <TaskRowMenu task={row.original} />
      </div>
    ),
  },
];
