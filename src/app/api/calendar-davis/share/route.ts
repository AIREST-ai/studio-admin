import { NextResponse } from "next/server";

import { removeShare, SHARE_LEVELS, type ShareLevel, setShare, sharesOf } from "@/lib/davis/server";

import { fail, failFrom, headers, people, readJson, sameOrigin, viewerFrom } from "../shared";

// M129-G: who a calendar is shared with, at the four levels of Google Calendar (see lib/davis/server.ts).
// GET ?calendarId=&as=                              -> the shares
// PUT { as?, calendarId, personId, level }          -> share with that employee, or change their level
// DELETE { as?, calendarId, personId }              -> stop sharing with them
// Only the owner, or someone with "Make changes and manage sharing", may do this.
export const dynamic = "force-dynamic";

const LEVELS = SHARE_LEVELS.map((l) => l.value);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("calendarId");
  if (!id?.includes("/")) return fail(400, "calendarId is required");
  try {
    const viewer = await viewerFrom(url.searchParams.get("as") ?? undefined);
    return NextResponse.json({ shares: await sharesOf(viewer.username, id) }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

type Body = { as?: unknown; calendarId?: unknown; personId?: unknown; level?: unknown };

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const json = await readJson<Body>(request);
  if (!json || typeof json.calendarId !== "string" || !json.calendarId.includes("/"))
    return fail(400, "calendarId is required");
  if (typeof json.level !== "string" || !LEVELS.includes(json.level as ShareLevel))
    return fail(400, "level is not valid");
  try {
    const person = (await people()).find((p) => p.id === json.personId);
    if (!person) return fail(400, "choose an employee");
    const viewer = await viewerFrom(json.as);
    if (person.id === viewer.person.id) return fail(400, "you already see your own calendars");
    await setShare(viewer.username, json.calendarId, person, json.level as ShareLevel);
    return NextResponse.json({ shares: await sharesOf(viewer.username, json.calendarId) }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const json = await readJson<Body>(request);
  if (!json || typeof json.calendarId !== "string" || !json.calendarId.includes("/"))
    return fail(400, "calendarId is required");
  if (!Number.isInteger(json.personId)) return fail(400, "personId is required");
  try {
    const viewer = await viewerFrom(json.as);
    await removeShare(viewer.username, json.calendarId, json.personId as number);
    return NextResponse.json({ shares: await sharesOf(viewer.username, json.calendarId) }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
