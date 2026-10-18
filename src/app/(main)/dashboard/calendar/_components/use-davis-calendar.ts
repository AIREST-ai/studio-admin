"use client";
// M129-G (Fahad 129.8): the calendar page's one store. Calendars, events and sharing are read from and written to Davis
// through this preview's own routes (/api/calendar-davis/*), which call Davis from the Next.js server; nothing is kept
// in the browser, so a change shows in every browser and stays after a reload.
import * as React from "react";

import type { CalendarAccess, ShareLevel, StudioCalendar, StudioEvent } from "@/lib/davis/server";

export type { CalendarAccess, ShareLevel, StudioCalendar, StudioEvent };

export interface CalendarPerson {
  id: number;
  name: string;
  email: string;
}

export interface CalendarShare {
  personId: number;
  level: ShareLevel;
  davis: "read" | "read-write" | "none";
}

export interface DavisCalendarData {
  source: { name: string; version: string; url: string };
  viewer: { id: number; name: string; isMe: boolean };
  people: CalendarPerson[];
  levels: { value: ShareLevel; label: string; where: string }[];
  colors: string[];
  calendars: Omit<StudioCalendar, "path">[];
  events: StudioEvent[];
  accountIds: number[];
}

export type Outcome<T = null> = { ok: true; value: T } | { ok: false; message: string; status?: number };

export async function call<T>(url: string, method: string, body?: unknown): Promise<Outcome<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, message: json.error ?? `HTTP ${response.status}`, status: response.status };
    return { ok: true, value: json as T };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/** `as`: the employee the page is previewed as (null = the signed-in person). */
export function useDavisCalendar(range: { start: Date; end: Date } | undefined, as: number | null) {
  const [data, setData] = React.useState<DavisCalendarData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const latest = React.useRef(0);
  const start = range?.start.toISOString();
  const end = range?.end.toISOString();

  const reload = React.useCallback(async () => {
    if (!start || !end) return;
    const ticket = ++latest.current;
    setLoading(true);
    const query = new URLSearchParams({ start, end, ...(as === null ? {} : { as: String(as) }) });
    const result = await call<DavisCalendarData>(`/api/calendar-davis?${query}`, "GET");
    if (ticket !== latest.current) return; // a newer range or person was asked for meanwhile
    setLoading(false);
    if (result.ok) {
      setData(result.value);
      setLoadError(null);
    } else setLoadError(result.message);
  }, [start, end, as]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const api = React.useMemo(() => {
    const withAs = <T extends object>(body: T) => (as === null ? body : { ...body, as });
    const asQuery: Record<string, string> = as === null ? {} : { as: String(as) };
    return {
      createEvent: (calendarId: string, event: unknown) =>
        call<{ created: { href: string } }>("/api/calendar-davis/events", "POST", withAs({ calendarId, event })),
      updateEvent: (calendarId: string, href: string, etag: string, event: unknown, moveTo?: string) =>
        call<{ saved: { href: string } }>(
          "/api/calendar-davis/events",
          "PATCH",
          withAs({ calendarId, href, etag, event, ...(moveTo && moveTo !== calendarId ? { moveTo } : {}) }),
        ),
      deleteEvent: (calendarId: string, href: string, etag: string) =>
        call<{ deleted: true }>("/api/calendar-davis/events", "DELETE", withAs({ calendarId, href, etag })),
      createCalendar: (name: string, color: string) =>
        call<{ id: string }>("/api/calendar-davis/calendars", "POST", withAs({ name, color })),
      // F-5B: "Delete calendar" (its owner only; the server refuses the primary and the last calendar)
      deleteCalendar: (calendarId: string) =>
        call<{ deleted: { id: string; name: string; events: number | null } }>(
          "/api/calendar-davis/calendars",
          "DELETE",
          withAs({ calendarId }),
        ),
      shares: (calendarId: string) =>
        call<{ shares: CalendarShare[] }>(
          `/api/calendar-davis/share?${new URLSearchParams({ calendarId, ...asQuery })}`,
          "GET",
        ),
      setShare: (calendarId: string, personId: number, level: ShareLevel) =>
        call<{ shares: CalendarShare[] }>("/api/calendar-davis/share", "PUT", withAs({ calendarId, personId, level })),
      removeShare: (calendarId: string, personId: number) =>
        call<{ shares: CalendarShare[] }>("/api/calendar-davis/share", "DELETE", withAs({ calendarId, personId })),
    };
  }, [as]);

  return { data, loadError, loading, reload, ...api };
}

export const ACCESS_LABEL: Record<CalendarAccess, string> = {
  owner: "Owner",
  freebusy: "See only free/busy",
  details: "See all event details",
  edit: "Make changes to events",
  manage: "Make changes and manage sharing",
};
