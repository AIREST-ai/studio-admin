"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  AlarmClockOff,
  AlarmClockPlus,
  ArrowDownUp,
  AtSign,
  BellMinus,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Globe,
  HeartCrack,
  Inbox,
  Mail,
  MailOpen,
  MailPlus,
  MessageCircle,
  MessageSquarePlus,
  SlidersVertical,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/utils";

import {
  type InboxNotification,
  type NotificationType,
  priorityRank,
  notifications as seed,
  snoozeOptions,
  typeLabels,
} from "./data";

type SortKey = "newest" | "oldest" | "priority";

const typeIcons: Record<NotificationType, [React.ElementType, string]> = {
  conversation_mention: [AtSign, "text-primary"],
  conversation_assignment: [ChevronsRight, "text-primary"],
  conversation_creation: [MailPlus, "text-primary"],
  assigned_conversation_new_message: [MessageSquarePlus, "text-primary"],
  participating_conversation_new_message: [MessageSquarePlus, "text-primary"],
  sla_missed_first_response: [HeartCrack, "text-destructive"],
  sla_missed_resolution: [HeartCrack, "text-destructive"],
};

const inboxIcons = { WhatsApp: MessageCircle, Website: Globe, Email: Mail, Instagram: Camera };

const tones = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
];

function toneFor(name: string) {
  return tones[name.length % tones.length];
}

function PriorityIcon({ priority }: { priority: InboxNotification["priority"] }) {
  if (!priority) return null;
  const color =
    priority === "urgent" ? "text-destructive" : priority === "high" ? "text-orange-500" : "text-muted-foreground";
  const bars = priorityRank[priority];
  return (
    <span className={cn("inline-flex h-3.5 items-end gap-px", color)} title={`Priority: ${priority}`}>
      {priority === "urgent" ? (
        <TriangleAlert className="size-3.5" />
      ) : (
        [1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn("w-[3px] rounded-sm bg-current", n <= bars ? "" : "opacity-25")}
            style={{ height: `${n * 4 + 2}px` }}
          />
        ))
      )}
    </span>
  );
}

function PushMessage({ item }: { item: InboxNotification }) {
  const index = item.pushMessage.indexOf(":");
  const name = index > 0 ? item.pushMessage.slice(0, index + 1) : "";
  const rest = index > 0 ? item.pushMessage.slice(index + 1) : item.pushMessage;
  return (
    <p className="line-clamp-2 text-sm">
      {item.unread ? <span className="mr-1 mb-px inline-flex size-2 shrink-0 rounded-full bg-primary" /> : null}
      {name ? <span className={item.unread ? "font-medium" : "font-medium text-muted-foreground"}>{name}</span> : null}
      <span className={item.unread ? "text-foreground" : "text-muted-foreground"}>{rest}</span>
    </p>
  );
}

