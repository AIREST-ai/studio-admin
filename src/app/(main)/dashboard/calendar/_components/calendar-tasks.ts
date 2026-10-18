// T-276 (Fahad 77.21 "اختر القياسي"): task due dates on the calendar, the way Google Calendar, Asana and ClickUp show them.
// M129-G (Fahad 129.8): the Tasks page reads from Twenty now (M129-F), so the due dates here come from Twenty too, through
// the Tasks page's own store (dashboard/tasks/_twenty/use-twenty-board.ts, /api/tasks-twenty). No copy is kept here or in
// browser storage, and the old store (/api/tasks-board) is not read any more. A task without a due date is not shown.
//
// Day contract: a due date is a whole day. Twenty keeps it as a time (dueAt); the Tasks page writes noon UTC of the day
// ("yyyy-mm-ddT12:00:00Z") and reads its first ten characters back, so this page does the same: it shows the task as an
// all-day item on that date in any browser time zone, and a drop writes noon UTC of the day under the pointer.
import { format } from "date-fns";

import type { BoardTask } from "@/lib/twenty/server";

export const TASK_EVENT_PREFIX = "task:";
/** The calendar filter entry that shows only task due dates. */
export const TASKS_CALENDAR = { key: "tasks", label: "Task due dates" } as const;

type DueTask = Pick<BoardTask, "id" | "title" | "dueAt">;

/**
 * One all-day item per task with a due date. `pending` holds due dates being saved (task id -> new day): the item is
 * shown there, and not draggable again, until Twenty answers.
 */
export function taskDueEvents(tasks: DueTask[], pending: Record<string, string> = {}) {
  return tasks.flatMap((task) => {
    const due = pending[task.id] ?? task.dueAt?.slice(0, 10);
    if (!due) return [];
    return [
      {
        id: `${TASK_EVENT_PREFIX}${task.id}`,
        title: task.title,
        start: due,
        allDay: true,
        // a due date is one day: it moves, it does not stretch
        durationEditable: false,
        startEditable: !(task.id in pending),
        extendedProps: { kind: "task" as const, taskId: task.id },
      },
    ];
  });
}

export const taskIdOf = (eventId: string) =>
  eventId.startsWith(TASK_EVENT_PREFIX) ? eventId.slice(TASK_EVENT_PREFIX.length) : null;

/** The local wall-clock day FullCalendar gives for an all-day drop. */
export const dueDayOf = (date: Date) => format(date, "yyyy-MM-dd");

/** That day as Twenty's dueAt, written exactly as the Tasks page writes it (twenty-task-dialog.tsx inputFrom). */
export const dueAtOf = (day: string) => new Date(`${day}T12:00:00Z`).toISOString();
