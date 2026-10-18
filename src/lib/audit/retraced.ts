// M129-E (Fahad 129.5: "a permanent, automatic, complete activity log ... a full system, not something we build"):
// server-side client for the local Retraced install (retracedhq/retraced:1.13.1, Apache-2.0, docker project "retraced"
// on the colima "lab" machine, API published on 127.0.0.1:3495 only; install notes in /Users/ali/lobehub-hub/retraced/).
// Only Next.js route handlers import this file, so the API key never reaches the browser.
// API used (Retraced v1.13.1 source):
// - POST /publisher/v1/project/{projectId}/event/bulk  { events } (src/controllers/PublisherController.ts, max 50)
// - POST /publisher/v1/project/{projectId}/graphql     searchPaginated + counts (src/handlers/graphql/schema.ts)
// Auth header: "Authorization: token=<api key>" (src/security/helpers.ts).
// Retraced has no API to edit or delete an event, and this file only creates and reads: the log is append-only.
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const RETRACED_URL = process.env.RETRACED_URL ?? "http://127.0.0.1:3495/auditlog";
export const RETRACED_PROJECT_ID = process.env.RETRACED_PROJECT_ID ?? "studio-preview";
const KEY_FILE = process.env.RETRACED_API_KEY_FILE ?? "/Users/ali/lobehub-hub/retraced/preview-api-key.txt";
/** Events Retraced did not accept yet (it was down): sent again, oldest first, before the next new event. */
export const PENDING_FILE = path.join(process.cwd(), ".preview-state", "audit-pending.jsonl");
const BULK_MAX = 50;

/** One event as Retraced's publisher API takes it (createEventRequestSchema in src/handlers/createEvent.ts). */
export interface RetracedEventInput {
  action: string;
  crud: "c" | "r" | "u" | "d";
  created: string;
  description: string;
  group: { id: string; name: string };
  actor: { id: string; name: string; fields?: Record<string, string> };
  target?: { id: string; name: string; type: string; fields?: Record<string, string> };
  source_ip?: string;
  is_failure?: boolean;
  component?: string;
  version?: string;
  external_id?: string;
  fields?: Record<string, string>;
}

export class RetracedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let cachedKey: string | null = null;
async function apiKey() {
  if (process.env.RETRACED_API_KEY) return process.env.RETRACED_API_KEY;
  if (cachedKey) return cachedKey;
  try {
    cachedKey = (await readFile(KEY_FILE, "utf8")).trim();
  } catch {
    throw new RetracedError("The audit log server's API key is not configured on the preview server", 503);
  }
  return cachedKey;
}

async function call(pathname: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${RETRACED_URL}/publisher/v1/project/${RETRACED_PROJECT_ID}${pathname}`, {
      method: "POST",
      headers: { Authorization: `token=${await apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    if (error instanceof RetracedError) throw error;
    throw new RetracedError("The audit log server is not reachable", 502);
  }
  const text = await response.text();
  if (!response.ok)
    throw new RetracedError(`The audit log server answered ${response.status}: ${text.slice(0, 300)}`, 502);
  return text ? JSON.parse(text) : null;
}

// F-3: Retraced refuses a whole batch when one event's target has no id (400 "Field 'target.id' is required"), so one
// such event kept every later one pending. An empty target id or name is given the target's type instead.
function withTargetId(event: RetracedEventInput): RetracedEventInput {
  const target = event.target;
  if (!target || (target.id && target.name)) return event;
  const fallback = target.type || "unknown";
  return { ...event, target: { ...target, id: target.id || fallback, name: target.name || target.id || fallback } };
}

async function sendBulk(events: RetracedEventInput[]) {
  const ready = events.map(withTargetId);
  for (let i = 0; i < ready.length; i += BULK_MAX) await call("/event/bulk", { events: ready.slice(i, i + BULK_MAX) });
}

// One send at a time, so the pending file is never read and rewritten by two requests together.
let sending: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = sending.then(task, task);
  sending = run.catch(() => undefined);
  return run;
}

