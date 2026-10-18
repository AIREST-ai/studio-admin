// M129-B (items 129.1, 129.2): the Studio simulator. It plays a whole flow on a made-up conversation, one per
// channel: what would be sent and when (the clock moves forward for every wait), which way each branch goes, what
// each action changes, and every attachment checked against that channel's rules (media.ts). It also says what the
// flow still lacks before it can run (checkSimFlow). Plain functions, no React and no network: nothing is sent,
// nothing is called, and no real conversation changes. Chatwoot's own conditions are read with the same SQL reading
// the dry run always used (chatwoot.ts evaluate), so a Chatwoot rule behaves here as Chatwoot would run it.

import { CALENDAR_ACTION, eventFromSpec, specOf, whenText } from "./calendar-event";
import {
  type Action,
  actionDefs,
  actionError,
  attributeDefs,
  type Condition,
  conditionError,
  durationText,
  eventLabels,
  explanation,
  minutesPer,
} from "./catalog";
import {
  evaluate,
  type IdDirectory,
  type SampleConversation,
  type SampleMessage,
  toChatwootConditions,
} from "./chatwoot";
import { checkMedia, formatBytes } from "./media";
import {
  EXIT_LABELS,
  exitsOf,
  type FlowDoc,
  type FlowNode,
  type FlowRecord,
  type Handle,
  type SimChannel,
} from "./model";
import {
  ASK_MAX_MINUTES,
  baseEvent,
  CHANNELS,
  DELAY_MAX_SECONDS,
  eventCarriesMessage,
  isSimEvent,
  SIM_CHANNELS,
  SIM_EVENTS,
  SOURCES,
  type Source,
  stepTitles,
  unitSeconds,
} from "./sim-catalog";
import { contactFieldsFor, fillTemplate, missingVariables, type TemplateAction, variableLines } from "./template-vars";
import {
  invoiceLine,
  invoiceSpecOf,
  kindOfAction,
  notifyLine,
  notifySpecOf,
  taskLine,
  taskSpecOf,
  type WorkKind,
} from "./work-actions";

// ------------------------------------------------------------------------------------------------- inputs

export interface DayHours {
  day: string;
  open: boolean;
  allDay: boolean;
  from: string;
  to: string;
}

export interface BusinessHours {
  enabled: boolean;
  timezone: string;
  days: DayHours[];
}

export interface SimFolder {
  id: string;
  name: string;
  filters: { attribute: string; operator: string; value: string; join: "and" | "or" }[];
}

export interface SimContext {
  ids: IdDirectory;
  agents: { name: string; availability: string }[];
  /** The Business Hours saved for an inbox (Settings > Inboxes), or null when the inbox is unknown. */
  hoursOf: (inbox: string) => BusinessHours | null;
  folders: SimFolder[];
  /** The saved flows, for "Go to another flow". */
  flows: FlowRecord[];
  /** This flow's own id and name (it may not be saved yet). */
  flowId: string;
  flowName: string;
  /** Approved message templates that may be sent. */
  templates: string[];
  /** F-3: their text, so the step fills its {{n}} from the contact (template-vars.ts). */
  templateBodies?: Record<string, string>;
}

export interface SimScenario {
  /** When the trigger fires. */
  start: Date;
  contact: "new" | "returning";
  /** The contact already ran this flow before (what "Once per contact" checks). */
  ranBefore: boolean;
  replies: "reply" | "silent";
  replyText: string;
  replyAfterSeconds: number;
  split: "random" | "a" | "b";
  seed: number;
  /** What happens while a Chatwoot wait (a rule that runs after a wait) is counting. */
  duringWait: "nothing" | "customer_replies" | "teammate_replies" | "status_changes";
  /** The customer's message that started it (events that carry one). */
  messageText: string;
  /** For events without a message: how long ago the customer last wrote (reply windows count from it). */
  lastMessageHoursAgo: number;
  /** Labels already on the made-up conversation. */
  labels: string[];
  /** A simulated outside event: which one (e.g. "Shipped"). */
  eventDetail: string;
  /** Status of the made-up conversation when the trigger fires. */
  status: SampleConversation["status"];
  /** F-11 (item 87): a teammate steps in: replies so the customer sees it, or takes the conversation (assigned). */
  handoff: "none" | "agent_replied" | "agent_assigned";
  /** Seconds after the trigger fires. */
  handoffAfterSeconds: number;
}

export function defaultScenario(doc: FlowDoc, start = new Date()): SimScenario {
  const trigger = doc.nodes.find((node) => node.kind === "trigger");
  const event = trigger?.kind === "trigger" ? trigger.event : "message_created";
  const details = isSimEvent(event) ? SIM_EVENTS[event].details : undefined;
  // a rule that waits while a conversation stays in a status starts with a conversation in that status
  const statusWait = doc.nodes.find((node) => node.kind === "wait" && node.wait.trigger === "conversation_status");
  const status = (statusWait?.kind === "wait" ? statusWait.wait.status.toLowerCase() : "open") as SimScenario["status"];
  return {
    start,
    contact: "new",
    ranBefore: false,
    replies: "reply",
    replyText: "Yes",
    replyAfterSeconds: 60,
    split: "random",
    seed: 1,
    duringWait: "nothing",
    messageText: "Hi, do you have any offer or discount this week?",
    lastMessageHoursAgo: 1,
    labels: [],
    eventDetail: (trigger?.kind === "trigger" && trigger.detail) || details?.[0] || "",
    status: ["open", "pending", "snoozed", "resolved"].includes(status) ? status : "open",
    handoff: "none",
    handoffAfterSeconds: 300,
  };
}

// ------------------------------------------------------------------------------------------------- outputs

export type SimLevel = "info" | "send" | "ok" | "warning" | "error";

export interface SimStep {
  /** Seconds after the trigger fired. */
  at: number;
  level: SimLevel;
  nodeId: string | null;
  /** Step title on the canvas ("Ask 1"); for another flow, prefixed with its name. */
  step: string;
  title: string;
  detail?: string;
  source?: Source;
  /** M129-G: a "Create calendar event" step: its values and when it ran (ms), for the dry run's "Create in Davis". */
  calendarAction?: { values: string[]; at: number };
  /** F-11: a task, draft invoice or notification step: its values and when it ran (ms), for the dry run's button. */
  work?: { kind: WorkKind; values: string[]; at: number };
}

export interface SimRun {
  channel: SimChannel;
  steps: SimStep[];
  sends: number;
  errors: number;
  warnings: number;
  /** One line: how the run ended. */
  outcome: string;
}

