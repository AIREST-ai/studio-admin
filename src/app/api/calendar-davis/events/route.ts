import { NextResponse } from "next/server";

import { createEvent, deleteEvent, updateEvent } from "@/lib/davis/server";

import { eventInputFrom, fail, failFrom, headers, readJson, sameOrigin, str, viewerFrom } from "../shared";

// M129-G: one event in Davis, written over CalDAV as the person the calendar is shown as (Davis checks their access).
// POST { as?, calendarId, event, source? }                       -> a new event
// PATCH { as?, calendarId, href, etag, event, moveTo? }          -> the event changed (refused if changed since: 409)
// DELETE { as?, calendarId, href, etag }                          -> the event removed
export const dynamic = "force-dynamic";

const HREF = /^\/dav\/calendars\/[A-Za-z0-9_.@+'-]+\/[A-Za-z0-9_.-]+\/[^/]+\.ics$/;

type Body = {
  as?: unknown;
  calendarId?: unknown;
  href?: unknown;
  etag?: unknown;
  event?: unknown;
  moveTo?: unknown;
  source?: unknown;
};

async function body(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const json = await readJson<Body>(request);
  if (!json) return fail(400, "body must be JSON");
  if (typeof json.calendarId !== "string" || !json.calendarId.includes("/")) return fail(400, "calendarId is required");
  return json as Body & { calendarId: string };
}

export async function POST(request: Request) {
  const json = await body(request);
  if (json instanceof NextResponse) return json;
  const input = eventInputFrom(json.event);
  if (typeof input === "string") return fail(400, input);
  try {
    const viewer = await viewerFrom(json.as);
    const source = str(json.source, 200) || undefined;
    const created = await createEvent(viewer.username, json.calendarId, { ...input, source });
    return NextResponse.json({ created }, { status: 201, headers });
  } catch (error) {
    return failFrom(error);
  }
}

export async function PATCH(request: Request) {
  const json = await body(request);
  if (json instanceof NextResponse) return json;
  if (typeof json.href !== "string" || !HREF.test(json.href)) return fail(400, "href is not valid");
  const input = eventInputFrom(json.event);
  if (typeof input === "string") return fail(400, input);
  if (json.moveTo !== undefined && (typeof json.moveTo !== "string" || !json.moveTo.includes("/")))
    return fail(400, "moveTo is not valid");
  try {
    const viewer = await viewerFrom(json.as);
    const saved = await updateEvent(
      viewer.username,
      json.calendarId,
      json.href,
      str(json.etag, 200),
      input,
      json.moveTo as string | undefined,
    );
    return NextResponse.json({ saved }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export async function DELETE(request: Request) {
  const json = await body(request);
  if (json instanceof NextResponse) return json;
  if (typeof json.href !== "string" || !HREF.test(json.href)) return fail(400, "href is not valid");
  try {
    const viewer = await viewerFrom(json.as);
    await deleteEvent(viewer.username, json.calendarId, json.href, str(json.etag, 200));
    return NextResponse.json({ deleted: true }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
