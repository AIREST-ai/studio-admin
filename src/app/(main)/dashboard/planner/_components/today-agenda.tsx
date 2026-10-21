"use client";
import * as React from "react";

import { cn } from "cn";
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarDays, CheckSquare } from "lucide-react";

import { useDavisCalendar } from "@/app/(main)/dashboard/calendar/_components/use-davis-calendar";
import { useTwentyBoard } from "@/app/(main)/dashboard/tasks/_twenty/use-twenty-board";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
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
  if (isSameDay(date, today)) return "اليوم";
  if (isSameDay(date, addDays(today, 1))) return "غدًا";
  return format(date, "EEEE، d MMMM", { locale: ar });
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
      title: task.title || "مهمة بلا عنوان",
      status: statusOf(task)?.label ?? "",
    });
    const calendars = new Map(calendar.data?.calendars.map((c) => [c.id, c]) ?? []);
    const events: AgendaItem[] = (calendar.data?.events ?? []).map((event) => ({
      kind: "event",
      id: event.id,
      day: dayOf(event.start, event.allDay),
      time: event.allDay ? null : format(parseISO(event.start), "HH:mm"),
      title: event.busyOnly ? "مشغول" : event.title || "موعد بلا عنوان",
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

  const calendarPending = !calendar.data && !calendar.loadError;
  const tasksPending = !twenty.board && !twenty.loadError;
  const loading = !calendar.data && !twenty.board && (calendarPending || tasksPending);
  const complete = !!calendar.data && !!twenty.board && !calendar.loadError && !twenty.loadError;
  const todayItems = days.find(([day]) => day === todayKey)?.[1] ?? [];
  const todayEvents = todayItems.filter((item) => item.kind === "event").length;
  const todayTasks = todayItems.length - todayEvents;

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle>{format(today, "EEEE، d MMMM", { locale: ar })}</CardTitle>
          <CardDescription aria-live="polite">
            المواعيد اليوم: {sourceCount(calendarPending, calendar.loadError, todayEvents)}
            {" · "}
            المهام المستحقة اليوم: {sourceCount(tasksPending, twenty.loadError, todayTasks)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {calendar.loadError && <LoadError what="المواعيد" message={calendar.loadError} onRetry={calendar.reload} />}
          {twenty.loadError && <LoadError what="المهام" message={twenty.loadError} onRetry={twenty.reload} />}
          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <AgendaDay label="متأخرة" tone="text-destructive" items={overdue} onOpen={onOpen} />
              )}
              {days.map(([day, items]) => (
                <AgendaDay key={day} label={dayLabel(day, today)} items={items} complete={complete} onOpen={onOpen} />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle>بلا تاريخ استحقاق</CardTitle>
          <CardDescription>مهام مفتوحة تحتاج إلى تحديد موعد.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {tasksPending && <Skeleton className="h-12" />}
          {!tasksPending && !twenty.board && (
            <p className="text-muted-foreground text-sm">تعذر عرض المهام. أعد محاولة تحميلها.</p>
          )}
          {twenty.board && noDate.length === 0 && (
            <Empty className="py-4">
              <EmptyHeader>
                <EmptyDescription>لا توجد مهام مفتوحة بلا تاريخ استحقاق.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {twenty.board && noDate.length > 0 && (
            <div className="divide-y rounded-lg border">
              {noDate.slice(0, NO_DATE_SHOWN).map((item) => (
                <AgendaRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpen("tasks")}>
              <CheckSquare data-icon="inline-start" />
              {noDate.length > NO_DATE_SHOWN ? `عرض المهام كلها (${noDate.length})` : "فتح المهام"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpen("calendar")}>
              <CalendarDays data-icon="inline-start" /> فتح التقويم
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function sourceCount(pending: boolean, error: string | null, count: number) {
  if (error) return "تعذر التحميل";
  if (pending) return "جارٍ التحميل…";
  return count.toLocaleString("ar");
}

function LoadError({ what, message, onRetry }: { what: string; message: string; onRetry: () => Promise<unknown> }) {
  const [retrying, setRetrying] = React.useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <Alert variant="destructive" className="min-w-0 text-start">
      <AlertTitle>تعذر تحميل {what}</AlertTitle>
      <AlertDescription className="min-w-0 break-words">
        <p>{message}</p>
        <Button variant="outline" size="sm" disabled={retrying} onClick={() => void retry()}>
          {retrying ? "جارٍ إعادة المحاولة…" : `إعادة تحميل ${what}`}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function AgendaDay({
  label,
  items,
  tone,
  complete = true,
  onOpen,
}: {
  label: string;
  items: AgendaItem[];
  tone?: string;
  complete?: boolean;
  onOpen: (view: PlannerView) => void;
}) {
  return (
    <section className="grid gap-2">
      <h2 className={cn("font-medium text-sm", tone ?? "text-muted-foreground")}>{label}</h2>
      {items.length === 0 ? (
        <Empty className="border px-3 py-4">
          <EmptyHeader>
            <EmptyDescription>
              {complete ? "لا توجد مواعيد أو مهام مستحقة لهذا اليوم." : "الجدول غير مكتمل؛ بعض البيانات غير متاحة."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
        {isEvent ? (item.time ?? "طوال اليوم") : "مهمة"}
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
