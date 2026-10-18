"use client";
import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { cn } from "cn";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataTableFeatures } from "@/lib/data-table-features";

import { columns, type TaskRowActions, TaskRowActionsContext } from "./columns";
import type { Task } from "./data";
import { ConfirmDialog, TaskFormDialog } from "./task-dialogs";
import { type SaveResult, type TaskSaveState, useTaskStore } from "./task-store";
import { TasksToolbar } from "./tasks-toolbar";

interface TasksProps {
  data: Task[];
}

function preventPaginationNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

function getPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 3) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, 3];
  if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];

  return [currentPage - 1, currentPage, currentPage + 1];
}

function SaveNotice({ save, onReset }: { save: TaskSaveState; onReset: () => void }) {
  if (save.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-destructive text-sm">
        <span>
          Demo save: {save.message}
          {save.kind === "write" ? " Nothing was changed; the last saved tasks are kept. Try the change again." : null}
        </span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={onReset}>
          Reset demo data
        </Button>
      </div>
    );
  }

  const savedAt = save.status === "saved" ? save.savedAt : null;
  let detail = "Loading saved tasks…";
  if (savedAt) {
    detail = `Last saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
  } else if (save.status === "saved") {
    detail = "Showing sample data.";
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm" aria-live="polite">
      <span>Demo save: changes are kept in this browser only (no server). {detail}</span>
      {savedAt ? (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={onReset}>
          Reset demo data
        </Button>
      ) : null}
    </div>
  );
}

export function Tasks({ data }: TasksProps) {
  const store = useTaskStore(data);
  const [form, setForm] = React.useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [toDelete, setToDelete] = React.useState<Task | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useTable({
    features: dataTableFeatures,
    data: store.tasks,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    // Editing a row must not send the user back to page 1; an emptied last page is clamped below instead.
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });
  const pageIndex = table.state.pagination.pageIndex;
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = Math.min(pageIndex + 1, pageCount);
  const pageNumbers = getPageNumbers(currentPage, pageCount);
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  React.useEffect(() => {
    if (pageIndex > pageCount - 1) setPagination((current) => ({ ...current, pageIndex: pageCount - 1 }));
  }, [pageIndex, pageCount]);

  // The row whose ⋮ menu gets focus back when the Edit/Delete dialog closes; after a delete, its neighbour.
  const focusRow = React.useRef<string | null>(null);
  const restoreRowFocus = (event: Event) => {
    const id = focusRow.current;
    focusRow.current = null;
    if (id === null) return;
    const menus = Array.from(document.querySelectorAll<HTMLElement>("[data-task-menu]"));
    // The row may have left this page (sorting/filtering after an edit): fall back to the first row's menu.
    const target = menus.find((menu) => menu.dataset.taskMenu === id) ?? menus[0];
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  const notSaved = (result: SaveResult) => {
    if (!result.ok) toast.error(`${result.message} Nothing was changed.`);
  };

  const rowActions: TaskRowActions = {
    onEdit: (task) => {
      focusRow.current = task.id;
      setForm({ open: true, task });
    },
    onDuplicate: (task) => {
      const copy = store.duplicate(task.id);
      if (!copy) return;
      if (copy.ok) toast.success(`${task.id} copied to ${copy.task.id}`);
      else notSaved(copy);
    },
    onToggleFavorite: (task) => notSaved(store.toggleFavorite(task.id)),
    onLabelChange: (task, label) => notSaved(store.setLabel(task.id, label)),
    onDelete: (task) => {
      focusRow.current = task.id;
      setToDelete(task);
    },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="flex flex-col gap-3 border-b px-4 py-4">
        <TasksToolbar table={table} onAddTask={() => setForm({ open: true, task: null })} />
        <SaveNotice save={store.save} onReset={() => setResetOpen(true)} />
      </div>
      <TaskRowActionsContext value={rowActions}>
        <Table className="**:data-[slot=table-cell]:px-4 **:data-[slot=table-head]:px-4">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-11 font-medium text-muted-foreground",
                      header.column.id === "actions" && "sticky right-0 bg-background",
                    )}
                    colSpan={header.colSpan}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border/60 hover:bg-muted/20"
                  data-state={table.state.rowSelection[row.id] && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-3 align-middle",
                        cell.column.id === "title" && "md:w-full md:min-w-40 md:max-w-0",
                        cell.column.id === "actions" &&
                          "sticky right-0 bg-background [tr[data-state=selected]>&]:bg-muted",
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TaskRowActionsContext>
      <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-muted-foreground text-sm">
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
          selected.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6 lg:gap-8">
          <div className="flex items-center gap-2">
            <p className="font-medium text-muted-foreground text-sm">Rows per page</p>
            <Select
              value={`${table.state.pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-18">
                <SelectValue placeholder={table.state.pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-24 items-center justify-start font-medium text-sm sm:justify-center">
            Page {currentPage} of {pageCount}
          </div>
          <Pagination className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent className="gap-1">
              <PaginationItem className="hidden lg:block">
                <PaginationLink
                  href="#"
                  aria-label="Go to first page"
                  aria-disabled={!canPreviousPage}
                  className={cn(!canPreviousPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canPreviousPage) table.setPageIndex(0);
                  }}
                >
                  <ChevronsLeft />
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text="Prev"
                  aria-disabled={!canPreviousPage}
                  className={cn(!canPreviousPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canPreviousPage) table.previousPage();
                  }}
                />
              </PaginationItem>
              {pageNumbers[0] > 1 ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}
              {pageNumbers.map((pageNumber) => (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    href="#"
                    isActive={pageIndex === pageNumber - 1}
                    onClick={(event) => {
                      preventPaginationNavigation(event);
                      table.setPageIndex(pageNumber - 1);
                    }}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {pageNumbers[pageNumbers.length - 1] < pageCount ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={!canNextPage}
                  className={cn(!canNextPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canNextPage) table.nextPage();
                  }}
                />
              </PaginationItem>
              <PaginationItem className="hidden lg:block">
                <PaginationLink
                  href="#"
                  aria-label="Go to last page"
                  aria-disabled={!canNextPage}
                  className={cn(!canNextPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canNextPage) table.setPageIndex(pageCount - 1);
                  }}
                >
                  <ChevronsRight />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
      <TaskFormDialog
        open={form.open}
        task={form.task}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onCloseAutoFocus={restoreRowFocus}
        onSubmit={(draft) => {
          // Success is only announced after the save really happened; on failure the dialog keeps the draft.
          if (form.task) {
            const result = store.update(form.task.id, draft);
            if (!result.ok) return result;
            toast.success(`${form.task.id} updated`);
          } else {
            const result = store.create(draft);
            if (!result.ok) return result;
            table.setPageIndex(0);
            toast.success(`${result.task.id} created`);
          }
          setForm((current) => ({ ...current, open: false }));
          return { ok: true };
        }}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        onCloseAutoFocus={restoreRowFocus}
        title={toDelete ? `Delete ${toDelete.id}?` : "Delete task?"}
        description={toDelete ? `"${toDelete.title}" will be removed from this list. This cannot be undone.` : ""}
        confirm="Delete task"
        onConfirm={() => {
          if (!toDelete) return { ok: true };
          const ids = table.getRowModel().rows.map((row) => row.id);
          const index = ids.indexOf(toDelete.id);
          const result = store.remove(toDelete.id);
          if (!result.ok) return result;
          // No neighbour on this page: the deleted id is not found, so focus falls back to the first row's menu.
          focusRow.current = ids[index + 1] ?? ids[index - 1] ?? toDelete.id;
          toast.success(`${toDelete.id} deleted`);
          return result;
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        description="All task changes saved in this browser are removed and the sample tasks come back."
        confirm="Reset"
        onConfirm={store.reset}
      />
    </div>
  );
}