async function readPending(): Promise<RetracedEventInput[]> {
  try {
    const text = await readFile(PENDING_FILE, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RetracedEventInput);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function clearPending() {
  const temp = `${PENDING_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, "");
  await rename(temp, PENDING_FILE);
}

export interface PublishResult {
  /** Events Retraced accepted in this call (pending ones sent again included). */
  sent: number;
  /** Events kept in PENDING_FILE because Retraced did not accept them; sent on the next call. */
  pending: number;
  error: string | null;
}

/**
 * Sends `events` to Retraced. When Retraced is down they are kept on the preview disk (PENDING_FILE) and sent before
 * the next event, so an action is never dropped silently. The caller's request is never failed by this.
 */
export function publishAuditEvents(events: RetracedEventInput[]): Promise<PublishResult> {
  return serial(async () => {
    const queue = [...(await readPending()), ...events];
    if (!queue.length) return { sent: 0, pending: 0, error: null };
    try {
      await sendBulk(queue);
      if (queue.length > events.length) await clearPending();
      return { sent: queue.length, pending: 0, error: null };
    } catch (error) {
      await mkdir(path.dirname(PENDING_FILE), { recursive: true });
      if (events.length) await appendFile(PENDING_FILE, `${events.map((e) => JSON.stringify(e)).join("\n")}\n`);
      console.error(`[audit] Retraced did not take ${queue.length} event(s): ${(error as Error).message}`);
      return { sent: 0, pending: queue.length, error: (error as Error).message };
    }
  });
}

/** Sends what is waiting in PENDING_FILE, if anything (called before every read of the log). */
export const flushPendingAuditEvents = () => publishAuditEvents([]);

export async function pendingAuditCount(): Promise<number> {
  return (await readPending()).length;
}

// ---- reading -------------------------------------------------------------------------------------------------

export interface RetracedEvent {
  id: string;
  action: string;
  crud: string | null;
  created: string;
  received: string;
  description: string | null;
  is_failure: boolean | null;
  source_ip: string | null;
  actor: { id: string; name: string | null; fields: { key: string; value: string }[] | null } | null;
  target: { id: string; name: string | null; type: string | null } | null;
  fields: { key: string; value: string }[] | null;
  /** F-22: filled by the audit log server only when its IP-location lookup is on (it is off here: see geoStatus). */
  country?: string | null;
  loc_subdiv1?: string | null;
  loc_subdiv2?: string | null;
}

const EVENT_FIELDS = `id action crud created received description is_failure source_ip country loc_subdiv1 loc_subdiv2
  actor { id name fields { key value } } target { id name type } fields { key value }`;

/**
 * One page of events, filtered by Retraced itself (structured search: action:, actor.id:, created:from,to and free
 * text; see parseQuery in src/models/event/index.ts and the Postgres filter in src/models/event/filter.ts).
 */
export async function searchAuditEvents(options: {
  query: string;
  pageOffset: number;
  pageLimit: number;
  sortOrder: "asc" | "desc";
}): Promise<{ total: number; events: RetracedEvent[] }> {
  const body = (await call("/graphql", {
    query: `query Page($query: String!, $pageOffset: Int, $pageLimit: Int, $sortOrder: sortOrder) {
      searchPaginated(query: $query, pageOffset: $pageOffset, pageLimit: $pageLimit, sortOrder: $sortOrder) {
        totalCount edges { node { ${EVENT_FIELDS} } }
      }
    }`,
    variables: options,
  })) as {
    data?: { searchPaginated?: { totalCount: number; edges: { node: RetracedEvent }[] } };
    errors?: { message: string }[];
  };
  if (body.errors?.length) throw new RetracedError(`The audit log search failed: ${body.errors[0].message}`, 400);
  const result = body.data?.searchPaginated;
  return { total: result?.totalCount ?? 0, events: (result?.edges ?? []).map((edge) => edge.node) };
}

/** F-18a: one event with only what the page's totals and filter lists need (lighter than EVENT_FIELDS). */
export interface RetracedEventBrief {
  action: string;
  crud: string | null;
  created: string;
  is_failure: boolean | null;
  actor: { id: string; name: string | null } | null;
}

/**
 * F-18a: the newest events (up to `max`), with only action, time, failure and actor, read in pages of 2,000. The
 * Audit Logs page's totals (last 24 hours, last 7 days, failed, people, per section) and its filter lists come from
 * this, because Retraced's own `counts` query works on Elasticsearch only (src/models/event/countBy.ts) and this
 * install runs on Postgres alone (PG_SEARCH).
 */
export async function scanAuditEvents(max = 10_000): Promise<{ total: number; events: RetracedEventBrief[] }> {
  const events: RetracedEventBrief[] = [];
  let total = 0;
  for (let offset = 0; offset < max; offset += 2000) {
    const body = (await call("/graphql", {
      query: `query Scan($pageOffset: Int, $pageLimit: Int) {
        searchPaginated(query: "", pageOffset: $pageOffset, pageLimit: $pageLimit, sortOrder: desc) {
          totalCount edges { node { action crud created is_failure actor { id name } } }
        }
      }`,
      variables: { pageOffset: offset, pageLimit: Math.min(2000, max - offset) },
    })) as {
      data?: { searchPaginated?: { totalCount: number; edges: { node: RetracedEventBrief }[] } };
      errors?: { message: string }[];
    };
    if (body.errors?.length) throw new RetracedError(`The audit log search failed: ${body.errors[0].message}`, 400);
    const result = body.data?.searchPaginated;
    total = result?.totalCount ?? total;
    const page = (result?.edges ?? []).map((edge) => edge.node);
    events.push(...page);
    if (page.length < 2000 || events.length >= total) break;
  }
  return { total, events };
}

// ---- F-22: saved exports, read tokens, IP location ------------------------------------------------------------
// Fahad 15 Oct ("I mean the whole system … I want my own system"): what the audit log system offers beyond the list,
// through its own API (Retraced v1.13.1 source):
// - Saved exports: POST /viewer/v1/project/{projectId}/export { name, exportBody } and GET …/exports
//   (src/handlers/viewer/createExport.ts, listExports.ts; stored in its table saved_export, models/saved_export/*).
//   The viewer API takes a viewer session: GET /publisher/v1/project/{projectId}/viewertoken?group_id&actor_id
//   (PublisherController.createViewerDescriptor), then POST /viewer/v1/viewersession { token } -> { token } (a signed
//   voucher, src/handlers/createViewerSession.ts). The token behind a voucher is accepted for 5 minutes after it is
//   made (models/viewer_descriptor/get.ts: created > now - 5 minutes), so a voucher is kept 4 minutes here.
//   The system has no API to delete a saved export (src/routes.ts lists create, list, update and render only).
// - Read tokens ("Enterprise IT API" tokens): POST/GET/DELETE /publisher/v1/project/{projectId}/group/{groupId}/
//   enterprisetoken (PublisherController.ts lines 169-312). A token reads its group's events through
//   POST /enterprise/v1/graphql with "Authorization: token=<token>" (EnterpriseController.graphqlPost), and every such
//   read is recorded by the system itself as the token's view_log_action, actor "enterprise:<first 7 characters>".

/** The one group every event of this preview is recorded in (with-audit.ts GROUP.id). */
export const AUDIT_GROUP_ID = "studio-preview";
/** The action the audit log server records for each read made with a read token (its view_log_action). */
export const TOKEN_READ_ACTION = "audit_log.token_read";

const PROJECT_PATH = `/publisher/v1/project/${RETRACED_PROJECT_ID}`;
const TOKEN_PATH = `${PROJECT_PATH}/group/${AUDIT_GROUP_ID}/enterprisetoken`;

async function send(
  method: "GET" | "POST" | "DELETE",
  pathname: string,
  options: { auth?: string; body?: unknown } = {},
): Promise<{ status: number; text: string }> {
  let response: Response;
  try {
    response = await fetch(`${RETRACED_URL}${pathname}`, {
      method,
      headers: {
        ...(options.auth ? { Authorization: options.auth } : {}),
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof RetracedError) throw error;
    throw new RetracedError("The audit log server is not reachable", 502);
  }
  return { status: response.status, text: await response.text() };
}

const ok = (status: number) => status >= 200 && status < 300;
const refused = (what: string, answer: { status: number; text: string }) =>
  new RetracedError(`The audit log server refused to ${what} (${answer.status}): ${answer.text.slice(0, 200)}`, 502);

let viewer: { voucher: string; at: number } | null = null;
const VIEWER_MS = 4 * 60_000;

async function viewerVoucher(): Promise<string> {
  if (viewer && Date.now() - viewer.at < VIEWER_MS) return viewer.voucher;
  const query = new URLSearchParams({ group_id: AUDIT_GROUP_ID, actor_id: "audit-log-page" });
  const made = await send("GET", `${PROJECT_PATH}/viewertoken?${query}`, { auth: `token=${await apiKey()}` });
  if (!ok(made.status)) throw refused("open a viewer session", made);
  const { token } = JSON.parse(made.text) as { token: string };
  const session = await send("POST", "/viewer/v1/viewersession", { body: { token } });
  if (!ok(session.status)) throw refused("open a viewer session", session);
  viewer = { voucher: (JSON.parse(session.text) as { token: string }).token, at: Date.now() };
  return viewer.voucher;
}

/** A viewer API call; a refused voucher (older than the server allows) is replaced once. */
async function viewerCall(method: "GET" | "POST", pathname: string, body?: unknown) {
  let answer = await send(method, pathname, { auth: await viewerVoucher(), body });
  if (!ok(answer.status)) {
    viewer = null;
    answer = await send(method, pathname, { auth: await viewerVoucher(), body });
  }
  return answer;
}

export interface SavedExportRecord {
  id: string;
  name: string;
  /** The saved query (the system's query descriptor, JSON). */
  body: string;
  saved_at?: string | null;
}

export async function listSavedExports(): Promise<SavedExportRecord[]> {
  const answer = await viewerCall("GET", `/viewer/v1/project/${RETRACED_PROJECT_ID}/exports`);
  if (!ok(answer.status)) throw refused("list the saved exports", answer);
  return (JSON.parse(answer.text) as SavedExportRecord[]) ?? [];
}

export async function createSavedExport(name: string, body: string): Promise<SavedExportRecord> {
  const answer = await viewerCall("POST", `/viewer/v1/project/${RETRACED_PROJECT_ID}/export`, {
    name,
    exportBody: body,
  });
  if (!ok(answer.status)) throw refused("save the export", answer);
  return JSON.parse(answer.text) as SavedExportRecord;
}

export interface ReadTokenRecord {
  token: string;
  display_name: string;
}

export async function listReadTokens(): Promise<ReadTokenRecord[]> {
  const answer = await send("GET", TOKEN_PATH, { auth: `token=${await apiKey()}` });
  if (!ok(answer.status)) throw refused("list the read tokens", answer);
  return (JSON.parse(answer.text) as ReadTokenRecord[]) ?? [];
}

export async function createReadToken(displayName: string): Promise<ReadTokenRecord> {
  const answer = await send("POST", TOKEN_PATH, {
    auth: `token=${await apiKey()}`,
    body: { display_name: displayName, view_log_action: TOKEN_READ_ACTION },
  });
  if (!ok(answer.status)) throw refused("create the read token", answer);
  return JSON.parse(answer.text) as ReadTokenRecord;
}

/** false when the server has no such token (already revoked). */
export async function revokeReadToken(token: string): Promise<boolean> {
  const answer = await send("DELETE", `${TOKEN_PATH}/${encodeURIComponent(token)}`, {
    auth: `token=${await apiKey()}`,
  });
  if (answer.status === 404) return false;
  if (!ok(answer.status)) throw refused("revoke the read token", answer);
  return true;
}

/** One page of events read WITH a read token (not the preview's key): the server scopes it to the token's group. */
export async function searchWithReadToken(
  token: string,
  options: { query: string; pageOffset: number; pageLimit: number; sortOrder: "asc" | "desc" },
): Promise<{ total: number; events: RetracedEvent[] }> {
  const answer = await send("POST", "/enterprise/v1/graphql", {
    auth: `token=${token}`,
    body: {
      query: `query Page($query: String!, $pageOffset: Int, $pageLimit: Int, $sortOrder: sortOrder) {
        searchPaginated(query: $query, pageOffset: $pageOffset, pageLimit: $pageLimit, sortOrder: $sortOrder) {
          totalCount edges { node { ${EVENT_FIELDS} } }
        }
      }`,
      variables: options,
    },
  });
  if (answer.status === 401) throw new RetracedError("This read token is not valid or was revoked", 401);
  const body = (answer.text ? JSON.parse(answer.text) : null) as {
    data?: { searchPaginated?: { totalCount: number; edges: { node: RetracedEvent }[] } };
    errors?: { message: string }[];
  } | null;
  if (body?.errors?.length) throw new RetracedError(`The audit log search failed: ${body.errors[0].message}`, 400);
  if (!ok(answer.status)) throw refused("read with the token", answer);
  const result = body?.data?.searchPaginated;
  return { total: result?.totalCount ?? 0, events: (result?.edges ?? []).map((edge) => edge.node) };
}
