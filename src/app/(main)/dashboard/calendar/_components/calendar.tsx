"use client";

import * as React from "react";

import { type EventChangeInfo, useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import multiMonthPlugin from "@fullcalendar/react/multimonth";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { cn } from "cn";
import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  Eye,
  ListChecks,
  Plus,
  Share2,
  Trash2,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { EventCalendarViews } from "@/components/calendar/event-calendar-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENT_USER_ID } from "@/lib/cw/data";
import { useCwShared } from "@/lib/cw/store";

import { draftFrom, inputFrom, TwentyTaskDialog } from "../../tasks/_twenty/twenty-task-dialog";
import { useTwentyBoard } from "../../tasks/_twenty/use-twenty-board";
import { type CalendarEvent, countInRange, movedEvent, wireDetails, wireEvent } from "./calendar-events";
import { DeleteCalendarDialog, NewCalendarDialog, ShareDialog } from "./calendar-manage-dialogs";
import { CalendarSidebar, type UpcomingItem } from "./calendar-sidebar";
import { dueAtOf, dueDayOf, taskDueEvents, taskIdOf } from "./calendar-tasks";
import { DeleteEventDialog, EventDetailsDialog, EventDialog } from "./event-dialogs";
import { ACCESS_LABEL, type StudioCalendar, type StudioEvent, useDavisCalendar } from "./use-davis-calendar";

// T-227 (merge of T-186 isolated-diff.md): the agenda and year views of plugins already registered.
// M129-G (Fahad 124.8 "نص الواجهة بالإنجليزية أولاً ثم يُترجم لاحقاً"): the view names and the grid are English now, like
// the rest of the page; Arabic event titles still read right to left inside their boxes ([unicode-bidi:plaintext]).
const views = [
  { key: "dayGridMonth", label: "Month" },
  { key: "timeGridWeek", label: "Week" },
  { key: "timeGridDay", label: "Day" },
  { key: "listWeek", label: "Agenda" },
  { key: "multiMonthYear", label: "Year" },
];

// Below 640px the calendar opens on the agenda, which grows with its rows.
const NARROW_QUERY = "(max-width: 639px)";

// T-276: task due dates in their own colour (emerald 700 under white text, 5.5:1), apart from the events.
const TASK_COLOR = "#047857";

const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin];

// F-16 (Fahad 15 Oct 15:05 and 15:20): no link out to Twenty or Davis and neither name in the text; the page names
// the calendar server and the tasks server by what they do.

type Cal = Omit<StudioCalendar, "path">;

/** An event from the calendar server as the page's event. */
const toCalendarEvent = (e: StudioEvent): CalendarEvent => ({
  id: e.id,
  title: e.title,
  calendar: e.calendarId,
  allDay: e.allDay,
  start: e.start,
  end: e.end,
  href: e.href,
  etag: e.etag,
  editable: e.editable,
  recurring: e.recurring,
  busyOnly: e.busyOnly,
  source: e.source,
  location: e.location,
  description: e.description,
  repeat: e.repeat,
  reminderMinutes: e.reminderMinutes,
});

// F-18b: the calendars hidden with their box in the side panel ("tasks" = task due dates), kept in the address
// (?hide=) like the Tasks page keeps its section, so a reload or a shared link shows the same calendars.
function hiddenFromAddress(): Set<string> {
  const value = new URLSearchParams(window.location.search).get("hide");
  return new Set(value ? value.split(",").filter(Boolean) : []);
}

