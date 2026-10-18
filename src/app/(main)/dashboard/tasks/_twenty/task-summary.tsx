"use client";
// F-18b (Fahad, 15 Oct 15:20): the Tasks page's summary numbers, counted from the tasks the page has just read from the
// tasks server (no number is made up). The tasks server shows a count on top of every board column
// (Kanban "Column Aggregations": https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-docs/user-guide/views-pipelines/capabilities/kanban-views.mdx)
// and documents "Overdue" as due before today and not Done
// (https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-docs/user-guide/views-pipelines/how-tos/create-a-calendar-view-for-tasks-due.mdx).
// A tile is a button: it opens the All tasks list with that filter.
import { cn } from "cn";
import { AlarmClock, CalendarClock, CircleDot, UserRoundX } from "lucide-react";

import type { BoardStatus, BoardTask } from "@/lib/twenty/server";

import { dotClass } from "./twenty-card";

/** Statuses that end a task: it is neither open nor late any more. */
const CLOSED = new Set(["DONE", "CANCELED", "CANCELLED"]);

export const isOpen = (task: Pick<BoardTask, "status">) => !CLOSED.has(task.status ?? "");

const startOfToday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

/** Due before today (the due day has passed) and not Done or Canceled. */
export function isOverdue(task: Pick<BoardTask, "status" | "dueAt">, now = new Date()) {
  if (!task.dueAt || !isOpen(task)) return false;
  const due = new Date(task.dueAt);
  return !Number.isNaN(due.getTime()) && due < startOfToday(now);
}

/** Due today or in the next 6 days, and still open. */
export function isDueThisWeek(task: Pick<BoardTask, "status" | "dueAt">, now = new Date()) {
  if (!task.dueAt || !isOpen(task)) return false;
  const due = new Date(task.dueAt);
  const start = startOfToday(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return !Number.isNaN(due.getTime()) && due >= start && due < end;
}

export type SummaryPick =
  | { kind: "open" }
  | { kind: "status"; status: string }
  | { kind: "overdue" }
  | { kind: "week" }
  | { kind: "unassigned" };

function Tile({
  label,
  value,
  icon,
  tone,
  onClick,
  testId,
  hint,
}: {
  label: string;
  /** what the number counts, when the label alone is short */
  hint?: string;
  value: number;
  icon: React.ReactNode;
  tone?: "warn";
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-summary={testId}
      title={hint}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border bg-card px-3 py-2 text-start outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        tone === "warn" && value > 0 && "border-red-300 dark:border-red-900",
      )}
    >
      {/* F-18b round 2: the label wraps instead of being cut ("Open, unassign…") */}
      <span className="flex items-start gap-1.5 text-muted-foreground text-xs leading-tight">
        <span className="flex h-[1.25em] shrink-0 items-center">{icon}</span>
        <span>{label}</span>
      </span>
      <span
        className={cn(
          "font-semibold text-xl tabular-nums leading-none",
          tone === "warn" && value > 0 && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </span>
    </button>
  );
}

export function TaskSummary({
  tasks,
  statuses,
  isUnassigned,
  onPick,
}: {
  tasks: BoardTask[];
  statuses: BoardStatus[];
  isUnassigned: (task: BoardTask) => boolean;
  onPick: (pick: SummaryPick) => void;
}) {
  const now = new Date();
  const open = tasks.filter(isOpen);
  return (
    <div
      role="group"
      aria-label="Summary"
      data-testid="tasks-summary"
      className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2 border-b px-4 py-3 lg:px-6"
    >
      <Tile
        testId="open"
        label="Open tasks"
        value={open.length}
        icon={<CircleDot className="size-3.5" aria-hidden />}
        onClick={() => onPick({ kind: "open" })}
      />
      {statuses.map((status) => (
        <Tile
          key={status.value}
          testId={`status-${status.value}`}
          label={status.label}
          value={tasks.filter((task) => task.status === status.value).length}
          icon={<span className={cn("size-2 rounded-full", dotClass(status.color))} aria-hidden />}
          onClick={() => onPick({ kind: "status", status: status.value })}
        />
      ))}
      <Tile
        testId="overdue"
        label="Overdue"
        value={tasks.filter((task) => isOverdue(task, now)).length}
        tone="warn"
        icon={<AlarmClock className="size-3.5" aria-hidden />}
        onClick={() => onPick({ kind: "overdue" })}
      />
      <Tile
        testId="week"
        label="Due in 7 days"
        value={tasks.filter((task) => isDueThisWeek(task, now)).length}
        icon={<CalendarClock className="size-3.5" aria-hidden />}
        onClick={() => onPick({ kind: "week" })}
      />
      <Tile
        testId="unassigned"
        label="Unassigned"
        hint="Open tasks with no assignee"
        value={open.filter(isUnassigned).length}
        icon={<UserRoundX className="size-3.5" aria-hidden />}
        onClick={() => onPick({ kind: "unassigned" })}
      />
    </div>
  );
}