function NotificationCard({
  item,
  active,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  item: InboxNotification;
  active: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const [TypeIcon, typeColor] = typeIcons[item.type];
  const InboxIcon = inboxIcons[item.inbox];
  const person = item.actor || item.contact;
  const accent = item.unread ? typeColor : "text-muted-foreground";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex w-full flex-col gap-1 rounded-lg p-3 text-left transition-colors hover:bg-muted/60",
            active && "bg-muted",
          )}
        >
          <div className="flex items-start gap-2">
            <Avatar className="mt-0.5 size-5">
              <AvatarFallback className={cn("text-[9px]", toneFor(person))}>{getInitials(person)}</AvatarFallback>
            </Avatar>
            <PushMessage item={item} />
          </div>
          <div className="flex h-6 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
              {item.snoozedFor || item.snoozeEnded ? (
                <>
                  {item.snoozeEnded ? (
                    <AlarmClockOff
                      className={cn("size-4 shrink-0", item.unread ? "text-primary" : "text-muted-foreground")}
                    />
                  ) : (
                    <AlarmClockPlus
                      className={cn("size-4 shrink-0", item.unread ? "text-primary" : "text-muted-foreground")}
                    />
                  )}
                  <span
                    className={cn(
                      "truncate font-medium text-xs",
                      item.unread ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.snoozeEnded ? "Snooze ended" : `Snoozed for ${item.snoozedFor}`}
                  </span>
                </>
              ) : (
                <>
                  <TypeIcon className={cn("size-4 shrink-0", accent)} />
                  <span className={cn("truncate font-medium text-xs", accent)}>{typeLabels[item.type]}</span>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <PriorityIcon priority={item.priority} />
              <span className="flex size-4 items-center justify-center rounded-full bg-muted" title={item.inbox}>
                <InboxIcon className="size-2.5 text-muted-foreground" />
              </span>
              <span className="text-muted-foreground text-xs">{item.time}</span>
            </div>
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={onToggleRead}>
          {item.unread ? <MailOpen /> : <Mail />}
          {item.unread ? "Mark as read" : "Mark as unread"}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DisplayMenu({
  sort,
  onSort,
  showSnoozed,
  showRead,
  onSnoozed,
  onRead,
}: {
  sort: SortKey;
  onSort: (value: SortKey) => void;
  showSnoozed: boolean;
  showRead: boolean;
  onSnoozed: (value: boolean) => void;
  onRead: (value: boolean) => void;
}) {
  const sortLabel = { newest: "Newest", oldest: "Oldest", priority: "Priority" }[sort];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="xs">
          Display <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="flex h-11 items-center justify-between gap-2 px-3">
          <span className="flex items-center gap-1.5 font-medium text-xs">
            <ArrowDownUp className="size-3.5" /> Sort
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="xs" className="min-w-20 justify-between">
                {sortLabel} <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as SortKey)}>
                <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Separator />
        <div className="px-3 pt-3 pb-1 font-medium text-muted-foreground text-xs">Display :</div>
        <div className="divide-y">
          <Label className="flex h-9 items-center gap-2 px-3 font-medium text-xs">
            <Checkbox checked={showSnoozed} onCheckedChange={(c) => onSnoozed(c === true)} /> Snoozed
          </Label>
          <Label className="flex h-9 items-center gap-2 px-3 font-medium text-xs">
            <Checkbox checked={showRead} onCheckedChange={(c) => onRead(c === true)} /> Read
          </Label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CustomSnoozeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 9, 14));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Snooze until</DialogTitle>
        </DialogHeader>
        <div className="grid justify-items-center gap-3">
          <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-lg border" />
          <Input type="time" defaultValue="09:00" className="w-full" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => onOpenChange(false)}>Snooze</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConversationPane({
  item,
  index,
  total,
  onPrev,
  onNext,
  onSnooze,
  onCustomSnooze,
  onDelete,
}: {
  item: InboxNotification;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSnooze: (label: string) => void;
  onCustomSnooze: () => void;
  onDelete: () => void;
}) {
  const InboxIcon = inboxIcons[item.inbox];
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex items-center gap-1">
          {total > 1 ? (
            <>
              <Button variant="ghost" size="icon-xs" aria-label="Previous" disabled={index === 0} onClick={onPrev}>
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Next" disabled={index >= total - 1} onClick={onNext}>
                <ChevronRight />
              </Button>
              <span className="ml-1 text-muted-foreground text-xs tabular-nums">
                <span className="text-foreground">{index + 1}</span> of {total}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="xs">
                <BellMinus /> Snooze notification
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Snooze Notification</DropdownMenuLabel>
              {snoozeOptions.map((option) => (
                <DropdownMenuItem key={option} onSelect={() => onSnooze(option)}>
                  {option}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCustomSnooze}>Custom...</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="xs" onClick={onDelete}>
            <Trash2 /> Delete notification
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className={cn("text-xs", toneFor(item.contact))}>
              {getInitials(item.contact)}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate font-medium text-sm">{item.contact}</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
              <InboxIcon className="size-3" /> {item.inbox} • #{item.conversationId}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.labels.map((label) => (
            <Badge key={label} variant="secondary" className="font-normal">
              {label}
            </Badge>
          ))}
          <Button size="sm" asChild>
            <Link href="/dashboard/chat">Open conversation</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-muted/30 p-6">
        {item.messages.map((m, i) => (
          <div
            key={`${item.id}-${i}`}
            className={cn(
              "flex max-w-[75%] flex-col gap-1",
              m.from === "contact" ? "self-start" : "self-end items-end",
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                m.from === "contact" && "rounded-bl-sm border bg-card",
                m.from === "agent" && "rounded-br-sm bg-primary text-primary-foreground",
                m.from === "note" &&
                  "rounded-br-sm border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
              )}
            >
              {m.body}
            </div>
            <span className="text-muted-foreground text-xs">
              {m.from === "note" ? "Private note • " : ""}
              {m.author} • {m.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsInbox() {
  const [items, setItems] = React.useState<InboxNotification[]>(seed);
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [showSnoozed, setShowSnoozed] = React.useState(true);
  const [showRead, setShowRead] = React.useState(true);
  const [activeId, setActiveId] = React.useState<number | null>(1);
  const [customOpen, setCustomOpen] = React.useState(false);

  const visible = React.useMemo(() => {
    const filtered = items.filter((n) => (showSnoozed || !n.snoozedFor) && (showRead || n.unread));
    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return b.minutesAgo - a.minutesAgo;
      if (sort === "priority") {
        const diff = (priorityRank[b.priority ?? ""] ?? 0) - (priorityRank[a.priority ?? ""] ?? 0);
        return diff || a.minutesAgo - b.minutesAgo;
      }
      return a.minutesAgo - b.minutesAgo;
    });
  }, [items, sort, showSnoozed, showRead]);

  const activeIndex = visible.findIndex((n) => n.id === activeId);
  const active = activeIndex >= 0 ? visible[activeIndex] : null;

  function update(id: number, patch: Partial<InboxNotification>) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function remove(id: number) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function open(id: number) {
    setActiveId(id);
    update(id, { unread: false });
  }

  const snoozeShort: Record<string, string> = {
    "Until an hour from now": "1h",
    "Until tomorrow": "tomorrow",
    "Until next week": "next week",
    "Until next month": "next month",
  };

  return (
    <>
      <Card className="flex h-[calc(100svh-8rem)] min-h-[560px] flex-row gap-0 overflow-hidden py-0">
        <div className="flex w-full shrink-0 flex-col border-r lg:w-[340px]">
          <div className="flex h-13 shrink-0 items-center justify-between gap-1 pr-3 pl-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="truncate font-medium text-lg">My Inbox</h1>
              <DisplayMenu
                sort={sort}
                onSort={setSort}
                showSnoozed={showSnoozed}
                showRead={showRead}
                onSnoozed={setShowSnoozed}
                onRead={setShowRead}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Inbox options">
                  <SlidersVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setItems((prev) => prev.map((n) => ({ ...n, unread: false })))}>
                  Mark all as read
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setItems([]);
                    setActiveId(null);
                  }}
                >
                  Delete all
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setItems((prev) => prev.filter((n) => n.unread))}>
                  Delete all read
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 divide-y divide-border/60 overflow-y-auto px-2 pb-4">
            {visible.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                active={item.id === activeId}
                onOpen={() => open(item.id)}
                onToggleRead={() => update(item.id, { unread: !item.unread })}
                onDelete={() => remove(item.id)}
              />
            ))}
            {visible.length === 0 ? (
              <p className="p-4 text-center font-medium text-muted-foreground text-sm">No notifications</p>
            ) : null}
          </div>
        </div>

        {active ? (
          <ConversationPane
            item={active}
            index={activeIndex}
            total={visible.length}
            onPrev={() => open(visible[activeIndex - 1].id)}
            onNext={() => open(visible[activeIndex + 1].id)}
            onSnooze={(label) => {
              update(active.id, { snoozedFor: snoozeShort[label] ?? label, snoozeEnded: false });
              setActiveId(null);
            }}
            onCustomSnooze={() => setCustomOpen(true)}
            onDelete={() => remove(active.id)}
          />
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-center lg:flex">
            <Inbox className="size-10 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-medium text-muted-foreground text-sm">Notifications from all subscribed inboxes</span>
          </div>
        )}
      </Card>

      <CustomSnoozeDialog open={customOpen} onOpenChange={setCustomOpen} />
    </>
  );
}
