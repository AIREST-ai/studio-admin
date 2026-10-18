"use client";
// M129-F: one task card. Its fields are the ones the client switched on in "Card design" (the visible fields of the
// Twenty board view); the title is always shown. Look copied from the previous Tasks card (_board/task-card.tsx).
import { cn } from "cn";
import { CalendarDays, MessageSquareText, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { assigneeLabel } from "@/lib/twenty/agents";
import type { BoardMember, BoardStatus, BoardTask, CardField } from "@/lib/twenty/server";
import { getInitials } from "@/lib/utils";

/** Twenty option colors -> Tailwind palette classes (named colors only). */
const COLOR: Record<string, string> = {
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
  gray: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};
export const colorClass = (color: string) => COLOR[color] ?? COLOR.gray;

/** Solid dot of a status color (readable in light and dark). */
const DOT: Record<string, string> = {
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  violet: "bg-violet-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  pink: "bg-pink-500",
  gray: "bg-zinc-400",
};
export const dotClass = (color: string) => DOT[color] ?? DOT.gray;

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
export function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFmt.format(date);
}

export function StatusPill({ status }: { status: BoardStatus | undefined }) {
  if (!status) return null;
  return (
    <span className={cn("inline-flex rounded-md px-1.5 py-0.5 font-medium text-xs", colorClass(status.color))}>
      {status.label}
    </span>
  );
}

/** The value of a custom field as text (empty when not set). */
export function customText(field: CardField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "BOOLEAN") return value ? "Yes" : "No";
  if (field.type === "SELECT") return field.options.find((option) => option.value === value)?.label ?? String(value);
  if (field.type === "DATE" || field.type === "DATE_TIME") return formatDate(value);
  return String(value);
}

function FieldLine({ field, task, members }: { field: CardField; task: BoardTask; members: BoardMember[] }) {
  if (field.name === "assignee") {
    // F-8: the site agent the task names ("Studio agent") first, else its Twenty user (lib/twenty/agents.ts).
    const owner = assigneeLabel(task, members);
    return (
      <div className="flex min-w-0 items-center gap-1.5" data-card-field="assignee">
        {owner ? (
          <>
            <Avatar className="size-5 after:rounded-sm">
              <AvatarFallback className="rounded-sm text-[10px]">{getInitials(owner)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-muted-foreground text-sm">{owner}</span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <UserRound className="size-3.5" /> Unassigned
          </span>
        )}
      </div>
    );
  }
  if (field.name === "dueAt") {
    return task.dueAt ? (
      <span className="flex items-center gap-1.5 text-muted-foreground text-sm" data-card-field="dueAt">
        <CalendarDays className="size-3.5" /> {`Due ${formatDate(task.dueAt)}`}
      </span>
    ) : null;
  }
  if (field.name === "bodyV2") {
    return task.body ? (
      <p dir="auto" className="line-clamp-2 text-muted-foreground text-sm" data-card-field="bodyV2">
        {task.body.replace(/^>\s?/gm, "").replace(/\s+/g, " ").trim()}
      </p>
    ) : null;
  }
  if (field.name === "createdBy") {
    return task.createdBy ? (
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs" data-card-field="createdBy">
        <MessageSquareText className="size-3" /> {`Created by ${task.createdBy}`}
      </span>
    ) : null;
  }
  if (field.name === "createdAt") {
    return (
      <span className="text-muted-foreground text-xs" data-card-field="createdAt">
        {`Created ${formatDate(task.createdAt)}`}
      </span>
    );
  }
  const text = customText(field, task.custom[field.name]);
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 text-sm" data-card-field={field.name}>
      <span className="shrink-0 text-muted-foreground">{`${field.label}:`}</span>
      <span dir="auto" className={cn("truncate", !text && "text-muted-foreground")}>
        {text || "—"}
      </span>
    </div>
  );
}

export function TwentyCard({
  task,
  fields,
  members,
  status,
  showStatus = false,
  isOverlay = false,
}: {
  task: BoardTask;
  fields: CardField[];
  members: BoardMember[];
  status?: BoardStatus;
  showStatus?: boolean;
  isOverlay?: boolean;
}) {
  const visible = fields.filter((field) => field.visible);
  return (
    <article
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        isOverlay && "w-68 rotate-1 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 dir="auto" className="line-clamp-3 min-w-0 font-medium text-sm leading-5">
          {task.title}
        </h3>
        {showStatus ? <StatusPill status={status} /> : null}
      </div>
      {visible.map((field) => (
        <FieldLine key={field.id} field={field} task={task} members={members} />
      ))}
    </article>
  );
}
