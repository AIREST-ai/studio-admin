// M129-G (Fahad 129.8): the small part of iCalendar (RFC 5545) the Studio calendar reads and writes on Davis.
// Davis stores and expands the events (CalDAV calendar-query with <expand>, RFC 4791 §9.6.5, so repeating events and
// TZID times come back as single UTC instances); this file only turns one VEVENT into the page's event and back.
// Writing an edit patches the stored VEVENT in place (SUMMARY, DTSTART, DTEND), so properties written by other
// calendar apps (alarms, attendees, notes) are kept.
// F-18b (Fahad, 15 Oct 15:20: "التقويم … أراه هو نفسه لم يتغير"): an event also has a place (LOCATION, RFC 5545
// §3.8.1.7), notes (DESCRIPTION, §3.8.1.5), a simple repeat rule (RRULE FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, §3.8.5.3) and
// one reminder (a VALARM with ACTION:DISPLAY and a TRIGGER before the start, §3.6.6), which Davis stores as they are and
// phone calendar apps show. An edit writes them only when the page sends them; otherwise they are kept as stored.

import { PRODUCT_NAME } from "@/config/app-config";

// F-23 (Fahad 15 Oct 15:20: "even the internal names all change to my name"): the product's own non-standard property
// (an "x-name", RFC 5545 §3.8.8.2) that keeps what made an event. It was X-STUDIO-SOURCE; an event written under that
// name is still read. A fixed key, not built from PRODUCT_NAME, so stored events never lose it.
const SOURCE_PROP = "X-AIREST-SOURCE";
const EARLIER_SOURCE_PROPS = ["X-STUDIO-SOURCE"];

export interface IcsEvent {
  uid: string;
  /** Set on one instance of a repeating event (expanded by Davis). */
  recurrenceId?: string;
  title: string;
  allDay: boolean;
  /** "yyyy-MM-dd" when allDay, else an ISO time in UTC ("…Z"). */
  start: string;
  /** Exclusive end, same form as start. */
  end?: string;
  /** The event repeats (RRULE / RECURRENCE-ID): Studio shows it but leaves editing to a calendar app. */
  recurring: boolean;
  description?: string;
  /** SOURCE_PROP: what in the product made the event (e.g. an automation flow). */
  source?: string;
  /** F-18b: LOCATION. */
  location?: string;
  /** F-18b: the RRULE when it is one of the simple rules the page writes ("none" when the event does not repeat). */
  repeat?: Repeat;
  /** F-18b: minutes before the start of the first VALARM (null: no reminder). */
  reminderMinutes?: number | null;
}

/** F-18b: the repeat rules the page writes (RRULE FREQ, every 1 period, no end). */
export const REPEATS = ["none", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type Repeat = (typeof REPEATS)[number] | "custom";

export interface IcsInput {
  uid: string;
  title: string;
  allDay: boolean;
  start: string;
  end?: string;
  description?: string;
  source?: string;
  location?: string;
  repeat?: Repeat;
  reminderMinutes?: number | null;
}

interface Line {
  name: string;
  params: Record<string, string>;
  value: string;
  raw: string;
}

/** RFC 5545 §3.1: a line that starts with a space or tab continues the previous one. */
export function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else if (line.length) out.push(line);
  }
  return out;
}

function parseLine(raw: string): Line {
  let i = 0;
  let quoted = false;
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ":" && !quoted) break;
  }
  const head = raw.slice(0, i);
  const value = raw.slice(i + 1);
  const [name, ...rest] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of rest) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value, raw };
}

const unescapeText = (value: string) =>
  value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));

const escapeText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 §3.1: lines longer than 75 octets are folded, never inside a UTF-8 character. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  let limit = 75;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, "utf8");
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
      limit = 74; // the continuation's leading space counts
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Offset of `timeZone` at the UTC instant `utc`, in minutes (Intl, no time-zone database of our own). */
function offsetMinutes(timeZone: string, utc: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utc) / 60000);
}