export function formatOffset(seconds: number): string {
  if (seconds < 60) return `+${Math.round(seconds)} s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  const parts = [
    days ? `${days} d` : "",
    hours ? `${hours} h` : "",
    minutes ? `${minutes} min` : "",
    secs && !days ? `${secs} s` : "",
  ];
  return `+${parts.filter(Boolean).join(" ")}`;
}

// ------------------------------------------------------------------------------------------------- helpers

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A small seeded random number (mulberry32): the same seed always picks the same paths. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weekday and HH:MM of an instant in a timezone. */
export function wallClock(at: Date, timezone: string): { day: string; time: string; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: get("weekday"),
    time: `${get("hour")}:${get("minute")}`,
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export function withinHours(hours: BusinessHours, at: Date): boolean {
  // Chatwoot: with working hours turned off an inbox is never "out of office"
  if (!hours.enabled) return true;
  const clock = wallClock(at, hours.timezone);
  const day = hours.days.find((d) => d.day === clock.day);
  if (!day?.open) return false;
  if (day.allDay) return true;
  return clock.time >= day.from && clock.time < day.to;
}

/** The instant a wall-clock date and time happens in a timezone. */
export function zonedInstant(date: string, time: string, timezone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  // correct for the zone's offset at that moment (twice, for a change of offset in between)
  let at = guess;
  for (let i = 0; i < 2; i++) {
    const wall = wallClock(new Date(at), timezone);
    const wm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wall.date);
    const wt = /^(\d{2}):(\d{2})$/.exec(wall.time);
    if (!wm || !wt) return null;
    const shown = Date.UTC(+wm[1], +wm[2] - 1, +wm[3], +wt[1], +wt[2]);
    at += guess - shown;
  }
  return new Date(at);
}

export function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return !!timezone;
  } catch {
    return false;
  }
}

/** The first run of a schedule at or after `from`, or null when it never runs again. */
export function nextRun(
  schedule: NonNullable<Extract<FlowNode, { kind: "trigger" }>["schedule"]>,
  from: Date,
): Date | null {
  if (!validTimezone(schedule.timezone)) return null;
  const first = zonedInstant(schedule.date, schedule.time, schedule.timezone);
  if (!first) return null;
  if (schedule.mode === "once") return first >= from ? first : null;
  // walk day by day (at most 400 days) from the later of the start date and today, at the set time
  const startDay = first > from ? schedule.date : wallClock(from, schedule.timezone).date;
  const [y, mo, d] = startDay.split("-").map(Number);
  const dayOfMonth = Number(schedule.date.slice(8, 10));
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(y, mo - 1, d + i));
    const iso = day.toISOString().slice(0, 10);
    const at = zonedInstant(iso, schedule.time, schedule.timezone);
    if (!at || at < from || at < first) continue;
    const weekday = day.getUTCDay();
    if (schedule.mode === "weekly" && !schedule.weekdays.includes(weekday)) continue;
    if (schedule.mode === "monthly" && day.getUTCDate() !== dayOfMonth) continue;
    return at;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------- the made-up conversation

const CONTACT_FIELD_DEFAULTS: Record<string, string> = {
  name: "Sara (made-up contact)",
  preferred_language: "Arabic",
};

function sampleFor(
  channel: SimChannel,
  scenario: SimScenario,
  ctx: SimContext,
  withMessage: boolean,
): SampleConversation {
  const inbox = CHANNELS[channel].inbox;
  const message: SampleMessage = { message_type: "incoming", private: false, content: scenario.messageText };
  return {
    id: 9100 + SIM_CHANNELS.indexOf(channel),
    title: `Made-up ${CHANNELS[channel].label} conversation`,
    status: scenario.status,
    inbox_id: inbox ? (ctx.ids.inbox(inbox) ?? 0) : 0,
    assignee_id: null,
    assignee_agent_bot_id: null,
    team_id: null,
    priority: null,
    labels: [...scenario.labels],
    additional_attributes: { browser_language: "ar", conversation_language: "ar" },
    custom_attributes: {},
    contact: {
      email: channel === "email" ? "sara@example.com" : null,
      phone_number: channel === "whatsapp" || channel === "telegram" ? "+966500000000" : null,
      additional_attributes: { country_code: "SA" },
      custom_attributes: {},
    },
    messages: withMessage ? [message] : [],
  };
}

// ------------------------------------------------------------------------------------------------- one run

interface State {
  channel: SimChannel;
  t: number;
  conv: SampleConversation;
  fields: Record<string, string>;
  lastInbound: number | null;
  lastSend: number | null;
  lastText: string;
  gap: number;
  tiktokAfterWindow: number;
  /** WhatsApp's one-message-every-6-seconds warning is said once per run. */
  warnedPairRate: boolean;
  steps: SimStep[];
  sends: number;
  rand: () => number;
  /** M129-G: when the trigger fired (ms), so a calendar event lands on the simulated day. */
  startMs: number;
  /** F-11: when a teammate steps in (seconds on the run's clock), or null. */
  handoffAt: number | null;
}

const MAX_STEPS = 300;

function push(st: State, step: Omit<SimStep, "at">) {
  st.steps.push({ at: st.t, ...step });
}

/** F-11: the teammate has stepped in by now. */
const teammateIn = (st: State) => st.handoffAt !== null && st.t >= st.handoffAt;

/** Moves the clock forward. When the teammate steps in before then, the clock stops there and this is false. */
function passes(st: State, seconds: number): boolean {
  if (st.handoffAt !== null && st.t + seconds > st.handoffAt) {
    st.t = Math.max(st.t, st.handoffAt);
    return false;
  }
  st.t += seconds;
  return true;
}

/** F-11 (item 87, Chatwoot's bot handoff): a teammate's reply the customer sees, or the conversation assigned to a
 *  teammate, hands the conversation to the team: it leaves Pending for Open and the bot (this flow) does nothing more.
 *  A private note or typing does not. */
function handOff(st: State, scenario: SimScenario, nodeId: string | null, step: string): string {
  const replied = scenario.handoff === "agent_replied";
  const was = st.conv.status;
  st.conv.status = "open";
  push(st, {
    level: "info",
    nodeId,
    step,
    title: replied ? "Stopped: agent replied" : "Stopped: agent assigned",
    detail: replied
      ? `A teammate replied and the customer sees the reply. As the engine does for its own bot (Captain), the conversation ${was === "pending" ? "moves from Pending to Open" : "is Open"} and the bot stops: the rest of this flow does not run. A private note or typing would not stop it.`
      : `The conversation was assigned to a teammate. As in the engine, assigning a person to a conversation a bot holds ${was === "pending" ? "moves it from Pending to Open" : "leaves it Open"}, and the bot stops: the rest of this flow does not run.`,
    source: replied ? SOURCES.cwHandoffReply : SOURCES.cwHandoffAssign,
  });
  return replied
    ? `Stopped: agent replied at ${formatOffset(st.t)}. The bot sent ${st.sends} message${st.sends === 1 ? "" : "s"} before.`
    : `Stopped: agent assigned at ${formatOffset(st.t)}. The bot sent ${st.sends} message${st.sends === 1 ? "" : "s"} before.`;
}

function windowOpen(st: State): boolean {
  const hours = CHANNELS[st.channel].windowHours;
  if (hours === null) return true;
  return st.lastInbound !== null && st.t - st.lastInbound < hours * 3600;
}

const FOLDER_FIELDS = [
  "status",
  "priority",
  "labels",
  "inbox_id",
  "assignee_id",
  "team_id",
  "browser_language",
  "country_code",
  "referer",
];

/** Whether the conversation is in a folder (Conversations' saved filters), or null when a filter is one it cannot read. */
function folderMatches(folder: SimFolder, conv: SampleConversation): boolean | null {
  const fieldValues = (attribute: string): string[] => {
    const one = (item: string | number | null | undefined) =>
      item === null || item === undefined ? [] : [String(item)];
    switch (attribute) {
      case "status":
        return one(conv.status);
      case "priority":
        return one(conv.priority);
      case "labels":
        return conv.labels;
      case "inbox_id":
        return one(conv.inbox_id);
      case "assignee_id":
        return one(conv.assignee_id);
      case "team_id":
        return one(conv.team_id);
      case "browser_language":
        return one(conv.additional_attributes.browser_language);
      case "country_code":
        return one(conv.contact.additional_attributes.country_code);
      default:
        return one(conv.additional_attributes.referer);
    }
  };
  let result: boolean | null = null;
  for (const [index, row] of folder.filters.entries()) {
    if (!FOLDER_FIELDS.includes(row.attribute)) return null;
    const list = fieldValues(row.attribute).map((v) => v.toLowerCase());
    const target = row.value.toLowerCase();
    let ok: boolean;
    switch (row.operator) {
      case "equal_to":
        ok = list.includes(target);
        break;
      case "not_equal_to":
        ok = !list.includes(target);
        break;
      case "contains":
        ok = list.some((v) => v.includes(target));
        break;
      case "does_not_contain":
        ok = !list.some((v) => v.includes(target));
        break;
      case "is_present":
        ok = list.length > 0;
        break;
      case "is_not_present":
        ok = list.length === 0;
        break;
      default:
        return null;
    }
    result = index === 0 || result === null ? ok : row.join === "or" ? result || ok : result && ok;
  }
  return result ?? true;
}

/** true / false for one simulator row. `note` explains what was read. */
function simRow(row: Condition, st: State, scenario: SimScenario, ctx: SimContext): { ok: boolean; note: string } {
  const values = row.values.filter(Boolean);
  switch (row.attribute) {
    case "contact_type": {
      const actual = scenario.contact === "new" ? "New contact" : "Returning contact";
      const hit = values.includes(actual);
      return { ok: row.operator === "Not equal to" ? !hit : hit, note: `the contact is a ${actual.toLowerCase()}` };
    }
    case "business_hours": {
      const inbox = values[0] ?? "";
      const hours = ctx.hoursOf(inbox);
      const at = new Date(scenario.start.getTime() + st.t * 1000);
      if (!hours) return { ok: false, note: `no business hours found for “${inbox}”` };
      const within = withinHours(hours, at);
      const clock = wallClock(at, hours.timezone);
      return {
        ok: row.operator.startsWith("Within") ? within : !within,
        note: `${clock.day} ${clock.time} (${hours.timezone}) is ${within ? "within" : "outside"} ${inbox}'s business hours`,
      };
    }
    case "message_intent": {
      const text = st.lastText.toLowerCase();
      const hit = values.map((v) => v.trim().toLowerCase()).find((v) => v && text.includes(v));
      return {
        ok: row.operator.startsWith("Has a") ? !!hit : !hit,
        note: hit
          ? `the message contains the marketing keyword “${hit}”`
          : "the message has none of the marketing keywords",
      };
    }
    case "channel_type": {
      const label = CHANNELS[st.channel].label;
      const hit = values.includes(label);
      return { ok: row.operator === "Not equal to" ? !hit : hit, note: `the channel is ${label}` };
    }
    case "folder": {
      const folder = ctx.folders.find((f) => f.name === values[0]);
      if (!folder) return { ok: false, note: `no folder named “${values[0] ?? ""}”` };
      const match = folderMatches(folder, st.conv);
      if (match === null)
        return { ok: false, note: `the folder “${folder.name}” uses a filter the simulator does not read` };
      return {
        ok: row.operator === "Is in folder" ? match : !match,
        note: `the conversation is ${match ? "" : "not "}in the folder “${folder.name}”`,
      };
    }
    case "reply_window": {
      const open = windowOpen(st);
      return {
        ok: row.operator === "Is open" ? open : !open,
        note: `the ${CHANNELS[st.channel].label} reply window is ${open ? "open" : "closed"}`,
      };
    }
    case "event_detail": {
      const detail = scenario.eventDetail.toLowerCase();
      const hit =
        row.operator === "Contains"
          ? values.some((v) => detail.includes(v.toLowerCase()))
          : values.some((v) => v.toLowerCase() === detail);
      return {
        ok: row.operator === "Not equal to" ? !hit : hit,
        note: `the event detail is “${scenario.eventDetail}”`,
      };
    }
    case "contact_attr": {
      const key = row.values[0] ?? "";
      const current = st.fields[key] ?? "";
      const wanted = (row.values[1] ?? "").toLowerCase();
      let ok = false;
      if (row.operator === "Is present") ok = current !== "";
      else if (row.operator === "Is not present") ok = current === "";
      else if (row.operator === "Equal to") ok = current.toLowerCase() === wanted;
      else ok = current.toLowerCase() !== wanted;
      return { ok, note: `the contact field ${key} is ${current ? `“${current}”` : "empty"}` };
    }
  }
  return { ok: false, note: `“${row.attribute}” is not a field the simulator reads` };
}

