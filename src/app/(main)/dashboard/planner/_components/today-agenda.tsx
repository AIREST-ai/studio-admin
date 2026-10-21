"use client";
import * as React from "react";

import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { CalendarDays, CheckSquare } from "lucide-react";

import { useDavisCalendar } from "@/app/(main)/dashboard/calendar/_components/use-davis-calendar";
import { useTwentyBoard } from "@/app/(main)/dashboard/tasks/_twenty/use-twenty-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardTask } from "@/lib/twenty/server";

import type { PlannerView } from "./planner";

// FAH-20: the agenda view of Google Calendar and Outlook ("Schedule" / "Agenda"), one list by day, where a task's due
// date sits among the appointments the way Google Calendar shows Google Tasks. The days ahead it covers:
const DAYS_AHEAD = 7;
const NO_DATE_SHOWN = 5;

type AgendaItem =
  | { kind: "event"; id: string; day: string; time: string | null; title: string; color: string; where: string }
  | { kind: "task"; id: string; day: string; title: string; status: string };

/** The local day of an event (all-day events are a date already; timed ones are a time in UTC). */
const dayOf = (start: string, allDay: boolean) => (allDay ? start.slice(0, 10) : format(parseISO(start), "yyyy-MM-dd"));

function dayLabel(day: string, today: Date) {
  const date = parseISO(day);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, addDays(today, 1))) return "Tomorrow";
  return format(date, "EEEE, d MMMM");
}

export function TodayAgenda({ onOpen }: { onOpen: (view: PlannerView) => void }) {
  // the range is fixed for the page view: today and the next DAYS_AHEAD days
  const [range] = React.useState(() => {
    const start = startOfDay(new Date());
    return { start, end: addDays(start, DAYS_AHEAD) };
  });
  const calendar = useDavisCalendar(range, null);
  const twenty = useTwentyBoard();
  const today = range.start;
  const todayKey = format(today, "yyyy-MM-dd");

  const { overdue, days, noDate } = React.useMemo(() => {
    const board = twenty.board;
    const open = new Set(board?.statuses.filter((s) => s.onBoard).map((s) => s.value) ?? []);
    const statusOf = (task: BoardTask) => board?.statuses.find((s) => s.value === task.status);
    const openTasks = board?.tasks.filter((task) => task.status !== null && open.has(task.status)) ?? [];
    const taskItem = (task: BoardTask): AgendaItem => ({
      kind: "task",
      id: task.id,
      // the Tasks page's day contract: the first ten characters of dueAt (calendar-tasks.ts)
      day: task.dueAt?.slice(0, 10) ?? "",
      title: task.title || "Untitled task",
      status: statusOf(task)?.label ?? "",
    });
    const calendars = new Map(calendar.data?.calendars.map((c) => [c.id, c]) ?? []);
    const events: AgendaItem[] = (calendar.data?.events ?? []).map((event) => ({
      kind: "event",
      id: event.id,
      day: dayOf(event.start, event.allDay),
      time: event.allDay ? null : format(parseISO(event.start), "HH:mm"),
      title: event.busyOnly ? "Busy" : event.title || "Untitled event",
      color: calendars.get(event.calendarId)?.color ?? "var(--primary)",
      where: [calendars.get(event.calendarId)?.name, event.location].filter(Boolean).join(" · "),
    }));
    const lastKey = format(addDays(today, DAYS_AHEAD - 1), "yyyy-MM-dd");
    const dated = [
      ...events,
      ...openTasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) >= todayKey).map(taskItem),
    ].filter((item) => item.day >= todayKey && item.day <= lastKey);
    const byDay = new Map<string, AgendaItem[]>();
    for (const item of dated.sort((a, b) => a.day.localeCompare(b.day))) {
      byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
    }
    // in a day: all-day items first, then by time; a task due that day is an all-day item
    const timeOf = (item: AgendaItem) => (item.kind === "event" && item.time ? item.time : "");
    for (const items of byDay.values()) items.sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
    if (!byDay.has(todayKey)) byDay.set(todayKey, []);
    return {
      overdue: openTasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) < todayKey).map(taskItem),
      days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)),
      noDate: openTasks.filter((t) => !t.dueAt).map(taskItem),
    };
  }, [calendar.data, twenty.board, today, todayKey]);

  const loading = (!calendar.data && !calendar.loadError) || (!twenty.board && !twenty.loadError);
  const todayItems = days.find(([day]) => day === todayKey)?.[1] ?? [];
  const todayEvents = todayItems.filter((item) => item.kind === "event").length;
  const todayTasks = todayItems.length - todayEvents;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl leading-none">{format(today, "EEEE, d MMMM")}</CardTitle>
          <CardDescription className="leading-snug">
            {loading
              ? "Loading your day…"
              : `${todayEvents} ${todayEvents === 1 ? "appointment" : "appointments"} and ${todayTasks} ${
                  todayTasks === 1 ? "task" : "tasks"
                } due today.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {calendar.loadError && <LoadError what="appointments" message={calendar.loadError} />}
          {twenty.loadError && <LoadError what="tasks" message={twenty.loadError} />}
          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <AgendaDay label="Overdue" tone="text-destructive" items={overdue} onOpen={onOpen} />
              )}
              {days.map(([day, items]) => (
                <AgendaDay key={day} label={dayLabel(day, today)} items={items} onOpen={onOpen} />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl leading-none">No due date</CardTitle>
          <CardDescription className="leading-snug">Open tasks waiting for a day.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <Skeleton className="h-12" />
          ) : noDate.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground text-sm">Every open task has a day.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {noDate.slice(0, NO_DATE_SHOWN).map((item) => (
                <AgendaRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpen("tasks")}>
              <CheckSquare /> {noDate.length > NO_DATE_SHOWN ? `All ${noDate.length} in Tasks` : "Open Tasks"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpen("calendar")}>
              <CalendarDays /> Open Calendar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadError({ what, message }: { what: string; message: string }) {
  return (
    <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive text-sm">
      The {what} could not be read: {message}
    </p>
  );
}

function AgendaDay({
  label,
  items,
  tone,
  onOpen,
}: {
  label: string;
  items: AgendaItem[];
  tone?: string;
  onOpen: (view: PlannerView) => void;
}) {
  return (
    <section className="grid gap-2">
      <h2 className={`font-medium text-sm ${tone ?? "text-muted-foreground"}`}>{label}</h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
          Nothing planned. A calm day.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((item) => (
            <AgendaRow key={`${item.kind}:${item.id}`} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function AgendaRow({ item, onOpen }: { item: AgendaItem; onOpen: (view: PlannerView) => void }) {
  const isEvent = item.kind === "event";
  return (
    <button
      type="button"
      onClick={() => onOpen(isEvent ? "calendar" : "tasks")}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm transition-colors hover:bg-muted/50"
    >
      <span className="w-14 shrink-0 text-muted-foreground text-xs tabular-nums">
        {isEvent ? (item.time ?? "All day") : "Task"}
      </span>
      {isEvent ? (
        <span className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
      ) : (
        <CheckSquare className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {isEvent ? (
        item.where && (
          <span className="hidden max-w-48 shrink-0 truncate text-muted-foreground text-xs sm:block">{item.where}</span>
        )
      ) : (
        <Badge variant="outline" className="shrink-0 font-normal">
          {item.status}
        </Badge>
      )}
    </button>
  );
}
