// M129-G (Fahad 129.8, "هل جُرّب تقويم ... وربطه بالأتمتة"): the automation action "Create calendar event", as plain data
// (no React) so the simulator (sim-engine.ts) and its tests read it outside the browser.
// The action's values: [title, calendar id ("owner/uri" in Davis), days after the trigger, time "HH:MM" ("" = all day),
// length in minutes]. The dry run only says what it would create; "Create in Davis" on that line of the dry run makes
// the event for real in Davis (sim-dry-run.tsx -> /api/calendar-davis/events), and the Calendar page shows it.
// Like Google Calendar's own events, a time is the browser's wall-clock time; Davis stores it in UTC.

export const CALENDAR_ACTION = "create_calendar_event";

export interface CalendarActionSpec {
  title: string;
  calendarId: string;
  days: number;
  /** "HH:MM", or "" for an all-day event. */
  time: string;
  minutes: number;
}

export const DAYS_MAX = 365;
export const MINUTES_MAX = 24 * 60;

export function specOf(values: string[]): CalendarActionSpec {
  const days = Number.parseInt(values[2] ?? "0", 10);
  const minutes = Number.parseInt(values[4] ?? "60", 10);
  return {
    title: (values[0] ?? "").trim(),
    calendarId: values[1] ?? "",
    days: Number.isFinite(days) ? days : Number.NaN,
    time: values[3] ?? "",
    minutes: Number.isFinite(minutes) ? minutes : Number.NaN,
  };
}

export const valuesOf = (spec: CalendarActionSpec) => [
  spec.title,
  spec.calendarId,
  String(spec.days),
  spec.time,
  String(spec.minutes),
];

/** What is missing before the action can run ("" when nothing is). */
export function specError(values: string[]): string {
  const spec = specOf(values);
  if (!spec.title) return "Enter the event title";
  if (spec.title.length > 120) return "The title must be 120 characters or fewer";
  if (!spec.calendarId.includes("/")) return "Choose the calendar";
  if (!Number.isInteger(spec.days) || spec.days < 0 || spec.days > DAYS_MAX)
    return `Days after the trigger must be 0 to ${DAYS_MAX}`;
  if (spec.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(spec.time)) return "Enter the time as HH:MM";
  if (spec.time && (!Number.isInteger(spec.minutes) || spec.minutes < 5 || spec.minutes > MINUTES_MAX))
    return "The length must be 5 to 1440 minutes";
  return "";
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The event the action makes when it runs at `at`: all-day dates as "yyyy-MM-dd", times as UTC ISO instants. */
export function eventFromSpec(spec: CalendarActionSpec, at: Date) {
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate() + spec.days);
  if (!spec.time) {
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return { title: spec.title, allDay: true, start: dayOf(day), end: dayOf(next) };
  }
  const [hours, minutes] = spec.time.split(":").map(Number);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
  const end = new Date(start.getTime() + spec.minutes * 60000);
  return { title: spec.title, allDay: false, start: start.toISOString(), end: end.toISOString() };
}

/** "on Thu 16 Oct 2026, 09:00–10:00" / "on Thu 16 Oct 2026, all day" in the browser's time. */
export function whenText(event: ReturnType<typeof eventFromSpec>): string {
  const fmt = (date: Date, withTime: boolean) =>
    date.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    });
  if (event.allDay) return `on ${fmt(new Date(`${event.start}T00:00:00`), false)}, all day`;
  const end = new Date(event.end);
  return `on ${fmt(new Date(event.start), true)}–${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

/** The canvas line of the step. */
export function specSummary(values: string[]): string {
  const spec = specOf(values);
  const when = `${spec.days ? `+${spec.days} d` : "same day"}${spec.time ? ` ${spec.time}` : ", all day"}`;
  return `“${spec.title || "…"}” · ${when}`;
}