function conditionHolds(
  rows: Condition[],
  st: State,
  scenario: SimScenario,
  ctx: SimContext,
  event: ReturnType<typeof baseEvent>,
): { ok: boolean; notes: string[] } {
  const message = st.conv.messages[st.conv.messages.length - 1];
  const chatwootOnly = rows.every((row) => !attributeDefs[row.attribute]?.sim);
  if (chatwootOnly) {
    const ok = evaluate(
      toChatwootConditions(rows, ctx.ids),
      st.conv,
      event,
      event === "message_created" ? message : undefined,
    );
    return { ok, notes: ["read the way the engine's rules read these rows"] };
  }
  // AND before OR, as Chatwoot reads its rows; Chatwoot rows each read as Chatwoot reads them
  const notes: string[] = [];
  const groups: boolean[][] = [];
  rows.forEach((row, index) => {
    if (index === 0 || row.join === "or") groups.push([]);
    let ok: boolean;
    if (attributeDefs[row.attribute]?.sim) {
      const result = simRow(row, st, scenario, ctx);
      ok = result.ok;
      notes.push(result.note);
    } else {
      ok = evaluate(
        toChatwootConditions([{ ...row, join: "and" }], ctx.ids),
        st.conv,
        event,
        event === "message_created" ? message : undefined,
      );
    }
    groups[groups.length - 1].push(ok);
  });
  return { ok: groups.some((group) => group.every(Boolean)), notes };
}

