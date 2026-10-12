"use client";
// My Inbox in the Studio pattern (page heading + tabs with counts + filter chips + one card), keeping Chatwoot v4.18's
// inbox (routes/dashboard/inbox, components-next/Inbox/InboxCard.vue): Display menu (Sort Newest / Oldest / Priority,
// Display : Snoozed, Read), options menu (Mark all as read, Delete all, Delete all read), notification cards with
// type line, snooze state, SLA label, priority, inbox icon and time, the right-click menu (here also a "..." menu per
// row), and the right pane with up / down pagination, Snooze notification (+ Custom...), Delete notification and
// the conversation thread.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  AlarmClockOff,
  AlarmClockPlus,
  ArrowDownUp,
  AtSign,
  BellMinus,
  ChevronDown,
  ChevronsRight,
  ChevronUp,
  CheckCheck,
  HeartCrack,
  Inbox,
  Mail,
  MailOpen,
  MailPlus,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Settings2,
  SlidersVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import {
  buildThread,
  type CwMessage,
  inboxes,
  inboxOf,
  initialMeta,
  priorities,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import {
  AgentAvatar,
  ChannelIcon,
  PersonAvatar,
  PriorityIcon,
  SlaBadge,
  StatusPill,
} from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { LabelBadge, PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import {
  buildNotification,
  exactTime,
  type InboxNotification,
  type NotificationType,
  notificationSeeds,
  relativeTime,
  snoozeOptions,
  typeLabels,
} from "./notification-data";

type SortKey = "newest" | "oldest" | "priority";
type View = "all" | "unread" | "mentioned" | "assigned" | "sla";

const typeIcons: Record<NotificationType, [React.ElementType, string]> = {
  conversation_mention: [AtSign, "text-primary"],
  conversation_assignment: [ChevronsRight, "text-primary"],
  conversation_creation: [MailPlus, "text-primary"],
  assigned_conversation_new_message: [MessageSquarePlus, "text-primary"],
  participating_conversation_new_message: [MessageSquarePlus, "text-primary"],
  sla_missed_first_response: [HeartCrack, "text-destructive"],
  sla_missed_next_response: [HeartCrack, "text-destructive"],
  sla_missed_resolution: [HeartCrack, "text-destructive"],
};

const views: { value: View; label: string; match: (n: InboxNotification) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "unread", label: "Unread", match: (n) => n.unread },
  { value: "mentioned", label: "Mentioned", match: (n) => n.type === "conversation_mention" },
  {
    value: "assigned",
    label: "Assigned to you",
    match: (n) => n.type === "conversation_assignment" || n.type === "assigned_conversation_new_message",
  },
  { value: "sla", label: "SLA breach", match: (n) => n.type.startsWith("sla_missed") },
];

const priorityRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };

const seed: InboxNotification[] = notificationSeeds
  .map((s, i) => buildNotification(s, i))
  .filter((n): n is InboxNotification => n !== null);

function ChipSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CardMessage({ item }: { item: InboxNotification }) {
  return (
    <p className="line-clamp-2 text-sm">
      {item.unread ? <span className="me-1.5 mb-px inline-flex size-2 shrink-0 rounded-full bg-primary" /> : null}
      <span className={item.unread ? "font-semibold" : "font-medium text-muted-foreground"}>{item.actor}:</span>{" "}
      <span className={item.unread ? "font-medium text-foreground" : "text-muted-foreground"}>{item.message}</span>
    </p>
  );
}