/** An iCalendar DATE or DATE-TIME as the page's form: "yyyy-MM-dd" (all day) or an ISO UTC time. */
export function fromIcsDate(value: string, params: Record<string, string>): { value: string; allDay: boolean } | null {
  const date = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (date || params.VALUE === "DATE") {
    if (!date) return null;
    return { value: `${date[1]}-${date[2]}-${date[3]}`, allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  let utc = wall;
  if (!m[7] && params.TZID) {
    try {
      // two passes settle the offset on either side of a daylight-saving change
      utc = wall - offsetMinutes(params.TZID, wall) * 60000;
      utc = wall - offsetMinutes(params.TZID, utc) * 60000;
    } catch {
      utc = wall; // an unknown TZID name: read as UTC rather than drop the event
    }
  }
  return { value: new Date(utc).toISOString().replace(".000Z", "Z"), allDay: false };
}

/** The page's "yyyy-MM-dd" or ISO time as an iCalendar property line (UTC for times). */
function toIcsDate(name: string, value: string, allDay: boolean): string {
  if (allDay) return `${name};VALUE=DATE:${value.slice(0, 10).replace(/-/g, "")}`;
  const d = new Date(value);
  return `${name}:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const stamp = () => toIcsDate("DTSTAMP", new Date().toISOString(), false);

/** RFC 5545 §3.3.6 durations (P1D, PT1H30M, P2W …) in milliseconds. */
function durationMs(value: string): number | null {
  const m = value.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms =
    ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

function addMs(start: string, allDay: boolean, ms: number): string {
  if (allDay) {
    const d = new Date(`${start}T00:00:00Z`);
    return new Date(d.getTime() + ms).toISOString().slice(0, 10);
  }
  return new Date(new Date(start).getTime() + ms).toISOString().replace(".000Z", "Z");
}

/** Every VEVENT of a calendar object (nested VALARMs are skipped). */
export function parseEvents(ics: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const stack: string[] = [];
  let lines: Line[] | null = null;
  let trigger: Line | null = null;
  for (const raw of unfold(ics)) {
    const line = parseLine(raw);
    if (line.name === "BEGIN") {
      stack.push(line.value.toUpperCase());
      if (line.value.toUpperCase() === "VEVENT") {
        lines = [];
        trigger = null;
      }
      continue;
    }
    if (line.name === "END") {
      const closing = stack.pop();
      if (closing === "VEVENT" && lines) {
        const event = eventFrom(lines, trigger);
        if (event) events.push(event);
        lines = null;
      }
      continue;
    }
    if (lines && stack[stack.length - 1] === "VEVENT") lines.push(line);
    // F-18b: the first reminder of the event (a VALARM inside this VEVENT)
    if (lines && !trigger && stack[stack.length - 1] === "VALARM" && line.name === "TRIGGER") trigger = line;
  }
  return events;
}

/** F-18b: a TRIGGER before the start ("-PT15M", "-P1D") in minutes; null when absolute or after the start. */
function reminderOf(trigger: Line | null): number | null {
  if (!trigger || trigger.params.VALUE === "DATE-TIME" || trigger.params.RELATED === "END") return null;
  const ms = durationMs(trigger.value);
  if (ms === null || ms > 0) return null;
  return Math.round(-ms / 60000);
}

/** F-18b: one of the simple rules the page writes, "custom" for any other RRULE, "none" without one. */
function repeatOf(rrule: string | undefined): Repeat {
  if (!rrule) return "none";
  const parts = Object.fromEntries(
    rrule
      .toUpperCase()
      .split(";")
      .map((part) => part.split("=") as [string, string]),
  );
  const keys = Object.keys(parts).filter((key) => !(key === "INTERVAL" && parts[key] === "1") && key !== "WKST");
  const freq = parts.FREQ as Repeat | undefined;
  if (keys.length === 1 && freq && (REPEATS as readonly string[]).includes(freq) && freq !== "none") return freq;
  return "custom";
}

function eventFrom(lines: Line[], trigger: Line | null = null): IcsEvent | null {
  const get = (name: string) => lines.find((l) => l.name === name);
  const startLine = get("DTSTART");
  const uid = get("UID")?.value;
  if (!startLine || !uid) return null;
  const start = fromIcsDate(startLine.value, startLine.params);
  if (!start) return null;
  const endLine = get("DTEND");
  let end = endLine ? fromIcsDate(endLine.value, endLine.params)?.value : undefined;
  const duration = get("DURATION");
  if (!end && duration) {
    const ms = durationMs(duration.value);
    if (ms !== null) end = addMs(start.value, start.allDay, ms);
  }
  // RFC 5545 §3.6.1: an all-day event without DTEND lasts one day
  if (!end && start.allDay) end = addMs(start.value, true, 86400000);
  const recurrence = get("RECURRENCE-ID");
  const summary = get("SUMMARY");
  const description = get("DESCRIPTION");
  const sourceLine = [SOURCE_PROP, ...EARLIER_SOURCE_PROPS].map(get).find(Boolean);
  return {
    uid,
    recurrenceId: recurrence
      ? (fromIcsDate(recurrence.value, recurrence.params)?.value ?? recurrence.value)
      : undefined,
    title: summary ? unescapeText(summary.value) : "(No title)",
    allDay: start.allDay,
    start: start.value,
    end: end && end !== start.value ? end : undefined,
    recurring: Boolean(recurrence || get("RRULE") || get("RDATE")),
    description: description ? unescapeText(description.value) : undefined,
    source: sourceLine ? unescapeText(sourceLine.value) : undefined,
    location: get("LOCATION") ? unescapeText(get("LOCATION")?.value ?? "") : undefined,
    // an expanded instance of a repeating event carries RECURRENCE-ID and no RRULE (RFC 4791 §9.6.5)
    repeat: recurrence ? "custom" : repeatOf(get("RRULE")?.value),
    reminderMinutes: reminderOf(trigger),
  };
}

/** F-18b: RFC 5545 §3.6.6 display alarm, `minutes` before the start. */
function alarmLines(minutes: number, title: string): string[] {
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(title)}`,
    `TRIGGER:-PT${Math.max(0, Math.round(minutes))}M`,
    "END:VALARM",
  ];
}

/**
 * A new calendar object with one event, written by the product. F-23 (round 2): its PRODID (RFC 5545 §3.7.3, "the
 * identifier for the product that created the iCalendar object") is the product's name, from PRODUCT_NAME; it was
 * "-//Weblabs Studio//Calendar//EN".
 */
export function buildCalendar(input: IcsInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${PRODUCT_NAME}//Calendar//EN`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    stamp(),
    toIcsDate("CREATED", new Date().toISOString(), false),
    toIcsDate("DTSTART", input.start, input.allDay),
    ...(input.end ? [toIcsDate("DTEND", input.end, input.allDay)] : []),
    `SUMMARY:${escapeText(input.title)}`,
    ...(input.description ? [`DESCRIPTION:${escapeText(input.description)}`] : []),
    ...(input.location ? [`LOCATION:${escapeText(input.location)}`] : []),
    ...(input.repeat && input.repeat !== "none" && input.repeat !== "custom" ? [`RRULE:FREQ=${input.repeat}`] : []),
    ...(input.source ? [`${SOURCE_PROP}:${escapeText(input.source)}`] : []),
    ...(typeof input.reminderMinutes === "number" ? alarmLines(input.reminderMinutes, input.title) : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/**
 * The stored object with its (single, non-repeating) VEVENT changed: title, start and end. Every other property and
 * component is kept as it was; SEQUENCE goes up by one and DTSTAMP / LAST-MODIFIED are renewed (RFC 5545 §3.8.7).
 */
export function patchCalendar(
  ics: string,
  change: Pick<
    IcsInput,
    "title" | "allDay" | "start" | "end" | "description" | "location" | "repeat" | "reminderMinutes"
  >,
): string {
  const out: string[] = [];
  const stack: string[] = [];
  let sequence = -1;
  // F-18b: a field the page did not send (undefined) is kept as stored; a sent one replaces it ("" or null removes it)
  const replaced = ["DTSTART", "DTEND", "DURATION", "SUMMARY", "DTSTAMP", "LAST-MODIFIED"];
  if (change.description !== undefined) replaced.push("DESCRIPTION");
  if (change.location !== undefined) replaced.push("LOCATION");
  if (change.repeat !== undefined && change.repeat !== "custom") replaced.push("RRULE");
  const newAlarm = change.reminderMinutes !== undefined;
  for (const raw of unfold(ics)) {
    const line = parseLine(raw);
    if (line.name === "BEGIN") stack.push(line.value.toUpperCase());
    // F-18b: a new reminder replaces the event's alarms
    if (newAlarm && stack.includes("VEVENT") && stack.includes("VALARM")) {
      if (line.name === "END" && line.value.toUpperCase() === "VALARM") stack.pop();
      continue;
    }
    const inEvent = stack[stack.length - 1] === "VEVENT";
    if (line.name === "END" && line.value.toUpperCase() === "VEVENT") {
      out.push(toIcsDate("DTSTART", change.start, change.allDay));
      if (change.end) out.push(toIcsDate("DTEND", change.end, change.allDay));
      out.push(`SUMMARY:${escapeText(change.title)}`);
      if (change.description) out.push(`DESCRIPTION:${escapeText(change.description)}`);
      if (change.location) out.push(`LOCATION:${escapeText(change.location)}`);
      if (change.repeat && change.repeat !== "none" && change.repeat !== "custom")
        out.push(`RRULE:FREQ=${change.repeat}`);
      out.push(stamp());
      out.push(toIcsDate("LAST-MODIFIED", new Date().toISOString(), false));
      out.push(`SEQUENCE:${sequence + 1}`);
      if (typeof change.reminderMinutes === "number") out.push(...alarmLines(change.reminderMinutes, change.title));
    }
    if (line.name === "END") stack.pop();
    if (inEvent && line.name !== "BEGIN") {
      if (line.name === "SEQUENCE") {
        sequence = Number.parseInt(line.value, 10) || 0;
        continue;
      }
      if (replaced.includes(line.name)) continue;
    }
    out.push(raw);
  }
  return `${out.map(fold).join("\r\n")}\r\n`;
}

/** FREEBUSY periods of a free-busy-query answer (RFC 4791 §7.10), as UTC ISO start/end pairs. */
export function parseFreeBusy(ics: string): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  for (const raw of unfold(ics)) {
    const line = parseLine(raw);
    if (line.name !== "FREEBUSY" || (line.params.FBTYPE && line.params.FBTYPE !== "BUSY")) continue;
    for (const period of line.value.split(",")) {
      const [from, to] = period.split("/");
      const start = fromIcsDate(from, {});
      if (!start || !to) continue;
      const end = to.startsWith("P") || to.startsWith("-P") ? null : fromIcsDate(to, {});
      const ms = to.startsWith("P") ? durationMs(to) : null;
      out.push({ start: start.value, end: end ? end.value : addMs(start.value, false, ms ?? 0) });
    }
  }
  return out;
}
