"use client";
// My Inbox as Chatwoot v4.18 draws it (routes/dashboard/inbox: InboxList.vue, InboxListHeader.vue, InboxView.vue,
// InboxItemHeader.vue, components-next/Inbox/InboxCard.vue), inside the Studio frame of the Conversations page
// (conversations-workspace.tsx): one card under the header holding the notification list, the open conversation and
// the contact panel. T-140 (Fahad 2026-10-14 00:45, item 58: the page heading, the tabs with counts and the big
// message were not standard): the list header is "My Inbox" + Display + options only; nothing opens by itself (the
// right side shows Chatwoot's empty state); an opened notification shows the conversation itself (the same
// ConversationPane as Conversations, like Chatwoot's ConversationBox), under Chatwoot's item header (back, n / N,
// Snooze notification, Delete notification). Studio's extra filters (type, inbox, priority, sort by priority) moved
// into the Display menu, with a chip under the header while one is on. T-286 (Fahad 2026-10-15, item 125.5): three tabs
// under the header, Unread / Read / Snoozed, in place of Display's Read and Snoozed checkboxes; Snoozed is grouped by
// return day with a Today / Tomorrow / date filter; a returned notification tops Unread with "Returned from snooze".
// F-10b (Fahad item 51b, 01:23:54: «الاشعارات تكون للنظام التسجيل التغيير الموافقات اشعارات عامه بكل شيئ»): the list also
// holds the bell's System, Sign-ups, Changes, Approvals and Automation notifications (the activity log's, the same
// `feed` of notifications-store.ts the bell reads, with the same saved read state). They sit with the conversation
// ones by time, under Unread and Read; opening one marks it read and goes to its place, as in the bell. Display > Type
// lists their categories. They cannot be snoozed or deleted: they are records of the activity log, which is append-only.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  AlarmClockCheck,
  AlarmClockPlus,
  ArrowDownUp,
  AtSign,
  BellMinus,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronsRight,
  ChevronUp,
  HeartCrack,
  Inbox,
  Mail,
  MailOpen,
  MailPlus,
  MessageSquarePlus,
  MoreHorizontal,
  Settings2,
  SlidersVertical,
  SquareArrowOutUpRight,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { ContactPanel } from "@/app/(main)/dashboard/chat/_components/contact-panel";
import { ConversationPane } from "@/app/(main)/dashboard/chat/_components/conversation-pane";
import { inboxes, inboxOf, priorities } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { CwDialogs } from "@/app/(main)/dashboard/chat/_components/cw-dialogs";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { AgentAvatar, ChannelIcon, PriorityIcon, SlaBadge } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORY_LABELS } from "@/lib/notifications/feed";

import { FeedAvatar } from "./header-inbox";
import {
  conversationRows,
  dayKey,
  defaultFilters,
  feedFiltered,
  feedInTab,
  feedMinutes,
  feedTypeGroups,
  filtered as filteredOf,
  type InboxTab,
  inboxTabs,
  inTab,
  type ListFilters,
  listedGroups,
  mergeRows,
  returnedFirstRows,
  type SnoozeDay,
  type SortKey,
  snoozedByReturn,
  tabCounts,
  typeCounts,
  typeGroups,
} from "./my-inbox-filters";
import {
  exactTime,
  type InboxNotification,
  type NotificationType,
  relativeTime,
  type SnoozeKey,
  snoozeOptions,
  snoozeTime,
  typeLabels,
} from "./notification-data";
import { type FeedEntry, useNotifications, useNotificationsStore } from "./notifications-store";

// Chatwoot NOTIFICATION_TYPES_MAPPING (InboxViewHelpers.js): blue, SLA in red.
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

// The Display choices outlive the page, as Chatwoot keeps them in the agent's UI settings (inbox_filter_by). The tab
// is kept in the store (notifications-store.ts), Unread by default.
let savedFilters: ListFilters = defaultFilters;
let savedSnoozeDay: SnoozeDay = "all";

// The clock the Snoozed tab reads ("Snoozed for 2h", Today / Tomorrow), refreshed every 30 seconds.
function useNow(ms = 30_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

function useMinWidth(px: number) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [px]);
  return matches;
}