export function Calendar() {
  const controller = useCalendarController();
  // M129-G: the calendar is read from Davis for one person: the signed-in sample person, or (Preview as) another
  // employee who has a calendar account, to see what sharing gives them. The preview has no sign-in of its own.
  const [as, setAs] = React.useState<number | null>(null);
  const [range, setRange] = React.useState<{ start: Date; end: Date }>();
  const store = useDavisCalendar(range, as);
  // M129-G: task due dates come from Twenty, through the Tasks page's own store (no copy here).
  const twenty = useTwentyBoard();
  // F-8: the site's agents for the task window's Assignee list (lib/twenty/agents.ts).
  const taskAgents = useCwShared((state) => state.agents);
  const [pendingDue, setPendingDue] = React.useState<Record<string, string>>({});
  const [taskDialogId, setTaskDialogId] = React.useState<string | null>(null);
  const [taskError, setTaskError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string>();
  // The day a New event dialog starts on: today from the button, the clicked day from the grid.
  const [newDay, setNewDay] = React.useState(() => new Date());
  // F-18b: calendars shown or hidden one by one (side panel boxes) instead of one "Calendar" choice
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [pickedDay, setPickedDay] = React.useState(() => new Date());
  const [dialog, setDialog] = React.useState<{ open: boolean; event?: CalendarEvent }>({ open: false });
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [details, setDetails] = React.useState<CalendarEvent>();
  const [deleting, setDeleting] = React.useState<CalendarEvent>();
  const [newCalendarOpen, setNewCalendarOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [deleteCalendarOpen, setDeleteCalendarOpen] = React.useState(false);
  const [narrow, setNarrow] = React.useState(false);
  // The event element that opened the dialog: focus goes back to it when the dialog closes (it has no trigger button).
  const openedFrom = React.useRef<HTMLElement | null>(null);
  const [dateInfo, setDateInfo] = React.useState(() => {
    const now = new Date();

    return {
      title: format(now, "MMMM yyyy"),
      days: differenceInCalendarDays(endOfMonth(now), startOfMonth(now)) + 1,
      // F-18b round 2: the period the title names (the month), not the whole grid with its days of other months
      start: startOfMonth(now),
      end: addDays(endOfMonth(now), 1),
    };
  });
  // F-18b round 2: events deleted on this page leave the grid and the side panel as soon as the server confirms the
  // delete, before the reload answers (a deleted object's address never comes back: a new event gets a new one)
  const [dropped, setDropped] = React.useState<Set<string>>(() => new Set());

  const data = store.data;
  const calendars: Cal[] = data?.calendars ?? [];
  const viewerId = data?.viewer.id ?? as ?? CURRENT_USER_ID;
  const personName = (id: number | null) => data?.people.find((p) => p.id === id)?.name ?? "another employee";
  const labelOf = (calendar: Cal | undefined) =>
    !calendar
      ? "Calendar"
      : calendar.owner.personId === viewerId
        ? calendar.name
        : // the name is isolated (FSI…PDI), so an Arabic name never reorders the owner's name around it
          `\u2068${calendar.name}\u2069 (${personName(calendar.owner.personId)})`;
  const calendarOf = (id: string) => calendars.find((c) => c.id === id);
  const colorOf = (id: string) => calendarOf(id)?.color ?? "#2563EB";

  const events: CalendarEvent[] = (data?.events ?? [])
    .filter((e) => !(e.href && dropped.has(e.href)))
    .map(toCalendarEvent);
  const shown = events.filter((event) => !hidden.has(event.calendar));
  const eventCount = countInRange(shown, dateInfo.start, dateInfo.end);
  const showTasks = !hidden.has("tasks");
  const tasks = twenty.board?.tasks ?? null;
  const dueItems = showTasks && tasks ? taskDueEvents(tasks, pendingDue) : [];
  const writable = calendars.filter((c) => c.canEdit).map((c) => ({ id: c.id, label: labelOf(c) }));
  const defaultCalendar = writable.find((c) => !hidden.has(c.id))?.id ?? writable[0]?.id ?? "";
  const shareable = calendars
    .filter((c) => c.canShare)
    .map((c) => ({ id: c.id, label: labelOf(c), ownerId: c.owner.personId }));
  // F-5B: "Delete calendar" lists the viewer's own calendars only; the primary one is shown but cannot be deleted
  const deletable = calendars
    .filter((c) => c.access === "owner")
    .map((c) => ({ id: c.id, label: labelOf(c), primary: c.primary }));
  const canDeleteSome = deletable.some((c) => !c.primary);
  const accounts = (data?.accountIds ?? [])
    .map((id) => data?.people.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => (a.id === CURRENT_USER_ID ? -1 : b.id === CURRENT_USER_ID ? 1 : a.name.localeCompare(b.name)));
  const taskDialogTask = taskDialogId ? tasks?.find((t) => t.id === taskDialogId) : undefined;

  // F-18b: hidden calendars from the address on load, and back into it on every change (no browser storage)
  React.useEffect(() => setHidden(hiddenFromAddress()), []);
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (hidden.size) url.searchParams.set("hide", [...hidden].join(","));
    else url.searchParams.delete("hide");
    window.history.replaceState(null, "", url);
  }, [hidden]);
  const toggleCalendar = (id: string, show: boolean) =>
    setHidden((current) => {
      const next = new Set(current);
      if (show) next.delete(id);
      else next.add(id);
      return next;
    });
  const pickDay = (day: Date) => {
    setPickedDay(day);
    controller.gotoDate(day);
  };
  const openItem = (item: UpcomingItem) => {
    if (item.kind === "task") {
      if (!tasks?.some((t) => t.id === item.taskId)) return;
      setTaskError(null);
      setTaskDialogId(item.taskId);
      return;
    }
    const event = toCalendarEvent(item.event);
    openedFrom.current = null;
    if (event.editable && event.href) {
      setDialogError(null);
      setDialog({ open: true, event });
    } else setDetails(event);
  };

  // The screen width is known after hydration only, so the phone agenda is chosen here, once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on mount only.
  React.useEffect(() => {
    if (!window.matchMedia(NARROW_QUERY).matches) return;
    setNarrow(true);
    controller.changeView("listWeek");
  }, []);

  const failed = (message: string, status?: number) => {
    setNotice(`Not saved: ${message}`);
    toast.error(`Not saved: ${message}`);
    if (status === 409) void store.reload();
  };

  // A dragged task saves its new due date in Twenty; refused or failed, it goes back to its saved day.
  const moveTask = async (info: EventChangeInfo, taskId: string) => {
    const start = info.event.start;
    if (!start || !info.event.allDay) {
      info.revert();
      return;
    }
    const day = dueDayOf(start);
    setPendingDue((current) => ({ ...current, [taskId]: day }));
    const result = await twenty.update(taskId, { dueAt: dueAtOf(day) });
    setPendingDue((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    if (result.ok) {
      setNotice(undefined);
      toast.success(`“${result.value.title}” is now due ${day} (saved on the tasks server)`);
      return;
    }
    info.revert();
    setNotice(`Not saved on the tasks server: ${result.message}. The task stays on its saved day.`);
  };

  // T-276: an event moves by drag (mouse, or long press on touch) and is saved like an edit; refused, it goes back.
  const moveItem = async (info: EventChangeInfo) => {
    const taskId = taskIdOf(info.event.id);
    if (taskId) {
      void moveTask(info, taskId);
      return;
    }
    const event = events.find((e) => e.id === info.event.id);
    if (!event?.href || !event.editable) {
      info.revert();
      return;
    }
    const moved = movedEvent(event, info.event);
    const result = await store.updateEvent(event.calendar, event.href, event.etag ?? "", wireEvent(moved));
    if (result.ok) {
      setNotice(undefined);
      toast.success("Event moved");
      void store.reload();
      return;
    }
    info.revert();
    failed(result.message, result.status);
  };

  const saveEvent = async (event: CalendarEvent) => {
    const original = dialog.event;
    setSaving(true);
    setDialogError(null);
    // F-18b: location, notes, repeat and reminder go with the save when they were set or changed in the dialog
    const wire = { ...wireEvent(event), ...wireDetails(event, original) };
    const result = original?.href
      ? await store.updateEvent(original.calendar, original.href, original.etag ?? "", wire, event.calendar)
      : await store.createEvent(event.calendar, wire);
    setSaving(false);
    if (!result.ok) {
      // a failed save keeps the dialog open with what was typed
      setDialogError(`Not saved: ${result.message}`);
      if (result.status === 409) void store.reload();
      return;
    }
    setDialog((d) => ({ ...d, open: false }));
    setNotice(undefined);
    toast.success(original ? "Event updated" : "Event added");
    void store.reload();
  };

  const removeEvent = async (event: CalendarEvent) => {
    if (!event.href) return;
    const result = await store.deleteEvent(event.calendar, event.href, event.etag ?? "");
    if (!result.ok) {
      failed(result.message, result.status);
      return;
    }
    const href = event.href;
    setDropped((current) => new Set(current).add(href));
    toast.success("Event deleted");
    void store.reload();
  };

  const readOnlyReason = (event: CalendarEvent) => {
    const calendar = calendarOf(event.calendar);
    if (event.busyOnly)
      return `${personName(calendar?.owner.personId ?? null)} shares only free/busy times of this calendar: the title and details stay hidden.`;
    if (event.recurring)
      return calendar?.canEdit
        ? "A repeating event: its dates cannot be changed one by one on this page. Delete it and create it again to change it."
        : "A repeating event on a calendar you can only see.";
    return `You can see this calendar but not change it (${ACCESS_LABEL[calendar?.access ?? "details"]}).`;
  };

  const openNew = (day: Date) => {
    if (!writable.length) {
      setNotice("You have no calendar you can add events to.");
      return;
    }
    setNewDay(day);
    setDialogError(null);
    setDialog({ open: true });
  };

  const previewing = data && !data.viewer.isMe ? data.viewer.name : null;

  return (
    // F-18b: the side panel (small month, numbers, calendars with their boxes, next 7 days) beside the grid
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <CalendarSidebar
        calendars={calendars}
        viewerId={viewerId}
        personName={personName}
        hidden={hidden}
        onToggle={toggleCalendar}
        date={pickedDay}
        onPickDay={pickDay}
        tasks={tasks}
        as={as}
        refreshKey={data}
        dropped={dropped}
        onOpenItem={openItem}
      />
      <div
        data-calendar-root
        data-loaded={data ? "true" : "false"}
        className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border"
      >
        <div className="flex flex-col gap-4 border-b bg-sidebar p-4 text-sidebar-foreground xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 shrink-0 flex-col gap-1">
            <div className="font-medium text-lg leading-none">{dateInfo.title}</div>
            <p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              {dateInfo.days} days - {eventCount} events
              <Badge
                variant="outline"
                data-testid="calendar-source"
                title="Calendars and events are stored on the calendar server, the same for every browser"
              >
                <Database aria-hidden className="size-3" />
                Saved on the calendar server
              </Badge>
              <Badge
                variant="outline"
                data-testid="calendar-task-legend"
                title="Due dates of the Tasks page, read from the tasks server and saved to it"
              >
                <span aria-hidden className="size-2.5 rounded-sm" style={{ background: TASK_COLOR }} />
                Task due dates · from Tasks
              </Badge>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {accounts.length > 1 ? (
              <Select
                value={String(as ?? CURRENT_USER_ID)}
                onValueChange={(value) => {
                  setAs(Number(value) === CURRENT_USER_ID ? null : Number(value));
                  setHidden(new Set());
                }}
              >
                <SelectTrigger
                  className="w-full sm:w-48"
                  aria-label="Preview as"
                  title="The preview has no sign-in: see the calendar as this employee sees it"
                >
                  <Eye />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {accounts.map((person) => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.id === CURRENT_USER_ID ? `${person.name} (you)` : `As ${person.name}`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : null}
            <ButtonGroup>
              <Button size="icon" variant="outline" aria-label="Previous period" onClick={() => controller.prev()}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" onClick={() => controller.today()}>
                Today
              </Button>
              <Button size="icon" variant="outline" aria-label="Next period" onClick={() => controller.next()}>
                <ChevronRight />
              </Button>
            </ButtonGroup>
            <Select
              value={controller.view?.type ?? views[0].key}
              onValueChange={(value) => {
                controller.changeView(value);
              }}
            >
              <SelectTrigger aria-label="View">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {views.map((v) => (
                    <SelectItem key={v.key} value={v.key}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={!data} onClick={() => setNewCalendarOpen(true)}>
              <CalendarPlus />
              New calendar
            </Button>
            <Button
              variant="outline"
              disabled={!shareable.length}
              title={shareable.length ? undefined : "Only a calendar's owner, or someone allowed to manage its sharing"}
              onClick={() => setShareOpen(true)}
            >
              <Share2 />
              Share
            </Button>
            <Button
              variant="outline"
              disabled={!canDeleteSome}
              title={
                canDeleteSome
                  ? undefined
                  : "Only a calendar's owner can delete it, and the primary calendar can't be deleted"
              }
              onClick={() => setDeleteCalendarOpen(true)}
            >
              <Trash2 />
              Delete calendar
            </Button>
            <Button disabled={!data} onClick={() => openNew(new Date())}>
              <Plus />
              New event
            </Button>
          </div>
        </div>

        {previewing ? (
          <div
            role="status"
            data-testid="calendar-preview-as"
            className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-amber-950 text-sm dark:bg-amber-950/40 dark:text-amber-100"
          >
            <Eye className="size-4 shrink-0" />
            <span>
              Previewing as {previewing}: the calendars and access {previewing} has. Changes made here are made as{" "}
              {previewing}.
            </span>
            <Button size="sm" variant="outline" className="ms-auto" onClick={() => setAs(null)}>
              Back to my calendar
            </Button>
          </div>
        ) : null}
        {store.loadError ? (
          <div
            role="alert"
            className="flex items-start gap-2 border-b bg-destructive/10 px-4 py-2 text-destructive text-sm"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{`The calendar could not be read from the calendar server: ${store.loadError}`}</span>
          </div>
        ) : null}
        {twenty.loadError ? (
          <div
            role="alert"
            className="flex items-start gap-2 border-b bg-destructive/10 px-4 py-2 text-destructive text-sm"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{`Task due dates could not be loaded from the tasks server: ${twenty.loadError}. Only events are shown.`}</span>
          </div>
        ) : null}
        {notice ? (
          <div
            role="alert"
            className="flex items-start gap-2 border-b bg-destructive/10 px-4 py-2 text-destructive text-sm"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        <EventCalendarViews
          controller={controller}
          initialView={views[0].key}
          plugins={[...plugins]}
          // week/day: overlapping events get their own columns instead of covering each other
          slotEventOverlap={false}
          // week/day: the title wraps inside its box instead of being cut sideways, between words only (T-276: «Fi/na/nc/e»);
          // a word wider than the box is cut at its end with "…", never split
          blockEventTitleClass="overflow-hidden text-ellipsis whitespace-normal"
          {...(narrow ? { height: "auto" } : {})}
          views={{
            // month/year: a cut title keeps its first letters. Under direction="rtl" an English title was cut from its
            // start («…ly planning»); plaintext takes the direction from the title's own text, Arabic or English.
            // month on a phone: every event is at least 24px tall, so a finger can hit it. "!": the calendar's own
            // unlayered min-height: 0 wins over a plain utility.
            dayGrid: { eventTitleClass: "[unicode-bidi:plaintext]", eventInnerClass: "max-sm:min-h-6!" },
            multiMonth: { eventTitleClass: "[unicode-bidi:plaintext]" },
            // week/day, T-276: first letters kept as in the month, and every item at least 24px tall on a phone (the all-day
            // row like the month; a timed event by its padding, as its height already grows to fit its text)
            timeGrid: {
              eventTitleClass: "[unicode-bidi:plaintext]",
              rowEventInnerClass: "max-sm:min-h-6!",
              columnEventInnerClass: "max-sm:py-1.5",
            },
            // week: a short event grows to its wrapped title instead of hiding the end of it below its box. T-276: its time
            // takes its own line when the title does not fit beside it, and wraps after the dash rather than being cut
            // sideways («:00–2:30»). On a phone the day column is ~31px wide, narrower than «11:00ص», so the time is written
            // on 24 hours («09:30–11:00») in a 10px font (12px lines, its digits not clipped at the top), with less padding
            timeGridWeek: {
              columnEventClass: "min-h-fit!",
              columnEventInnerClass: (info) => cn("min-h-fit! max-sm:px-0.5", info.isShort && "flex-wrap"),
              columnEventTimeClass: "shrink-0 max-w-full whitespace-normal! max-sm:text-[10px]/[12px]",
              ...(narrow ? { eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false } } : {}),
            },
            // agenda rows: the time takes only its own width and the title wraps instead of being cut
            list: {
              listItemEventTimeClass: "-order-1 shrink-0 w-auto px-4 py-2 whitespace-nowrap text-sm",
              listItemEventTitleClass: "grow min-w-0 px-4 py-2 text-sm whitespace-normal break-words",
            },
          }}
          popoverCloseContent={() => <XIcon className="size-5 text-muted-foreground group-hover:text-foreground" />}
          events={[
            ...shown.map((event) => ({
              id: event.id,
              title: event.title,
              start: event.start,
              end: event.end,
              allDay: event.allDay,
              editable: Boolean(event.editable),
              color: colorOf(event.calendar),
              contrastColor: "#ffffff",
              extendedProps: { calendar: event.calendar, busyOnly: Boolean(event.busyOnly) },
            })),
            ...dueItems.map((item) => ({ ...item, color: TASK_COLOR, contrastColor: "#ffffff" })),
          ]}
          nowIndicator
          // T-276: events move by drag (mouse, or long press on touch) and are saved like an edit; tasks move by day only.
          editable
          eventAllow={(span, moving) => !moving || !taskIdOf(moving.id) || span.allDay}
          eventDrop={(info) => void moveItem(info)}
          eventResize={(info) => void moveItem(info)}
          // a click (or tap) on the empty part of a day opens New event on that day
          dateClick={(info) => openNew(info.date)}
          // a task shows a task mark, read out as "Task due:", and carries the id its editor gives focus back to
          eventContent={(info) =>
            taskIdOf(info.event.id) ? (
              <>
                <ListChecks aria-hidden className="size-3 shrink-0" />
                <span className="sr-only">Task due: </span>
                {/* one line, cut at its end like the other all-day items, first letters kept in every view (T-276 round 2:
                  the week row cut it from its start); in the agenda it wraps and aligns like the events */}
                <div
                  className={cn(
                    info.titleClass,
                    "min-w-0",
                    !info.view.type.startsWith("list") && "whitespace-nowrap! truncate [unicode-bidi:plaintext]",
                  )}
                >
                  {info.event.title}
                </div>
              </>
            ) : (
              true
            )
          }
          eventDidMount={(info) => {
            const taskId = taskIdOf(info.event.id);
            if (taskId) info.el.setAttribute("data-task-open", taskId);
            else {
              info.el.setAttribute("data-event-id", info.event.id);
              info.el.setAttribute("data-event-calendar", String(info.event.extendedProps.calendar ?? ""));
            }
            if (info.event.extendedProps.busyOnly) info.el.setAttribute("data-busy-only", "true");
          }}
          eventClick={(info) => {
            const taskId = taskIdOf(info.event.id);
            if (taskId) {
              if (!tasks?.some((t) => t.id === taskId)) return;
              setTaskError(null);
              setTaskDialogId(taskId);
              return;
            }
            const event = events.find((e) => e.id === info.event.id);
            if (!event) return;
            openedFrom.current = info.el;
            if (event.editable && event.href) {
              setDialogError(null);
              setDialog({ open: true, event });
            } else setDetails(event);
          }}
          datesSet={(info) => {
            setDateInfo({
              title: info.view.title,
              days: differenceInCalendarDays(info.view.currentEnd, info.view.currentStart),
              start: info.view.currentStart,
              end: info.view.currentEnd,
            });
            setRange({ start: info.start, end: info.end });
            // F-18b: the side panel's small month follows the grid (a day picked there stays picked)
            setPickedDay((day) => {
              const { currentStart, currentEnd } = info.view;
              if (day >= currentStart && day < currentEnd) return day;
              const now = new Date();
              return now >= currentStart && now < currentEnd ? now : currentStart;
            });
          }}
        />

        <EventDialog
          open={dialog.open}
          event={dialog.event}
          day={newDay}
          calendars={writable}
          defaultCalendar={defaultCalendar}
          busy={saving}
          error={dialogError}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          onCloseAutoFocus={(e) => {
            const el = openedFrom.current;
            if (!dialog.event || !el?.isConnected) return;
            e.preventDefault();
            el.focus();
          }}
          onSave={(event) => void saveEvent(event)}
          onDelete={(event) => {
            setDialog((d) => ({ ...d, open: false }));
            setDeleting(event);
          }}
        />
        <EventDetailsDialog
          event={details}
          calendarLabel={labelOf(details ? calendarOf(details.calendar) : undefined)}
          reason={details ? readOnlyReason(details) : ""}
          onOpenChange={(open) => !open && setDetails(undefined)}
          onDelete={
            details?.recurring && details.href && calendarOf(details.calendar)?.canEdit
              ? (event) => {
                  setDetails(undefined);
                  setDeleting(event);
                }
              : undefined
          }
          onCloseAutoFocus={(e) => {
            const el = openedFrom.current;
            if (!el?.isConnected) return;
            e.preventDefault();
            el.focus();
          }}
        />
        <DeleteEventDialog
          event={deleting}
          calendarLabel={labelOf(deleting ? calendarOf(deleting.calendar) : undefined)}
          onOpenChange={(open) => !open && setDeleting(undefined)}
          onConfirm={(event) => void removeEvent(event)}
        />
        <NewCalendarDialog
          open={newCalendarOpen}
          colors={data?.colors ?? []}
          onOpenChange={setNewCalendarOpen}
          onCreate={async (name, color) => {
            const result = await store.createCalendar(name, color);
            if (result.ok) {
              toast.success(`Calendar “${name}” created on the calendar server`);
              await store.reload();
              toggleCalendar(result.value.id, true);
            }
            return result;
          }}
        />
        <DeleteCalendarDialog
          open={deleteCalendarOpen}
          calendars={deletable}
          initialCalendar={
            deletable.find((c) => !c.primary && !hidden.has(c.id))?.id ?? deletable.find((c) => !c.primary)?.id ?? ""
          }
          onOpenChange={setDeleteCalendarOpen}
          onDelete={async (calendarId) => {
            const result = await store.deleteCalendar(calendarId);
            if (result.ok) {
              const { name, events } = result.value.deleted;
              const count = events === null ? "" : ` with its ${events} event${events === 1 ? "" : "s"}`;
              toast.success(`Calendar “${name}” deleted from the calendar server${count}`);
              toggleCalendar(calendarId, true);
              await store.reload();
            }
            return result;
          }}
        />
        {data ? (
          <ShareDialog
            open={shareOpen}
            calendars={shareable}
            initialCalendar={shareable.find((c) => !hidden.has(c.id))?.id ?? shareable[0]?.id ?? ""}
            people={data.people}
            viewerId={viewerId}
            levels={data.levels}
            onOpenChange={(open) => {
              setShareOpen(open);
              if (!open) void store.reload();
            }}
            load={store.shares}
            save={store.setShare}
            remove={store.removeShare}
          />
        ) : null}
        {taskDialogTask && twenty.board ? (
          // The Tasks page's own editor: it edits the task itself in Twenty (no delete here).
          <TwentyTaskDialog
            key={taskDialogTask.id}
            mode="edit"
            task={taskDialogTask}
            initial={draftFrom(taskDialogTask, taskDialogTask.status ?? "", "", {
              agents: taskAgents,
              members: twenty.board.members,
            })}
            statuses={twenty.board.statuses}
            members={twenty.board.members}
            fields={twenty.board.fields}
            busy={twenty.saving}
            error={taskError}
            onClose={() => setTaskDialogId(null)}
            onSubmit={(draft) => {
              const board = twenty.board;
              if (!board) return;
              const lists = { agents: taskAgents, members: board.members };
              void twenty.update(taskDialogTask.id, inputFrom(draft, board.fields, lists)).then((result) => {
                if (result.ok) setTaskDialogId(null);
                else setTaskError(result.message);
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
