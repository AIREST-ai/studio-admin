"use client";
import type { ReactTable, RowData } from "@tanstack/react-table";
import { cn } from "cn";
import { Plus, Settings2, X } from "lucide-react";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/lib/data-table-features";

import { TaskPriorityFilter } from "./task-priority-filter";
import { TaskStatusFilter } from "./task-status-filter";

interface TasksToolbarProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  onAddTask?: () => void;
}

export function TasksToolbar<TData extends RowData>({ table, onAddTask }: TasksToolbarProps<TData>) {
  const isFiltered = table.state.columnFilters.length > 0;
  const searchValue = (table.getColumn("title")?.getFilterValue() as string | undefined) ?? "";
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide());
  const hiddenColumns = hideableColumns.filter((column) => !column.getIsVisible());

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {/* F-13 round 2 (Fahad 125.4): a lens only; a click opens the box, closing it brings back the lens. */}
        <ExpandingSearch
          name="tasks-sample"
          label="Filter tasks"
          placeholder="Filter tasks..."
          size="default"
          className="w-full sm:w-64"
          value={searchValue}
          onChange={(value) => {
            table.getColumn("title")?.setFilterValue(value);
            table.setPageIndex(0);
          }}
        />
        <TaskStatusFilter table={table} />
        <TaskPriorityFilter table={table} />
        {isFiltered && (
          <Button
            variant="destructive"
            onClick={() => {
              table.resetColumnFilters();
              table.setPageIndex(0);
            }}
          >
            <X data-icon="inline-start" />
            Reset
          </Button>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("ml-auto hidden lg:flex", hiddenColumns.length > 0 && "bg-muted text-foreground")}
            >
              <Settings2 data-icon="inline-start" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-38">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {hideableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {onAddTask && (
          <Button size="sm" onClick={onAddTask}>
            <Plus data-icon="inline-start" />
            Add task
          </Button>
        )}
      </div>
    </div>
  );
}