/** Sends one message through the channel's rules: the gap between replies, the reply window, the attachment. */
function deliver(
  st: State,
  node: FlowNode,
  title: string,
  what: { text?: string; template?: string; action?: Action },
  stepName: string,
  ctx: SimContext,
): boolean {
  const info = CHANNELS[st.channel];
  if (st.gap > 0 && st.lastSend !== null && st.t - st.lastSend < st.gap) {
    const hold = st.gap - (st.t - st.lastSend);
    // F-11: a teammate stepping in during the hold stops the bot: nothing is sent
    if (!passes(st, hold)) return false;
    push(st, {
      level: "info",
      nodeId: node.id,
      step: stepName,
      title: `Holds ${Math.round(hold)} s: Seconds between replies is ${st.gap}`,
    });
  }
  if (st.channel === "whatsapp" && st.lastSend !== null && st.t - st.lastSend < 6 && !st.warnedPairRate) {
    st.warnedPairRate = true;
    push(st, {
      level: "warning",
      nodeId: node.id,
      step: stepName,
      title: "WhatsApp takes about one message every 6 seconds to the same person",
      detail:
        "Faster messages can be refused (error 131056). Set Seconds between replies to 6 or more in Flow settings.",
      source: SOURCES.waErrors,
    });
  }
  if (what.template !== undefined && st.channel !== "whatsapp") {
    push(st, {
      level: "error",
      nodeId: node.id,
      step: stepName,
      title: `Not sent: approved message templates are WhatsApp's; ${info.label} has none`,
      source: SOURCES.waPricing,
    });
    return false;
  }
  if (what.template !== undefined && !ctx.templates.includes(what.template)) {
    push(st, {
      level: "error",
      nodeId: node.id,
      step: stepName,
      title: `Not sent: “${what.template || "no template"}” is not an approved template in Settings > Templates`,
    });
    return false;
  }
  if (info.windowHours !== null && !windowOpen(st)) {
    if (st.channel === "whatsapp" && what.template !== undefined) {
      push(st, {
        level: "info",
        nodeId: node.id,
        step: stepName,
        title: "The 24-hour window is closed: an approved template may still be sent",
        source: SOURCES.waPricing,
      });
    } else if (st.channel === "tiktok") {
      st.tiktokAfterWindow += 1;
      if (st.tiktokAfterWindow > 3) {
        push(st, {
          level: "error",
          nodeId: node.id,
          step: stepName,
          title: "Not sent: TikTok allows only 3 messages after 48 hours without a customer message",
          source: SOURCES.tiktokLimits,
        });
        return false;
      }
      push(st, {
        level: "warning",
        nodeId: node.id,
        step: stepName,
        title: `TikTok: message ${st.tiktokAfterWindow} of the 3 allowed after 48 hours without a customer message`,
        source: SOURCES.tiktokLimits,
      });
    } else {
      push(st, {
        level: "error",
        nodeId: node.id,
        step: stepName,
        title: `Not sent: the ${info.label} reply window is closed`,
        detail: info.outsideWindow,
        source: info.windowSource ?? undefined,
      });
      return false;
    }
  }
  if (what.action?.action === "send_attachment" && what.action.media) {
    const check = checkMedia(what.action.media, st.channel);
    if (check.status === "rejected" || check.status === "missing") {
      push(st, {
        level: "error",
        nodeId: node.id,
        step: stepName,
        title: `Not sent: ${check.line.replace(/^Refused: /, "")}`,
        source: check.source,
      });
      return false;
    }
    const warn = check.status === "warning";
    push(st, {
      level: "send",
      nodeId: node.id,
      step: stepName,
      title,
      detail: [
        warn ? "" : check.line,
        ...check.notes,
        what.action.media.caption ? `Caption: “${what.action.media.caption}”` : "",
      ]
        .filter(Boolean)
        .join(" "),
      source: check.source,
    });
    if (warn) push(st, { level: "warning", nodeId: node.id, step: stepName, title: check.line, source: check.source });
  } else {
    push(st, { level: "send", nodeId: node.id, step: stepName, title, detail: what.text });
  }
  st.lastSend = st.t;
  st.sends += 1;
  return true;
}

