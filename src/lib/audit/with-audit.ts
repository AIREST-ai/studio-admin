// M129-E (Fahad 129.5): THE one wrapper. Every preview route handler that changes something is exported through
// `withAudit`, which (1) reads the route's saved data before the change, (2) runs the handler, (3) asks the route's
// describer (./describe.ts) what changed, and (4) publishes one Retraced event per change with the standard fields
// (OWASP Logging Cheat Sheet "when, where, who, what", https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
//   when   created (UTC) · where  group "studio-preview", route, source_ip, user agent, request id
//   who    actor (the person the page is viewed as, else the preview's signed-in sample agent; the preview has no
//          login) · what  action, crud, target
//   before/after values with secrets masked · result success or failure with the reason.
// A failed request is logged too (is_failure). Publishing happens after the response (next/server `after`) and never
// fails the user's request; events Retraced cannot take are kept and sent later (./retraced.ts PENDING_FILE).
import { after } from "next/server";

import { APP_CONFIG, PRODUCT_NAME } from "@/config/app-config";
import { CURRENT_USER_ID, agents as seedAgents } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";

import { publishAuditEvents, type RetracedEventInput } from "./retraced";

export type Crud = "c" | "r" | "u" | "d";

/** One change a request made, as a describer reports it. The wrapper adds who, when, where and the result. */
export interface AuditChange {
  /** "<object>.<verb>", e.g. "team.delete", "agent.role_change". */
  action: string;
  crud: Crud;
  /** English sentence without the actor, e.g. 'deleted the team "Sales"'. The wrapper puts the actor's name first. */
  summary: string;
  target: { id: string | number; name: string; type: string };
  before?: unknown;
  after?: unknown;
}

export interface AuditContext<S> {
  request: Request;
  url: URL;
  method: string;
  /** Parsed JSON body, or null (no body, not JSON, or a file upload). */
  json: unknown;
  /** The route's saved data read just before the handler ran (spec.snapshot), if the route has one. */
  before: S | undefined;
  status: number;
  /** Parsed JSON response, or null. */
  response: unknown;
  params: Record<string, string>;
}

export interface AuditSpec<S> {
  /** Name of the route's area, used for the fallback action when a describer reports nothing for a failure. */
  area: string;
  snapshot?: (request: Request) => Promise<S>;
  describe: (context: AuditContext<S>) => AuditChange[] | Promise<AuditChange[]>;
}

// ---- secrets ------------------------------------------------------------------------------------------------

const SECRET_KEY =
  /pass(word)?|secret|token|api[-_]?key|authori[sz]ation|cookie|session|private[-_]?key|access[-_]?key|credential|otp|signature/i;
const MAX_VALUE_CHARS = 3_000;

/** Deep copy with every value under a secret-looking key replaced by "[redacted]". */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[too deep]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(item, depth + 1);
    return out;
  }
  if (typeof value === "string" && value.length > 1_000) return `${value.slice(0, 1_000)}… (${value.length} chars)`;
  return value;
}

