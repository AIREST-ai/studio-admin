import { NextResponse } from "next/server";

import { PRODUCT_NAME } from "@/config/app-config";
import {
  flushPendingAuditEvents,
  publishAuditEvents,
  RETRACED_URL,
  RetracedError,
  type RetracedEvent,
  searchAuditEvents,
} from "@/lib/audit/retraced";
import { AUDIT_SOURCE } from "@/lib/audit/with-audit";
import { BIGCAPITAL_URL } from "@/lib/bigcapital/server";
import { DAVIS_URL } from "@/lib/davis/server";
import {
  FEED_ACTION_QUERY,
  FEED_LIMIT,
  FEED_START,
  feedFromEvents,
  SERVICES,
  type ServiceCheck,
  serviceTransitions,
} from "@/lib/notifications/feed";
import { ownNames } from "@/lib/own-names";
import { TWENTY_URL } from "@/lib/twenty/server";

// F-10 (Fahad item 51b): the bell's System, Sign-ups, Changes and Approvals notifications, read from the preview's
// activity log (Retraced, M129-E). GET -> { items, services, start } (lib/notifications/feed.ts makes the rows).
// Each GET also starts a check of the services the preview uses (at most every 30 s, in the background, so the answer
// never waits for it); a service that stops answering is written to the log once as "service.down", and "service.up"
// when it answers again, so those notifications come from the same log and stay after a reload or a server restart.
// Read / unread is kept by the page (notifications-store.ts).
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const CHECK_EVERY_MS = 30_000;
// "Not answering" means what each service's own client in this app treats as not reachable: Retraced 8 s
// (lib/audit/retraced.ts), Bigcapital and Twenty 20 s (lib/bigcapital/server.ts, lib/twenty/server.ts); the Davis
// client sets none, so it gets Retraced's 8 s. (A first version waited 3 s and logged one false "Retraced down".)
const TIMEOUTS_MS: Record<ServiceCheck["id"], number> = {
  retraced: 8_000,
  bigcapital: 20_000,
  twenty: 20_000,
  davis: 8_000,
};

const PROBES: Record<string, string> = {
  retraced: `${RETRACED_URL}/`,
  bigcapital: `${BIGCAPITAL_URL}/`,
  twenty: `${TWENTY_URL}/healthz`,
  davis: `${DAVIS_URL}/`,
};

async function probe(id: ServiceCheck["id"]): Promise<ServiceCheck> {
  try {
    const response = await fetch(PROBES[id], { cache: "no-store", signal: AbortSignal.timeout(TIMEOUTS_MS[id]) });
    await response.body?.cancel();
    if (response.status >= 500) return { id, ok: false, error: `answered ${response.status}` };
    return { id, ok: true, error: null };
  } catch (error) {
    const reason =
      (error as Error).name === "TimeoutError" ? `no answer in ${TIMEOUTS_MS[id] / 1000} s` : "not reachable";
    return { id, ok: false, error: `${reason} at ${PROBES[id]}` };
  }
}

/** The newest recorded state of each service, from the log. */
async function recordedStates(): Promise<Map<string, "down" | "up">> {
  const { events } = await searchAuditEvents({
    query: "action:service.down,service.up",
    pageOffset: 0,
    pageLimit: 50,
    sortOrder: "desc",
  });
  const last = new Map<string, "down" | "up">();
  for (const event of events) {
    const id = event.target?.id;
    if (id && !last.has(id)) last.set(id, event.action === "service.down" ? "down" : "up");
  }
  return last;
}

let lastCheck: { at: number; checks: ServiceCheck[] } | null = null;
let checking: Promise<ServiceCheck[]> | null = null;

/** One check at a time for the whole server, reused for 30 s. */
function checkServices(): Promise<ServiceCheck[]> {
  if (lastCheck && Date.now() - lastCheck.at < CHECK_EVERY_MS) return Promise.resolve(lastCheck.checks);
  checking ??= (async () => {
    try {
      const checks = await Promise.all(SERVICES.map((s) => probe(s.id)));
      // When Retraced itself is down the states cannot be read: its own "down" is recorded (kept in the pending
      // file until it answers again), the others wait for the next check.
      const retracedDown = checks.find((c) => c.id === "retraced" && !c.ok);
      const last = retracedDown ? new Map<string, "down" | "up">() : await recordedStates();
      const changes = serviceTransitions(last, retracedDown ? [retracedDown] : checks);
      if (changes.length) {
        const now = new Date().toISOString();
        await publishAuditEvents(
          changes.map((change) => {
            const service = SERVICES.find((s) => s.id === change.id);
            // F-16: stored and shown without the vendor names (lib/own-names.ts).
            const name = ownNames(service?.name ?? change.id);
            return {
              action: `service.${change.to}`,
              crud: "u" as const,
              created: now,
              description: ownNames(
                change.to === "down"
                  ? `${name} stopped answering the preview server (${change.error})`
                  : `${name} answers the preview server again`,
              ),
              group: { id: "studio-preview", name: `${PRODUCT_NAME} preview` },
              actor: { id: "system", name: `${PRODUCT_NAME} preview server` },
              target: { id: change.id, name, type: "service" },
              is_failure: change.to === "down",
              ...AUDIT_SOURCE,
              external_id: `service:${change.id}:${change.to}:${now}`,
              fields: {
                result: change.to === "down" ? `down: ${change.error}` : "up",
                checked: PROBES[change.id],
                source: `${PRODUCT_NAME} preview server (Next.js on 8797), notifications feed check`,
              },
            };
          }),
        );
      }
      lastCheck = { at: Date.now(), checks };
      return checks;
    } finally {
      checking = null;
    }
  })();
  return checking;
}

const asFeedEvent = (event: RetracedEvent) => ({
  id: event.id,
  action: event.action,
  created: event.created,
  // F-16: older lines were recorded with the vendor names ("Retraced (Audit Logs) …"); shown in the product's words.
  description: ownNames(event.description),
  is_failure: event.is_failure,
  target: event.target ? { ...event.target, name: ownNames(event.target.name) } : event.target,
  fields: event.fields,
});

export async function GET() {
  const created = `created:${FEED_START},2100-01-01T00:00:00Z`;
  // In the background: a "service.down" it records shows at the next read of the feed (the bell reads every 30 s).
  checkServices().catch((error: Error) => console.error(`[notifications feed] service check failed: ${error.message}`));
  const services = lastCheck?.checks ?? [];
  try {
    await flushPendingAuditEvents();
    const [changes, failures] = await Promise.all([
      searchAuditEvents({
        query: `${FEED_ACTION_QUERY} ${created}`,
        pageOffset: 0,
        pageLimit: FEED_LIMIT,
        sortOrder: "desc",
      }),
      // Failed requests of any kind (Retraced matches the description's word "Failed"; is_failure is checked below).
      searchAuditEvents({
        query: `description:failed ${created}`,
        pageOffset: 0,
        pageLimit: FEED_LIMIT,
        sortOrder: "desc",
      }),
    ]);
    const events = [...changes.events, ...failures.events.filter((e) => e.is_failure)].map(asFeedEvent);
    return NextResponse.json(
      {
        items: feedFromEvents(events),
        services,
        start: FEED_START,
        source: { system: "Audit log server", url: RETRACED_URL },
      },
      { headers },
    );
  } catch (error) {
    const status = error instanceof RetracedError ? error.status : 500;
    return NextResponse.json(
      { error: ownNames((error as Error).message), items: [], services, start: FEED_START },
      { status, headers },
    );
  }
}
