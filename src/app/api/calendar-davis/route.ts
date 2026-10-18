import { NextResponse } from "next/server";

import {
  accountPersonIds,
  CALENDAR_COLORS,
  calendarsFor,
  DAVIS_URL,
  DAVIS_VERSION,
  eventsFor,
  SHARE_LEVELS,
} from "@/lib/davis/server";

import { fail, failFrom, headers, people, viewerFrom } from "./shared";

// M129-G (Fahad 129.8): the calendar page's calendars and events, read from the local Davis (CalDAV) on the server.
// GET ?start=ISO&end=ISO[&as=<employee id>] -> who it is shown as, the calendars they see (own and shared, with the
// sharing level), the events in the range, and the people who have a calendar account.
// Writes: ./events (POST/PATCH/DELETE), ./calendars (POST), ./share (GET/PUT/DELETE).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || start >= end)
    return fail(400, "start and end must be ISO times, start before end");
  if (Date.parse(end) - Date.parse(start) > 400 * 86400000) return fail(400, "the range is limited to 400 days");
  try {
    const viewer = await viewerFrom(url.searchParams.get("as") ?? undefined);
    const calendars = await calendarsFor(viewer.username);
    const events = await eventsFor(viewer.username, calendars, start, end);
    const everyone = await people();
    // the people who appear in a calendar the viewer sees, so the page can name owners
    const known = new Set<number>(calendars.map((c) => c.owner.personId).filter((id): id is number => id !== null));
    return NextResponse.json(
      {
        // F-16: no vendor name in what the page receives (the page no longer shows the source at all).
        source: { name: "Calendar server", version: DAVIS_VERSION, url: DAVIS_URL },
        viewer: { id: viewer.person.id, name: viewer.person.name, isMe: viewer.isMe },
        people: everyone.map((p) => ({ id: p.id, name: p.name, email: p.email, owner: known.has(p.id) })),
        levels: SHARE_LEVELS,
        colors: CALENDAR_COLORS,
        calendars: calendars.map(({ path: _path, ...calendar }) => calendar),
        events,
        ownerIds: [...known],
        accountIds: await accountPersonIds(),
      },
      { headers },
    );
  } catch (error) {
    return failFrom(error);
  }
}
