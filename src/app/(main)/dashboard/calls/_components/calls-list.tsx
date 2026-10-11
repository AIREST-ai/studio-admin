"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  MessageCircle,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Play,
  Plus,
  UserRound,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { type Activity, type Call, type CallKind, agents, calls, matchesActivity, toneFor, voiceInboxes } from "./data";

const activityIcons: Record<Activity, React.ElementType> = {
  missed: PhoneMissed,
  no_reply: PhoneOutgoing,
  incoming: PhoneIncoming,
  outgoing: PhoneOutgoing,
  in_progress: PhoneCall,
};

const activityLabels: Record<Activity, string> = {
  missed: "Missed",
  no_reply: "No reply",
  incoming: "Incoming",
  outgoing: "Outgoing",
  in_progress: "In progress",
};

const kindConfig: Record<CallKind, { label: string; icon: React.ElementType; className: string }> = {
  ongoing: {
    label: "Ongoing",
    icon: PhoneCall,
    className: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  },
  incoming: { label: "Incoming", icon: PhoneIncoming, className: "bg-muted text-muted-foreground" },
  outgoing: { label: "Outgoing", icon: PhoneOutgoing, className: "bg-muted text-muted-foreground" },
  missed: {
    label: "Missed",
    icon: PhoneMissed,
    className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  no_reply: {
    label: "No reply",
    icon: PhoneOutgoing,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  failed: {
    label: "Failed",
    icon: PhoneOff,
    className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

function CallStatusBadge({ kind }: { kind: CallKind }) {
  const config = kindConfig[kind];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 w-24 shrink-0 items-center justify-center gap-1.5 rounded-md px-1 font-medium text-xs",
        config.className,
      )}
    >
      <Icon className="size-3 shrink-0" />
      {config.label}
    </span>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ seconds }: { seconds: number }) {
  const [playing, setPlaying] = React.useState(false);
  return (
    <div className="flex h-8 w-56 shrink-0 items-center gap-2 rounded-full bg-muted px-1.5">
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full bg-background"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => setPlaying((p) => !p)}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="relative h-1 flex-1 rounded-full bg-border">
        <div className={cn("absolute inset-y-0 left-0 rounded-full bg-primary", playing ? "w-1/3" : "w-0")} />
      </div>
      <span className="pr-2 text-muted-foreground text-xs tabular-nums">
        {playing ? formatDuration(Math.round(seconds / 3)) : "0:00"} / {formatDuration(seconds)}
      </span>
    </div>
  );
}

function resultLabel(call: Call) {
  if (call.kind === "missed") return "No agent answered this call";
  if (call.kind === "no_reply") return "Contact did not answer";
  if (call.kind === "failed") return "This call could not be connected";
  return "";
}

function CallRow({ call }: { call: Call }) {
  const agentAction = call.agent ? (call.kind === "outgoing" ? "Dialed by" : "Picked by") : "";
  return (
    <div className="flex items-center gap-3 border-b px-6 last:border-b-0">
      <div className="flex w-56 shrink-0 items-center gap-2.5 py-3.5">
        <Avatar className="size-6">
          <AvatarFallback className={cn("text-[10px]", toneFor(call.contact))}>
            {call.contact.startsWith("+") ? <UserRound className="size-3" /> : getInitials(call.contact)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "truncate font-medium text-sm tabular-nums",
            call.contact === "Deleted contact" && "text-muted-foreground italic",
          )}
        >
          {call.contact}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CallStatusBadge kind={call.kind} />
        {agentAction ? (
          <div className="flex w-72 min-w-0 shrink-0 items-center gap-1.5">
            <span className="shrink-0 text-muted-foreground text-xs">{agentAction}</span>
            <Avatar className="size-5">
              <AvatarFallback className={cn("text-[9px]", toneFor(call.agent ?? ""))}>
                {getInitials(call.agent ?? "")}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{call.agent}</span>
            {call.kind === "ongoing" ? (
              <span className="ml-1 inline-flex items-center gap-1 text-teal-600 text-xs dark:text-teal-400">
                <span className="size-1.5 animate-pulse rounded-full bg-teal-500" /> In progress
              </span>
            ) : null}
          </div>
        ) : (
          <span className="w-72 shrink-0 truncate text-muted-foreground text-sm">{resultLabel(call)}</span>
        )}
        {call.recordingSeconds ? (
          <div className="mx-auto hidden xl:block">
            <AudioPlayer seconds={call.recordingSeconds} />
          </div>
        ) : null}
      </div>
      <div className="hidden w-44 shrink-0 items-center justify-end gap-1.5 text-muted-foreground text-sm md:flex">
        <Phone className="size-3.5 shrink-0" />
        <span className="truncate">{call.inbox}</span>
      </div>
      <Link
        href="/dashboard/chat"
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-muted-foreground text-xs tabular-nums hover:bg-muted"
      >
        <MessageCircle className="size-3.5" />
        {call.conversationId}
        <ArrowUpRight className="size-3.5" />
      </Link>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="w-20 shrink-0 py-3.5 text-right text-muted-foreground text-xs tabular-nums">
            {call.createdAt}
          </span>
        </TooltipTrigger>
        <TooltipContent>{call.createdAtFull}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function CallsSetupState() {
  return (
    <Card>
      <CardContent>
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PhoneCall />
            </EmptyMedia>
            <EmptyTitle>Make and receive calls in one place</EmptyTitle>
            <EmptyDescription>
              Set up a voice channel to start handling calls with your team. Every call, along with its recording, will
              appear here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" asChild>
              <Link href="/dashboard/calls">
                <Plus /> Set up voice channel
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
}

export function CallsList({ setup = false }: { setup?: boolean }) {
  const [activity, setActivity] = React.useState<Activity | null>(null);
  const [assignee, setAssignee] = React.useState<number | null>(null);
  const [inbox, setInbox] = React.useState<number | null>(null);
  const [agentQuery, setAgentQuery] = React.useState("");

  if (setup) return <CallsSetupState />;

  const assigneeName = agents.find((a) => a.id === assignee)?.name;
  const inboxName = voiceInboxes.find((i) => i.id === inbox)?.name;
  const rows = calls.filter(
    (c) =>
      matchesActivity(c, activity) &&
      (!assigneeName || c.agent === assigneeName) &&
      (!inboxName || c.inbox === inboxName),
  );
  const isOther = activity === "incoming" || activity === "outgoing" || activity === "in_progress";
  const ActiveIcon = activity ? activityIcons[activity] : Phone;
  const inactiveChips = (["missed", "no_reply"] as Activity[]).filter((a) => a !== activity);

  return (
    <Card>
      <CardHeader className="gap-5">
        <CardTitle className="text-xl leading-none">Calls</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {activity ? (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary"
                onClick={() => setActivity(null)}
              >
                <ActiveIcon />
                {activityLabels[activity]} ({rows.length})
                <X />
              </Button>
            ) : (
              <span className="font-medium text-muted-foreground text-sm">All Calls ({rows.length})</span>
            )}
            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-3.5" />
            {inactiveChips.map((chip) => {
              const Icon = activityIcons[chip];
              return (
                <Button
                  key={chip}
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setActivity(chip)}
                >
                  <Icon /> {activityLabels[chip]}
                </Button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={isOther ? "" : "text-muted-foreground"}>
                  <Phone /> Other activity <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {(["incoming", "outgoing", "in_progress"] as Activity[]).map((a) => {
                  const Icon = activityIcons[a];
                  return (
                    <DropdownMenuItem key={a} onSelect={() => setActivity(a)}>
                      <Icon /> {activityLabels[a]}
                      {activity === a ? <Check className="ml-auto" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("max-w-52", !assignee && "text-muted-foreground")}>
                  {assigneeName ? (
                    <Avatar className="size-4">
                      <AvatarFallback className={cn("text-[7px]", toneFor(assigneeName))}>
                        {getInitials(assigneeName)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <UserRound />
                  )}
                  <span className="truncate">{assigneeName ?? "Assignee"}</span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-1">
                  <Input
                    className="h-7"
                    placeholder="Search"
                    value={agentQuery}
                    onChange={(e) => setAgentQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <DropdownMenuItem onSelect={() => setAssignee(null)}>
                  All assignees
                  {!assignee ? <Check className="ml-auto" /> : null}
                </DropdownMenuItem>
                {agents
                  .filter((a) => a.name.toLowerCase().includes(agentQuery.toLowerCase()))
                  .map((a) => (
                    <DropdownMenuItem key={a.id} onSelect={() => setAssignee(a.id)}>
                      <Avatar className="size-5">
                        <AvatarFallback className={cn("text-[8px]", toneFor(a.name))}>
                          {getInitials(a.name)}
                        </AvatarFallback>
                      </Avatar>
                      {a.name}
                      {assignee === a.id ? <Check className="ml-auto" /> : null}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={inbox ? "border-primary/40 text-primary" : "text-muted-foreground"}
                >
                  <ListFilter /> More filters <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Inbox</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setInbox(null)}>
                  All inboxes
                  {!inbox ? <Check className="ml-auto" /> : null}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {voiceInboxes.map((i) => (
                  <DropdownMenuItem key={i.id} onSelect={() => setInbox(i.id)}>
                    <Phone /> {i.name}
                    {inbox === i.id ? <Check className="ml-auto" /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="border-t">
          {rows.length ? (
            rows.map((call) => <CallRow key={call.id} call={call} />)
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">No calls found</div>
          )}
        </div>
        {rows.length ? (
          <>
            <Separator />
            <div className="flex items-center justify-between px-6 pt-4">
              <span className="text-muted-foreground text-sm tabular-nums">
                Showing 1 - {rows.length} of {rows.length} calls
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled>
                  <ChevronLeft />
                </Button>
                <span className="text-sm tabular-nums">
                  1 <span className="text-muted-foreground">of</span> 1
                </span>
                <Button variant="outline" size="icon-sm" aria-label="Next page" disabled>
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
