"use client";
// M129-G (Fahad 129.8): the fields of the automation action "Create calendar event", and the dry run's
// "Create in Davis" button, which makes that one event for real in Davis (the Calendar page shows it).
import * as React from "react";

import Link from "next/link";

import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { type CalendarActionSpec, DAYS_MAX, eventFromSpec, MINUTES_MAX, specOf, valuesOf } from "./calendar-event";
import type { Action } from "./catalog";

type DavisCalendar = { id: string; name: string };
type Loaded = { ok: true; calendars: DavisCalendar[] } | { ok: false; message: string };

let loading: Promise<Loaded> | null = null;
/** The calendars the signed-in person may add events to, read from Davis once per page. */
function loadCalendars(): Promise<Loaded> {
  loading ??= fetch("/api/calendar-davis/calendars", { cache: "no-store" })
    .then(async (response) => {
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        loading = null;
        return { ok: false as const, message: json.error ?? `HTTP ${response.status}` };
      }
      return { ok: true as const, calendars: json.calendars as DavisCalendar[] };
    })
    .catch((error: Error) => {
      loading = null;
      return { ok: false as const, message: error.message };
    });
  return loading;
}

export function useDavisCalendars() {
  const [state, setState] = React.useState<Loaded | null>(null);
  React.useEffect(() => {
    let live = true;
    void loadCalendars().then((result) => live && setState(result));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function CalendarEventFields({
  action,
  onChange,
  invalid,
}: {
  action: Action;
  onChange: (action: Action) => void;
  invalid: boolean;
}) {
  const loaded = useDavisCalendars();
  const spec = specOf(action.values);
  const set = (change: Partial<CalendarActionSpec>) =>
    onChange({ ...action, values: valuesOf({ ...spec, ...change }) });
  const id = React.useId();

  // a new step starts on the next day at 09:00 for one hour, in the first calendar
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the step is still empty.
  React.useEffect(() => {
    if (action.values.length) return;
    onChange({ ...action, values: valuesOf({ title: "", calendarId: "", days: 1, time: "09:00", minutes: 60 }) });
  }, [action.values.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fill the calendar once the list arrives.
  React.useEffect(() => {
    if (loaded?.ok && !spec.calendarId && loaded.calendars[0] && action.values.length)
      set({ calendarId: loaded.calendars[0].id });
  }, [loaded, action.values.length]);

  return (
    <div className="grid gap-2" data-calendar-action>
      <Input
        aria-label="Event title"
        dir="auto"
        placeholder="Event title, e.g. Follow-up call"
        maxLength={140}
        aria-invalid={invalid && !spec.title}
        value={spec.title}
        onChange={(e) => set({ title: e.target.value })}
      />
      <NativeSelect
        className="w-full"
        aria-label="Calendar"
        aria-invalid={invalid && !spec.calendarId}
        value={spec.calendarId}
        onChange={(e) => set({ calendarId: e.target.value })}
      >
        <option value="" disabled>
          {loaded === null ? "Loading calendars…" : "Choose the calendar"}
        </option>
        {loaded?.ok
          ? loaded.calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))
          : null}
        {spec.calendarId && loaded?.ok && !loaded.calendars.some((c) => c.id === spec.calendarId) ? (
          <option value={spec.calendarId}>A calendar you cannot add to any more</option>
        ) : null}
      </NativeSelect>
      {loaded && !loaded.ok ? (
        <p role="alert" className="text-destructive text-xs">
          Calendars could not be read from the calendar server: {loaded.message}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-days`} className="text-xs">
            Days after the trigger
          </Label>
          <Input
            id={`${id}-days`}
            type="number"
            min={0}
            max={DAYS_MAX}
            value={Number.isNaN(spec.days) ? "" : spec.days}
            onChange={(e) => set({ days: Number.parseInt(e.target.value, 10) })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-time`} className="text-xs">
            Time
          </Label>
          <Input
            id={`${id}-time`}
            type="time"
            disabled={!spec.time}
            value={spec.time || "09:00"}
            onChange={(e) => set({ time: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-allday`}
            checked={!spec.time}
            onCheckedChange={(checked) => set({ time: checked === true ? "" : "09:00" })}
          />
          <Label htmlFor={`${id}-allday`} className="text-xs">
            All day
          </Label>
        </div>
        {spec.time ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={`${id}-minutes`} className="text-xs">
              Length (minutes)
            </Label>
            <Input
              id={`${id}-minutes`}
              type="number"
              min={5}
              max={MINUTES_MAX}
              className="w-24"
              value={Number.isNaN(spec.minutes) ? "" : spec.minutes}
              onChange={(e) => set({ minutes: Number.parseInt(e.target.value, 10) })}
            />
          </div>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Saved on the calendar server of the Calendar page. The dry run shows the event; its “Create event” button makes
        it.
      </p>
    </div>
  );
}

/** On the dry run's line: make this one event for real in Davis, marked as made by this flow. */
export function CreateInDavis({ values, at, flowName }: { values: string[]; at: Date; flowName: string }) {
  const [state, setState] = React.useState<{ busy: boolean; done?: string; error?: string }>({ busy: false });
  const spec = specOf(values);
  const create = async () => {
    setState({ busy: true });
    try {
      const response = await fetch("/api/calendar-davis/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          calendarId: spec.calendarId,
          event: eventFromSpec(spec, at),
          source: `Automation flow “${flowName || "Untitled flow"}”, created from its dry run`,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) setState({ busy: false, error: json.error ?? `HTTP ${response.status}` });
      else setState({ busy: false, done: json.created?.href ?? "" });
    } catch (error) {
      setState({ busy: false, error: (error as Error).message });
    }
  };
  if (state.done !== undefined)
    return (
      <span className="ps-5 text-emerald-700 dark:text-emerald-400" role="status" data-davis-created>
        Created on the calendar server.{" "}
        <Link href="/dashboard/calendar" className="underline underline-offset-4">
          Open Calendar
        </Link>
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-2 ps-5">
      <Button type="button" size="sm" variant="outline" disabled={state.busy} onClick={() => void create()}>
        <CalendarPlus />
        Create event
      </Button>
      {state.error ? (
        <span role="alert" className="text-destructive">
          Not created: {state.error}
        </span>
      ) : null}
    </span>
  );
}