function runAction(st: State, node: Extract<FlowNode, { kind: "action" }>, stepName: string, ctx: SimContext) {
  const action = node.action;
  const label = actionDefs[action.action]?.label ?? action.action;
  const values = action.values.filter(Boolean);
  const say = (title: string, level: SimLevel = "ok", detail?: string) =>
    push(st, { level, nodeId: node.id, step: stepName, title, detail });
  // a step not filled in yet (e.g. in a flow this one goes to) is reported, not played with empty values
  const missing = actionError(action);
  if (missing) {
    say(`Skipped “${label}”: ${missing.charAt(0).toLowerCase()}${missing.slice(1)}`, "warning");
    return;
  }
  switch (action.action) {
    case "send_message":
      deliver(st, node, "Sends a message", { text: values[0] ?? "" }, stepName, ctx);
      return;
    case "send_attachment": {
      const media = action.media;
      const what = media
        ? media.type === "contact" || media.type === "location"
          ? media.type
          : (media.file?.name ?? media.type)
        : "";
      deliver(
        st,
        node,
        `Sends ${media ? `${media.type === "voice" ? "a voice note" : `the ${media.type}`} ${what && what !== media.type ? `“${what}”` : ""}`.trim() : "an attachment"}`,
        { action },
        stepName,
        ctx,
      );
      return;
    }
    case "send_template": {
      // F-3 item 6: the template's {{n}} filled from this contact's fields (template-vars.ts)
      const name = values[0] ?? "";
      const body = ctx.templateBodies?.[name];
      const variables = (action as TemplateAction).variables;
      const fields = contactFieldsFor(st.fields, {
        email: st.conv.contact.email,
        phone_number: st.conv.contact.phone_number,
        country_code: String(st.conv.contact.additional_attributes?.country_code ?? ""),
      });
      const missing = body ? missingVariables(body, variables) : [];
      if (missing.length) {
        push(st, {
          level: "error",
          nodeId: node.id,
          step: stepName,
          title: `Not sent: ${missing.map((key) => `{{${key}}}`).join(", ")} of “${name}” has no value`,
          detail: "WhatsApp refuses a template whose parameters do not match it (error 132000).",
          source: SOURCES.waErrors,
        });
        return;
      }
      deliver(
        st,
        node,
        `Sends the approved template “${name}”`,
        {
          template: name,
          text: body
            ? `“${fillTemplate(body, variables, fields)}”${variableLines(body, variables, fields).length ? ` · ${variableLines(body, variables, fields).join(" · ")}` : ""}`
            : undefined,
        },
        stepName,
        ctx,
      );
      return;
    }
    case "add_private_note":
      say("Adds a private note (teammates only)", "ok", values[0]);
      return;
    case "send_email_to_team":
      say(
        `Emails the team${values.length > 1 ? "s" : ""} ${values.join(", ")} (not the customer)`,
        "ok",
        action.message,
      );
      return;
    case "send_email_transcript":
      say(`Emails the transcript to ${values[0] ?? "…"}`);
      return;
    case "send_webhook_event":
      say(`Would post the event to ${values[0] ?? "…"}`, "ok", "Simulated: nothing leaves the preview.");
      return;
    case "add_label":
      st.conv.labels = [...new Set([...st.conv.labels, ...values])];
      say(`Adds the label${values.length > 1 ? "s" : ""} ${values.join(", ")}`);
      return;
    case "remove_label":
      st.conv.labels = st.conv.labels.filter((l) => !values.includes(l));
      say(`Removes the label${values.length > 1 ? "s" : ""} ${values.join(", ")}`);
      return;
    case "assign_agent": {
      const name = values[0] ?? "";
      if (name === "None") {
        st.conv.assignee_id = null;
        say("Unassigns the conversation");
      } else if (name === "Last Responding Agent") {
        say(
          "Assigns the last teammate who replied",
          "ok",
          "This made-up conversation has no teammate reply yet, so nobody is assigned.",
        );
      } else {
        st.conv.assignee_id = ctx.ids.agent(name);
        say(`Assigns ${name}`);
      }
      return;
    }
    case "assign_team": {
      const name = values[0] ?? "";
      if (name === "None") {
        st.conv.team_id = null;
        say("Removes the team");
        return;
      }
      const id = ctx.ids.team(name);
      st.conv.team_id = id;
      if (id === null)
        say(
          `Assigns the team ${name}`,
          "warning",
          `There is no team “${name}” in this preview yet (Settings > Teams).`,
        );
      else say(`Assigns the team ${name}`);
      return;
    }
    case "remove_assigned_agent":
      st.conv.assignee_id = null;
      say("Removes the assigned teammate");
      return;
    case "remove_assigned_team":
      st.conv.team_id = null;
      say("Removes the assigned team");
      return;
    case "change_priority":
      st.conv.priority = (
        (values[0] ?? "").toLowerCase() === "none" ? null : (values[0] ?? "").toLowerCase()
      ) as SampleConversation["priority"];
      say(`Sets the priority to ${values[0] ?? ""}`);
      return;
    case "add_sla":
      say(`Adds the SLA ${values[0] ?? ""}`);
      return;
    case "mute_conversation":
      say("Mutes the conversation");
      return;
    case "snooze_conversation":
      st.conv.status = "snoozed";
      say("Snoozes the conversation");
      return;
    case "resolve_conversation":
      st.conv.status = "resolved";
      say("Resolves (closes) the conversation");
      return;
    case "open_conversation":
      st.conv.status = "open";
      say("Opens the conversation");
      return;
    case "pending_conversation":
      st.conv.status = "pending";
      say("Marks the conversation as pending");
      return;
    case "update_contact_field": {
      const [key, value] = action.values;
      st.fields[key ?? ""] = value ?? "";
      say(`Sets the contact field ${key} to “${value ?? ""}”`);
      return;
    }
    case CALENDAR_ACTION: {
      // M129-G: a dry run creates nothing; the line says what would be made and offers to make it in Davis
      const spec = specOf(action.values);
      const at = new Date(st.startMs + st.t * 1000);
      push(st, {
        level: "ok",
        nodeId: node.id,
        step: stepName,
        // the title is isolated (FSI…PDI) so an Arabic title does not reorder the English line around it
        title: `Would create the calendar event “\u2068${spec.title}\u2069” ${whenText(eventFromSpec(spec, at))}`,
        detail: "Dry run: nothing is created in the calendar. “Create event” makes this one event for real.",
        calendarAction: { values: [...action.values], at: at.getTime() },
      });
      return;
    }
    case "create_twenty_task":
    case "create_invoice_draft":
    case "notify_teammate": {
      // F-11: a dry run makes nothing; the line says what would be made, and its button makes it for real
      const kind = kindOfAction(action.action) as WorkKind;
      const at = new Date(st.startMs + st.t * 1000);
      push(st, {
        level: "ok",
        nodeId: node.id,
        step: stepName,
        title:
          kind === "task"
            ? taskLine(taskSpecOf(action.values), at)
            : kind === "invoice"
              ? invoiceLine(invoiceSpecOf(action.values), at)
              : notifyLine(notifySpecOf(action.values)),
        detail: WORK_DETAIL[kind],
        source: WORK_SOURCES[kind],
        work: { kind, values: [...action.values], at: at.getTime() },
      });
      return;
    }
    case "assign_strategy": {
      const strategy = values[0] ?? "";
      const onlineOnly = strategy.includes("online");
      const pool = onlineOnly ? ctx.agents.filter((a) => a.availability === "online") : ctx.agents;
      const pick = pool[0];
      say(
        pick ? `Assigns ${pick.name} (${strategy.toLowerCase()})` : `Nobody to assign (${strategy.toLowerCase()})`,
        pick ? "ok" : "warning",
        strategy.startsWith("Fewest")
          ? "The preview has no live count of open conversations: the first teammate in the list stands in."
          : "The made-up queue starts at the first teammate in the list.",
      );
      return;
    }
  }
  say(label);
}

const WORK_DETAIL: Record<WorkKind, string> = {
  task: "Dry run: nothing is created on the tasks server. “Create task” makes this one task for real; it shows on the Tasks page.",
  invoice:
    "Dry run: nothing is created on the invoices server. “Create draft” makes this one draft for real (not delivered, nothing is emailed); it shows in Invoices.",
  notify: "Dry run: nobody is notified. “Send to the bell” makes this one notification for real; it shows in the bell.",
};

const WORK_SOURCES: Record<WorkKind, Source> = {
  task: SOURCES.taskStandard,
  invoice: SOURCES.invoiceStandard,
  notify: SOURCES.notifyStandard,
};