function RowMenuItems({
  item,
  Item,
  onToggleRead,
  onDelete,
}: {
  item: InboxNotification;
  Item: typeof DropdownMenuItem | typeof ContextMenuItem;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Item onSelect={onToggleRead}>
        {item.unread ? <MailOpen /> : <Mail />}
        {item.unread ? "Mark as read" : "Mark as unread"}
      </Item>
      <Item variant="destructive" onSelect={onDelete}>
        <Trash2 /> Delete
      </Item>
    </>
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
  const meta = useCwStore((s) => s.meta[item.conversationId]);
  const inbox = inboxOf(item.conversation);
  const accent = item.unread ? typeColor : "text-muted-foreground";
  const snoozeAccent = item.unread ? "text-primary" : "text-muted-foreground";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className={cn(
            "group/row relative flex w-full cursor-pointer flex-col gap-1 rounded-lg p-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-muted",
          )}
        >
          <div className="flex items-start gap-2 pe-7">
            <AgentAvatar id={item.assigneeId} size="sm" className="mt-0.5 size-5" />
            <CardMessage item={item} />
          </div>
          <div className="flex h-6 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 ps-1">
              {item.snoozedUntil || item.snoozeEnded ? (
                <>
                  {item.snoozeEnded ? (
                    <AlarmClockOff className={cn("size-4 shrink-0", snoozeAccent)} />
                  ) : (
                    <AlarmClockPlus className={cn("size-4 shrink-0", snoozeAccent)} />
                  )}
                  <span className={cn("truncate font-medium text-xs", snoozeAccent)}>
                    {item.snoozeEnded ? "Snooze ended" : `Snoozed for ${item.snoozedUntil}`}
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
              {meta?.sla ? (
                <>
                  <SlaBadge sla={meta.sla} className={item.unread ? undefined : "opacity-70"} />
                  <span className="h-3 w-px rounded-sm bg-border" />
                </>
              ) : null}
              {meta ? <PriorityIcon priority={meta.priority} /> : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex size-4 items-center justify-center rounded-full bg-muted">
                    <ChannelIcon channel={item.conversation.channel} className="size-2.5 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">{inbox.name}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground text-xs tabular-nums">{relativeTime(item.minutesAgo)}</span>
                </TooltipTrigger>
                <TooltipContent>{exactTime(item.minutesAgo)}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div
            className={cn(
              "absolute end-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100",
              active && "opacity-100",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Open actions for notification from ${item.actor}`}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44" onClick={(event) => event.stopPropagation()}>
                <RowMenuItems
                  item={item}
                  Item={DropdownMenuItem}
                  onToggleRead={onToggleRead}
                  onDelete={onDelete}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <RowMenuItems
          item={item}
          Item={ContextMenuItem}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
        />
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
        <Button variant="outline" size="sm">
          Display <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <div className="flex h-11 items-center justify-between gap-2 px-3">
          <span className="flex items-center gap-1.5 font-medium text-xs">
            <ArrowDownUp className="size-3.5" /> Sort
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="xs" className="min-w-24 justify-between">
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
        <div className="px-3 pt-2 pb-0.5 font-medium text-muted-foreground text-xs">Display :</div>
        <div className="divide-y">
          <Label className="flex h-9 cursor-pointer items-center gap-2 px-3 font-medium text-xs">
            <Checkbox checked={showSnoozed} onCheckedChange={(c) => onSnoozed(c === true)} /> Snoozed
          </Label>
          <Label className="flex h-9 cursor-pointer items-center gap-2 px-3 font-medium text-xs">
            <Checkbox checked={showRead} onCheckedChange={(c) => onRead(c === true)} /> Read
          </Label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CustomSnoozeDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (label: string) => void;
}) {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 9, 14));
  const [time, setTime] = React.useState("09:00");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Snooze until</DialogTitle>
        </DialogHeader>
        <div className="grid justify-items-center gap-3">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={{ before: new Date(2026, 9, 12) }}
            className="rounded-lg border"
          />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!date || !time}
            onClick={() => {
              if (!date) return;
              onApply(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
              onOpenChange(false);
            }}
          >
            Snooze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThreadMessage({ message }: { message: CwMessage }) {
  if (message.kind === "activity") {
    return (
      <div className="self-center rounded-full bg-muted px-3 py-1 text-center text-muted-foreground text-xs">
        {message.text}
      </div>
    );
  }
  const incoming = message.kind === "incoming";
  return (
    <div className={cn("flex max-w-[75%] flex-col gap-1", incoming ? "self-start" : "items-end self-end")}>
      <div
        className={cn(
          "grid gap-1.5 rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          incoming && "rounded-bl-sm border bg-card",
          message.kind === "outgoing" && "rounded-br-sm bg-primary text-primary-foreground",
          message.kind === "note" &&
            "rounded-br-sm border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
        )}
      >
        {message.text ? <span className="whitespace-pre-line">{message.text}</span> : null}
        {message.attachments?.map((file) => (
          <span key={file.name} className="inline-flex items-center gap-1.5 text-xs opacity-80">
            <Paperclip className="size-3" /> {file.name}
          </span>
        ))}
      </div>
      <span className="text-muted-foreground text-xs">
        {message.kind === "note" ? "Private note • " : ""}
        {message.sender ? `${message.sender} • ` : ""}
        {message.time}
      </span>
    </div>
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
  onSnooze: (short: string) => void;
  onCustomSnooze: () => void;
  onDelete: () => void;
}) {
  const meta = useCwStore((s) => s.meta[item.conversationId]) ?? initialMeta[item.conversationId];
  const { byConv } = useChatTags();
  const labels = byConv[String(item.conversationId)] ?? [];
  const thread = React.useMemo(() => buildThread(item.conversation, meta), [item.conversation, meta]);
  const inbox = inboxOf(item.conversation);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" aria-label="Previous notification" disabled={index <= 0} onClick={onPrev}>
              <ChevronUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Next notification"
              disabled={index >= total - 1}
              onClick={onNext}
            >
              <ChevronDown />
            </Button>
          </div>
          <span className="whitespace-nowrap text-sm tabular-nums">
            <span className="font-medium">{total <= 1 ? 1 : index + 1}</span>
            {total > 1 ? <span className="text-muted-foreground"> / {total}</span> : null}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <BellMinus /> Snooze notification
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Snooze Notification</DropdownMenuLabel>
              {snoozeOptions.map((option) => (
                <DropdownMenuItem key={option.label} onSelect={() => onSnooze(option.short)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCustomSnooze}>Custom...</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 /> Delete notification
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={item.contactName} />
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate font-medium text-sm">
              {item.contactName} <span className="font-normal text-muted-foreground">#{item.conversationId}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 truncate text-muted-foreground text-xs">
              <ChannelIcon channel={item.conversation.channel} className="size-3" /> {inbox.name} •{" "}
              {item.conversation.subject}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta ? <StatusPill status={meta.status} /> : null}
          {labels.map((label) => (
            <LabelBadge key={label} label={label} />
          ))}
          <Button size="sm" asChild>
            <Link href={`/dashboard/chat?conversation=${item.conversationId}`}>Open conversation</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-muted/30 p-6">
        {thread.map((message) => (
          <ThreadMessage key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

export function NotificationsView() {
  const [items, setItems] = React.useState<InboxNotification[]>(seed);
  const [view, setView] = React.useState<View>("all");
  const [inboxFilter, setInboxFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [showSnoozed, setShowSnoozed] = React.useState(true);
  const [showRead, setShowRead] = React.useState(true);
  const [activeId, setActiveId] = React.useState<number | null>(1);
  const [customFor, setCustomFor] = React.useState<number | null>(null);

  const displayed = React.useMemo(
    () => items.filter((n) => (showSnoozed || !n.snoozedUntil) && (showRead || n.unread)),
    [items, showSnoozed, showRead],
  );

  const visible = React.useMemo(() => {
    const viewMatch = views.find((v) => v.value === view)?.match ?? (() => true);
    const filtered = displayed.filter(
      (n) =>
        viewMatch(n) &&
        (inboxFilter === "all" || n.conversation.channel === inboxFilter) &&
        (priorityFilter === "all" || (initialMeta[n.conversationId]?.priority ?? "none") === priorityFilter),
    );
    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return b.minutesAgo - a.minutesAgo;
      if (sort === "priority") {
        const pa = priorityRank[initialMeta[a.conversationId]?.priority ?? "none"];
        const pb = priorityRank[initialMeta[b.conversationId]?.priority ?? "none"];
        return pb - pa || a.minutesAgo - b.minutesAgo;
      }
      return a.minutesAgo - b.minutesAgo;
    });
  }, [displayed, view, inboxFilter, priorityFilter, sort]);

  const activeIndex = visible.findIndex((n) => n.id === activeId);
  const active = activeIndex >= 0 ? visible[activeIndex] : null;
  const unreadCount = items.filter((n) => n.unread).length;

  function update(id: number, patch: Partial<InboxNotification>) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function remove(id: number) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
    toast.success("Notification deleted");
  }

  function open(id: number) {
    setActiveId(id);
    update(id, { unread: false });
  }

  function toggleRead(item: InboxNotification) {
    update(item.id, { unread: !item.unread });
    toast.success(item.unread ? "Notification marked as read" : "Notification marked as unread");
  }

  function snooze(id: number, short: string) {
    update(id, { snoozedUntil: short, snoozeEnded: false });
    if (activeId === id) setActiveId(null);
    toast.success("Notification snoozed");
  }

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    toast.success("All notifications marked as read");
  }

  const inboxOptions = [
    { value: "all", label: "All" },
    ...inboxes.filter((i) => seed.some((n) => n.conversation.channel === i.id)).map((i) => ({ value: i.id, label: i.name })),
  ];
  const priorityOptions = [{ value: "all", label: "All" }, ...priorities.map((p) => ({ value: p.value, label: p.label }))];
  const filtersOn = inboxFilter !== "all" || priorityFilter !== "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading title="My Inbox" subtitle="Notifications from all subscribed inboxes" />
        <Button size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck /> Mark all as read
        </Button>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="gap-4">
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          {views.map((v) => (
            <TabsTrigger key={v.value} value={v.value}>
              {v.label}
              <Badge variant="secondary" className="ms-1 tabular-nums">
                {displayed.filter(v.match).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Notifications</CardTitle>
          <CardDescription className="leading-snug">
            {unreadCount ? `${unreadCount} unread` : "You are all caught up"} · {items.length} in total
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <DisplayMenu
              sort={sort}
              onSort={setSort}
              showSnoozed={showSnoozed}
              showRead={showRead}
              onSnoozed={setShowSnoozed}
              onRead={setShowRead}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Inbox options">
                  <SlidersVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={markAllRead}>
                  <CheckCheck /> Mark all as read
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setItems([]);
                    setActiveId(null);
                    toast.success("All notifications deleted");
                  }}
                >
                  <Trash2 /> Delete all
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setItems((prev) => prev.filter((n) => n.unread));
                    if (active && !active.unread) setActiveId(null);
                    toast.success("All read notifications deleted");
                  }}
                >
                  <MailOpen /> Delete all read
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings/profile">
                    <Settings2 /> Notification preferences
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <ChipSelect label="Inbox" value={inboxFilter} options={inboxOptions} onChange={setInboxFilter} />
              <ChipSelect
                label="Priority"
                value={priorityFilter}
                options={priorityOptions}
                onChange={setPriorityFilter}
              />
            </div>
            {filtersOn ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInboxFilter("all");
                  setPriorityFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>

          <div className="flex h-[calc(100svh-22rem)] min-h-[520px] border-t">
            <div
              className={cn(
                "flex w-full shrink-0 flex-col border-e lg:w-[380px]",
                active ? "hidden lg:flex" : "flex",
              )}
            >
              <div className="flex flex-1 flex-col gap-0.5 divide-y divide-border/60 overflow-y-auto p-2">
                {visible.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    active={item.id === activeId}
                    onOpen={() => open(item.id)}
                    onToggleRead={() => toggleRead(item)}
                    onDelete={() => remove(item.id)}
                  />
                ))}
                {visible.length === 0 ? (
                  <p className="p-6 text-center font-medium text-muted-foreground text-sm">No notifications</p>
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
                onSnooze={(short) => snooze(active.id, short)}
                onCustomSnooze={() => setCustomFor(active.id)}
                onDelete={() => remove(active.id)}
              />
            ) : (
              <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-center lg:flex">
                <Inbox className="size-10 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-medium text-muted-foreground text-sm">
                  {items.length ? "Notifications from all subscribed inboxes" : "No notifications"}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CustomSnoozeDialog
        open={customFor !== null}
        onOpenChange={(o) => {
          if (!o) setCustomFor(null);
        }}
        onApply={(label) => {
          if (customFor !== null) snooze(customFor, label);
          setCustomFor(null);
        }}
      />
    </div>
  );
}
