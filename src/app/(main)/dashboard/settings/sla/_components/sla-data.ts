// T-134: the SLA policies of Settings > SLA, in a plain module so the conversations (cw-data.ts) apply the same
// policies the Settings page lists. Moved unchanged from sla-list.tsx.
export interface Sla {
  id: number;
  name: string;
  description: string;
  /** Thresholds in seconds, as the API stores them; null when not set. */
  frt: number | null;
  nrt: number | null;
  rt: number | null;
  businessHours: boolean;
}

export const M = 60;
export const H = 3600;
export const D = 86400;

export const initialSlas: Sla[] = [
  {
    id: 1,
    name: "Enterprise P0",
    description: "Issues raised by enterprise customers, that require immediate attention.",
    frt: 15 * M,
    nrt: 30 * M,
    rt: 4 * H,
    businessHours: false,
  },
  {
    id: 2,
    name: "Enterprise P1",
    description: "Issues raised by enterprise customers, that needs to be acknowledged quickly.",
    frt: 1 * H,
    nrt: 2 * H,
    rt: 1 * D,
    businessHours: true,
  },
  {
    id: 3,
    name: "VIP Doha",
    description: "Repeat buyers and corporate accounts in Qatar",
    frt: 10 * M,
    nrt: 20 * M,
    rt: 8 * H,
    businessHours: false,
  },
  {
    id: 4,
    name: "Refund 24h",
    description: "Refund and billing requests must close within one day",
    frt: 2 * H,
    nrt: null,
    rt: 1 * D,
    businessHours: true,
  },
  {
    id: 5,
    name: "Standard",
    description: "Default promise for all website and WhatsApp chats",
    frt: 4 * H,
    nrt: 8 * H,
    rt: 3 * D,
    businessHours: true,
  },
];

// T-261 (buried 6, item 5 "افتحها"): the badge counts the way Chatwoot does, from the saved policy.
// Chatwoot AppliedSla#frt_due_at / nrt_due_at / rt_due_at (enterprise/app/models/applied_sla.rb): the due time is the
// conversation's created_at (FRT, RT) or waiting_since (NRT) plus the threshold, counted in the inbox's working hours
// when the policy is "Only during business hours" (Sla::BusinessHoursService). The badge (helper/slaHelper.js
// evaluateSLAStatus) then shows the most urgent of FRT, NRT and RT: a missed one first, else the nearest.

/** An inbox's Business Hours as Settings > Inboxes saves them (inboxes-store.ts BusinessHoursSettings). */
export interface WorkingHours {
  enabled: boolean;
  timezone: string;
  days: { day: string; open: boolean; allDay: boolean; from: string; to: string }[];
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86_400_000;

// Minutes east of UTC of a time zone at an instant (Asia/Qatar -> 180). An unknown zone counts as UTC, as Chatwoot's
// `inbox.timezone || 'UTC'`.
function zoneOffset(timezone: string, at: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).formatToParts(new Date(at));
    const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Math.round(
      (Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - at) / 60_000,
    );
  } catch {
    return 0;
  }
}

const clockMs = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60_000;
};

/**
 * Chatwoot Sla::BusinessHoursService#deadline: `thresholdSeconds` after `start` (ms), counting only the inbox's open
 * hours when they are on and some day is open; otherwise plain time. Worked in the inbox's wall clock.
 */
