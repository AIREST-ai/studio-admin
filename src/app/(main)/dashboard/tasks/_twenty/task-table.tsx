"use client";
// F-18b (Fahad, 15 Oct 15:20: "المهام يجب أن تنقل كلها لدي"): the tasks server's own list views, inside the page.
// The tasks server ships three Task views: "All Tasks" (a table), "By Status" (the board) and "Assigned to Me" (a table
// grouped by status, filtered to the signed-in person):
// https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/view/compute-standard-task-views.util.ts
// Its table columns (Title, Status, Assignee, Due date, Created by, Creation date):
// https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/view-field/compute-standard-task-view-fields.util.ts
// Search, filters, column sorting (click: ascending, again: descending, again: no sort), group by status and Export
// view (CSV) follow its user guide:
// https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-docs/user-guide/views-pipelines/capabilities/filters-and-sorting.mdx
// https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-docs/user-guide/views-pipelines/capabilities/table-views.mdx
// https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-docs/user-guide/data-migration/how-tos/export-your-data.mdx
// Rows are the tasks the page already read (same store as the board); a click opens the same task window.
import * as React from "react";

import { cn } from "cn";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, X } from "lucide-react";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { assigneeLabel } from "@/lib/twenty/agents";
import type { BoardMember, BoardStatus, BoardTask, CardField } from "@/lib/twenty/server";

import { isDueThisWeek, isOpen, isOverdue } from "./task-summary";
import { customText, dotClass, formatDate, StatusPill } from "./twenty-card";

export type DueFilter = "any" | "overdue" | "week" | "none";
export interface TableFilter {
  query: string;
  /** "all", "open" or a status value */
  status: string;
  due: DueFilter;
  unassignedOnly: boolean;
}
export const EMPTY_FILTER: TableFilter = { query: "", status: "all", due: "any", unassignedOnly: false };

type SortKey = "title" | "status" | "assignee" | "dueAt" | "createdBy" | "createdAt" | `custom:${string}`;
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

