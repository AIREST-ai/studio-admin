"use client";
// F-18b (Fahad, 15 Oct 15:20: "التقويم … أراه هو نفسه لم يتغير"): the calendar's side panel, the standard layout of
// a calendar app (Google Calendar): a small month to jump to a day, "My calendars" and the calendars others share,
// each with a box in its own colour that shows or hides it, and "Tasks" as one more box
// (https://support.google.com/calendar/answer/41067: "If a calendar does not have a check mark next to it, it's
// hidden"; https://support.google.com/calendar/answer/9901136: under "My calendars", the box next to "Tasks").
// Above them, real numbers (events today and in the next 7 days, tasks due and overdue) and the next 7 days as a list.
// The next 7 days are read from the calendar server through the page's own route (/api/calendar-davis), for the same
// person the page shows (Preview as), whatever month the grid is on.
import * as React from "react";

import { cn } from "cn";
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { AlarmClock, CalendarDays, CalendarRange, ListChecks } from "lucide-react";

import { Calendar as MonthPicker } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import type { BoardTask } from "@/lib/twenty/server";

import type { DavisCalendarData, StudioCalendar, StudioEvent } from "./use-davis-calendar";

type Cal = Omit<StudioCalendar, "path">;

export const TASK_COLOR = "#047857";
const CLOSED = new Set(["DONE", "CANCELED", "CANCELLED"]);

export type UpcomingItem =
  | { kind: "event"; key: string; start: Date; allDay: boolean; title: string; color: string; event: StudioEvent }
  | { kind: "task"; key: string; start: Date; allDay: true; title: string; color: string; taskId: string };

