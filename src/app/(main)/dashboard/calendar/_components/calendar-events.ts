// M129-G (Fahad 129.8): calendar events of the page. They are stored in Davis (CalDAV) and reach the page through
// /api/calendar-davis (use-davis-calendar.ts); nothing is kept in this browser. This file holds the page's form of an
// event and the dialog's rules (T-78, T-276), unchanged except that a calendar is now one of the Davis calendars.
import { addDays, format, isValid, parseISO, subDays } from "date-fns";

export type CalendarEvent = {
  id: string;
  title: string;
  /** The Davis calendar ("owner/uri"). */
  calendar: string;
  allDay: boolean;
  /** "yyyy-MM-dd" when allDay, else a time: an ISO time from Davis, or a local "yyyy-MM-ddTHH:mm:ss" from the form. */
  start: string;
  /** Exclusive end, same form as start (FullCalendar's rule for all-day ranges). */
  end?: string;
  /** Where the event is in Davis, and its ETag (an edit made over a newer copy is refused). */
  href?: string;
  etag?: string;
  /** false: the viewer can only see it (a read-only share, a repeating event, or a free/busy block). */
  editable?: boolean;
  recurring?: boolean;
  busyOnly?: boolean;
  source?: string;
  /** F-18b: where it happens (LOCATION), notes (DESCRIPTION), repeat rule and reminder, as stored on the server. */
  location?: string;
  description?: string;
  repeat?: string;
  reminderMinutes?: number | null;
};

export const TITLE_MAX = 120;
export const LOCATION_MAX = 300;
export const NOTES_MAX = 2000;

/** F-18b: the repeat choices of the dialog (RRULE FREQ, RFC 5545 §3.8.5.3). */
export const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "DAILY", label: "Every day" },
  { value: "WEEKLY", label: "Every week" },
  { value: "MONTHLY", label: "Every month" },
  { value: "YEARLY", label: "Every year" },
] as const;

/** F-18b: the reminder choices (one display alarm before the start, RFC 5545 §3.6.6), in minutes; "" = none. */
export const REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "0", label: "At the start" },
  { value: "10", label: "10 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
] as const;

export const reminderText = (minutes: number | null | undefined) => {
  if (minutes === null || minutes === undefined) return "";
  const known = REMINDER_OPTIONS.find((option) => option.value === String(minutes));
  if (known) return known.label;
  return minutes % 60 === 0 ? `${minutes / 60} hours before` : `${minutes} minutes before`;
};

export const repeatText = (repeat: string | undefined) =>
  repeat === "custom"
    ? "Repeats"
    : (REPEAT_OPTIONS.find((option) => option.value === repeat && option.value !== "none")?.label ?? "");

const DAY = "yyyy-MM-dd";
const DAY_TIME = "yyyy-MM-dd'T'HH:mm:ss";

export type EventForm = {
  title: string;
  calendar: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** F-18b */
  location: string;
  notes: string;
  repeat: string;
  /** minutes as text, "" = no reminder */
  reminder: string;
};
export type FormErrors = Partial<Record<keyof EventForm, string>>;

export function formFromEvent(event: CalendarEvent | undefined, day: Date, calendar = ""): EventForm {
  if (!event) {
    const date = format(day, DAY);
    return {
      title: "",
      calendar,
      allDay: false,
      startDate: date,
      startTime: "09:00",
      endDate: date,
      endTime: "10:00",
      location: "",
      notes: "",
      repeat: "none",
      reminder: "",
    };
  }
  const start = parseISO(event.start);
  const end = event.end ? parseISO(event.end) : undefined;
  return {
    title: event.title,
    calendar: event.calendar,
    allDay: event.allDay,
    startDate: format(start, DAY),
    startTime: event.allDay ? "09:00" : format(start, "HH:mm"),
    // The form shows the last day of an all-day range; the stored end is the day after.
    endDate: end ? format(event.allDay ? subDays(end, 1) : end, DAY) : "",
    endTime: end && !event.allDay ? format(end, "HH:mm") : "",
    location: event.location ?? "",
    notes: event.description ?? "",
    repeat: event.repeat && event.repeat !== "custom" ? event.repeat : "none",
    reminder:
      event.reminderMinutes === null || event.reminderMinutes === undefined ? "" : String(event.reminderMinutes),
  };
}

const at = (date: string, time?: string) => parseISO(time ? `${date}T${time}` : date);

