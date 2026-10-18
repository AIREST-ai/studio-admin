import { NextResponse } from "next/server";

import { CALENDAR_COLORS, calendarsFor, createCalendar, deleteCalendar, NAME_MAX } from "@/lib/davis/server";

import { fail, failFrom, headers, readJson, sameOrigin, str, viewerFrom } from "../shared";

// M129-G: "New calendar". POST { as?, name, color } -> a calendar owned by that person, made in Davis over CalDAV
// (MKCALENDAR), so any name is kept, Arabic included (Davis's REST API refuses non-Latin names).
// GET [?as=] -> the calendars that person may add events to (the automation action "Create calendar event" lists them).
// F-5B: DELETE { as?, calendarId } -> "Delete calendar": the owner's calendar and all its events deleted in Davis
// (CalDAV DELETE, RFC 4918 §9.6.1). Refused for anyone but the owner (403), and for the primary or last calendar (409).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await viewerFrom(new URL(request.url).searchParams.get("as") ?? undefined);
    const calendars = (await calendarsFor(viewer.username))
      .filter((calendar) => calendar.canEdit)
      .map((calendar) => ({ id: calendar.id, name: calendar.name, color: calendar.color }));
    return NextResponse.json({ viewer: viewer.person.name, calendars }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const json = await readJson<{ as?: unknown; name?: unknown; color?: unknown }>(request);
  if (!json) return fail(400, "body must be JSON");
  const name = str(json.name, NAME_MAX + 1);
  if (!name) return fail(400, "name is required");
  if (name.length > NAME_MAX) return fail(400, `name must be ${NAME_MAX} characters or fewer`);
  if (typeof json.color !== "string" || !CALENDAR_COLORS.includes(json.color)) return fail(400, "color is not valid");
  try {
    const viewer = await viewerFrom(json.as);
    const id = await createCalendar(viewer.username, name, json.color);
    return NextResponse.json({ id }, { status: 201, headers });
  } catch (error) {
    return failFrom(error);
  }
}

const CALENDAR_ID = /^[A-Za-z0-9_.@+'-]+\/[A-Za-z0-9_.-]+$/;

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const json = await readJson<{ as?: unknown; calendarId?: unknown }>(request);
  if (!json) return fail(400, "body must be JSON");
  if (typeof json.calendarId !== "string" || !CALENDAR_ID.test(json.calendarId))
    return fail(400, "calendarId is required");
  try {
    const viewer = await viewerFrom(json.as);
    const deleted = await deleteCalendar(viewer.username, json.calendarId);
    return NextResponse.json({ deleted }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
