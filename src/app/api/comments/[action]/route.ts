// V-5 (item 160.8): Server-side comments bridge in Studio: /api/comments/[action] -> http://127.0.0.1:3485/comments-api/<action>.
// - Relays Facebook Page & Instagram comment actions (`posts`, `comments`, `reply`, `private_reply`,
//   `hide`, `unhide`, `delete`, `like`, `unlike`, `block`, `unblock`, `mark_read`, `mark_all_read`,
//   `audit`, `status`, `updates`, `whoami`) to the comments engine on 127.0.0.1:3485 with server-side
//   authentication (`X-Airest-Comments: 1` + `api_access_token` + `Authorization: Bearer`).
// - Enforces `sameOrigin` (403 on cross-origin requests), `roleAllows` (403 on insufficient permissions),
//   and `containsBlocked6888` (403 on any reference to a number/identifier ending in 6888).
// - Scrubs every response via `scrubSecrets` (`page_access_token`, `user_access_token`, `access_token`,
//   `api_access_token`, `token`, `secret`, etc.) before returning to the browser.

import { NextResponse } from "next/server";

import { cleanQuery, containsBlocked6888, roleAllows, scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import { buildAuthHeaders, resolveSecretFilePath } from "@/lib/chatwoot/server";
import { type Agent, CURRENT_USER_ID, agents as seedAgents } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";
import { permissionsOf } from "@/lib/cw/view-as-permissions";

import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";

const COMMENTS_SERVICE_BASE = "http://127.0.0.1:3485/comments-api";
const JSON_LIMIT = 65_536;
const headers = { "Cache-Control": "no-store" };

export const ALLOWED_COMMENT_ACTIONS = new Set([
  "posts",
  "comments",
  "reply",
  "private_reply",
  "hide",
  "unhide",
  "delete",
  "like",
  "unlike",
  "block",
  "unblock",
  "mark_read",
  "mark_all_read",
  "audit",
  "status",
  "updates",
  "whoami",
]);

const GET_COMMENT_ACTIONS = new Set(["posts", "comments", "audit", "status", "updates", "whoami"]);

const answer = (status: number, body: unknown) => NextResponse.json(scrubSecrets(body), { status, headers });
const refuse = (status: number, error: string) => answer(status, { error });

function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
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
  throw new Error("no server token available for comments bridge");
}

function queryToObject(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(search);
  for (const [k, v] of params.entries()) {
    const lower = k.toLowerCase();
    if (
      lower === "api_access_token" ||
      lower === "access_token" ||
      lower === "page_access_token" ||
      lower === "user_access_token" ||
      lower === "token" ||
      lower === "secret"
    ) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

async function handle(method: "GET" | "POST", request: Request, context: { params: Promise<{ action?: string }> }) {
  const action = ((await context.params).action ?? "").trim();
  if (!action || !ALLOWED_COMMENT_ACTIONS.has(action)) {
    return refuse(404, `unknown comments action: ${action || "(empty)"}`);
  }

  if (!sameOrigin(request)) {
    return refuse(403, "refused: cross-origin request not allowed");
  }

  const rawSearch = new URL(request.url).search;
  const pathJoined = `/api/comments/${action}`;

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
  } else if (!GET_COMMENT_ACTIONS.has(action)) {
    return refuse(405, `method GET not allowed for comments action ${action}`);
  }

  // 2. Check body payload for blocked 6888 number before anything reaches 3485
  const bodyBlocked = containsBlocked6888(bodyObj, rawSearch, pathJoined);
  if (bodyBlocked) return refuse(403, bodyBlocked);

  if (!roleAllows(await viewerPermissions(request), "agent")) {
    return refuse(403, "refused: insufficient permissions for comments");
  }

  const query = cleanQuery(rawSearch);
  if (query === null) return refuse(414, "query too long");

  let token: string;
  try {
    token = await readServerToken();
  } catch {
    return refuse(503, "comments bridge token unavailable");
  }

  const upstreamHeaders: Record<string, string> = {
    ...buildAuthHeaders(token),
    "X-Airest-Comments": "1",
    "Content-Type": "application/json",
  };

  let response: Response;
  try {
    response = await fetch(`${COMMENTS_SERVICE_BASE}/${encodeURIComponent(action)}${query}`, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(bodyObj),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return refuse(
      504,
      isTimeout ? "comments service (127.0.0.1:3485) timed out" : "comments service (127.0.0.1:3485) unreachable",
    );
  }

  const text = await response.text();
  let upstreamBody: unknown = null;
  try {
    upstreamBody = text.trim() ? JSON.parse(text) : null;
  } catch {
    return refuse(502, "comments service (127.0.0.1:3485) did not return JSON");
  }

  // 3. Enforce 6888 safety check on upstream response and scrub all secrets before returning
  const responseBlocked = containsBlocked6888(upstreamBody);
  if (responseBlocked) return refuse(403, responseBlocked);

  return answer(response.status, upstreamBody ?? { ok: response.ok });
}

type Context = { params: Promise<{ action?: string }> };

export const GET = (request: Request, context: Context) => handle("GET", request, context);
export const POST = (request: Request, context: Context) => handle("POST", request, context);