export function slaDeadline(start: number, thresholdSeconds: number, hours: WorkingHours | null): number {
  const byDay = new Map(hours?.days.map((d) => [d.day, d]) ?? []);
  const dayOf = (wall: number) => byDay.get(WEEKDAYS[new Date(wall).getUTCDay()]);
  // A day with no hours, or closing before it opens, is a closed day.
  const openDay = (d: ReturnType<typeof dayOf>) => !!d?.open && (d.allDay || clockMs(d.to) > clockMs(d.from));
  if (!hours?.enabled || !WEEKDAYS.some((day) => openDay(byDay.get(day)))) return start + thresholdSeconds * 1000;

  const offset = zoneOffset(hours.timezone, start) * 60_000;
  const midnight = (wall: number) => Math.floor(wall / DAY_MS) * DAY_MS;
  const opensAt = (wall: number) => {
    const d = dayOf(wall);
    return midnight(wall) + (d?.allDay ? 0 : clockMs(d?.from ?? "00:00"));
  };
  const closesAt = (wall: number) => {
    const d = dayOf(wall);
    return d?.allDay ? midnight(wall) + DAY_MS : midnight(wall) + clockMs(d?.to ?? "00:00");
  };
  const nextBusinessDayStart = (wall: number) => {
    let next = midnight(wall) + DAY_MS;
    for (let i = 0; i < 7; i++) {
      if (openDay(dayOf(next))) return opensAt(next);
      next += DAY_MS;
    }
    return next;
  };

  let remaining = thresholdSeconds * 1000;
  let current = start + offset;
  for (let guard = 0; remaining > 0 && guard < 10_000; guard++) {
    if (!openDay(dayOf(current))) {
      current = nextBusinessDayStart(current);
      continue;
    }
    if (current < opensAt(current)) current = opensAt(current);
    else if (current >= closesAt(current)) {
      current = nextBusinessDayStart(current);
      continue;
    }
    const available = closesAt(current) - current;
    if (remaining <= available) {
      current += remaining;
      remaining = 0;
    } else {
      remaining -= available;
      current = nextBusinessDayStart(current);
    }
  }
  return current - offset;
}

/** Chatwoot slaHelper.js formatSLATime: the two largest units (2h 30m, 1d 4h), "1m" under a minute. */
export function formatSlaTime(seconds: number): string {
  const units: [string, number][] = [
    ["y", 31_536_000],
    ["mo", 2_592_000],
    ["d", D],
    ["h", H],
    ["m", M],
  ];
  let remaining = Math.abs(seconds);
  if (remaining < 60) return "1m";
  const parts: string[] = [];
  for (const [unit, value] of units) {
    if (parts.length >= 2) break;
    const count = Math.floor(remaining / value);
    if (count > 0) {
      parts.push(`${count}${unit}`);
      remaining -= count * value;
    }
  }
  return parts.join(" ");
}

/** The times Chatwoot counts an applied SLA from (ms), as on the conversation. */
export interface SlaClock {
  createdAt: number;
  firstReplyAt: number | null;
  /** The customer's first message after the last agent reply (Chatwoot waiting_since), or null. */
  waitingSince: number | null;
  resolved: boolean;
}

export interface SlaStatus {
  kind: "FRT" | "NRT" | "RT";
  /** Seconds left (negative: overdue). */
  left: number;
  missed: boolean;
  /** The policy's threshold for this kind, in seconds. */
  threshold: number;
}

/** Chatwoot evaluateSLAStatus for an active applied SLA without recorded miss events. Null: nothing to show. */
export function evaluateSla(policy: Sla, clock: SlaClock, hours: WorkingHours | null, now: number): SlaStatus | null {
  const due = (from: number, seconds: number) => slaDeadline(from, seconds, policy.businessHours ? hours : null);
  const statuses: SlaStatus[] = [];
  const push = (kind: SlaStatus["kind"], dueAt: number, threshold: number) => {
    const left = Math.round((dueAt - now) / 1000);
    statuses.push({ kind, left, missed: left <= 0, threshold });
  };
  if (!clock.resolved) {
    // FRT until the first reply is made on time.
    if (policy.frt) {
      const frtDue = due(clock.createdAt, policy.frt);
      if (clock.firstReplyAt === null || clock.firstReplyAt > frtDue) push("FRT", frtDue, policy.frt);
    }
    if (policy.nrt && clock.firstReplyAt !== null && clock.waitingSince !== null)
      push("NRT", due(clock.waitingSince, policy.nrt), policy.nrt);
    if (policy.rt) push("RT", due(clock.createdAt, policy.rt), policy.rt);
  }
  if (!statuses.length) return null;
  statuses.sort((a, b) => Number(b.missed) - Number(a.missed) || Math.abs(a.left) - Math.abs(b.left));
  return statuses[0];
}
