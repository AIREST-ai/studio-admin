"use client";
// T-244 round 2: a task card in the look of Studio's own board card (dashboard/kanban/_components/task-card.tsx,
// copied here so the Dodge board stays untouched). Content only: the draggable wrapper is the card's one control.

import { cn } from "cn";
import { CalendarDays, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/utils";

import { priorities } from "../_components/data";
import { type BoardTask, personName, TASK_LABELS } from "./model";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDueDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${monthNames[Number(match[2]) - 1] ?? match[2]} ${Number(match[3])}`;
}

export function TaskCard({ task, isOverlay = false }: { task: BoardTask; isOverlay?: boolean }) {
  const owner = personName(task.ownerId);
  const priority = priorities.find((p) => p.value === task.priority);
  const label = TASK_LABELS.find((l) => l.id === task.label)?.label;
  const followers = task.followerIds.length;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        isOverlay && "w-68 rotate-1 shadow-lg",
      )}
    >
      <h3 dir="auto" className="line-clamp-3 min-w-0 font-medium text-sm leading-5">
        {task.title}
      </h3>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">{task.id}</span>
        {label ? (
          <Badge variant="outline" className="rounded-md px-1.5 font-medium">
            {label}
          </Badge>
        ) : null}
        {priority ? (
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            <priority.icon className="size-3" />
            {priority.label}
          </span>
        ) : null}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {owner ? (
            <>
              <Avatar className="size-5 after:rounded-sm">
                <AvatarFallback className="rounded-sm text-[10px]">{getInitials(owner)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-muted-foreground text-sm">{owner}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">No owner</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
          {followers > 0 ? (
            <span className="flex items-center gap-1 text-sm" title="Followers">
              <Users className="size-3" />
              {`${followers} follower${followers > 1 ? "s" : ""}`}
            </span>
          ) : null}
          {task.dueDate ? (
            <span className="flex items-center gap-1 text-sm" title="Due date">
              <CalendarDays className="size-3" />
              {formatDueDate(task.dueDate)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