/** Plays `doc` on one channel. */
export function simulate(doc: FlowDoc, channel: SimChannel, scenario: SimScenario, ctx: SimContext): SimRun {
  const trigger = doc.nodes.find((node) => node.kind === "trigger");
  const event = trigger?.kind === "trigger" ? trigger.event : "message_created";
  const base = baseEvent(event);
  const withMessage = eventCarriesMessage(event);
  const st: State = {
    channel,
    t: 0,
    conv: sampleFor(channel, scenario, ctx, withMessage),
    fields: { ...CONTACT_FIELD_DEFAULTS },
    lastInbound: withMessage ? 0 : -scenario.lastMessageHoursAgo * 3600,
    lastSend: null,
    lastText: withMessage ? scenario.messageText : "",
    gap: Math.max(0, doc.settings?.secondsBetweenReplies ?? 0),
    tiktokAfterWindow: 0,
    warnedPairRate: false,
    steps: [],
    sends: 0,
    rand: seeded(scenario.seed * 7919 + SIM_CHANNELS.indexOf(channel)),
    startMs: scenario.start.getTime(),
    handoffAt: null,
  };
  const finish = (outcome: string): SimRun => ({
    channel,
    steps: st.steps,
    sends: st.sends,
    errors: st.steps.filter((s) => s.level === "error").length,
    warnings: st.steps.filter((s) => s.level === "warning").length,
    outcome,
  });
  if (trigger?.kind !== "trigger") return finish("The flow has no trigger.");

  // ---- the trigger
  const label = CHANNELS[channel].label;
  if (trigger.channels?.length && !trigger.channels.includes(channel)) {
    push(st, {
      level: "info",
      nodeId: trigger.id,
      step: "Trigger",
      title: `Does not start on ${label}: the trigger runs on ${trigger.channels.map((c) => CHANNELS[c].label).join(", ")} only`,
    });
    return finish(`Not started on ${label}.`);
  }
  if (isSimEvent(event)) {
    const def = SIM_EVENTS[event];
    if (event === "scheduled") {
      const schedule = trigger.schedule;
      const at = schedule ? nextRun(schedule, scenario.start) : null;
      if (!schedule || !at) {
        push(st, {
          level: "error",
          nodeId: trigger.id,
          step: "Trigger",
          title: "Does not start: the schedule has no time after the simulation's start",
        });
        return finish("Not started: no scheduled time ahead.");
      }
      if (schedule.labels.length && !schedule.labels.some((l) => st.conv.labels.includes(l))) {
        push(st, {
          level: "info",
          nodeId: trigger.id,
          step: "Trigger",
          title: `Does not start: the conversation has none of the labels ${schedule.labels.join(", ")}`,
        });
        return finish("Not started: not in the scheduled audience.");
      }
      const wait = Math.max(0, (at.getTime() - scenario.start.getTime()) / 1000);
      st.t = wait;
      const clock = wallClock(at, schedule.timezone);
      push(st, {
        level: "info",
        nodeId: trigger.id,
        step: "Trigger",
        title: `Scheduled time: ${clock.day} ${clock.date} ${clock.time} (${schedule.timezone})`,
        detail: schedule.mode === "once" ? "Runs once." : `Repeats ${schedule.mode}.`,
      });
    } else if (event === "label_added") {
      if (trigger.label) st.conv.labels = [...new Set([...st.conv.labels, trigger.label])];
      push(st, {
        level: "info",
        nodeId: trigger.id,
        step: "Trigger",
        title: `Label “${trigger.label ?? ""}” added to the conversation`,
      });
    } else {
      push(st, {
        level: "info",
        nodeId: trigger.id,
        step: "Trigger",
        title: `Pretends: ${def.label}${scenario.eventDetail ? ` · ${scenario.eventDetail}` : ""}`,
        detail: withMessage ? `The customer wrote: “${scenario.messageText}”` : undefined,
      });
    }
  } else {
    push(st, {
      level: "info",
      nodeId: trigger.id,
      step: "Trigger",
      title: `Event: ${eventLabels[event]}`,
      detail: withMessage ? `The customer wrote: “${scenario.messageText}”` : undefined,
    });
  }
  if (trigger.repeat === "once_per_contact" && scenario.ranBefore) {
    push(st, {
      level: "info",
      nodeId: trigger.id,
      step: "Trigger",
      title: "Skipped: this contact already ran this flow, and it runs once per contact",
    });
    return finish("Skipped (once per contact).");
  }
  // F-11: the teammate's moment counts from the trigger (a scheduled trigger fires at its time)
  if (scenario.handoff !== "none") st.handoffAt = st.t + Math.max(0, scenario.handoffAfterSeconds);

  // ---- the steps
  const stack: { id: string; name: string }[] = [{ id: ctx.flowId, name: ctx.flowName }];
  let current = doc;
  let titles = stepTitles(current);
  let prefix = "";
  let node: FlowNode | undefined = trigger;
  let handle: Handle | null = "out";
  let count = 0;
  const nextOf = (from: FlowNode, exit: Handle | null) => {
    if (!exit) return undefined;
    const edge = current.edges.find((e) => e.source === from.id && e.handle === exit);
    return edge ? current.nodes.find((n) => n.id === edge.target) : undefined;
  };
  while (node && count++ < MAX_STEPS) {
    if (teammateIn(st)) return finish(handOff(st, scenario, null, ""));
    const next = nextOf(node, handle);
    if (!next) {
      if (handle && exitsOf(node).length) {
        const exitName = EXIT_LABELS[handle];
        push(st, {
          level: "info",
          nodeId: null,
          step: "",
          title: exitName
            ? `Nothing follows ${titles.get(node.id) ?? ""} ${exitName}: the flow ends`
            : "End of the flow",
        });
      }
      break;
    }
    node = next;
    const stepName = `${prefix}${titles.get(node.id) ?? node.kind}`;
    switch (node.kind) {
      case "trigger":
        handle = "out";
        break;
      case "wait": {
        const wait = node.wait;
        const seconds = wait.amount * minutesPer[wait.unit] * 60;
        const inboxOk =
          !wait.inboxes.length ||
          wait.inboxes.some((name) => ctx.ids.inbox(name) === st.conv.inbox_id && st.conv.inbox_id !== 0);
        const duration = durationText(wait.amount, wait.unit);
        if (!inboxOk) {
          push(st, {
            level: "info",
            nodeId: node.id,
            step: stepName,
            title: `The wait does not start: it watches ${wait.inboxes.join(", ")} only`,
          });
          return finish("Ended at the wait (other inboxes).");
        }
        if (wait.trigger === "conversation_status" && st.conv.status !== wait.status.toLowerCase()) {
          push(st, {
            level: "info",
            nodeId: node.id,
            step: stepName,
            title: `The wait does not start: the conversation is ${st.conv.status}, not ${wait.status.toLowerCase()}`,
          });
          return finish("Ended at the wait (other status).");
        }
        const stops =
          (wait.trigger === "conversation_status" && scenario.duringWait === "status_changes") ||
          (wait.trigger === "customer_unresponsive" && scenario.duringWait === "customer_replies") ||
          (wait.trigger === "agent_unresponsive" && scenario.duringWait === "teammate_replies");
        push(st, {
          level: "info",
          nodeId: node.id,
          step: stepName,
          title: `Waits ${duration} (engine rule that runs after a wait)`,
          detail: `${explanation(wait.trigger, duration)} In the engine this needs the delayed_automations feature, which is off by default; here it runs.`,
          source: SOURCES.cwFeatures,
        });
        if (stops) {
          // the change is simulated half-way through the wait
          if (!passes(st, Math.round(seconds / 2))) return finish(handOff(st, scenario, node.id, stepName));
          const what =
            scenario.duringWait === "customer_replies"
              ? "the customer replied"
              : scenario.duringWait === "teammate_replies"
                ? "a teammate replied"
                : "the status changed";
          if (scenario.duringWait === "customer_replies") st.lastInbound = st.t;
          push(st, {
            level: "info",
            nodeId: node.id,
            step: stepName,
            title: `Stopped: ${what} before the wait ended, so nothing runs`,
          });
          return finish("Stopped during the wait.");
        }
        if (!passes(st, seconds)) return finish(handOff(st, scenario, node.id, stepName));
        push(st, {
          level: "ok",
          nodeId: node.id,
          step: stepName,
          title: `${duration} later nothing changed: the steps below run`,
        });
        handle = "out";
        break;
      }
      case "delay": {
        const seconds = node.delay.amount * unitSeconds[node.delay.unit];
        if (!passes(st, seconds)) return finish(handOff(st, scenario, node.id, stepName));
        push(st, {
          level: "info",
          nodeId: node.id,
          step: stepName,
          title: `Waits ${durationText(node.delay.amount, node.delay.unit)}`,
          detail: "Clock moved forward.",
        });
        handle = "out";
        break;
      }
      case "condition": {
        const result = conditionHolds(node.rows, st, scenario, ctx, base);
        handle = result.ok ? "yes" : "no";
        const why = result.notes.join("; ");
        push(st, {
          level: "info",
          nodeId: node.id,
          step: stepName,
          title: `Takes ${result.ok ? "Yes" : "Else"}`,
          detail: why ? `${why[0].toUpperCase()}${why.slice(1)}.` : undefined,
        });
        break;
      }
      case "action":
        runAction(st, node, stepName, ctx);
        if (teammateIn(st)) return finish(handOff(st, scenario, node.id, stepName));
        handle = "out";
        break;
      case "ask": {
        const ask = node.ask;
        if (!ask.question.trim()) {
          push(st, {
            level: "warning",
            nodeId: node.id,
            step: stepName,
            title: "Skipped: the question is not written yet → No reply",
          });
          handle = "noreply";
          break;
        }
        const sent = deliver(
          st,
          node,
          "Asks a question",
          { text: `${ask.question}${ask.answers.length ? ` [${ask.answers.join(" | ")}]` : ""}` },
          stepName,
          ctx,
        );
        const timeout = ask.timeout.amount * unitSeconds[ask.timeout.unit];
        if (teammateIn(st)) return finish(handOff(st, scenario, node.id, stepName));
        if (!sent) {
          if (!passes(st, timeout)) return finish(handOff(st, scenario, node.id, stepName));
          push(st, { level: "info", nodeId: node.id, step: stepName, title: "The question was not sent: No reply" });
          handle = "noreply";
          break;
        }
        const replyAfter = Math.max(1, scenario.replyAfterSeconds);
        if (scenario.replies === "reply" && replyAfter <= timeout) {
          if (!passes(st, replyAfter)) return finish(handOff(st, scenario, node.id, stepName));
          st.lastInbound = st.t;
          st.lastText = scenario.replyText;
          st.conv.messages.push({ message_type: "incoming", private: false, content: scenario.replyText });
          if (ask.saveTo) st.fields[ask.saveTo] = scenario.replyText;
          push(st, {
            level: "ok",
            nodeId: node.id,
            step: stepName,
            title: `The customer replies “${scenario.replyText}” → Replied`,
            detail: ask.saveTo ? `Saved to the contact field ${ask.saveTo}.` : undefined,
          });
          handle = "replied";
        } else {
          if (!passes(st, timeout)) return finish(handOff(st, scenario, node.id, stepName));
          push(st, {
            level: "info",
            nodeId: node.id,
            step: stepName,
            title: `No reply after ${durationText(ask.timeout.amount, ask.timeout.unit)} → No reply`,
          });
          handle = "noreply";
        }
        break;
      }
      case "split": {
        const roll = st.rand();
        const a = scenario.split === "a" || (scenario.split === "random" && roll * 100 < node.split.percentA);
        handle = a ? "a" : "b";
        push(st, {
          level: "info",
          nodeId: node.id,
          step: stepName,
          title: `Takes path ${a ? "A" : "B"} (${a ? node.split.percentA : 100 - node.split.percentA}%)`,
          detail:
            scenario.split === "random"
              ? "Picked at random (seeded, so the same run gives the same path)."
              : "Forced in the dry run.",
        });
        break;
      }
      case "http": {
        const http = node.http;
        const ok = http.mockStatus >= 200 && http.mockStatus < 300;
        if (http.saveTo && ok) st.fields[http.saveTo] = http.mockBody;
        push(st, {
          level: ok ? "ok" : "warning",
          nodeId: node.id,
          step: stepName,
          title: `${http.method} ${http.url || "…"} → simulated ${http.mockStatus} → ${ok ? "Success" : "Failure"}`,
          detail: `Nothing was called: the answer is the one set on the step.${http.saveTo && ok ? ` Saved to the contact field ${http.saveTo}.` : ""}`,
        });
        handle = ok ? "success" : "failure";
        break;
      }
      case "goto": {
        const wanted = node.goto.flowId;
        const target = ctx.flows.find((flow) => flow.id === wanted);
        if (!target) {
          push(st, {
            level: "error",
            nodeId: node.id,
            step: stepName,
            title: "The flow to go to is not saved in this preview",
          });
          return finish("Stopped: missing flow.");
        }
        if (stack.some((entry) => entry.id === target.id)) {
          push(st, {
            level: "error",
            nodeId: node.id,
            step: stepName,
            title: `Loop: “${target.name}” already ran in this run, so it does not start again`,
          });
          return finish("Stopped: flows go to each other in a loop.");
        }
        stack.push({ id: target.id, name: target.name });
        push(st, {
          level: "ok",
          nodeId: node.id,
          step: stepName,
          title: `Continues in the flow “${target.name || "Untitled flow"}”`,
        });
        current = target.doc;
        titles = stepTitles(current);
        prefix = `${target.name || "Untitled flow"} › `;
        node = current.nodes.find((n) => n.kind === "trigger");
        handle = "out";
        continue;
      }
    }
  }
  if (count >= MAX_STEPS) push(st, { level: "error", nodeId: null, step: "", title: "Stopped after 300 steps" });
  if (st.handoffAt !== null)
    push(st, {
      level: "info",
      nodeId: null,
      step: "",
      title: `The flow ended before the teammate steps in (${formatOffset(st.handoffAt)}): nothing left to stop`,
    });
  const errors = st.steps.filter((s) => s.level === "error").length;
  return finish(
    `${st.sends} message${st.sends === 1 ? "" : "s"} would be sent over ${formatOffset(st.t).slice(1)}${errors ? `, ${errors} refused` : ""}.`,
  );
}