function CardMessage({ item }: { item: InboxNotification }) {
  return (
    <p className="line-clamp-2 text-sm">
      {item.unread ? (
        <span data-unread="" className="me-1.5 mb-px inline-flex size-2 shrink-0 rounded-full bg-primary" />
      ) : null}
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
  now,
  active,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  item: InboxNotification;
  now: number;
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
          data-slot="notification-card"
          data-active={active}
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
          {/* T-286: the snooze state on its own line, so it is never cut by the SLA badge; the type stays below. */}
          {item.snoozedUntil !== undefined ? (
            <span className={cn("flex items-center gap-1.5 ps-1 font-medium text-xs", snoozeAccent)}>
              <AlarmClockPlus className="size-3.5 shrink-0" />
              Snoozed for {relativeTime(Math.max(1, Math.ceil((item.snoozedUntil - now) / 60_000)))}
            </span>
          ) : null}
          {item.snoozedUntil === undefined && item.returnedAt !== undefined ? (
            // Its own mark, so a notification back from a snooze is not taken for a new one.
            <span
              data-slot="returned-from-snooze"
              className={cn(
                "inline-flex h-5 w-fit items-center gap-1 rounded-md px-1.5 font-medium text-xs",
                item.unread ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground",
              )}
            >
              <AlarmClockCheck className="size-3.5 shrink-0" />
              Returned from snooze
            </span>
          ) : null}
          <div className="flex items-start gap-2 pe-7">
            <AgentAvatar id={item.assigneeId} size="sm" className="mt-0.5 size-5" />
            <CardMessage item={item} />
          </div>
          <div className="flex h-6 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 ps-1">
              <TypeIcon className={cn("size-4 shrink-0", accent)} />
              <span className={cn("truncate font-medium text-xs", accent)}>{typeLabels[item.type]}</span>
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
                <RowMenuItems item={item} Item={DropdownMenuItem} onToggleRead={onToggleRead} onDelete={onDelete} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <RowMenuItems item={item} Item={ContextMenuItem} onToggleRead={onToggleRead} onDelete={onDelete} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

// F-10b: a System / Sign-ups / Changes / Approvals / Automation notification from the activity log. Same card shape as
// a conversation notification: the mark (the bell's), the type and the log's sentence, the category and the time.
function FeedCard({
  entry,
  now,
  onOpen,
  onToggleRead,
}: {
  entry: FeedEntry;
  now: number;
  onOpen: () => void;
  onToggleRead: () => void;
}) {
  const accent = entry.unread ? "text-primary" : "text-muted-foreground";
  const minutes = feedMinutes(entry, now);
  const menuItems = (Item: typeof DropdownMenuItem | typeof ContextMenuItem) => (
    <Item onSelect={onToggleRead}>
      {entry.unread ? <MailOpen /> : <Mail />}
      {entry.unread ? "Mark as read" : "Mark as unread"}
    </Item>
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          data-slot="notification-card"
          data-kind="feed"
          data-category={entry.category}
          data-href={entry.href}
          data-unread={entry.unread}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className="group/row relative flex w-full cursor-pointer flex-col gap-1 rounded-lg p-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-start gap-2 pe-7">
            <FeedAvatar entry={entry} size="sm" />
            <p className="line-clamp-3 text-sm">
              {entry.unread ? (
                <span data-unread="" className="me-1.5 mb-px inline-flex size-2 shrink-0 rounded-full bg-primary" />
              ) : null}
              <span className={entry.unread ? "font-semibold" : "font-medium text-muted-foreground"}>{entry.type}</span>
              {" · "}
              <span className={entry.unread ? "font-medium text-foreground" : "text-muted-foreground"}>
                {entry.text}
              </span>
            </p>
          </div>
          <div className="flex h-6 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 ps-1">
              <span className={cn("truncate font-medium text-xs", accent)}>{CATEGORY_LABELS[entry.category]}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{relativeTime(minutes)}</span>
              </TooltipTrigger>
              <TooltipContent>{exactTime(minutes)}</TooltipContent>
            </Tooltip>
          </div>
          <div className="absolute end-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Open actions for notification: ${entry.type}`}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44" onClick={(event) => event.stopPropagation()}>
                {menuItems(DropdownMenuItem)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">{menuItems(ContextMenuItem)}</ContextMenuContent>
    </ContextMenu>
  );
}

function MenuSelect({
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
    <div className="flex h-9 items-center justify-between gap-2 px-3">
      <span className="font-medium text-xs">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="h-6 min-w-24 max-w-36 text-xs" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

// Chatwoot InboxDisplayMenu (Sort; its "Display :" Snoozed / Read are the tabs now, T-286), then Studio's filters: type
// (Chatwoot's card labels, each with how many are listed), inbox and priority.
function DisplayMenu({
  showSort,
  filters,
  onFilters,
  counts,
  inboxOptions,
  active,
}: {
  showSort: boolean; // Snoozed is always ordered by return time
  filters: ListFilters;
  onFilters: (value: ListFilters) => void;
  counts: Record<string, number>;
  inboxOptions: { value: string; label: string }[];
  active: number;
}) {
  const sortLabel = { newest: "Newest", oldest: "Oldest", priority: "Priority" }[filters.sort];
  const priorityOptions = [
    { value: "all", label: "All" },
    ...priorities.map((p) => ({ value: p.value, label: p.label })),
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="xs" aria-label={active ? `Display, ${active} filters on` : "Display"}>
          Display
          {active ? (
            <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground tabular-nums">
              {active}
            </span>
          ) : null}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {showSort ? (
          <>
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
                  <DropdownMenuRadioGroup
                    value={filters.sort}
                    onValueChange={(v) => onFilters({ ...filters, sort: v as SortKey })}
                  >
                    <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />
          </>
        ) : null}
        <div className="px-3 pt-2 pb-1 font-medium text-muted-foreground text-xs">Type</div>
        <div className="flex flex-col px-1.5 pb-1.5">
          {[{ value: "all", label: "All" }, ...listedGroups(), ...feedTypeGroups].map((g) => {
            const on = filters.type === g.value;
            return (
              <button
                key={g.value}
                type="button"
                aria-pressed={on}
                onClick={() => onFilters({ ...filters, type: g.value })}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md px-1.5 text-left font-medium text-xs hover:bg-muted",
                  on && "bg-primary/10 text-primary",
                )}
              >
                <Check className={cn("size-3", !on && "invisible")} />
                <span className="flex-1 truncate">{g.label}</span>
                <span className="text-muted-foreground tabular-nums">{counts[g.value] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <Separator />
        <MenuSelect
          label="Inbox"
          value={filters.inbox}
          options={inboxOptions}
          onChange={(inbox) => onFilters({ ...filters, inbox })}
        />
        <MenuSelect
          label="Priority"
          value={filters.priority}
          options={priorityOptions}
          onChange={(priority) => onFilters({ ...filters, priority })}
        />
        {active ? (
          <>
            <Separator />
            <div className="p-1.5">
              <Button
                variant="ghost"
                size="xs"
                className="w-full"
                onClick={() => onFilters({ ...defaultFilters, sort: filters.sort })}
              >
                Clear filters
              </Button>
            </div>
          </>
        ) : null}
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
  onApply: (until: number) => void;
}) {
  // T-286: the picked day and time are the return time (it was the day only, as a label). Nothing in the past.
  const [date, setDate] = React.useState<Date | undefined>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  });
  const [time, setTime] = React.useState("09:00");
  const [hours, minutes] = time.split(":").map(Number);
  const until =
    date && Number.isFinite(hours) && Number.isFinite(minutes)
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes).getTime()
      : null;
  const today = new Date();
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
            disabled={{ before: new Date(today.getFullYear(), today.getMonth(), today.getDate()) }}
            className="rounded-lg border"
          />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={until === null || until <= Date.now()}
            onClick={() => {
              if (until === null || until <= Date.now()) return;
              onApply(until);
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

// Chatwoot InboxItemHeader.vue: back (when the list is hidden), n / N with up / down, Snooze notification, Delete
// notification; plus Studio's link to the conversation on the Conversations page.
function ItemHeader({
  item,
  index,
  total,
  onBack,
  onPrev,
  onNext,
  onSnooze,
  onCustomSnooze,
  onDelete,
}: {
  item: InboxNotification;
  index: number;
  total: number;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSnooze: (short: SnoozeKey) => void;
  onCustomSnooze: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to notifications"
          className="lg:hidden"
          onClick={onBack}
        >
          <ChevronLeft />
        </Button>
        {total > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Previous notification"
              disabled={index <= 0}
              onClick={onPrev}
            >
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
            <span className="whitespace-nowrap text-sm tabular-nums">
              <span className="font-medium">{index + 1}</span>
              <span className="text-muted-foreground"> / {total}</span>
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="xs" aria-label="Snooze notification">
              <BellMinus /> <span className="hidden md:inline">Snooze notification</span>
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
        <Button variant="secondary" size="xs" aria-label="Delete notification" onClick={onDelete}>
          <Trash2 /> <span className="hidden md:inline">Delete notification</span>
        </Button>
        <Button variant="secondary" size="xs" asChild>
          <Link href={`/dashboard/chat?conversation=${item.conversationId}`} aria-label="Open conversation">
            <SquareArrowOutUpRight /> <span className="hidden md:inline">Open conversation</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

const emptyText: Record<InboxTab, string> = {
  unread: "No unread notifications",
  read: "No read notifications",
  snoozed: "No snoozed notifications",
};

// T-286: the Snoozed filter by return day, "All" first (item 123), then Today, Tomorrow and a picked date.
function SnoozeDayFilter({
  value,
  onChange,
  now,
}: {
  value: SnoozeDay;
  onChange: (v: SnoozeDay) => void;
  now: number;
}) {
  const [pickOpen, setPickOpen] = React.useState(false);
  const picked = value !== "all" && value !== "today" && value !== "tomorrow" ? value : null;
  const pickedDate = picked ? new Date(`${picked}T12:00:00`) : undefined;
  const today = new Date(now);
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-6 items-center gap-1 rounded-md px-2 font-medium text-xs transition-colors",
      on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  return (
    <div data-slot="snooze-day-filter" className="flex items-center gap-1 px-3 pt-2">
      {[
        { value: "all", label: "All" },
        { value: "today", label: "Today" },
        { value: "tomorrow", label: "Tomorrow" },
      ].map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={chip(value === o.value)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
      <Popover open={pickOpen} onOpenChange={setPickOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-pressed={Boolean(picked)} className={chip(Boolean(picked))}>
            <CalendarDays className="size-3.5" />
            {pickedDate ? pickedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Date"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={pickedDate}
            onSelect={(d) => {
              if (!d) return;
              onChange(dayKey(d.getTime()));
              setPickOpen(false);
            }}
            disabled={{ before: new Date(today.getFullYear(), today.getMonth(), today.getDate()) }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function EmptyPane({ hasItems }: { hasItems: boolean }) {
  // Chatwoot InboxEmptyState.vue
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-2 text-center lg:flex">
      <Inbox className="size-10 text-muted-foreground" strokeWidth={1.5} />
      <span className="font-medium text-muted-foreground text-sm">
        {hasItems ? "Notifications from all subscribed inboxes" : "No notifications"}
      </span>
    </div>
  );
}

export function NotificationsView() {
  const router = useRouter();
  const [chat, setChat] = useChat();
  // T-98: the same notifications as the header bell (notifications-store.ts), so read / unread, snooze and delete
  // agree in both places.
  const items = useNotifications();
  // Live inbox state (cw-store): SLA and priority as the conversations show them now.
  const meta = useCwStore((s) => s.meta);
  const tab = useNotificationsStore((s) => s.tab);
  // F-10b: the bell's activity-log notifications (read by the header bell, notifications-store.ts useFeedPolling).
  const feed = useNotificationsStore((s) => s.feed);
  const feedStatus = useNotificationsStore((s) => s.feedStatus);
  const feedError = useNotificationsStore((s) => s.feedError);
  const [snoozeDay, setSnoozeDayState] = React.useState<SnoozeDay>(savedSnoozeDay);
  const [filters, setFiltersState] = React.useState(savedFilters);
  const now = useNow();
  const [keep, setKeep] = React.useState<Set<number>>(() => new Set());
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [customFor, setCustomFor] = React.useState<number | null>(null);
  const wide = useMinWidth(1440);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  function setTab(value: InboxTab) {
    useNotificationsStore.getState().setTab(value);
    setKeep(new Set()); // a fresh list, as Chatwoot fetches it again when its Display option changes
    setActiveId(null);
  }
  function setSnoozeDay(value: SnoozeDay) {
    savedSnoozeDay = value;
    setSnoozeDayState(value);
  }
  function setFilters(value: ListFilters) {
    savedFilters = value;
    setFiltersState(value);
  }

  const listed = React.useMemo(() => inTab(items, meta, tab, { keep }), [items, meta, tab, keep]);
  const feedListed = React.useMemo(() => feedInTab(feed, tab, keep), [feed, tab, keep]);
  const counts = typeCounts(listed, undefined, feedListed);
  const countsByTab = tabCounts(items, meta, undefined, feed);
  // Unread / Read: the Display sort, conversation and activity-log notifications together, returned-from-snooze on top
  // of Unread. Snoozed: by return time, one group a day (conversation notifications only).
  const groups = React.useMemo(() => {
    const rows = filteredOf(listed, meta, filters);
    if (tab === "snoozed")
      return snoozedByReturn(rows, snoozeDay, now).map((g) => ({ ...g, items: conversationRows(g.items) }));
    const merged = mergeRows(rows, feedFiltered(feedListed, filters), filters.sort, meta, now);
    return [{ key: tab, label: "", items: tab === "unread" ? returnedFirstRows(merged) : merged }];
  }, [listed, feedListed, meta, filters, tab, snoozeDay, now]);
  const visible = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  // The open conversation, with n / N and up / down over the conversation notifications (an activity-log one opens its
  // place instead of a conversation).
  const openable = React.useMemo(
    () => visible.flatMap((row) => (row.kind === "conversation" ? [row.item] : [])),
    [visible],
  );

  const activeIndex = openable.findIndex((n) => n.id === activeId);
  const active = activeIndex >= 0 ? openable[activeIndex] : null;
  const conversation = active?.conversation;

  // The conversation pane's own links (previous / next chat with this customer) pick another conversation: that one
  // opens on the Conversations page, as it has no notification here.
  const lastSelected = React.useRef(chat.selected);
  React.useEffect(() => {
    if (chat.selected === lastSelected.current) return;
    lastSelected.current = chat.selected;
    if (chat.selected !== null && conversation && chat.selected !== conversation.id) {
      router.push(`/dashboard/chat?conversation=${chat.selected}`);
    }
  }, [chat.selected, conversation, router]);

  function update(id: number, patch: Partial<InboxNotification>) {
    useNotificationsStore.getState().update(id, patch);
  }

  function stay(...ids: number[]) {
    setKeep((k) => new Set([...k, ...ids]));
  }

  function remove(id: number) {
    useNotificationsStore.getState().remove(id);
    if (activeId === id) setActiveId(null);
    toast.success("Notification deleted");
  }

  function open(item: InboxNotification) {
    setActiveId(item.id);
    stay(item.id);
    update(item.id, { unread: false });
    // Same conversation selected on the Conversations page afterwards (Chatwoot opens it by its route).
    lastSelected.current = item.conversationId;
    setChat({ selected: item.conversationId });
  }

  function toggleRead(item: InboxNotification) {
    stay(item.id);
    update(item.id, { unread: !item.unread });
    toast.success(item.unread ? "Notification marked as read" : "Notification marked as unread");
  }

  function snooze(id: number, until: number) {
    useNotificationsStore.getState().snooze(id, until);
    if (activeId === id) setActiveId(null);
    toast.success("Notification snoozed");
  }

  // F-10b: an activity-log notification opens its place and is read, as in the bell.
  function openFeed(entry: FeedEntry) {
    stay(entry.id);
    useNotificationsStore.getState().readFeed(entry.id);
    router.push(entry.href);
  }

  function toggleFeedRead(entry: FeedEntry) {
    stay(entry.id);
    useNotificationsStore.getState().readFeed(entry.id, !entry.unread);
    toast.success(entry.unread ? "Notification marked as read" : "Notification marked as unread");
  }

  function markAllRead() {
    stay(...listed.map((n) => n.id), ...feedListed.map((f) => f.id));
    useNotificationsStore.getState().markAllRead();
    toast.success("All notifications marked as read");
  }

  // The activity log is append-only, so its notifications are not deleted with the conversation ones.
  const keptNote = feed.length
    ? "System, sign-up, change, approval and automation notifications stay: they come from the activity log, which cannot be edited."
    : undefined;

  const inboxOptions = [
    { value: "all", label: "All" },
    ...inboxes
      .filter((i) => items.some((n) => n.conversation.channel === i.id))
      .map((i) => ({ value: i.id, label: i.name })),
  ];
  const chips = [
    filters.type !== "all" && {
      label: [...typeGroups, ...feedTypeGroups].find((g) => g.value === filters.type)?.label ?? filters.type,
      clear: () => setFilters({ ...filters, type: "all" }),
    },
    filters.inbox !== "all" && {
      label: inboxOptions.find((o) => o.value === filters.inbox)?.label ?? filters.inbox,
      clear: () => setFilters({ ...filters, inbox: "all" }),
    },
    filters.priority !== "all" && {
      label: priorities.find((p) => p.value === filters.priority)?.label ?? filters.priority,
      clear: () => setFilters({ ...filters, priority: "all" }),
    },
  ].filter((c): c is { label: string; clear: () => void } => Boolean(c));
  const togglePanel = () => (wide ? setPanelOpen((v) => !v) : setSheetOpen((v) => !v));

  return (
    // Same frame as the Conversations page (conversations-workspace.tsx): the card takes the height under the header,
    // so the page itself never scrolls.
    <div className="flex h-[calc(100svh-var(--dashboard-header-height)-5rem)] flex-col md:h-[calc(100svh-var(--dashboard-header-height)-3rem)]">
      <Card className="min-h-[24rem] flex-1 gap-0 overflow-hidden p-0">
        <div
          className={cn(
            "grid h-full min-h-0 grid-cols-1 *:min-h-0 *:min-w-0",
            wide && panelOpen && active
              ? "lg:grid-cols-[21rem_minmax(0,1fr)_20rem]"
              : "lg:grid-cols-[21rem_minmax(0,1fr)]",
          )}
        >
          <div data-slot="my-inbox-list" className={cn("flex h-full flex-col lg:border-e", active && "hidden lg:flex")}>
            {/* Chatwoot InboxListHeader.vue: title, Display, options. */}
            <div className="flex h-13 shrink-0 items-center justify-between gap-2 px-3">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate font-medium text-base">My Inbox</h2>
                <DisplayMenu
                  showSort={tab !== "snoozed"}
                  filters={filters}
                  onFilters={setFilters}
                  counts={counts}
                  inboxOptions={inboxOptions}
                  active={chips.length}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Inbox options">
                    <SlidersVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={markAllRead}>
                    <CheckCheck /> Mark all as read
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      useNotificationsStore.getState().deleteAll();
                      setActiveId(null);
                      toast.success(keptNote ? "Conversation notifications deleted" : "All notifications deleted", {
                        description: keptNote,
                      });
                    }}
                  >
                    <Trash2 /> Delete all
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      useNotificationsStore.getState().deleteAllRead();
                      if (active && !active.unread) setActiveId(null);
                      toast.success(
                        keptNote ? "Read conversation notifications deleted" : "All read notifications deleted",
                        { description: keptNote },
                      );
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
            </div>
            {/* T-286: Unread / Read / Snoozed, same tab row as the Conversations list (conversation-list.tsx). */}
            <div data-slot="my-inbox-tabs" className="border-b px-1.5">
              <Tabs value={tab} onValueChange={(value) => setTab(value as InboxTab)}>
                <TabsList
                  variant="line"
                  aria-label="Notifications"
                  className="w-full justify-start gap-0.5 *:data-[slot=tabs-trigger]:flex-none"
                >
                  {inboxTabs.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="gap-1 px-1.5">
                      {t.label}
                      <span className="text-muted-foreground text-xs tabular-nums">{countsByTab[t.value]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            {tab === "snoozed" ? <SnoozeDayFilter value={snoozeDay} onChange={setSnoozeDay} now={now} /> : null}
            {chips.length ? (
              <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex h-6 items-center gap-1 rounded-md bg-muted ps-2 pe-0.5 font-medium text-xs"
                  >
                    {chip.label}
                    <button
                      type="button"
                      aria-label={`Remove filter ${chip.label}`}
                      onClick={chip.clear}
                      className="grid size-5 place-items-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {/* T-140 round 2: the cards' tooltips (SLA badge, inbox, time) close as soon as the pointer leaves them, so
                the SLA tooltip of the first card no longer stays over "Display" while the pointer moves up to it. */}
            <TooltipProvider disableHoverableContent>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 divide-y divide-border/60 overflow-y-auto px-2 pb-4">
                {feedStatus === "error" ? (
                  <div
                    data-slot="my-inbox-feed-error"
                    className="flex items-start gap-2 rounded-lg px-1 py-3 text-muted-foreground text-sm"
                  >
                    <FeedAvatar entry={{ category: "system", href: "/dashboard/settings/audit-logs" }} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-foreground">System · Activity log not reachable</span>
                      {": "}
                      {feedError}. System, sign-up, change and approval notifications cannot be shown.
                    </span>
                  </div>
                ) : null}
                {groups.map((group) => (
                  <React.Fragment key={group.key}>
                    {group.label ? (
                      <div data-slot="snooze-day" className="px-1 pt-3 pb-1 font-medium text-muted-foreground text-xs">
                        {group.label}
                      </div>
                    ) : null}
                    {group.items.map((row) =>
                      row.kind === "feed" ? (
                        <FeedCard
                          key={`f-${row.id}`}
                          entry={row.entry}
                          now={now}
                          onOpen={() => openFeed(row.entry)}
                          onToggleRead={() => toggleFeedRead(row.entry)}
                        />
                      ) : (
                        <NotificationCard
                          key={row.id}
                          item={row.item}
                          now={now}
                          active={row.id === activeId}
                          onOpen={() => open(row.item)}
                          onToggleRead={() => toggleRead(row.item)}
                          onDelete={() => remove(row.id)}
                        />
                      ),
                    )}
                  </React.Fragment>
                ))}
                {visible.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <p className="font-medium text-muted-foreground text-sm">
                      {feedStatus === "idle" && tab !== "snoozed" ? "Loading notifications…" : emptyText[tab]}
                    </p>
                    {tab === "snoozed" && snoozeDay !== "all" ? (
                      <Button variant="ghost" size="xs" onClick={() => setSnoozeDay("all")}>
                        Show all snoozed
                      </Button>
                    ) : null}
                    {chips.length ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setFilters({ ...defaultFilters, sort: filters.sort })}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </TooltipProvider>
          </div>

          {active && conversation ? (
            // Chatwoot InboxView.vue: item header, then the conversation itself (ConversationBox).
            <div data-slot="my-inbox-pane" className="flex h-full min-h-0 flex-col">
              <ItemHeader
                item={active}
                index={activeIndex}
                total={openable.length}
                onBack={() => setActiveId(null)}
                onPrev={() => open(openable[activeIndex - 1])}
                onNext={() => open(openable[activeIndex + 1])}
                onSnooze={(short) => snooze(active.id, snoozeTime(short, Date.now()))}
                onCustomSnooze={() => setCustomFor(active.id)}
                onDelete={() => remove(active.id)}
              />
              <ConversationPane
                conversation={conversation}
                panelOpen={wide ? panelOpen : sheetOpen}
                onTogglePanel={togglePanel}
                className="min-h-0 flex-1"
              />
            </div>
          ) : (
            <EmptyPane hasItems={items.length > 0 || feed.length > 0} />
          )}
          {wide && panelOpen && active && conversation ? (
            <div className="border-s">
              <ContactPanel conversation={conversation} onClose={() => setPanelOpen(false)} />
            </div>
          ) : null}
        </div>
      </Card>

      {!wide && active && conversation ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-[22rem] p-0 sm:max-w-[22rem]" showCloseButton={false}>
            <SheetTitle className="sr-only">Contact</SheetTitle>
            <SheetDescription className="sr-only">Contact details and conversation actions</SheetDescription>
            <ContactPanel conversation={conversation} onClose={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      ) : null}

      <CustomSnoozeDialog
        open={customFor !== null}
        onOpenChange={(o) => {
          if (!o) setCustomFor(null);
        }}
        onApply={(until) => {
          if (customFor !== null) snooze(customFor, until);
          setCustomFor(null);
        }}
      />
      {/* The conversation pane's menus (snooze, transcript, resolve, translate...) open these dialogs. */}
      <CwDialogs />
    </div>
  );
}
