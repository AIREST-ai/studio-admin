"use client";

import * as React from "react";

import { format, parseISO, subDays } from "date-fns";
import { Bell, MapPin, Repeat, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import {
  type CalendarEvent,
  type EventForm,
  eventFromForm,
  type FormErrors,
  formFromEvent,
  LOCATION_MAX,
  NOTES_MAX,
  REMINDER_OPTIONS,
  REPEAT_OPTIONS,
  reminderText,
  repeatText,
  TITLE_MAX,
} from "./calendar-events";

function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <span className="text-destructive text-xs">{children}</span>;
}

export interface CalendarOption {
  id: string;
  label: string;
}

/**
 * New / edit dialog (M129-G: "New event", the name Outlook and Teams use). `event` undefined = New event; the form
 * resets every time the dialog opens. `calendars` are the ones the viewer may write to.
 */
export function EventDialog({
  open,
  onOpenChange,
  event,
  day,
  calendars,
  defaultCalendar,
  busy,
  error,
  onSave,
  onDelete,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent;
  day: Date;
  calendars: CalendarOption[];
  defaultCalendar: string;
  busy: boolean;
  error: string | null;
  onSave: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  /** Where focus goes when the dialog closes; without it focus falls to the page body. */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [form, setForm] = React.useState<EventForm>(() => formFromEvent(event, day, defaultCalendar));
  const [errors, setErrors] = React.useState<FormErrors>({});

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setForm(formFromEvent(event, day, defaultCalendar));
    setErrors({});
  }, [open]);

  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = eventFromForm(
      form,
      event ?? { id: "new" },
      calendars.map((c) => c.id),
    );
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    onSave(result.event);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>Saved on the calendar server behind this page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              dir="auto"
              placeholder="Event title"
              maxLength={TITLE_MAX + 20}
              value={form.title}
              aria-invalid={!!errors.title}
              onChange={(e) => set("title", e.target.value)}
            />
            <FieldError>{errors.title}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-calendar">Calendar</Label>
            <NativeSelect
              id="event-calendar"
              className="w-full"
              value={form.calendar}
              aria-invalid={!!errors.calendar}
              onChange={(e) => set("calendar", e.target.value)}
            >
              {calendars.length ? null : <option value="">No calendar you can add events to</option>}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
            <FieldError>{errors.calendar}</FieldError>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="event-all-day" checked={form.allDay} onCheckedChange={(v) => set("allDay", v === true)} />
            <Label htmlFor="event-all-day">All day</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="event-start-date">Start date</Label>
              <Input
                id="event-start-date"
                type="date"
                value={form.startDate}
                aria-invalid={!!errors.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
              <FieldError>{errors.startDate}</FieldError>
            </div>
            {form.allDay ? null : (
              <div className="grid gap-2">
                <Label htmlFor="event-start-time">Start time</Label>
                <Input
                  id="event-start-time"
                  type="time"
                  value={form.startTime}
                  aria-invalid={!!errors.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                />
                <FieldError>{errors.startTime}</FieldError>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="event-end-date">End date</Label>
              <Input
                id="event-end-date"
                type="date"
                value={form.endDate}
                aria-invalid={!!errors.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
              <FieldError>{errors.endDate}</FieldError>
            </div>
            {form.allDay ? null : (
              <div className="grid gap-2">
                <Label htmlFor="event-end-time">End time</Label>
                <Input
                  id="event-end-time"
                  type="time"
                  value={form.endTime}
                  aria-invalid={!!errors.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                />
                <FieldError>{errors.endTime}</FieldError>
              </div>
            )}
          </div>
          {/* F-18b: repeat, reminder, place and notes (RFC 5545 RRULE, VALARM, LOCATION, DESCRIPTION) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="event-repeat">Repeat</Label>
              <NativeSelect
                id="event-repeat"
                className="w-full"
                value={form.repeat}
                onChange={(e) => set("repeat", e.target.value)}
              >
                {REPEAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-reminder">Reminder</Label>
              <NativeSelect
                id="event-reminder"
                className="w-full"
                value={form.reminder}
                onChange={(e) => set("reminder", e.target.value)}
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {form.reminder && !REMINDER_OPTIONS.some((option) => option.value === form.reminder) ? (
                  <option value={form.reminder}>{reminderText(Number(form.reminder))}</option>
                ) : null}
              </NativeSelect>
            </div>
          </div>
          {form.repeat !== "none" ? (
            <p className="-mt-2 text-muted-foreground text-xs">
              A repeating event is shown on every date it repeats. To change it later, delete it and create it again.
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              dir="auto"
              placeholder="Add a place or a meeting link"
              maxLength={LOCATION_MAX + 20}
              value={form.location}
              aria-invalid={!!errors.location}
              onChange={(e) => set("location", e.target.value)}
            />
            <FieldError>{errors.location}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-notes">Notes</Label>
            <Textarea
              id="event-notes"
              dir="auto"
              rows={3}
              maxLength={NOTES_MAX + 50}
              value={form.notes}
              aria-invalid={!!errors.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
            <FieldError>{errors.notes}</FieldError>
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {event ? (
              <Button type="button" variant="outline" className="text-destructive" onClick={() => onDelete(event)}>
                <Trash2 />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busy || !calendars.length}>
                {event ? "Update" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const whenText = (event: CalendarEvent) => {
  const start = parseISO(event.start);
  if (event.allDay) {
    const last = event.end ? subDays(parseISO(event.end), 1) : start;
    return last.getTime() > start.getTime()
      ? `${format(start, "EEE d MMM yyyy")} – ${format(last, "EEE d MMM yyyy")}, all day`
      : `${format(start, "EEE d MMM yyyy")}, all day`;
  }
  const end = event.end ? parseISO(event.end) : undefined;
  return `${format(start, "EEE d MMM yyyy, HH:mm")}${end ? ` – ${format(end, "HH:mm")}` : ""}`;
};

/** An event the viewer may only look at: a read-only share, a free/busy block, or a repeating event. */
export function EventDetailsDialog({
  event,
  calendarLabel,
  reason,
  onOpenChange,
  onCloseAutoFocus,
  onDelete,
}: {
  event?: CalendarEvent;
  calendarLabel: string;
  reason: string;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** F-18b: a repeating event on a calendar the viewer may change can be deleted (all its dates). */
  onDelete?: (event: CalendarEvent) => void;
}) {
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle dir="auto">{event?.title}</DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>
        {event ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">When</dt>
            <dd>{whenText(event)}</dd>
            <dt className="text-muted-foreground">Calendar</dt>
            <dd dir="auto">{calendarLabel}</dd>
            {event.source ? (
              <>
                <dt className="text-muted-foreground">Made by</dt>
                <dd dir="auto">{event.source}</dd>
              </>
            ) : null}
            {repeatText(event.repeat) ? (
              <>
                <dt className="text-muted-foreground">
                  <Repeat className="inline size-3.5" aria-hidden /> Repeat
                </dt>
                <dd>{repeatText(event.repeat)}</dd>
              </>
            ) : null}
            {reminderText(event.reminderMinutes) ? (
              <>
                <dt className="text-muted-foreground">
                  <Bell className="inline size-3.5" aria-hidden /> Reminder
                </dt>
                <dd>{reminderText(event.reminderMinutes)}</dd>
              </>
            ) : null}
            {event.location ? (
              <>
                <dt className="text-muted-foreground">
                  <MapPin className="inline size-3.5" aria-hidden /> Location
                </dt>
                <dd dir="auto">{event.location}</dd>
              </>
            ) : null}
            {event.description ? (
              <>
                <dt className="text-muted-foreground">Notes</dt>
                <dd dir="auto" className="whitespace-pre-wrap">
                  {event.description}
                </dd>
              </>
            ) : null}
          </dl>
        ) : null}
        <DialogFooter className={onDelete && event ? "sm:justify-between" : undefined}>
          {onDelete && event ? (
            <Button type="button" variant="outline" className="text-destructive" onClick={() => onDelete(event)}>
              <Trash2 />
              Delete all dates
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEventDialog({
  event,
  calendarLabel,
  onOpenChange,
  onConfirm,
}: {
  event?: CalendarEvent;
  calendarLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (event: CalendarEvent) => void;
}) {
  return (
    <AlertDialog open={!!event} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{event?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The event is removed from “{calendarLabel}” on the calendar server, for everyone this calendar is shared
            with{event?.recurring ? ", on every date it repeats" : ""}. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              if (event) onConfirm(event);
              onOpenChange(false);
            }}
          >
            Delete event
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