const asField = (value: unknown) => {
  if (value === undefined) return undefined;
  const text = JSON.stringify(redact(value));
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}… (cut, ${text.length} chars)` : text;
};

// ---- who and where ------------------------------------------------------------------------------------------

export interface AuditActor {
  id: string;
  name: string;
  role: string;
  /** True when the actor is a person the page is viewed as (View as), not the signed-in sample administrator. */
  viewingAs: boolean;
  /** The signed-in sample administrator, who is behind a View as page. */
  signedInName: string;
}

/** The agent number in the browser's "View as" cookie (lib/cw/view-as-cookie.ts), or null. */
function viewAsOf(request: Request): number | null {
  const value = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === VIEW_AS_COOKIE)?.[1];
  return parseViewAs(value ?? null);
}

/**
 * Who made the change. F-25 (F-24's note: "the actor is always Arham Khan, also when a macro is deleted under View as
 * Priya"): Chatwoot records the current user (the audited gem's current_user_method defaults to :current_user, and
 * Chatwoot's config/initializers/audited.rb leaves it so), and in the preview the current user is the person the page is
 * viewed as. The preview has no login, so it is the sample signed-in agent (lib/cw/data.ts CURRENT_USER_ID) unless the
 * request carries the View as cookie of an agent that is in the saved list.
 * https://github.com/collectiveidea/audited/blob/master/lib/audited.rb (current_user_method)
 * https://github.com/chatwoot/chatwoot/blob/v4.18.0/config/initializers/audited.rb
 */
export async function currentActor(request?: Request): Promise<AuditActor> {
  let agents = seedAgents as { id: number; name: string; role: string }[];
  try {
    const saved = await readPreviewState();
    if (saved?.lists?.agents?.length) agents = saved.lists.agents as unknown as typeof agents;
  } catch {
    // unreadable saved lists: the seed name is still the right person
  }
  const signedIn = agents.find((agent) => agent.id === CURRENT_USER_ID) ?? seedAgents[0];
  const asId = request ? viewAsOf(request) : null;
  const viewed = asId === null ? undefined : agents.find((agent) => agent.id === asId);
  const me = viewed ?? signedIn;
  return {
    id: `agent-${me.id}`,
    name: me.name,
    role: me.role,
    viewingAs: Boolean(viewed),
    signedInName: signedIn.name,
  };
}

// Retraced accepts only these (IPV4_REGEX in src/handlers/createEvent.ts); anything else goes to fields.source_ip.
const IPV4 = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;

function sourceIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "";
  return ip.replace(/^::ffff:/, "");
}

// ---- the wrapper --------------------------------------------------------------------------------------------

const GROUP = { id: "studio-preview", name: `${PRODUCT_NAME} preview` };
/**
 * F-23 (Fahad 15 Oct 15:20: "even the internal names all change to my name"): the component and version every new
 * event carries inside the audit log server, from PRODUCT_NAME (they were "studio-preview" and "studio-admin 2.2.0").
 * Events already logged keep theirs: the audit log server has no API to change an event. The group id above stays: it
 * is the key the saved exports, read tokens and viewer sessions are kept under (lib/audit/retraced.ts AUDIT_GROUP_ID).
 */
export const AUDIT_SOURCE = {
  component: `${PRODUCT_NAME.toLowerCase()}-preview`,
  version: `${PRODUCT_NAME} ${APP_CONFIG.version}`,
};
const VERB: Record<string, string> = { POST: "create", PUT: "save", PATCH: "update", DELETE: "delete" };
const CRUD_OF: Record<string, Crud> = { POST: "c", PUT: "u", PATCH: "u", DELETE: "d" };

// One request per area at a time: the "before" read and the handler's write cannot interleave with another tab's
// save of the same data, so a change is never reported twice or missed.
const queues = new Map<string, Promise<unknown>>();
function inOrder<T>(area: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(area) ?? Promise.resolve();
  const run = previous.then(task, task);
  queues.set(
    area,
    run.catch(() => undefined),
  );
  return run;
}

function errorOf(response: unknown): string {
  const error = (response as { error?: unknown } | null)?.error;
  return typeof error === "string" ? error : "";
}

type Handler<P> = (request: Request, context: P) => Promise<Response>;

export function withAudit<S, P = unknown>(spec: AuditSpec<S>, handler: Handler<P>): Handler<P> {
  return async (request: Request, context: P) => {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    const type = request.headers.get("content-type") ?? "";
    // A JSON body is read here and handed to the handler again; uploads are left untouched (the response names them).
    let json: unknown = null;
    let forward = request;
    if (type.includes("application/json")) {
      const text = await request.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const headers = new Headers(request.headers);
      headers.delete("content-length"); // recomputed from the same text
      forward = new Request(request.url, { method, headers, body: text });
    }

    const { response, before } = await inOrder(spec.area, async () => {
      let before: S | undefined;
      try {
        before = spec.snapshot ? await spec.snapshot(request) : undefined;
      } catch {
        before = undefined;
      }
      return { response: await handler(forward, context), before };
    });

    const status = response.status;
    const answer: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    const params = ((await (context as { params?: Promise<Record<string, string>> } | undefined)?.params) ??
      {}) as Record<string, string>;

    after(async () => {
      try {
        let changes = await spec.describe({ request, url, method, json, before, status, response: answer, params });
        const failed = status >= 400;
        if (!changes.length && failed)
          changes = [
            {
              action: `${spec.area}.${VERB[method] ?? method.toLowerCase()}`,
              crud: CRUD_OF[method] ?? "u",
              summary: `tried to ${VERB[method] ?? method.toLowerCase()} ${spec.area.replace(/_/g, " ")}`,
              target: { id: url.pathname, name: url.pathname, type: spec.area },
              after: json ?? undefined,
            },
          ];
        if (!changes.length) return; // nothing changed (e.g. a save of identical data): nothing to log
        const actor = await currentActor(request);
        const ip = sourceIp(request);
        const requestId = crypto.randomUUID();
        const result = failed ? `failed: ${status}${errorOf(answer) ? ` ${errorOf(answer)}` : ""}` : "success";
        const now = new Date().toISOString();
        const events: RetracedEventInput[] = changes.map((change, index) => {
          const fields: Record<string, string> = {
            result,
            route: `${method} ${url.pathname}${url.search}`,
            request_id: requestId,
            user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
            actor_role: actor.role,
            sign_in: actor.viewingAs
              ? `viewing as ${actor.name} (the preview has no login; the sample signed-in agent is ${actor.signedInName})`
              : "sample signed-in agent (the preview has no login)",
            source: `${PRODUCT_NAME} preview server (Next.js on 8797)`,
          };
          const beforeText = asField(change.before);
          const afterText = asField(change.after);
          if (beforeText !== undefined) fields.before = beforeText;
          if (afterText !== undefined) fields.after = afterText;
          if (ip && !IPV4.test(ip)) fields.source_ip = ip;
          return {
            action: change.action,
            crud: change.crud,
            created: now,
            description: failed
              ? `Failed (${status}): ${actor.name} ${change.summary}`
              : `${actor.name} ${change.summary}`,
            group: GROUP,
            actor: { id: actor.id, name: actor.name, fields: { role: actor.role } },
            target: {
              id: String(change.target.id),
              name: change.target.name || String(change.target.id),
              type: change.target.type,
            },
            ...(ip && IPV4.test(ip) ? { source_ip: ip } : {}),
            is_failure: failed,
            ...AUDIT_SOURCE,
            external_id: `${requestId}:${index}`,
            fields,
          };
        });
        await publishAuditEvents(events);
      } catch (error) {
        console.error(`[audit] ${spec.area}: could not describe or publish: ${(error as Error).message}`);
      }
    });

    return response;
  };
}
