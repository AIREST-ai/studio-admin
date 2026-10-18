import { NextResponse } from "next/server";

// F-19 (Fahad 82b: "the conversation does not open for two" -> the world standard is a notice, not a lock): who else
// has a conversation open in this preview, and whether they are typing. Chatwoot tells the other agents through
// ActionCable; the preview has no live channel, so each open conversation tab posts here every 2 s and gets back the
// others in that conversation. Kept in this server's memory only (like Chatwoot's presence, kept in Redis with an
// expiry): not saved to disk, not audited, gone when the preview server restarts, and Chatwoot is not told.
// POST { tab, conv, agentId, name, typing? } -> { others: [{ agentId, name, typing }] }
// POST { tab, conv, leave: true }: the tab closed the conversation or the page (sendBeacon on pagehide); its entry
//   goes at once, so the others' notice is gone at their next post (2 s).
//   tab: one browser tab (a random id per page load); a tab is in one conversation at a time.
// The times, from Chatwoot v4.18.0:
// - PRESENCE_MS 20 s: a tab that stops posting without leaving (crash, sleep) is dropped after 20 s, Chatwoot's
//   PRESENCE_DURATION (lib/online_status_tracker.rb: ENV.fetch('PRESENCE_DURATION', 20)).
// - TYPING_MS 30 s: "typing" left on is turned off after 30 s, as Chatwoot's dashboard does
//   (app/javascript/dashboard/helper/actionCable.js initTimer: "Turn off typing automatically after 30 seconds").
//   The typer's own page turns it off after 4 s without a key (WootWriter/Editor.vue TYPING_INDICATOR_IDLE_TIME).
export const dynamic = "force-dynamic";

const PRESENCE_MS = 20_000;
const TYPING_MS = 30_000;
const headers = { "Cache-Control": "no-store" };

interface Entry {
  tab: string;
  conv: number;
  agentId: number;
  name: string;
  typing: boolean;
  typingAt: number;
  seenAt: number;
}

// One map for the whole server process, kept across hot reloads of this file.
const holder = globalThis as typeof globalThis & { __studioPresence?: Map<string, Entry> };
const entries: Map<string, Entry> = holder.__studioPresence ?? new Map();
holder.__studioPresence = entries;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function prune(now: number) {
  for (const [tab, entry] of entries) {
    if (now - entry.seenAt > PRESENCE_MS) entries.delete(tab);
    else if (entry.typing && now - entry.typingAt > TYPING_MS) entry.typing = false;
  }
}

const whole = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1e7;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const raw = await request.text();
  if (raw.length > 2000) return fail(413, "request too large");
  let parsed: Record<string, unknown> | null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown> | null;
  } catch {
    return fail(400, "body is not JSON");
  }
  const body = parsed ?? {};
  const { tab, conv, agentId, name } = body;
  if (typeof tab !== "string" || !/^[a-z0-9-]{6,64}$/.test(tab)) return fail(400, "tab must be an id");
  const now = Date.now();
  prune(now);
  if (body.leave === true) {
    // Only the conversation it left: a late "leave" must not drop the conversation the tab opened next.
    if (entries.get(tab)?.conv === conv) entries.delete(tab);
    return NextResponse.json({ others: [] }, { headers });
  }
  if (!whole(conv) || !whole(agentId)) return fail(400, "conv and agentId must be whole numbers");
  if (typeof name !== "string" || !name.trim() || name.length > 200) return fail(400, "name is required");
  const typing = body.typing === true;
  const before = entries.get(tab);
  // A tab that keeps saying "typing" (keys within 4 s) keeps its start time, so the 30 s cap can apply.
  let typingAt = 0;
  if (typing) typingAt = before?.typing && before.conv === conv ? before.typingAt : now;
  entries.set(tab, {
    tab,
    conv: conv as number,
    agentId: agentId as number,
    name: name.trim(),
    typing,
    typingAt,
    seenAt: now,
  });
  // The other people in this conversation: other agents only (the same agent in two tabs is not "someone else"),
  // one line per person, typing if any of their tabs is typing.
  const others = new Map<number, { agentId: number; name: string; typing: boolean }>();
  for (const entry of entries.values()) {
    if (entry.conv !== conv || entry.tab === tab || entry.agentId === agentId) continue;
    const seen = others.get(entry.agentId);
    others.set(entry.agentId, {
      agentId: entry.agentId,
      name: entry.name,
      typing: (seen?.typing ?? false) || entry.typing,
    });
  }
  return NextResponse.json({ others: [...others.values()] }, { headers });
}
