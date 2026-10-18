// M129-G (Fahad 129.8, "الجاهز قبل البناء"): the Studio calendar's store is Davis (tchapi/davis 5.5.0, MIT), a CalDAV
// server on sabre/dav, running in colima "lab" on 127.0.0.1:3499 (/Users/ali/lobehub-hub/davis). Only this Next.js
// server talks to it, through tsdav (MIT) for CalDAV and Davis's own REST API for users and shares. Nothing is kept in
// the browser.
//
// People: every Studio employee who uses the calendar has a Davis account "studio-agent-<id>". Accounts are made with
// Davis's own dashboard form (the REST API cannot create users) the first time they are needed; their passwords are
// generated here and kept in /Users/ali/lobehub-hub/davis/studio-users.json (mode 600), never sent to a browser.
//
// Sharing, the four levels of Google Calendar (support.google.com/calendar/answer/37082):
//   details  "See all event details"            -> a Davis read-only share (Davis refuses writes: 403)
//   edit     "Make changes to events"           -> a Davis read-write share
//   manage   "Make changes and manage sharing"   -> a Davis read-write share; Studio also lets this person change who
//                                                  the calendar is shared with (Davis only lets the owner share)
//   freebusy "See only free/busy"                -> no Davis share at all; Studio shows this person the owner's busy
//                                                  times from a CalDAV free-busy-query (RFC 4791 §7.10), never titles
// Davis has read and read-write only (its share API: write_access true/false), so the two other levels are Studio's.
// The level of each person is kept on the owner's calendar in Davis itself, as a WebDAV property
// {urn:airest:calendar}share-levels (Davis stores such properties: sabre PropertyStorage plugin).
// F-23 (Fahad 15 Oct 15:20: "even the internal names all change to my name"): the namespace was the template's
// https://weblabs.studio/ns/calendar. Davis held no property under it when it changed (propertystorage: 0 rows).

import {
  createCalendarObject,
  type DAVCalendar,
  deleteCalendarObject,
  fetchCalendarObjects,
  getBasicAuthHeaders,
  makeCalendar,
  propfind,
  updateCalendarObject,
} from "tsdav";

import { PRODUCT_NAME } from "@/config/app-config";
import { readVaultSecret, resolveVaultFilePath } from "@/lib/system-vault";

import { buildCalendar, type IcsEvent, parseEvents, parseFreeBusy, patchCalendar, type Repeat } from "./ical";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";

export const DAVIS_URL = process.env.DAVIS_URL ?? "http://127.0.0.1:3499";
export const DAVIS_VERSION = "5.5.0";
const ENV_FILE = process.env.DAVIS_ENV_FILE ?? "/Users/ali/lobehub-hub/davis/.env";
const ENV_VAULT_NAMES = ["davis.env", "davis_env"] as const;
const API_KEY_VAULT_NAMES = ["davis_api_key", "DAVIS_API_KEY"] as const;
const USERS_FILE = process.env.DAVIS_USERS_FILE ?? "/Users/ali/lobehub-hub/davis/studio-users.json";
const LEVELS_PROP = "share-levels";
const OWN_NS = "urn:airest:calendar";

export class DavisError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ people -------------------------------------- */

export interface StudioPerson {
  id: number;
  name: string;
  email: string;
}

export const usernameOf = (personId: number) => `studio-agent-${personId}`;
export const personIdOf = (username: string) => {
  const m = username.match(/^studio-agent-(\d+)$/);
  return m ? Number(m[1]) : null;
};

/**
 * F-5B: Davis (sabre/dav) makes a calendar "default" with every account: the person's primary calendar. Like Google
 * Calendar ("you can't delete your primary calendar", support.google.com/calendar/answer/37188) and Outlook ("you can't
 * delete the primary calendar", support.microsoft.com/en-us/office/9ba1364c-bdb0-41be-8f66-eaf96698d021), Studio never
 * deletes it.
 */
export const PRIMARY_URI = "default";

/** The four fixed calendars of the old page (Work, Personal, Team, Focus time), made real for the first owner. */
export const SEED_CALENDARS = [
  { uri: "default", name: "Work", color: "#2563EB" },
  { uri: "personal", name: "Personal", color: "#7C3AED" },
  { uri: "team", name: "Team", color: "#BE185D" },
  { uri: "focus", name: "Focus time", color: "#475569" },
] as const;

/** Colours offered for a new calendar; each keeps white text at 4.5:1 or more (WCAG AA). */
export const CALENDAR_COLORS = ["#2563EB", "#7C3AED", "#BE185D", "#C2410C", "#0E7490", "#4D7C0F", "#B91C1C", "#475569"];

/* ------------------------------------------------------------------ secrets ------------------------------------- */