/** Validates the dialog fields and builds the event. Keeps the Davis reference of an edited event. */
export function eventFromForm(
  form: EventForm,
  base: Pick<CalendarEvent, "id"> & Partial<CalendarEvent>,
  calendars: string[],
): { event: CalendarEvent; errors?: undefined } | { event?: undefined; errors: FormErrors } {
  const errors: FormErrors = {};
  const title = form.title.trim();
  if (!title) errors.title = "Title is required";
  else if (title.length > TITLE_MAX) errors.title = `Title must be ${TITLE_MAX} characters or fewer`;
  if (!calendars.includes(form.calendar)) errors.calendar = "Choose a calendar";
  if (form.location.trim().length > LOCATION_MAX)
    errors.location = `Location must be ${LOCATION_MAX} characters or fewer`;
  if (form.notes.trim().length > NOTES_MAX) errors.notes = `Notes must be ${NOTES_MAX} characters or fewer`;

  const start = at(form.startDate, form.allDay ? undefined : form.startTime);
  if (!form.startDate || !isValid(at(form.startDate))) errors.startDate = "Start date is required";
  else if (!form.allDay && (!form.startTime || !isValid(start))) errors.startTime = "Start time is required";

  let end: string | undefined;
  if (!errors.startDate && !errors.startTime) {
    if (form.allDay && form.endDate) {
      const last = at(form.endDate);
      if (!isValid(last)) errors.endDate = "End date is not valid";
      else if (last < start) errors.endDate = "End must be after start";
      else if (last > start) end = format(addDays(last, 1), DAY);
    } else if (!form.allDay && form.endTime) {
      const stop = at(form.endDate || form.startDate, form.endTime);
      if (!isValid(stop)) errors.endTime = "End time is not valid";
      else if (stop <= start) errors.endTime = "End must be after start";
      else end = format(stop, DAY_TIME);
    }
  }
  if (Object.keys(errors).length) return { errors };

  const event: CalendarEvent = {
    ...base,
    id: base.id,
    title,
    calendar: form.calendar,
    allDay: form.allDay,
    start: format(start, form.allDay ? DAY : DAY_TIME),
    location: form.location.trim(),
    description: form.notes.trim(),
    repeat: form.repeat,
    reminderMinutes: form.reminder === "" ? null : Number(form.reminder),
  };
  if (end) event.end = end;
  else delete event.end;
  return { event };
}

/** What the server is sent: all-day dates as they are, times as UTC instants of this browser's wall-clock time. */
export function wireEvent(event: CalendarEvent) {
  const time = (value: string) => (event.allDay ? value.slice(0, 10) : parseISO(value).toISOString());
  return {
    title: event.title,
    allDay: event.allDay,
    start: time(event.start),
    ...(event.end ? { end: time(event.end) } : {}),
  };
}

/**
 * F-18b: what a save from the dialog sends besides wireEvent: location, notes, repeat and reminder, only those that
 * differ from the stored event, so a value written by another calendar app (e.g. an alarm at a fixed time) is kept
 * unless the person changed that field here.
 */
export function wireDetails(event: CalendarEvent, original?: CalendarEvent) {
  const out: { location?: string; description?: string; repeat?: string; reminderMinutes?: number | null } = {};
  if ((event.location ?? "") !== (original?.location ?? "")) out.location = event.location ?? "";
  if ((event.description ?? "") !== (original?.description ?? "")) out.description = event.description ?? "";
  const wasRepeat = original?.repeat && original.repeat !== "custom" ? original.repeat : "none";
  if (event.repeat && event.repeat !== "custom" && event.repeat !== wasRepeat) out.repeat = event.repeat;
  if ((event.reminderMinutes ?? null) !== (original?.reminderMinutes ?? null))
    out.reminderMinutes = event.reminderMinutes ?? null;
  return out;
}

export const visibleEvents = (events: CalendarEvent[], calendar: string) =>
  calendar === "all" ? events : events.filter((event) => event.calendar === calendar);

/** Events intersecting the half-open range; missing/zero duration keeps the start-point count. */
export const countInRange = (events: CalendarEvent[], start: Date, end: Date) =>
  events.filter((event) => {
    if (start >= end) return false;
    const at = parseISO(event.start);
    const until = event.end ? parseISO(event.end) : at;
    if (until.getTime() === at.getTime()) return at >= start && at < end;
    return until > at && at < end && until > start;
  }).length;

/** T-276: the event after a drag (or resize) in the calendar; the end stays exclusive and is dropped when absent. */
export function movedEvent(
  event: CalendarEvent,
  to: { start: Date | null; end: Date | null; allDay: boolean },
): CalendarEvent {
  const form = to.allDay ? DAY : DAY_TIME;
  const moved: CalendarEvent = { ...event, allDay: to.allDay, start: format(to.start ?? parseISO(event.start), form) };
  if (to.end) moved.end = format(to.end, form);
  else delete moved.end;
  return moved;
}
