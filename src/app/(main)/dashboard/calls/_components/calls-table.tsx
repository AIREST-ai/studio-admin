"use client";
// Chatwoot v4.18 Calls page (routes/dashboard/calls/pages/CallsIndex.vue, components-next/Calls/*) in the Studio
// pattern (contacts/_components/contacts-list.tsx): big heading outside, Chatwoot's filter bar as the chips row of
// the card, rows as a table with coloured badges, recording player and a "…" menu, pagination footer.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  ListFilter,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
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
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { PageHeading, personToneClass } from "../../contacts/_components/studio-ui";
import { type Activity, type Call, type CallKind, agents, calls, matchesActivity, voiceInboxes } from "./data";

const PAGE_SIZE = 10;

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

const kindConfig: Record<CallKind, { label: string; icon: React.ElementType; badge: string }> = {
  ongoing: {
    label: "Ongoing",
    icon: PhoneCall,
    badge: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  incoming: { label: "Incoming", icon: PhoneIncoming, badge: "border-border bg-muted/50 text-muted-foreground" },
  outgoing: { label: "Outgoing", icon: PhoneOutgoing, badge: "border-border bg-muted/50 text-muted-foreground" },
  missed: { label: "Missed", icon: PhoneMissed, badge: "border-destructive/20 bg-destructive/10 text-destructive" },
  no_reply: {
    label: "No reply",
    icon: PhoneOutgoing,
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  failed: { label: "Failed", icon: PhoneOff, badge: "border-destructive/20 bg-destructive/10 text-destructive" },
};

function CallStatusBadge({ kind }: { kind: CallKind }) {
  const config = kindConfig[kind];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border px-2 py-1 font-medium", config.badge)}>
      <config.icon className="size-3" />
      {config.label}
    </Badge>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.5, 2];

// CallRecordingPlayer.vue: play/pause, seek bar, elapsed / duration, speed 1x · 1.5x · 2x, download.
function RecordingPlayer({ seconds, name }: { seconds: number; name: string }) {
  const [playing, setPlaying] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);

  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPosition((p) => {
        const next = p + 0.25 * speed;
        if (next >= seconds) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, speed, seconds]);

  return (
    <div className="flex h-8 w-fit items-center gap-1.5 rounded-full bg-muted px-1.5">
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full bg-background"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => setPlaying((p) => !p)}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <input
        type="range"
        min={0}
        max={seconds}
        step={1}
        value={position}
        aria-label="Seek"
        className="h-1 w-20 cursor-pointer accent-primary"
        onChange={(e) => setPosition(Number(e.target.value))}
      />
      <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
        {formatDuration(position)} / {formatDuration(seconds)}
      </span>
      <button
        type="button"
        className="rounded-md px-1 font-medium text-muted-foreground text-xs tabular-nums hover:text-foreground"
        aria-label="Playback speed"
        onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
      >
        {speed}x
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label="Download recording"
        onClick={() => toast.success(`Recording of the call with ${name} downloaded`)}
      >
        <Download />
      </Button>
    </div>
  );
}

function resultLabel(call: Call) {
  if (call.kind === "missed") return "No agent answered this call";
  if (call.kind === "no_reply") return "Contact did not answer";
  if (call.kind === "failed") return "This call could not be connected";
  if (call.kind === "ongoing") return call.ringing ? "Ringing" : "In progress";
  return "Answered";
}

function contactName(call: Call) {
  return call.contact.replace(/^\+/, "");
}

function InboxIcon({ inbox }: { inbox: string }) {
  const provider = voiceInboxes.find((i) => i.name === inbox)?.provider;
  return provider === "whatsapp" ? (
    <MessageSquareText className="size-3.5 shrink-0 text-muted-foreground" />
  ) : (
    <Phone className="size-3.5 shrink-0 text-muted-foreground" />
  );
}

function PersonAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "default" }) {
  const unknown = name.startsWith("+") || name === "Deleted contact";
  return (
    <Avatar size={size} className={cn("font-medium", personToneClass(name))}>
      <AvatarFallback>{unknown ? <UserRound className="size-3.5" /> : getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

function CallsSetupState() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Calls" subtitle="Every voice call your team made or received, with recordings." />
      <Card>
        <CardContent>
          <Empty className="py-20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PhoneCall />
              </EmptyMedia>
              <EmptyTitle>Make and receive calls in one place</EmptyTitle>
              <EmptyDescription>
                Set up a voice channel to start handling calls with your team. Every call, along with its recording,
                will appear here.
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
    </div>
  );
}

const sortedCalls = [...calls].sort((a, b) => Date.parse(b.createdAtFull) - Date.parse(a.createdAtFull));

export function CallsTable({ setup = false }: { setup?: boolean }) {
  const [activity, setActivity] = React.useState<Activity | null>(null);
  const [assignee, setAssignee] = React.useState<number | null>(null);
  const [inbox, setInbox] = React.useState<number | null>(null);
  const [agentQuery, setAgentQuery] = React.useState("");
  const [page, setPage] = React.useState(0);

  if (setup) return <CallsSetupState />;

  const assigneeName = agents.find((a) => a.id === assignee)?.name;
  const inboxName = voiceInboxes.find((i) => i.id === inbox)?.name;
  const rows = sortedCalls.filter(
    (c) =>
      matchesActivity(c, activity) &&
      (!assigneeName || c.agent === assigneeName) &&
      (!inboxName || c.inbox === inboxName),
  );
  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const isOther = activity === "incoming" || activity === "outgoing" || activity === "in_progress";
  const ActiveIcon = activity ? activityIcons[activity] : Phone;
  const inactiveChips = (["missed", "no_reply"] as Activity[]).filter((a) => a !== activity);

  function pick<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }
  const chooseActivity = pick(setActivity);
  const chooseAssignee = pick(setAssignee);
  const chooseInbox = pick(setInbox);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Calls" subtitle="Every voice call your team made or received, with recordings." />

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {activity ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/40 text-primary"
                  onClick={() => chooseActivity(null)}
                >
                  <ActiveIcon />
                  {activityLabels[activity]} ({rows.length})
                  <X />
                </Button>
              ) : (
                <span className="font-medium text-muted-foreground text-sm tabular-nums">
                  All Calls ({rows.length})
                </span>
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
                    onClick={() => chooseActivity(chip)}
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
                      <DropdownMenuItem key={a} onSelect={() => chooseActivity(a)}>
                        <Icon /> {activityLabels[a]}
                        {activity === a ? <Check className="ml-auto" /> : null}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("max-w-52", !assignee && "text-muted-foreground")}>
                    {assigneeName ? (
                      <Avatar className={cn("size-4", personToneClass(assigneeName))}>
                        <AvatarFallback className="text-[7px]">{getInitials(assigneeName)}</AvatarFallback>
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
                  <DropdownMenuItem onSelect={() => chooseAssignee(null)}>
                    All assignees
                    {!assignee ? <Check className="ml-auto" /> : null}
                  </DropdownMenuItem>
                  {agents
                    .filter((a) => a.name.toLowerCase().includes(agentQuery.toLowerCase()))
                    .map((a) => (
                      <DropdownMenuItem key={a.id} onSelect={() => chooseAssignee(a.id)}>
                        <Avatar className={cn("size-5", personToneClass(a.name))}>
                          <AvatarFallback className="text-[8px]">{getInitials(a.name)}</AvatarFallback>
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
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Inbox</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => chooseInbox(null)}>
                    All inboxes
                    {!inbox ? <Check className="ml-auto" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {voiceInboxes.map((i) => (
                    <DropdownMenuItem key={i.id} onSelect={() => chooseInbox(i.id)}>
                      <InboxIcon inbox={i.name} /> {i.name}
                      {inbox === i.id ? <Check className="ml-auto" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          {pageRows.length ? (
            <Table className="**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-3">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 font-normal">Contact</TableHead>
                  <TableHead className="py-4 font-normal">Status</TableHead>
                  <TableHead className="py-4 font-normal">Agent</TableHead>
                  <TableHead className="py-4 font-normal">Recording</TableHead>
                  <TableHead className="py-4 font-normal">Inbox</TableHead>
                  <TableHead className="py-4 font-normal">Conversation</TableHead>
                  <TableHead className="py-4 font-normal">Time</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((call) => {
                  const agentAction = call.agent ? (call.kind === "outgoing" ? "Dialed by" : "Picked by") : "";
                  const name = contactName(call);
                  return (
                    <TableRow key={call.id} className="border-border/60 hover:bg-white/2.5">
                      <TableCell className="py-3.5 align-middle">
                        <div className="flex max-w-40 items-center gap-2.5">
                          <PersonAvatar name={call.contact} />
                          <span
                            className={cn(
                              "truncate font-medium text-sm tabular-nums",
                              call.contact === "Deleted contact" && "text-muted-foreground italic",
                            )}
                          >
                            {name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <CallStatusBadge kind={call.kind} />
                      </TableCell>
                      <TableCell className="align-middle">
                        {agentAction && call.agent ? (
                          <div className="flex max-w-52 items-center gap-1.5">
                            <span className="shrink-0 text-muted-foreground text-xs">{agentAction}</span>
                            <PersonAvatar name={call.agent} />
                            <span className="truncate text-sm">{call.agent}</span>
                            {call.kind === "ongoing" ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="ml-1 size-1.5 shrink-0 animate-pulse rounded-full bg-teal-500"
                                    role="img"
                                    aria-label="In progress"
                                  />
                                </TooltipTrigger>
                                <TooltipContent>In progress</TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "block max-w-52 truncate text-muted-foreground text-sm",
                              call.ringing && "inline-flex items-center gap-1.5 text-teal-600 dark:text-teal-400",
                            )}
                          >
                            {call.ringing ? <span className="size-1.5 animate-pulse rounded-full bg-teal-500" /> : null}
                            {resultLabel(call)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        {call.recordingSeconds ? (
                          <RecordingPlayer seconds={call.recordingSeconds} name={name} />
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        <span className="flex max-w-36 items-center gap-1.5 text-sm">
                          <InboxIcon inbox={call.inbox} />
                          <span className="truncate">{call.inbox}</span>
                        </span>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Link
                          href="/dashboard/chat"
                          className="inline-flex h-6 items-center gap-1 rounded-md border px-2 text-muted-foreground text-xs tabular-nums hover:bg-muted"
                        >
                          <MessageCircle className="size-3.5" />
                          {call.conversationId}
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                              {call.createdAt}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{call.createdAtFull}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Open actions for the call with ${name}`}
                                className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                size="icon-sm"
                                variant="ghost"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href="/dashboard/chat">
                                  <MessageCircle /> Open conversation
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!call.recordingSeconds}
                                onSelect={() => toast.success(`Recording of the call with ${name} downloaded`)}
                              >
                                <Download /> Download recording
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">No calls found</div>
          )}

          {rows.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 pt-4">
              <span className="text-muted-foreground text-sm tabular-nums">
                Showing {current * PAGE_SIZE + 1} - {Math.min(rows.length, (current + 1) * PAGE_SIZE)} of{" "}
                {rows.length} calls
              </span>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={current === 0}
                      className={cn(current === 0 && "pointer-events-none opacity-50")}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(Math.max(current - 1, 0));
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: pageCount }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: page numbers
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        isActive={i === current}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(i);
                        }}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={current >= pageCount - 1}
                      className={cn(current >= pageCount - 1 && "pointer-events-none opacity-50")}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(Math.min(current + 1, pageCount - 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
