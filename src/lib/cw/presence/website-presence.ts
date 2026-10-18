// T-268 (item 105): customer presence for Website (live chat widget) contacts only, as Chatwoot v4.18.0 CE
// does it. The widget pings every 60 s and a contact counts as online for CONTACT_PRESENCE_DURATION after the last
// ping (lib/online_status_tracker.rb:4-5, :14-18). No other channel has a presence source, so they never show one.
// Recent messages are not presence. Until a real widget heartbeat is bound, every contact is "unavailable".

export const CONTACT_PRESENCE_DURATION_MS = 90_000;

// The Website channel id in channelItems (src/app/(main)/chat/_components/data.ts).
export const WEBSITE_CHANNEL = "chat";

export type PresenceState = "online" | "offline" | "unavailable" | "not-applicable";

export type PresenceSource = {
  lastHeartbeatAt(contactId: number): number | undefined;
};

let source: PresenceSource | null = null;

// Bind the real heartbeat feed (Chatwoot presence.update) here once the account is linked.
export function bindPresenceSource(next: PresenceSource) {
  source = next;
}

export function unbindPresenceSource() {
  source = null;
}

// In-memory heartbeat set (Chatwoot keeps a Redis sorted set). Starts empty, so a reload never carries presence over.
export function createHeartbeatStore() {
  const last = new Map<number, number>();
  return {
    heartbeat(contactId: number, at: number) {
      last.set(contactId, at);
    },
    lastHeartbeatAt(contactId: number) {
      return last.get(contactId);
    },
  };
}

// Test fixture only: a headless test may set this global before the page loads. Never set by the app.
type Fixture = { heartbeats: Record<number, number>; now?: number };
function fixtureSource(): { source: PresenceSource; now?: number } | null {
  if (process.env.NODE_ENV === "production") return null;
  const fixture = (globalThis as { __T268_PRESENCE_FIXTURE__?: Fixture }).__T268_PRESENCE_FIXTURE__;
  if (!fixture) return null;
  return { source: { lastHeartbeatAt: (id) => fixture.heartbeats[id] }, now: fixture.now };
}

export function websitePresence(channel: string, contactId: number | null, now = Date.now()): PresenceState {
  if (channel !== WEBSITE_CHANNEL) return "not-applicable";
  const fixture = fixtureSource();
  const feed = source ?? fixture?.source ?? null;
  if (!feed) return "unavailable";
  if (contactId === null) return "offline";
  const at = feed.lastHeartbeatAt(contactId);
  const clock = source ? now : (fixture?.now ?? now);
  return at !== undefined && at > clock - CONTACT_PRESENCE_DURATION_MS ? "online" : "offline";
}

export function isWebsiteContactOnline(channel: string, contactId: number | null, now = Date.now()) {
  return websitePresence(channel, contactId, now) === "online";
}
