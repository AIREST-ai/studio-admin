"use client";

import type * as React from "react";

import { cn } from "cn";
import { ArrowUpRight, BadgeCheck, CalendarDays, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/utils";

import { personToneClass } from "../../contacts/_components/studio-ui";
import { formatDueDate } from "./board";
import { channelTone } from "./data";
import type { ColumnId, Task } from "./types";

export function TaskCard({
  task,
  columnId,
  isOverlay = false,
  menu,
}: {
  task: Task;
  columnId?: ColumnId;
  isOverlay?: boolean;
  menu?: React.ReactNode;
}) {
  const isSolved = columnId === "solved";
  const owner = task.owner;
  // F-9: every card is a dodge in a preview conversation, opened by its link.
  const href = task.conversationHref;
  const hasConversation = href.startsWith("/") || href.startsWith("https://");

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        isOverlay && "w-68 rotate-1 shadow-lg",
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="truncate font-medium text-sm leading-none">{task.customer}</h3>
          {menu}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="secondary"
            className={cn("shrink-0 rounded-md border-transparent px-1.5 font-medium", channelTone(task.channel))}
          >
            {task.channel}
          </Badge>
          <p className="min-w-0 truncate text-muted-foreground text-xs" title={task.problem}>
            {task.problem}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="rounded-r-md border-red-500/70 border-l-2 bg-red-500/5 px-2.5 py-1.5">
          <p className="font-medium text-[11px] text-red-700 uppercase tracking-wide dark:text-red-300">Dodge</p>
          <p className="line-clamp-2 text-foreground/80 text-sm italic leading-5">“{task.dodge}”</p>
        </div>
        <div className="rounded-r-md border-emerald-500/70 border-l-2 bg-emerald-500/5 px-2.5 py-1.5">
          <p className="flex items-center gap-1 font-medium text-[11px] text-emerald-700 uppercase tracking-wide dark:text-emerald-300">
            <Sparkles className="size-3" />
            Better reply
          </p>
          {task.betterReply ? (
            <p className="line-clamp-4 text-foreground/80 text-sm leading-5">{task.betterReply}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic leading-5">Not written yet</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar className={cn("size-5 after:rounded-sm", owner.tone || personToneClass(owner.name))}>
            <AvatarFallback className="rounded-sm text-[10px]">{getInitials(owner.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-muted-foreground text-sm">{owner.name}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground" title="Due date">
          <CalendarDays className="size-3" />
          <span className="text-sm">{formatDueDate(task.dueDate)}</span>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-2">
        {isSolved ? (
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-green-700 text-xs dark:text-green-500">
            <BadgeCheck className="size-3.5" />
            Solved
          </span>
        ) : null}
        {hasConversation ? (
          <a
            href={href}
            draggable={false}
            data-conversation-link={task.conversationId}
            className="ml-auto inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary text-sm underline-offset-4 hover:underline"
          >
            Open conversation #{task.conversationId}
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : (
          <span className="ml-auto whitespace-nowrap text-muted-foreground text-xs">No conversation linked</span>
        )}
      </div>
    </article>
  );
}