/** The next 7 days of events for one person (null = the signed-in person), refreshed when `refreshKey` changes. */
function useNextSevenDays(as: number | null, refreshKey: unknown) {
  const [events, setEvents] = React.useState<StudioEvent[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey reloads after a change on the page.
  React.useEffect(() => {
    let live = true;
    const start = startOfDay(new Date());
    const query = new URLSearchParams({
      start: start.toISOString(),
      end: addDays(start, 7).toISOString(),
      ...(as === null ? {} : { as: String(as) }),
    });
    fetch(`/api/calendar-davis?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!live) return;
        if (response.ok) {
          setEvents((json as DavisCalendarData).events);
          setError(null);
        } else setError(json.error ?? `HTTP ${response.status}`);
      })
      .catch((reason: Error) => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [as, refreshKey]);
  return { events, error };
}

function Stat({
  label,
  value,
  icon,
  warn,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border bg-background px-2.5 py-2",
        warn && value ? "border-red-300 dark:border-red-900" : "",
      )}
    >
      <span className="flex items-start gap-1.5 text-muted-foreground text-xs leading-tight">
        <span className="flex h-[1.25em] shrink-0 items-center">{icon}</span>
        <span>{label}</span>
      </span>
      <span
        className={cn(
          "font-semibold text-lg tabular-nums leading-none",
          warn && value ? "text-red-600 dark:text-red-400" : "",
        )}
      >
        {value ?? "…"}
      </span>
    </div>
  );
}

function CalendarRow({
  id,
  label,
  detail,
  color,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  detail?: string;
  color: string;
  checked: boolean;
  onToggle: (shown: boolean) => void;
}) {
  const inputId = `cal-toggle-${id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  return (
    <li className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60">
      <Checkbox
        id={inputId}
        data-calendar-toggle={id}
        checked={checked}
        onCheckedChange={(value) => onToggle(value === true)}
        className="mt-0.5"
        style={{ borderColor: color, backgroundColor: checked ? color : undefined, color: "#fff" }}
      />
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer text-sm leading-tight">
        <span className="block truncate [unicode-bidi:plaintext]">{label}</span>
        {detail ? <span className="block truncate text-muted-foreground text-xs">{detail}</span> : null}
      </label>
    </li>
  );
}

const ACCESS_SHORT: Record<string, string> = {
  freebusy: "free/busy only",
  details: "can see details",
  edit: "can edit",
  manage: "can edit and share",
};

export function CalendarSidebar({
  calendars,
  viewerId,
  personName,
  hidden,
  onToggle,
  date,
  onPickDay,
  tasks,
  as,
  refreshKey,
  dropped,
  onOpenItem,
}: {
  calendars: Cal[];
  viewerId: number;
  personName: (id: number | null) => string;
  /** Hidden calendar ids, and "tasks" when task due dates are hidden. */
  hidden: Set<string>;
  onToggle: (id: string, shown: boolean) => void;
  /** The day the grid is on. */
  date: Date;
  onPickDay: (day: Date) => void;
  tasks: BoardTask[] | null;
  as: number | null;
  refreshKey: unknown;
  /** F-18b round 2: events just deleted on the page (their addresses), left out before the next read answers. */
  dropped?: Set<string>;
  onOpenItem: (item: UpcomingItem) => void;
}) {
  const next = useNextSevenDays(as, refreshKey);
  // the small month turns on its own; it follows the grid when the grid moves to another month
  const [month, setMonth] = React.useState(date);
  const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the grid's month only.
  React.useEffect(() => setMonth(date), [monthKey]);
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);
  const colorOf = (id: string) => calendars.find((c) => c.id === id)?.color ?? "#2563EB";
  const mine = calendars.filter((c) => c.owner.personId === viewerId);
  const shared = calendars.filter((c) => c.owner.personId !== viewerId);

  const visibleEvents = (next.events ?? []).filter(
    (event) => !hidden.has(event.calendarId) && !(event.href && dropped?.has(event.href)),
  );
  const openTasks = (tasks ?? []).filter((task) => task.dueAt && !CLOSED.has(task.status ?? ""));
  const dueDay = (task: BoardTask) => parseISO((task.dueAt ?? "").slice(0, 10));
  const tasksThisWeek = openTasks.filter((task) => dueDay(task) >= today && dueDay(task) < weekEnd);
  const overdue = openTasks.filter((task) => dueDay(task) < today);

  const items: UpcomingItem[] = [
    ...visibleEvents.map(
      (event): UpcomingItem => ({
        kind: "event",
        key: event.id,
        start: event.allDay ? parseISO(event.start.slice(0, 10)) : new Date(event.start),
        allDay: event.allDay,
        title: event.title,
        color: colorOf(event.calendarId),
        event,
      }),
    ),
    ...(hidden.has("tasks") ? [] : tasksThisWeek).map(
      (task): UpcomingItem => ({
        kind: "task",
        key: `task:${task.id}`,
        start: dueDay(task),
        allDay: true,
        title: task.title,
        color: TASK_COLOR,
        taskId: task.id,
      }),
    ),
  ].sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.allDay) - Number(a.allDay));

  const eventsToday = next.events
    ? visibleEvents.filter((event) => {
        const start = event.allDay ? parseISO(event.start.slice(0, 10)) : new Date(event.start);
        const end = event.end ? (event.allDay ? parseISO(event.end.slice(0, 10)) : new Date(event.end)) : start;
        return isSameDay(start, today) || (start < today && end > today);
      }).length
    : null;

  // days of the small month that have something on them (the 7 days read here)
  const busyDays = items.map((item) => startOfDay(item.start));

  return (
    <aside aria-label="Calendars" data-calendar-sidebar className="flex w-full shrink-0 flex-col gap-4 lg:w-64">
      <div className="rounded-md border bg-sidebar p-1 text-sidebar-foreground">
        <MonthPicker
          mode="single"
          selected={date}
          month={month}
          onMonthChange={setMonth}
          onSelect={(day) => day && onPickDay(day)}
          modifiers={{ busy: busyDays }}
          modifiersClassNames={{ busy: "font-semibold underline decoration-2 underline-offset-2" }}
          className="mx-auto bg-transparent [--cell-size:--spacing(7.5)]"
        />
      </div>

      <div role="group" aria-label="Summary" data-testid="calendar-summary" className="grid grid-cols-2 gap-2">
        <Stat label="Events today" value={eventsToday} icon={<CalendarDays className="size-3.5" />} />
        <Stat
          label="Events, next 7 days"
          value={next.events ? visibleEvents.length : null}
          icon={<CalendarRange className="size-3.5" />}
        />
        <Stat
          label="Tasks due, 7 days"
          value={tasks ? tasksThisWeek.length : null}
          icon={<ListChecks className="size-3.5" />}
        />
        <Stat
          label="Overdue tasks"
          value={tasks ? overdue.length : null}
          icon={<AlarmClock className="size-3.5" />}
          warn
        />
      </div>

      <section aria-labelledby="cal-mine" className="rounded-md border p-2">
        <h2 id="cal-mine" className="px-1.5 pb-1 font-medium text-sm">
          My calendars
        </h2>
        <ul data-calendar-list="mine">
          {mine.map((calendar) => (
            <CalendarRow
              key={calendar.id}
              id={calendar.id}
              label={calendar.name}
              detail={calendar.primary ? "Primary" : undefined}
              color={calendar.color}
              checked={!hidden.has(calendar.id)}
              onToggle={(shown) => onToggle(calendar.id, shown)}
            />
          ))}
          <CalendarRow
            id="tasks"
            label="Tasks"
            detail="Due dates from the Tasks page"
            color={TASK_COLOR}
            checked={!hidden.has("tasks")}
            onToggle={(shown) => onToggle("tasks", shown)}
          />
        </ul>
        {shared.length ? (
          <>
            <h2 className="px-1.5 pt-3 pb-1 font-medium text-sm">Shared with me</h2>
            <ul data-calendar-list="shared">
              {shared.map((calendar) => (
                <CalendarRow
                  key={calendar.id}
                  id={calendar.id}
                  label={calendar.name}
                  detail={`${personName(calendar.owner.personId)} · ${ACCESS_SHORT[calendar.access] ?? calendar.access}`}
                  color={calendar.color}
                  checked={!hidden.has(calendar.id)}
                  onToggle={(shown) => onToggle(calendar.id, shown)}
                />
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section aria-labelledby="cal-next" className="rounded-md border p-2" data-testid="calendar-upcoming">
        <h2 id="cal-next" className="px-1.5 pb-1 font-medium text-sm">
          Next 7 days
        </h2>
        {next.error ? (
          <p role="alert" className="px-1.5 text-destructive text-sm">{`Could not be loaded: ${next.error}`}</p>
        ) : !next.events ? (
          <p className="px-1.5 text-muted-foreground text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-1.5 text-muted-foreground text-sm">Nothing in the next 7 days.</p>
        ) : (
          <ol className="max-h-72 space-y-0.5 overflow-y-auto">
            {items.map((item, index) => {
              const newDay = index === 0 || !isSameDay(items[index - 1].start, item.start);
              return (
                <li key={item.key}>
                  {newDay ? (
                    <p className="px-1.5 pt-1.5 pb-0.5 font-medium text-muted-foreground text-xs">
                      {isSameDay(item.start, today) ? "Today" : format(item.start, "EEE, MMM d")}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-upcoming={item.kind}
                    onClick={() => onOpenItem(item)}
                    className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-start text-sm outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      aria-hidden
                      className="mt-1 size-2.5 shrink-0 rounded-sm"
                      style={{ background: item.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate [unicode-bidi:plaintext]">
                        {item.kind === "task" ? <span className="sr-only">Task due: </span> : null}
                        {item.title}
                      </span>
                      <span className="block text-muted-foreground text-xs">
                        {item.kind === "task" ? "Task due" : item.allDay ? "All day" : format(item.start, "h:mm a")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </aside>
  );
}