// ------------------------------------------------------------------------------------------------- checks

export interface SimIssue {
  level: "error" | "warning";
  nodeId: string | null;
  message: string;
}

function reachableFrom(doc: FlowDoc, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of doc.edges) if (edge.source === id) stack.push(edge.target);
  }
  return seen;
}

/** What a simulator flow still lacks (errors block approval; warnings do not). */
export function checkSimFlow(
  doc: FlowDoc,
  meta: { name: string; description: string },
  ctx: Pick<SimContext, "flows" | "flowId" | "folders" | "templates" | "templateBodies">,
): SimIssue[] {
  const issues: SimIssue[] = [];
  const add = (issue: SimIssue) => {
    if (!issues.some((i) => i.nodeId === issue.nodeId && i.message === issue.message)) issues.push(issue);
  };
  if (!meta.name.trim()) add({ level: "error", nodeId: null, message: "Name is required" });
  if (!meta.description.trim()) add({ level: "error", nodeId: null, message: "Description is required" });
  const triggers = doc.nodes.filter((node) => node.kind === "trigger");
  if (triggers.length !== 1)
    add({ level: "error", nodeId: triggers[1]?.id ?? null, message: "A flow has exactly one trigger." });
  const trigger = triggers[0];
  if (trigger?.kind !== "trigger") return issues;
  if (!doc.edges.some((edge) => edge.source === trigger.id))
    add({ level: "error", nodeId: trigger.id, message: "Add a step under the trigger." });
  const reachable = reachableFrom(doc, trigger.id);
  const gap = doc.settings?.secondsBetweenReplies ?? 0;
  if (!Number.isInteger(gap) || gap < 0 || gap > 3600)
    add({ level: "error", nodeId: null, message: "Seconds between replies must be a whole number from 0 to 3600" });
  const channels = trigger.channels?.length ? trigger.channels : SIM_CHANNELS;

  if (isSimEvent(trigger.event)) {
    if (trigger.event === "scheduled") {
      const s = trigger.schedule;
      if (!s) add({ level: "error", nodeId: trigger.id, message: "Set the date and time of the schedule" });
      else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date))
          add({ level: "error", nodeId: trigger.id, message: "Choose the date" });
        if (!/^\d{2}:\d{2}$/.test(s.time)) add({ level: "error", nodeId: trigger.id, message: "Choose the time" });
        if (!validTimezone(s.timezone)) add({ level: "error", nodeId: trigger.id, message: "Choose a valid timezone" });
        if (s.mode === "weekly" && !s.weekdays.length)
          add({ level: "error", nodeId: trigger.id, message: "Choose at least one weekday" });
      }
    }
    if (trigger.event === "label_added" && !trigger.label)
      add({ level: "error", nodeId: trigger.id, message: "Choose the label that starts the flow" });
  }

  for (const node of doc.nodes) {
    if (!reachable.has(node.id))
      add({ level: "error", nodeId: node.id, message: "Not connected to the trigger. Connect it or delete it." });
    switch (node.kind) {
      case "wait": {
        const minutes = node.wait.amount * minutesPer[node.wait.unit];
        if (!Number.isFinite(minutes) || minutes < 10 || minutes > 43200)
          add({ level: "error", nodeId: node.id, message: "The wait must be between 10 minutes and 30 days" });
        break;
      }
      case "condition":
        if (!node.rows.length) add({ level: "error", nodeId: node.id, message: "Add at least one condition row." });
        for (const row of node.rows) {
          const def = attributeDefs[row.attribute];
          if (!def) {
            add({ level: "error", nodeId: node.id, message: `“${row.attribute}” is not a field this editor knows.` });
            continue;
          }
          const error = conditionError(row);
          if (error) add({ level: "error", nodeId: node.id, message: error });
          if (row.operator && !def.ops.includes(row.operator))
            add({ level: "error", nodeId: node.id, message: `“${row.operator}” is not an operator of ${def.label}.` });
          if (row.attribute === "folder" && row.values[0] && !ctx.folders.some((f) => f.name === row.values[0]))
            add({
              level: "error",
              nodeId: node.id,
              message: `There is no folder “${row.values[0]}” in Conversations.`,
            });
        }
        break;
      case "action": {
        if (!actionDefs[node.action.action])
          add({
            level: "error",
            nodeId: node.id,
            message: `“${node.action.action}” is not an action this editor knows.`,
          });
        const error = actionError(node.action);
        if (error) add({ level: "error", nodeId: node.id, message: error });
        if (
          node.action.action === "send_template" &&
          node.action.values[0] &&
          !ctx.templates.includes(node.action.values[0])
        )
          add({ level: "error", nodeId: node.id, message: `“${node.action.values[0]}” is not an approved template.` });
        // F-3 item 6: every {{n}} of the chosen template needs a contact field or a text (WhatsApp error 132000)
        const templateBody =
          node.action.action === "send_template" ? ctx.templateBodies?.[node.action.values[0] ?? ""] : undefined;
        const unfilled = templateBody ? missingVariables(templateBody, (node.action as TemplateAction).variables) : [];
        if (unfilled.length)
          add({
            level: "error",
            nodeId: node.id,
            message: `Choose a contact field or a text for ${unfilled.map((key) => `{{${key}}}`).join(", ")} of “${node.action.values[0]}” (WhatsApp refuses a missing parameter, error 132000).`,
          });
        const media = node.action.media;
        if (node.action.action === "send_attachment" && media && !error) {
          const checks = channels.map((channel) => checkMedia(media, channel));
          const refused = checks.filter((c) => c.status === "rejected");
          if (refused.length === checks.length)
            add({
              level: "error",
              nodeId: node.id,
              message: `No channel this flow runs on can receive it: ${refused.map((c) => CHANNELS[c.channel].label).join(", ")}. See the channel check.`,
            });
          else if (refused.length)
            add({
              level: "warning",
              nodeId: node.id,
              message: `Refused on ${refused.map((c) => CHANNELS[c.channel].label).join(", ")} (format or size): see the channel check.`,
            });
        }
        break;
      }
      case "ask": {
        const ask = node.ask;
        if (!ask.question.trim()) add({ level: "error", nodeId: node.id, message: "Write the question" });
        if (ask.answers.length > 3)
          add({
            level: "error",
            nodeId: node.id,
            message: "At most 3 reply buttons (WhatsApp's limit for reply buttons)",
          });
        if (ask.answers.some((a) => !a.trim()))
          add({ level: "error", nodeId: node.id, message: "A reply button has no text" });
        if (ask.answers.some((a) => a.length > 20))
          add({
            level: "error",
            nodeId: node.id,
            message: "A reply button's text is longer than WhatsApp's 20 characters",
          });
        const minutes = ask.timeout.amount * minutesPer[ask.timeout.unit];
        if (!Number.isInteger(ask.timeout.amount) || minutes < 1 || minutes > ASK_MAX_MINUTES)
          add({ level: "error", nodeId: node.id, message: "The reply time limit must be from 1 minute to 7 days" });
        break;
      }
      case "delay": {
        const seconds = node.delay.amount * unitSeconds[node.delay.unit];
        if (!Number.isInteger(node.delay.amount) || node.delay.amount < 1 || seconds > DELAY_MAX_SECONDS)
          add({ level: "error", nodeId: node.id, message: "The wait must be a whole number from 1 second to 7 days" });
        break;
      }
      case "split":
        if (!Number.isInteger(node.split.percentA) || node.split.percentA < 1 || node.split.percentA > 99)
          add({ level: "error", nodeId: node.id, message: "Path A's share must be a whole number from 1 to 99 %" });
        break;
      case "http": {
        let ok = false;
        try {
          const url = new URL(node.http.url);
          ok = url.protocol === "https:" || url.protocol === "http:";
        } catch {
          ok = false;
        }
        if (!ok) add({ level: "error", nodeId: node.id, message: "Enter a full address starting with https://" });
        if (!Number.isInteger(node.http.mockStatus) || node.http.mockStatus < 100 || node.http.mockStatus > 599)
          add({ level: "error", nodeId: node.id, message: "The simulated answer code must be from 100 to 599" });
        break;
      }
      case "goto": {
        const id = node.goto.flowId;
        if (!id) {
          add({ level: "error", nodeId: node.id, message: "Choose the flow to go to" });
          break;
        }
        if (id === ctx.flowId) {
          add({ level: "error", nodeId: node.id, message: "A flow cannot go to itself" });
          break;
        }
        const target = ctx.flows.find((flow) => flow.id === id);
        if (!target) {
          add({ level: "error", nodeId: node.id, message: "The chosen flow is not saved in this preview (deleted?)" });
          break;
        }
        if (target.doc.nodes.some((n) => n.kind === "goto" && n.goto.flowId === ctx.flowId))
          add({ level: "error", nodeId: node.id, message: `“${target.name}” goes back to this flow: that is a loop` });
        break;
      }
    }
  }
  return issues;
}

/** Runs every channel. */
export function simulateAll(doc: FlowDoc, channels: SimChannel[], scenario: SimScenario, ctx: SimContext): SimRun[] {
  return channels.map((channel) => simulate(clone(doc), channel, scenario, ctx));
}

export { formatBytes };
