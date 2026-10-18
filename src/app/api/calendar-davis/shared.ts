import { NextResponse } from "next/server";

import { CURRENT_USER_ID, agents as seedAgents } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";
import { REPEATS, type Repeat } from "@/lib/davis/ical";
import { DavisError, ensureAccount, type StudioPerson } from "@/lib/davis/server";
import { ownNames } from "@/lib/own-names";

// M129-G: helpers shared by the /api/calendar-davis routes (the calendar page's bridge to the local Davis).
export const headers = { "Cache-Control": "no-store" };

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

export function failFrom(error: unknown) {
  // F-16: errors reach the page in the product's words, never naming the system behind it (lib/own-names.ts).
  if (error instanceof DavisError) return fail(error.status, ownNames(error.message));
  return fail(500, ownNames((error as Error).message) || "unexpected error");
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function readJson<T>(request: Request, maxBytes = 20_000): Promise<T | null> {
  const body = await request.text();
  if (body.length > maxBytes) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/** The preview's employees (Settings > Agents as saved, else the sample roster). */
export async function people(): Promise<StudioPerson[]> {
  let list = seedAgents as { id: number; name: string; email: string }[];
  try {
    const saved = await readPreviewState();
    if (saved?.lists?.agents?.length) list = saved.lists.agents as unknown as typeof list;
  } catch {
    // unreadable saved lists: the sample roster still names the same people
  }
  return list
    .filter((agent) => Number.isInteger(agent.id) && agent.name)
    .map((agent) => ({ id: agent.id, name: agent.name, email: agent.email || `agent-${agent.id}@studio.invalid` }));
}

/**
 * Who the calendar is shown as. The preview has no sign-in, so it is its signed-in sample person (CURRENT_USER_ID,
 * Arham Khan) unless the page asks to preview it as another employee who already has a calendar account.
 */
export async function viewerFrom(raw: unknown): Promise<{ person: StudioPerson; username: string; isMe: boolean }> {
  const everyone = await people();
  const me = everyone.find((p) => p.id === CURRENT_USER_ID) ?? {
    id: CURRENT_USER_ID,
    name: "Arham Khan",
    email: "arham.khan@weblabs.studio",
  };
  const asId = raw === undefined || raw === null || raw === "" ? CURRENT_USER_ID : Number(raw);
  const person = everyone.find((p) => p.id === asId);
  if (!person) throw new DavisError("unknown employee", 400);
  if (person.id === me.id) {
    // first use: the signed-in person's Davis account, with the four calendars of the old page
    const { username } = await ensureAccount(me, true);
    return { person: me, username, isMe: true };
  }
  const { username } = await ensureAccount(person);
  return { person, username, isMe: false };
}

export const str = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** An event from the page: title, all-day flag, start and end ("yyyy-MM-dd" all day, ISO times otherwise). */
export function eventInputFrom(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "event must be an object";
  const e = raw as Record<string, unknown>;
  // F-18b: location, repeat and reminderMinutes (lib/davis/ical.ts); a field left out keeps the stored value on edit
  const allowed = ["title", "allDay", "start", "end", "description", "location", "repeat", "reminderMinutes"];
  const extra = Object.keys(e).filter((key) => !allowed.includes(key));
  if (extra.length) return `unknown fields: ${extra.join(", ")}`;
  const title = str(e.title, 120);
  if (!title) return "title is required";
  if (typeof e.allDay !== "boolean") return "allDay must be true or false";
  const valid = (value: unknown) =>
    typeof value === "string" && (e.allDay ? DAY.test(value) : !Number.isNaN(Date.parse(value)) && value.includes("T"));
  if (!valid(e.start)) return "start is not valid";
  if (e.end !== undefined && e.end !== null && !valid(e.end)) return "end is not valid";
  const start = e.start as string;
  const end = (e.end ?? undefined) as string | undefined;
  if (end && (e.allDay ? end <= start : Date.parse(end) <= Date.parse(start))) return "end must be after start";
  if (e.repeat !== undefined && !(REPEATS as readonly unknown[]).includes(e.repeat)) return "repeat is not valid";
  if (
    e.reminderMinutes !== undefined &&
    e.reminderMinutes !== null &&
    !(
      Number.isInteger(e.reminderMinutes) &&
      (e.reminderMinutes as number) >= 0 &&
      (e.reminderMinutes as number) <= 40320
    )
  )
    return "reminderMinutes must be whole minutes before the start (up to 4 weeks) or null";
  return {
    title,
    allDay: e.allDay,
    start: e.allDay ? start : new Date(start).toISOString(),
    end: end ? (e.allDay ? end : new Date(end).toISOString()) : undefined,
    // F-18b: "" clears the notes or the place on edit; undefined (left out) keeps them
    description: e.description === undefined ? undefined : str(e.description, 2000),
    location: e.location === undefined ? undefined : str(e.location, 300),
    repeat: e.repeat as Repeat | undefined,
    reminderMinutes: e.reminderMinutes as number | null | undefined,
  };
}