let cachedEnv: Record<string, string> | null = null;
async function davisEnv() {
  if (cachedEnv) return cachedEnv;
  const envPath = resolveVaultFilePath(ENV_VAULT_NAMES, ENV_FILE);
  let text: string;
  try {
    text = await readFile(envPath, "utf8");
  } catch {
    throw new DavisError("the calendar server settings file is not readable on this server", 500);
  }
  cachedEnv = Object.fromEntries(
    text
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
  const vaultApiKey = readVaultSecret(API_KEY_VAULT_NAMES);
  if (vaultApiKey) cachedEnv.API_KEY = vaultApiKey;
  return cachedEnv;
}

async function readPasswords(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(USERS_FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

async function savePassword(username: string, password: string) {
  const all = await readPasswords();
  all[username] = password;
  const tmp = `${USERS_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 1), { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, USERS_FILE);
}

/* ------------------------------------------------------------------ REST API ------------------------------------ */

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const env = await davisEnv();
  let response: Response;
  try {
    response = await fetch(`${DAVIS_URL}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: { "X-Davis-API-Token": env.API_KEY ?? "", "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new DavisError("The calendar server is not reachable", 503);
  }
  const json = (await response.json().catch(() => null)) as {
    status?: string;
    message?: string;
    data?: unknown;
  } | null;
  if (!response.ok || json?.status === "error")
    throw new DavisError(
      `Calendar server: ${json?.message ?? `HTTP ${response.status}`}`,
      response.status >= 500 ? 502 : 400,
    );
  return json?.data as T;
}

interface DavisUser {
  user_id: number;
  principal_id: number;
  uri: string;
  username: string;
}

interface DavisCalendarRow {
  id: number;
  uri: string;
  displayname: string;
}

const davisUsers = () => api<DavisUser[]>("/users");

async function davisUser(username: string) {
  return (await davisUsers()).find((user) => user.username === username) ?? null;
}

/* ------------------------------------------------------------------ dashboard (user accounts) ------------------- */

/** Davis's own admin dashboard, used for the one thing its API cannot do: create a user (or set a new password). */
async function dashboard() {
  const env = await davisEnv();
  const jar = new Map<string, string>();
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(DAVIS_URL + path, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      headers: {
        ...(init.headers as Record<string, string>),
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const eq = pair.indexOf("=");
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    return response;
  };
  const form = (fields: Record<string, string>) => ({
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const loginPage = await (await request("/login")).text();
  const csrf = loginPage.match(/name="_csrf_token" value="([^"]+)"/)?.[1];
  if (!csrf) throw new DavisError("The calendar server's sign-in page did not load");
  const login = await request(
    "/login",
    form({ _username: env.ADMIN_LOGIN ?? "", _password: env.ADMIN_PASSWORD ?? "", _csrf_token: csrf }),
  );
  if (login.status !== 302 || !login.headers.get("location")?.endsWith("/dashboard"))
    throw new DavisError(`The calendar server refused the ${PRODUCT_NAME} admin sign-in`);
  return {
    async saveUser(path: string, person: StudioPerson, username: string | null, password: string) {
      const page = await (await request(path)).text();
      const token = page.match(/name="user\[_token\]"[^>]*value="([^"]+)"/)?.[1];
      if (!token) throw new DavisError("The calendar server's user form did not load");
      const fields: Record<string, string> = {
        "user[displayName]": person.name,
        "user[email]": person.email,
        "user[password][first]": password,
        "user[password][second]": password,
        "user[_token]": token,
      };
      if (username) fields["user[username]"] = username;
      const saved = await request(path, form(fields));
      if (saved.status !== 302) throw new DavisError(`The calendar server did not save the account of ${person.name}`);
    },
  };
}

const userLocks = new Map<string, Promise<unknown>>();
/** One account change at a time per person, so two requests never create the same account twice. */
function oneAtATime<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(key) ?? Promise.resolve();
  const next = previous.then(work, work);
  userLocks.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

/**
 * The Davis account of a Studio person, made when first needed. The first time the page's own signed-in person gets
 * an account, the four calendars of the old page are made in it (Work, Personal, Team, Focus time).
 */
export function ensureAccount(person: StudioPerson, seed = false): Promise<{ username: string; userId: number }> {
  const username = usernameOf(person.id);
  return oneAtATime(username, async () => {
    const passwords = await readPasswords();
    const existing = await davisUser(username);
    if (existing && passwords[username]) return { username, userId: existing.user_id };
    const password = randomBytes(18).toString("base64url");
    const board = await dashboard();
    if (existing) {
      // the account is in Davis but its password is not on this server any more: give it a new one
      await board.saveUser(`/users/edit/${existing.user_id}`, person, null, password);
      await savePassword(username, password);
      return { username, userId: existing.user_id };
    }
    await board.saveUser("/users/new", person, username, password);
    await savePassword(username, password);
    const created = await davisUser(username);
    if (!created) throw new DavisError(`The calendar server did not create the account of ${person.name}`);
    // Davis names everyone's first calendar "Default Calendar"; like Google, it carries the person's name instead
    if (seed) await seedCalendars(username);
    else await setProps(username, `${homePath(username)}default/`, { "d:displayname": person.name });
    return { username, userId: created.user_id };
  });
}

async function seedCalendars(username: string) {
  for (const calendar of SEED_CALENDARS) {
    if (calendar.uri === "default") {
      // Davis makes a "Default Calendar" with every account; it becomes Work
      await setProps(username, `${homePath(username)}default/`, {
        "d:displayname": calendar.name,
        "ca:calendar-color": calendar.color,
      });
    } else {
      await createCalendarAt(username, calendar.uri, calendar.name, calendar.color);
    }
  }
}

/* ------------------------------------------------------------------ CalDAV -------------------------------------- */

const homePath = (username: string) => `/dav/calendars/${username}/`;

async function auth(username: string) {
  const password = (await readPasswords())[username];
  if (!password) throw new DavisError(`no calendar server password on this server for ${username}`, 500);
  return getBasicAuthHeaders({ username, password }) as Record<string, string>;
}

async function davFetch(username: string, path: string, init: { method: string; body?: string; depth?: string }) {
  try {
    return await fetch(DAVIS_URL + path, {
      method: init.method,
      headers: {
        ...(await auth(username)),
        "content-type": "application/xml; charset=utf-8",
        ...(init.depth ? { depth: init.depth } : {}),
      },
      body: init.body,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DavisError) throw error;
    throw new DavisError("The calendar server is not reachable", 503);
  }
}

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** PROPPATCH of a calendar's name, colour or Studio share levels. */
async function setProps(username: string, path: string, props: Record<string, string>) {
  const body =
    `<?xml version="1.0" encoding="utf-8"?><d:propertyupdate xmlns:d="DAV:" xmlns:ca="http://apple.com/ns/ical/" xmlns:w="${OWN_NS}"><d:set><d:prop>` +
    Object.entries(props)
      .map(([name, value]) => `<${name}>${xmlEscape(value)}</${name}>`)
      .join("") +
    "</d:prop></d:set></d:propertyupdate>";
  const response = await davFetch(username, path, { method: "PROPPATCH", body });
  const text = await response.text();
  if (response.status !== 207 || /HTTP\/1\.1 (4|5)\d\d/.test(text))
    throw new DavisError(`The calendar server did not save the calendar settings (${response.status})`);
}

/** Saves the Studio share levels on the owner's calendar; with nobody left, the property is removed. */
async function saveLevels(owner: string, path: string, levels: ShareLevels) {
  if (Object.keys(levels).length) {
    await setProps(owner, path, { [`w:${LEVELS_PROP}`]: JSON.stringify(levels) });
    return;
  }
  const body = `<?xml version="1.0" encoding="utf-8"?><d:propertyupdate xmlns:d="DAV:" xmlns:w="${OWN_NS}"><d:remove><d:prop><w:${LEVELS_PROP}/></d:prop></d:remove></d:propertyupdate>`;
  const response = await davFetch(owner, path, { method: "PROPPATCH", body });
  const text = await response.text();
  if (response.status !== 207 || /HTTP\/1\.1 (4|5)\d\d/.test(text))
    throw new DavisError(`The calendar server did not save the calendar settings (${response.status})`);
}

async function createCalendarAt(username: string, uri: string, name: string, color: string) {
  const responses = await makeCalendar({
    url: `${DAVIS_URL}${homePath(username)}${uri}/`,
    props: {
      "d:displayname": name,
      "ca:calendar-color": color,
      "c:supported-calendar-component-set": { "c:comp": { _attributes: { name: "VEVENT" } } },
    },
    headers: await auth(username),
  });
  const failed = responses.find((r) => !r.ok && r.status !== 201);
  if (failed)
    throw new DavisError(`The calendar server did not create the calendar (${failed.status} ${failed.statusText})`);
}

interface HomeCalendar {
  path: string;
  uri: string;
  name: string;
  color: string;
  /** owner | read | read-write, from {DAV:}share-access */
  davisAccess: "owner" | "read" | "read-write";
  /** For a calendar shared with this person: the owner's principal ("studio-agent-1"). */
  organizer: string | null;
  levels: ShareLevels;
}

type ShareLevels = Record<string, { level: ShareLevel; instance?: string }>;

const textOf = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("_text" in record) return textOf(record._text);
    if ("_cdata" in record) return textOf(record._cdata);
  }
  return "";
};

/** The calendars in a person's Davis home: their own, and those shared with them (PROPFIND, depth 1). */
async function homeCalendars(username: string): Promise<HomeCalendar[]> {
  let responses: Awaited<ReturnType<typeof propfind>>;
  try {
    responses = await propfind({
      url: `${DAVIS_URL}${homePath(username)}`,
      props: {
        "d:displayname": {},
        "ca:calendar-color": {},
        "d:resourcetype": {},
        "d:share-access": {},
        "cs:invite": {},
        "c:supported-calendar-component-set": {},
        [`w:${LEVELS_PROP}`]: { _attributes: { "xmlns:w": OWN_NS } },
      },
      depth: "1",
      headers: await auth(username),
    });
  } catch (error) {
    if (error instanceof DavisError) throw error;
    throw new DavisError("The calendar server is not reachable", 503);
  }
  const out: HomeCalendar[] = [];
  for (const response of responses) {
    const props = (response.props ?? {}) as Record<string, unknown>;
    const types = Object.keys((props.resourcetype as object) ?? {});
    if (!types.includes("calendar")) continue;
    const comps = JSON.stringify(props.supportedCalendarComponentSet ?? "");
    if (comps.includes("name") && !comps.includes("VEVENT")) continue; // a tasks-only list
    const href = response.href ?? "";
    const path = new URL(href, DAVIS_URL).pathname;
    const uri = decodeURIComponent(path.replace(/\/$/, "").split("/").pop() ?? "");
    const access = Object.keys((props.shareAccess as object) ?? {});
    const davisAccess = access.includes("readWrite") ? "read-write" : access.includes("read") ? "read" : "owner";
    const organizerHref = textOf(
      ((props.invite as Record<string, unknown> | undefined)?.organizer as Record<string, unknown> | undefined)?.href,
    );
    let levels: ShareLevels = {};
    try {
      const raw = textOf(props[LEVELS_PROP.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())]);
      if (raw) levels = JSON.parse(raw) as ShareLevels;
    } catch {
      levels = {};
    }
    out.push({
      path: path.endsWith("/") ? path : `${path}/`,
      uri,
      name: textOf(props.displayname) || uri,
      color: textOf(props.calendarColor).slice(0, 7) || "#2563EB",
      davisAccess,
      organizer: davisAccess === "owner" ? null : (organizerHref.replace(/\/$/, "").split("/").pop() ?? null),
      levels,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ the calendars a person sees ------------------ */

export type ShareLevel = "freebusy" | "details" | "edit" | "manage";
export type CalendarAccess = "owner" | ShareLevel;

export const SHARE_LEVELS: { value: ShareLevel; label: string; where: string }[] = [
  {
    value: "freebusy",
    label: "See only free/busy",
    where: `Applied by ${PRODUCT_NAME}: the calendar server gets no share, and ${PRODUCT_NAME} shows only busy times (a free-busy query).`,
  },
  { value: "details", label: "See all event details", where: "A read-only share on the calendar server." },
  { value: "edit", label: "Make changes to events", where: "A read-write share on the calendar server." },
  {
    value: "manage",
    label: "Make changes and manage sharing",
    where: `A read-write share on the calendar server, and ${PRODUCT_NAME} lets this person change the sharing.`,
  },
];

export interface StudioCalendar {
  /** `${ownerUsername}/${ownerUri}`: the owner's calendar, the same for everyone who sees it. */
  id: string;
  name: string;
  color: string;
  owner: { username: string; personId: number | null };
  access: CalendarAccess;
  canEdit: boolean;
  canShare: boolean;
  /** F-5B: the owner's primary calendar (Davis's "default"); it cannot be deleted, as in Google Calendar and Outlook. */
  primary: boolean;
  /** Where this viewer reads and writes it in Davis (their own copy of a shared calendar); none for free/busy. */
  path: string | null;
}

export interface StudioEvent {
  id: string;
  calendarId: string;
  /** Davis object path and its ETag (an edit is refused when the object changed since: If-Match, RFC 7232). */
  href: string;
  etag: string;
  title: string;
  allDay: boolean;
  start: string;
  end?: string;
  recurring: boolean;
  editable: boolean;
  /** Free/busy level: only the busy time is known. */
  busyOnly: boolean;
  source?: string;
  /** F-18b: place, notes, repeat rule and reminder (lib/davis/ical.ts); not given for free/busy blocks. */
  location?: string;
  description?: string;
  repeat?: string;
  reminderMinutes?: number | null;
}

const calendarId = (owner: string, uri: string) => `${owner}/${uri}`;

/** Every Studio account in Davis (the calendars of others are scanned for free/busy shares to the viewer). */
async function studioUsernames(): Promise<string[]> {
  const [users, passwords] = await Promise.all([davisUsers(), readPasswords()]);
  return users.map((u) => u.username).filter((name) => personIdOf(name) !== null && passwords[name]);
}

export async function calendarsFor(viewer: string): Promise<StudioCalendar[]> {
  const mine = await homeCalendars(viewer);
  const out: StudioCalendar[] = [];
  const others = (await studioUsernames()).filter((name) => name !== viewer);
  const otherHomes = new Map<string, HomeCalendar[]>();
  await Promise.all(
    others.map(async (name) => {
      otherHomes.set(name, await homeCalendars(name).catch(() => []));
    }),
  );

  for (const cal of mine) {
    if (cal.davisAccess === "owner") {
      out.push({
        id: calendarId(viewer, cal.uri),
        name: cal.name,
        color: cal.color,
        owner: { username: viewer, personId: personIdOf(viewer) },
        access: "owner",
        canEdit: true,
        canShare: true,
        primary: cal.uri === PRIMARY_URI,
        path: cal.path,
      });
      continue;
    }
    const owner = cal.organizer ?? "";
    const ownerCals = (otherHomes.get(owner) ?? []).filter((c) => c.davisAccess === "owner");
    const source =
      ownerCals.find((c) => c.levels[viewer]?.instance === cal.uri) ??
      ownerCals.find((c) => c.name === cal.name && !c.levels[viewer]?.instance);
    const studioLevel = source?.levels[viewer]?.level;
    const access: CalendarAccess =
      cal.davisAccess === "read" ? "details" : studioLevel === "manage" ? "manage" : "edit";
    out.push({
      id: source ? calendarId(owner, source.uri) : calendarId(viewer, cal.uri),
      name: cal.name,
      color: cal.color,
      owner: { username: owner, personId: personIdOf(owner) },
      access,
      canEdit: cal.davisAccess === "read-write",
      canShare: access === "manage" && Boolean(source),
      primary: source?.uri === PRIMARY_URI,
      path: cal.path,
    });
  }
  for (const [owner, cals] of otherHomes) {
    for (const cal of cals) {
      if (cal.davisAccess !== "owner" || cal.levels[viewer]?.level !== "freebusy") continue;
      out.push({
        id: calendarId(owner, cal.uri),
        name: cal.name,
        color: cal.color,
        owner: { username: owner, personId: personIdOf(owner) },
        access: "freebusy",
        canEdit: false,
        canShare: false,
        primary: cal.uri === PRIMARY_URI,
        path: null,
      });
    }
  }
  return out;
}

async function calendarFor(viewer: string, id: string) {
  const calendar = (await calendarsFor(viewer)).find((c) => c.id === id);
  if (!calendar) throw new DavisError("this calendar is not shared with you", 404);
  return calendar;
}

const davCalendar = (path: string): DAVCalendar => ({ url: `${DAVIS_URL}${path}` });

function toStudioEvent(calendar: StudioCalendar, href: string, etag: string, event: IcsEvent): StudioEvent {
  return {
    id: `${calendar.id}|${href}${event.recurrenceId ? `|${event.recurrenceId}` : ""}`,
    calendarId: calendar.id,
    href,
    etag,
    title: event.title,
    allDay: event.allDay,
    start: event.start,
    end: event.end,
    recurring: event.recurring,
    editable: calendar.canEdit && !event.recurring,
    busyOnly: false,
    source: event.source,
    location: event.location,
    description: event.description,
    repeat: event.repeat,
    reminderMinutes: event.reminderMinutes ?? null,
  };
}

export async function eventsFor(viewer: string, calendars: StudioCalendar[], start: string, end: string) {
  const headers = await auth(viewer);
  const lists = await Promise.all(
    calendars.map(async (calendar): Promise<StudioEvent[]> => {
      if (calendar.access === "freebusy") return busyTimes(calendar, start, end);
      if (!calendar.path) return [];
      const objects = await fetchCalendarObjects({
        calendar: davCalendar(calendar.path),
        timeRange: { start, end },
        expand: true,
        headers,
      });
      // F-18b: an expanded date of a repeating event has no RRULE (RFC 4791 §9.6.5), so its rule ("Every week") is
      // read from the stored, unexpanded object, one multiget for all the repeating objects of this calendar
      const repeating = objects.filter((object) => /RECURRENCE-ID/.test(String(object.data ?? ""))).map((o) => o.url);
      const rules = new Map<string, Repeat>();
      if (repeating.length) {
        const stored = await fetchCalendarObjects({
          calendar: davCalendar(calendar.path),
          objectUrls: [...new Set(repeating)],
          headers,
        });
        for (const object of stored) {
          const master = parseEvents(String(object.data ?? "")).find((event) => !event.recurrenceId);
          if (master?.repeat) rules.set(new URL(object.url).pathname, master.repeat);
        }
      }
      return objects.flatMap((object) => {
        const href = new URL(object.url).pathname;
        return parseEvents(String(object.data ?? "")).map((event) =>
          toStudioEvent(calendar, href, object.etag ?? "", { ...event, repeat: rules.get(href) ?? event.repeat }),
        );
      });
    }),
  );
  return lists.flat();
}

/** Free/busy level: the owner's busy times, read with the owner's account; no title or detail leaves Davis. */
async function busyTimes(calendar: StudioCalendar, start: string, end: string): Promise<StudioEvent[]> {
  const owner = calendar.owner.username;
  const uri = calendar.id.slice(owner.length + 1);
  const stampOf = (iso: string) => `${new Date(iso).toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  const response = await davFetch(owner, `${homePath(owner)}${uri}/`, {
    method: "REPORT",
    depth: "1",
    body: `<?xml version="1.0" encoding="utf-8"?><c:free-busy-query xmlns:c="urn:ietf:params:xml:ns:caldav"><c:time-range start="${stampOf(start)}" end="${stampOf(end)}"/></c:free-busy-query>`,
  });
  if (!response.ok) throw new DavisError(`The calendar server's free/busy query failed (${response.status})`);
  return parseFreeBusy(await response.text()).map((period, index) => ({
    id: `${calendar.id}|busy|${index}|${period.start}`,
    calendarId: calendar.id,
    href: "",
    etag: "",
    title: "Busy",
    allDay: false,
    start: period.start,
    end: period.end,
    recurring: false,
    editable: false,
    busyOnly: true,
  }));
}

/* ------------------------------------------------------------------ event writes -------------------------------- */

export interface EventInput {
  title: string;
  allDay: boolean;
  start: string;
  end?: string;
  description?: string;
  source?: string;
  /** F-18b: written only when given (an edit keeps what is stored otherwise). */
  location?: string;
  repeat?: Repeat;
  reminderMinutes?: number | null;
}

function writable(calendar: StudioCalendar) {
  if (!calendar.canEdit || !calendar.path)
    throw new DavisError(`you can only view “${calendar.name}”, not change it`, 403);
  return calendar.path;
}

async function davisWrite(response: Response, what: string) {
  if (response.status === 412)
    throw new DavisError("This event was changed somewhere else since you opened it. Reload to see it.", 409);
  if (response.status === 403) throw new DavisError(`The calendar server refused to ${what}: no write access`, 403);
  if (!response.ok) throw new DavisError(`The calendar server did not ${what} (${response.status})`);
}

export async function createEvent(viewer: string, id: string, input: EventInput) {
  const calendar = await calendarFor(viewer, id);
  const path = writable(calendar);
  const uid = randomUUID();
  const response = await createCalendarObject({
    calendar: davCalendar(path),
    filename: `${uid}.ics`,
    iCalString: buildCalendar({ uid, ...input }),
    headers: await auth(viewer),
  });
  await davisWrite(response, "save the event");
  return { calendarId: calendar.id, href: `${path}${uid}.ics`, uid };
}

/** The stored object (not expanded), checked to be inside the viewer's copy of the calendar. */
async function storedObject(viewer: string, path: string, href: string) {
  if (!href.startsWith(path) || href.includes("..") || !href.endsWith(".ics"))
    throw new DavisError("that event is not in this calendar", 400);
  const [object] = await fetchCalendarObjects({
    calendar: davCalendar(path),
    objectUrls: [`${DAVIS_URL}${href}`],
    headers: await auth(viewer),
  });
  if (!object?.data)
    throw new DavisError("This event is no longer on the calendar server. Reload to see the calendar.", 409);
  return object;
}

export async function updateEvent(
  viewer: string,
  id: string,
  href: string,
  etag: string,
  input: EventInput,
  moveTo?: string,
) {
  const calendar = await calendarFor(viewer, id);
  const path = writable(calendar);
  const object = await storedObject(viewer, path, href);
  if (etag && object.etag && object.etag !== etag)
    throw new DavisError("This event was changed somewhere else since you opened it. Reload to see it.", 409);
  const events = parseEvents(String(object.data));
  if (events.length !== 1 || events[0].recurring)
    throw new DavisError("This is a repeating event. Repeating events cannot be changed on this page yet.", 400);
  const data = patchCalendar(String(object.data), input);
  if (moveTo && moveTo !== calendar.id) {
    const target = await calendarFor(viewer, moveTo);
    const targetPath = writable(target);
    const file = href.split("/").pop() ?? `${randomUUID()}.ics`;
    const created = await createCalendarObject({
      calendar: davCalendar(targetPath),
      filename: file,
      iCalString: data,
      headers: await auth(viewer),
    });
    await davisWrite(created, "move the event");
    const removed = await deleteCalendarObject({
      calendarObject: { url: `${DAVIS_URL}${href}`, etag: object.etag },
      headers: await auth(viewer),
    });
    await davisWrite(removed, "move the event");
    return { calendarId: target.id, href: `${targetPath}${file}` };
  }
  const response = await updateCalendarObject({
    calendarObject: { url: `${DAVIS_URL}${href}`, etag: etag || object.etag, data },
    headers: await auth(viewer),
  });
  await davisWrite(response, "save the event");
  return { calendarId: calendar.id, href };
}

export async function deleteEvent(viewer: string, id: string, href: string, etag: string) {
  const calendar = await calendarFor(viewer, id);
  const path = writable(calendar);
  if (!href.startsWith(path) || href.includes("..")) throw new DavisError("that event is not in this calendar", 400);
  const response = await deleteCalendarObject({
    calendarObject: { url: `${DAVIS_URL}${href}`, etag: etag || undefined },
    headers: await auth(viewer),
  });
  if (response.status === 404) return;
  await davisWrite(response, "delete the event");
}

/* ------------------------------------------------------------------ calendars and sharing ------------------------ */

export const NAME_MAX = 64;

/**
 * A new calendar owned by the viewer. Made over CalDAV (MKCALENDAR, RFC 4791 §5.3.1), not Davis's REST API: the API
 * accepts only /^[a-zA-Z0-9 ._-]{1,64}$/ names and refuses Arabic ones, CalDAV stores any name.
 */
export async function createCalendar(viewer: string, name: string, color: string) {
  const uri = `cal-${randomBytes(5).toString("hex")}`;
  await createCalendarAt(viewer, uri, name, color);
  return calendarId(viewer, uri);
}

/**
 * F-5B "Delete calendar", for its owner only. A CalDAV DELETE of the calendar collection, sent with the owner's own
 * account (Davis checks the right to delete too): a DELETE on a collection deletes it and every member in it (RFC 4918
 * §9.6.1, www.rfc-editor.org/rfc/rfc4918#section-9.6.1), so all its events go with it. Davis (sabre/dav 4.7.1,
 * CalDAV\Backend\PDO::deleteCalendar) then removes the calendar, its events and the copies shared with others, and its
 * stored properties (PropertyStorage afterUnbind: the Studio share levels). Refused: a calendar the viewer does not own,
 * their primary calendar, and their last calendar. The calendar list is read again afterwards (PROPFIND) to be sure the
 * calendar is gone before success is reported.
 */
export async function deleteCalendar(viewer: string, id: string) {
  const calendar = await calendarFor(viewer, id).catch((error: unknown) => {
    if (error instanceof DavisError && error.status === 404 && id.startsWith(`${viewer}/`))
      throw new DavisError("This calendar is not on the calendar server any more. Reload to see your calendars.", 404);
    throw error;
  });
  if (calendar.access !== "owner" || calendar.owner.username !== viewer || !calendar.path)
    throw new DavisError(`only the owner of “${calendar.name}” can delete it`, 403);
  const uri = calendar.id.slice(viewer.length + 1);
  if (uri === PRIMARY_URI)
    throw new DavisError(
      `“${calendar.name}” is your primary calendar. It cannot be deleted, as in Google Calendar and Outlook; you can delete its events instead.`,
      409,
    );
  const owned = (await homeCalendars(viewer)).filter((c) => c.davisAccess === "owner");
  if (owned.length <= 1) throw new DavisError(`“${calendar.name}” is your last calendar. It cannot be deleted.`, 409);
  // how many events go with it (Depth 1 lists the calendar's objects)
  const listing = await davFetch(viewer, calendar.path, {
    method: "PROPFIND",
    depth: "1",
    body: `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>`,
  });
  const events = listing.status === 207 ? ((await listing.text()).match(/\.ics<\/(?:\w+:)?href>/g) ?? []).length : null;
  const response = await davFetch(viewer, calendar.path, { method: "DELETE" });
  if (response.status !== 204 && response.status !== 200) {
    const text = await response.text().catch(() => "");
    const said = text.match(/<s:message>([\s\S]*?)<\/s:message>/)?.[1]?.trim();
    throw new DavisError(
      `The calendar server did not delete “${calendar.name}” (HTTP ${response.status}${said ? `: ${said}` : ""})`,
      response.status === 403 ? 403 : 502,
    );
  }
  if ((await homeCalendars(viewer)).some((c) => c.path === calendar.path))
    throw new DavisError(`The calendar server answered ${response.status}, but “${calendar.name}” is still on it`, 502);
  return { id: calendar.id, name: calendar.name, events, davisStatus: response.status };
}

async function ownerCalendar(id: string) {
  const owner = id.slice(0, id.indexOf("/"));
  const uri = id.slice(id.indexOf("/") + 1);
  const cal = (await homeCalendars(owner)).find((c) => c.uri === uri && c.davisAccess === "owner");
  if (!cal) throw new DavisError("calendar not found", 404);
  const ownerUser = await davisUser(owner);
  const row = ownerUser
    ? (await api<{ user_calendars: DavisCalendarRow[] }>(`/calendars/${ownerUser.user_id}`)).user_calendars.find(
        (c) => c.uri === uri,
      )
    : undefined;
  if (!ownerUser || !row) throw new DavisError("calendar not found on the calendar server", 404);
  return { owner, ownerUserId: ownerUser.user_id, instanceId: row.id, cal };
}

export interface CalendarShare {
  personId: number;
  username: string;
  level: ShareLevel;
  /** What Davis itself holds for this person: "read", "read-write" or "none" (free/busy). */
  davis: "read" | "read-write" | "none";
}

export async function sharesOf(viewer: string, id: string): Promise<CalendarShare[]> {
  const calendar = await calendarFor(viewer, id);
  if (!calendar.canShare) throw new DavisError("you cannot see or change who this calendar is shared with", 403);
  const { ownerUserId, instanceId, cal } = await ownerCalendar(calendar.id);
  const davisShares = await api<{ username: string; write_access: boolean }[]>(
    `/calendars/${ownerUserId}/shares/${instanceId}`,
  );
  const out: CalendarShare[] = [];
  for (const share of davisShares) {
    const personId = personIdOf(share.username);
    if (personId === null) continue;
    const studio = cal.levels[share.username]?.level;
    out.push({
      personId,
      username: share.username,
      level: share.write_access ? (studio === "manage" ? "manage" : "edit") : "details",
      davis: share.write_access ? "read-write" : "read",
    });
  }
  for (const [username, entry] of Object.entries(cal.levels)) {
    const personId = personIdOf(username);
    if (entry.level === "freebusy" && personId !== null && !out.some((s) => s.username === username))
      out.push({ personId, username, level: "freebusy", davis: "none" });
  }
  return out.sort((a, b) => a.personId - b.personId);
}

async function sharedInstanceUri(username: string, owner: string, name: string, before: Set<string>) {
  const calendars = await homeCalendars(username);
  const fresh = calendars.filter((c) => c.davisAccess !== "owner" && c.organizer === owner && !before.has(c.uri));
  return (fresh.find((c) => c.name === name) ?? fresh[0])?.uri;
}

export async function setShare(viewer: string, id: string, person: StudioPerson, level: ShareLevel) {
  const calendar = await calendarFor(viewer, id);
  if (!calendar.canShare) throw new DavisError("you cannot change who this calendar is shared with", 403);
  const { owner, ownerUserId, instanceId, cal } = await ownerCalendar(calendar.id);
  const { username } = await ensureAccount(person);
  if (username === owner) throw new DavisError("a calendar cannot be shared with its owner", 400);
  const levels: ShareLevels = { ...cal.levels };
  if (level === "freebusy") {
    // no Davis share: a Davis read share would let a calendar app read every title
    await api(`/calendars/${ownerUserId}/share/${instanceId}/remove`, { method: "POST", body: { username } }).catch(
      () => undefined,
    );
    levels[username] = { level };
  } else {
    const before = new Set((await homeCalendars(username)).map((c) => c.uri));
    await api(`/calendars/${ownerUserId}/share/${instanceId}/add`, {
      method: "POST",
      body: { username, write_access: level !== "details" },
    });
    const instance = levels[username]?.instance ?? (await sharedInstanceUri(username, owner, cal.name, before));
    levels[username] = { level, ...(instance ? { instance } : {}) };
  }
  await saveLevels(owner, cal.path, levels);
}

export async function removeShare(viewer: string, id: string, personId: number) {
  const calendar = await calendarFor(viewer, id);
  if (!calendar.canShare) throw new DavisError("you cannot change who this calendar is shared with", 403);
  const { owner, ownerUserId, instanceId, cal } = await ownerCalendar(calendar.id);
  const username = usernameOf(personId);
  if (username === owner) throw new DavisError("the owner cannot be removed", 400);
  const levels: ShareLevels = { ...cal.levels };
  const wasDavis = levels[username]?.level !== "freebusy";
  if (wasDavis)
    await api(`/calendars/${ownerUserId}/share/${instanceId}/remove`, { method: "POST", body: { username } }).catch(
      (error: unknown) => {
        if (!(error instanceof DavisError) || error.status !== 400) throw error;
      },
    );
  delete levels[username];
  await saveLevels(owner, cal.path, levels);
}

/** The Studio people who have a Davis account made by this server. */
export async function accountPersonIds(): Promise<number[]> {
  return Object.keys(await readPasswords())
    .map(personIdOf)
    .filter((id): id is number => id !== null);
}

/** Davis answers (health endpoint). */
export async function davisHealth() {
  try {
    const response = await fetch(`${DAVIS_URL}/api/v1/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}