interface Column {
  key: SortKey;
  label: string;
  text: (task: BoardTask) => string;
  /** value compared when sorting (text when absent) */
  order?: (task: BoardTask) => number | string;
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function TaskTable({
  tasks,
  statuses,
  fields,
  members,
  filter,
  onFilterChange,
  groupDefault = false,
  title,
  emptyText,
  onOpen,
}: {
  tasks: BoardTask[];
  statuses: BoardStatus[];
  fields: CardField[];
  members: BoardMember[];
  filter: TableFilter;
  onFilterChange: (filter: TableFilter) => void;
  /** "Assigned to me" opens grouped by status, as the tasks server's own view does. */
  groupDefault?: boolean;
  title: string;
  emptyText: string;
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = React.useState<Sort>(null);
  const [grouped, setGrouped] = React.useState(groupDefault);
  const [exported, setExported] = React.useState<string | null>(null);
  const now = React.useMemo(() => new Date(), []);

  const statusOf = React.useCallback((value: string | null) => statuses.find((s) => s.value === value), [statuses]);
  const statusRank = React.useCallback(
    (value: string | null) => {
      const index = statuses.findIndex((s) => s.value === value);
      return index < 0 ? statuses.length : index;
    },
    [statuses],
  );

  const columns = React.useMemo<Column[]>(() => {
    const custom = fields
      .filter((field) => field.isCustom && field.visible)
      .map(
        (field): Column => ({
          key: `custom:${field.name}`,
          label: field.label,
          text: (task) => customText(field, task.custom[field.name]),
        }),
      );
    return [
      { key: "title", label: "Title", text: (task) => task.title },
      {
        key: "status",
        label: "Status",
        text: (task) => statusOf(task.status)?.label ?? "",
        order: (task) => statusRank(task.status),
      },
      { key: "assignee", label: "Assignee", text: (task) => assigneeLabel(task, members) ?? "" },
      {
        key: "dueAt",
        label: "Due date",
        text: (task) => formatDate(task.dueAt),
        order: (task) => (task.dueAt ? Date.parse(task.dueAt) : Number.MAX_SAFE_INTEGER),
      },
      ...custom,
      { key: "createdBy", label: "Created by", text: (task) => task.createdBy },
      {
        key: "createdAt",
        label: "Created",
        text: (task) => formatDate(task.createdAt),
        order: (task) => Date.parse(task.createdAt),
      },
    ];
  }, [fields, members, statusOf, statusRank]);

  const rows = React.useMemo(() => {
    const query = filter.query.trim().toLowerCase();
    const list = tasks.filter((task) => {
      if (filter.status === "open" && !isOpen(task)) return false;
      if (filter.status !== "all" && filter.status !== "open" && task.status !== filter.status) return false;
      if (filter.due === "overdue" && !isOverdue(task, now)) return false;
      if (filter.due === "week" && !isDueThisWeek(task, now)) return false;
      if (filter.due === "none" && task.dueAt) return false;
      if (filter.unassignedOnly && assigneeLabel(task, members)) return false;
      if (!query) return true;
      // search: the title, the description and every column's text
      const haystack = [task.title, task.body, ...columns.map((column) => column.text(task))].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    if (!sort) return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const column = columns.find((each) => each.key === sort.key);
    if (!column) return list;
    const value = column.order ?? column.text;
    return list.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const result =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "en", { sensitivity: "base" });
      return sort.dir === "asc" ? result : -result;
    });
  }, [tasks, filter, sort, columns, members, now]);

  const groups = React.useMemo(() => {
    if (!grouped) return [{ status: null as BoardStatus | null, rows }];
    return statuses
      .map((status) => ({ status, rows: rows.filter((task) => task.status === status.value) }))
      .filter((group) => group.rows.length > 0);
  }, [grouped, rows, statuses]);

  function cycleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function exportCsv() {
    const header = columns.map((column) => csvCell(column.label)).join(",");
    const lines = rows.map((task) => columns.map((column) => csvCell(column.text(task))).join(","));
    const csv = `﻿${[header, ...lines].join("\r\n")}\r\n`;
    const name = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(`${name}: ${rows.length} ${rows.length === 1 ? "task" : "tasks"}, the rows shown here.`);
  }

  const set = (patch: Partial<TableFilter>) => onFilterChange({ ...filter, ...patch });
  const filtered = filter.query !== "" || filter.status !== "all" || filter.due !== "any" || filter.unassignedOnly;

  return (
    <section aria-label={title} data-task-table className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/25">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-2 lg:px-6">
        {/* F-13 round 2 (Fahad 125.4): a lens only; a click opens the box, closing it brings back the lens. */}
        <ExpandingSearch
          name="tasks"
          label="Search tasks"
          placeholder="Search tasks"
          size="default"
          className="w-full min-w-40 max-w-64 flex-1"
          value={filter.query}
          onChange={(query) => set({ query })}
        />
        <NativeSelect
          size="sm"
          aria-label="Status filter"
          value={filter.status}
          onChange={(event) => set({ status: event.target.value })}
        >
          <NativeSelectOption value="all">All statuses</NativeSelectOption>
          <NativeSelectOption value="open">Open (not Done or Canceled)</NativeSelectOption>
          {statuses.map((status) => (
            <NativeSelectOption key={status.value} value={status.value}>
              {status.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size="sm"
          aria-label="Due date filter"
          value={filter.due}
          onChange={(event) => set({ due: event.target.value as DueFilter })}
        >
          <NativeSelectOption value="any">Any due date</NativeSelectOption>
          <NativeSelectOption value="overdue">Overdue</NativeSelectOption>
          <NativeSelectOption value="week">Due in 7 days</NativeSelectOption>
          <NativeSelectOption value="none">No due date</NativeSelectOption>
        </NativeSelect>
        <div className="flex items-center gap-1.5">
          <Checkbox
            id="tasks-unassigned-only"
            checked={filter.unassignedOnly}
            onCheckedChange={(value) => set({ unassignedOnly: value === true })}
          />
          <Label htmlFor="tasks-unassigned-only" className="font-normal text-sm">
            Unassigned only
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox id="tasks-group" checked={grouped} onCheckedChange={(value) => setGrouped(value === true)} />
          <Label htmlFor="tasks-group" className="font-normal text-sm">
            Group by status
          </Label>
        </div>
        {filtered ? (
          <Button size="sm" variant="ghost" onClick={() => onFilterChange(EMPTY_FILTER)}>
            <X data-icon="inline-start" />
            Clear filters
          </Button>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums" data-testid="tasks-table-count">
            {`${rows.length} of ${tasks.length}`}
          </span>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        </div>
      </div>
      {exported ? (
        <p role="status" className="shrink-0 border-b px-4 py-1.5 text-muted-foreground text-xs lg:px-6">
          {`Exported ${exported}`}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b">
              {columns.map((column) => {
                const active = sort?.key === column.key ? sort.dir : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
                    className="px-3 py-2 text-start font-medium text-muted-foreground first:ps-4 lg:first:ps-6"
                  >
                    <button
                      type="button"
                      data-sort={column.key}
                      onClick={() => cycleSort(column.key)}
                      className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {column.label}
                      {active === "asc" ? (
                        <ArrowUp className="size-3.5" aria-hidden />
                      ) : active === "desc" ? (
                        <ArrowDown className="size-3.5" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground lg:px-6">
                  {filtered ? "No task matches these filters." : emptyText}
                </td>
              </tr>
            ) : null}
            {groups.map((group) => (
              <React.Fragment key={group.status?.value ?? "all"}>
                {group.status ? (
                  <tr className="border-b bg-muted/60" data-group={group.status.value}>
                    <th colSpan={columns.length} scope="colgroup" className="px-4 py-1.5 text-start lg:px-6">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className={cn("size-2 rounded-full", dotClass(group.status.color))} aria-hidden />
                        {group.status.label}
                        <span className="text-muted-foreground tabular-nums">{group.rows.length}</span>
                      </span>
                    </th>
                  </tr>
                ) : null}
                {group.rows.map((task) => {
                  const late = isOverdue(task, now);
                  return (
                    <tr
                      key={task.id}
                      data-task-row={task.id}
                      tabIndex={0}
                      onClick={() => onOpen(task.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onOpen(task.id);
                      }}
                      className="cursor-pointer border-b bg-background outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
                    >
                      {columns.map((column) => {
                        if (column.key === "title")
                          return (
                            <td key={column.key} className="max-w-80 px-3 py-2 ps-4 font-medium lg:ps-6">
                              <span className="line-clamp-2 [unicode-bidi:plaintext]">{task.title || "Untitled"}</span>
                            </td>
                          );
                        if (column.key === "status")
                          return (
                            <td key={column.key} className="whitespace-nowrap px-3 py-2">
                              <StatusPill status={statusOf(task.status)} />
                            </td>
                          );
                        if (column.key === "dueAt")
                          return (
                            <td
                              key={column.key}
                              className={cn(
                                "whitespace-nowrap px-3 py-2 tabular-nums",
                                late && "font-medium text-red-600 dark:text-red-400",
                              )}
                            >
                              {column.text(task) || <span className="text-muted-foreground">—</span>}
                              {late ? <span className="ms-1.5 text-xs">Overdue</span> : null}
                            </td>
                          );
                        const text = column.text(task);
                        return (
                          <td key={column.key} className="max-w-56 truncate px-3 py-2">
                            {text || <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
