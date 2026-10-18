// V-3 (item 160.9): Server-side calls bridge in Studio: /api/calls/[action] -> http://127.0.0.1:3483/call-api/<action>.
// - Relays call signaling and permanent SQLite call history (`diag`, `history`, `incoming`, `prepare`,
//   `w_start`, `m_start`, `w_accept`, `w_reject`, `w_hangup`, `m_accept`, `m_reject`, `m_hangup`) to the single
//   call engine on 127.0.0.1:3483 with server-side authentication (`X-Airest-Call: 1` + `api_access_token`).
// - Never exposes any token or secret to the browser; every response passes through `scrubSecrets`.
// - Strictly refuses with HTTP 403 any attempt (`prepare`, `w_start`, etc.) targeting or referencing the
//   blocked number ending in `6888`.

import { NextResponse } from "next/server";

import { cleanQuery, containsBlocked6888, roleAllows, scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import { buildAuthHeaders, resolveSecretFilePath } from "@/lib/chatwoot/server";
import { type Agent, CURRENT_USER_ID, agents as seedAgents } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";
import { permissionsOf } from "@/lib/cw/view-as-permissions";

import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";

const CALL_SERVICE_BASE = "http://127.0.0.1:3483/call-api";
const JSON_LIMIT = 65_536;
const headers = { "Cache-Control": "no-store" };

export const ALLOWED_CALL_ACTIONS = new Set([
  "diag",
  "history",
  "list",
  "incoming",
  "prepare",
  "w_start",
  "m_start",
  "w_accept",
  "w_reject",
  "w_hangup",
  "m_accept",
  "m_reject",
  "m_hangup",
]);

const GET_CALL_ACTIONS = new Set(["history", "list", "incoming", "diag"]);
const CONVERSATION_ACTIONS = new Set(["prepare", "w_start", "m_start"]);

const answer = (status: number, body: unknown) => NextResponse.json(scrubSecrets(body), { status, headers });
const refuse = (status: number, error: string) => answer(status, { error });

function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function viewAsOf(request: Request): number | null {
  const value = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === VIEW_AS_COOKIE)?.[1];
  return parseViewAs(value ?? null);
}

type RoleOf = Pick<Agent, "id" | "role" | "customRoleId">;

function asAgent(value: Record<string, unknown>): RoleOf | null {
  const role = value.role;
  if (typeof value.id !== "number" || (role !== "administrator" && role !== "agent")) return null;
  const customRoleId = typeof value.customRoleId === "number" ? value.customRoleId : null;
  return { id: value.id, role, customRoleId };
}

async function viewerPermissions(request: Request): Promise<string[]> {
  let agents: RoleOf[] = seedAgents;
  try {
    const saved = await readPreviewState();
    const list = saved?.lists?.agents?.map(asAgent).filter((agent): agent is RoleOf => agent !== null);
    if (list?.length) agents = list;
  } catch {
    // fallback to seed list
  }
  const asId = viewAsOf(request);
  if (asId === null) {
    const signedIn = agents.find((agent) => agent.id === CURRENT_USER_ID) ?? seedAgents[0];
    return permissionsOf(signedIn);
  }
  const viewed = agents.find((agent) => agent.id === asId);
  return viewed ? permissionsOf(viewed) : ["agent"];
}

async function readServerToken(): Promise<string> {
  const candidates = [
    resolveSecretFilePath("3200"),
    resolveSecretFilePath(),
    "/Users/ali/lobehub-hub/chatwoot-copy/live-3200-token.txt",
  ];
  for (const file of candidates) {
    try {
      const text = (await readFile(file, "utf8")).trim();
      if (text && !/\s/.test(text) && text.length <= 256) return text;
    } catch {
      // try next candidate
    }
  }
  throw new Error("no server token available for call bridge");
}

function queryToObject(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(search);
  for (const [k, v] of params.entries()) {
    const lower = k.toLowerCase();
    if (lower === "api_access_token" || lower === "access_token") continue;
    out[k] = v;
  }
  return out;
}

async function handle(method: "GET" | "POST", request: Request, context: { params: Promise<{ action?: string }> }) {
  const action = ((await context.params).action ?? "").trim();
  if (!action || !ALLOWED_CALL_ACTIONS.has(action)) {
    return refuse(404, `unknown call action: ${action || "(empty)"}`);
  }

  if (!sameOrigin(request)) {
    return refuse(403, "refused: cross-origin request not allowed");
  }

  const rawSearch = new URL(request.url).search;
  const pathJoined = `/api/calls/${action}`;

  // 1. Check query string and path for blocked 6888 number immediately
  const queryBlocked = containsBlocked6888(null, rawSearch, pathJoined);
  if (queryBlocked) return refuse(403, queryBlocked);

  let bodyObj: Record<string, unknown> = queryToObject(rawSearch);
  if (method === "POST") {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > JSON_LIMIT) return refuse(413, `body larger than ${JSON_LIMIT} bytes`);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > JSON_LIMIT) return refuse(413, `body larger than ${JSON_LIMIT} bytes`);
    if (bytes.byteLength > 0) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return refuse(400, "body is not valid JSON");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return refuse(400, "body must be a JSON object");
      }
      bodyObj = { ...bodyObj, ...(parsed as Record<string, unknown>) };
    }
  } else if (!GET_CALL_ACTIONS.has(action)) {
    return refuse(405, `method GET not allowed for call action ${action}`);
  }

  // 2. Check body payload for blocked 6888 number before anything reaches 3483
  const bodyBlocked = containsBlocked6888(bodyObj, rawSearch, pathJoined);
  if (bodyBlocked) return refuse(403, bodyBlocked);

  if (!roleAllows(await viewerPermissions(request), "agent")) {
    return refuse(403, "refused: insufficient permissions for calls");
  }

  if (CONVERSATION_ACTIONS.has(action) && bodyObj.account_id === undefined) {
    bodyObj.account_id = 1;
  }

  const query = cleanQuery(rawSearch);
  if (query === null) return refuse(414, "query too long");

  let token: string;
  try {
    token = await readServerToken();
  } catch {
    return refuse(503, "call bridge token unavailable");
  }

  const upstreamHeaders: Record<string, string> = {
    ...buildAuthHeaders(token),
    "X-Airest-Call": "1",
    "Content-Type": "application/json",
  };

  const timeoutMs = action === "incoming" ? 35_000 : 20_000;
  let response: Response;
  try {
    response = await fetch(`${CALL_SERVICE_BASE}/${encodeURIComponent(action)}${query}`, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(bodyObj),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return refuse(
      504,
      isTimeout ? "call service (127.0.0.1:3483) timed out" : "call service (127.0.0.1:3483) unreachable",
    );
  }

  const text = await response.text();
  let upstreamBody: unknown = null;
  try {
    upstreamBody = text.trim() ? JSON.parse(text) : null;
  } catch {
    return refuse(502, "call service (127.0.0.1:3483) did not return JSON");
  }

  // 3. If prepare / w_start / m_start resolved to a conversation with a 6888 number, enforce 403
  if (CONVERSATION_ACTIONS.has(action)) {
    const resolvedBlocked = containsBlocked6888(upstreamBody);
    if (resolvedBlocked) return refuse(403, resolvedBlocked);
  }

  return answer(response.status, upstreamBody ?? { ok: response.ok });
}

type Context = { params: Promise<{ action?: string }> };

export const GET = (request: Request, context: Context) => handle("GET", request, context);
export const POST = (request: Request, context: Context) => handle("POST", request, context);
