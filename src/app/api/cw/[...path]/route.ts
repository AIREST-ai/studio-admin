// U-1 (item 159): THE one gateway from the Studio to Chatwoot: /api/cw/<path> -> chatwoot-copy (v4.18.0 CE).
// Every call goes through src/lib/chatwoot/server.ts (gatewayCall): the address lock (127.0.0.1 / 100.86.173.123 on
// 8810 / 8812 only), the identity check, the account id read from the profile on the server, and the token header added
// on the server. No secret reaches the browser: the token is never in a response, and every JSON answer is passed
// through scrubSecrets (src/lib/chatwoot/gateway-policy.ts) first.
// Order of the checks (each one answers alone and nothing is called after it):
//   1. path segments plain words/numbers, else 400
//   2. §1-a forbidden writes (profile, webhooks, agents, accounts/{id}): 403 always, whatever the mode or role
//   3. writes from another site (sameOrigin): 403
//   4. mode gate: .preview-state/chatwoot-link.json must say "linked" (and not CHATWOOT_LINK_DISABLED), else 409
//   5. the ten areas absent from CE: 501 with an honest body (Chatwoot is not called)
//   6. the allow list (§1-b reads, §1-c writes): not listed -> 403
//   7. the role of the person the page is viewed as: the "View as" cookie (src/lib/cw/view-as-cookie.ts) and
//      permissionsOf (src/lib/cw/view-as-permissions.ts, re-exported by view-as.ts). No header from the browser is
//      read for the role (x-studio-role or any other is ignored). An admin row for a non-administrator: 403
//   8. writes: application/json (<= 1 MB) or multipart/form-data (<= 40 MB, Chatwoot's attachment limit), else 415/413
import { NextResponse } from "next/server";

import {
  ceArea,
  ceUnavailableBody,
  cleanQuery,
  containsBlocked6888,
  forbiddenWrite,
  type GatewayMethod,
  matchRoute,
  roleAllows,
  scrubSecrets,
  validSegments,
} from "@/lib/chatwoot/gateway-policy";
import { readLinkState } from "@/lib/chatwoot/mode";
import { ChatwootError, gatewayCall, problemOf } from "@/lib/chatwoot/server";
import { type Agent, CURRENT_USER_ID, agents as seedAgents } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";
import { permissionsOf } from "@/lib/cw/view-as-permissions";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const JSON_LIMIT = 1_000_000;
const MULTIPART_LIMIT = 40 * 1024 * 1024;

const answer = (status: number, body: unknown) => NextResponse.json(scrubSecrets(body), { status, headers });
const refuse = (status: number, error: string) => answer(status, { error });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** The agent number in the "View as" cookie, or null (the signed-in sample administrator). */
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

/**
 * The permissions of the person this browser views the app as, as the dashboard computes them: the agents saved in
 * the preview state (Settings > Agents), else the seed list (src/lib/cw/data.ts), same as lib/audit/with-audit.ts
 * currentActor. A View as cookie naming nobody in the list gets the least: ["agent"].
 */
async function viewerPermissions(request: Request): Promise<string[]> {
  let agents: RoleOf[] = seedAgents;
  try {
    const saved = await readPreviewState();
    const list = saved?.lists?.agents?.map(asAgent).filter((agent): agent is RoleOf => agent !== null);
    if (list?.length) agents = list;
  } catch {
    // unreadable saved lists: the seed list still says who is who
  }
  const asId = viewAsOf(request);
  if (asId === null) {
    const signedIn = agents.find((agent) => agent.id === CURRENT_USER_ID) ?? seedAgents[0];
    return permissionsOf(signedIn);
  }
  const viewed = agents.find((agent) => agent.id === asId);
  return viewed ? permissionsOf(viewed) : ["agent"];
}

async function payloadOf(
  request: Request,
): Promise<{ bytes: ArrayBuffer; contentType: string; parsed?: unknown } | undefined | Response> {
  const type = (request.headers.get("content-type") ?? "").trim();
  const length = Number(request.headers.get("content-length") ?? "0");
  const lower = type.toLowerCase();
  const json = lower.startsWith("application/json");
  const multipart = lower.startsWith("multipart/form-data");
  if (!type) {
    if (length > 0) return refuse(415, "send application/json or multipart/form-data");
    return undefined;
  }
  if (!json && !multipart) return refuse(415, "send application/json or multipart/form-data");
  const limit = json ? JSON_LIMIT : MULTIPART_LIMIT;
  if (length > limit) return refuse(413, `body larger than ${limit} bytes`);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > limit) return refuse(413, `body larger than ${limit} bytes`);
  if (bytes.byteLength === 0) return undefined;
  if (json) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return refuse(400, "body is not JSON");
    }
    return { bytes, contentType: "application/json", parsed };
  }
  if (!/boundary=/i.test(type)) return refuse(400, "multipart/form-data without a boundary");
  return { bytes, contentType: type };
}

async function handle(method: GatewayMethod, request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const segments = (await context.params).path ?? [];
  if (!validSegments(segments)) return refuse(400, "bad path");

  const forbidden = forbiddenWrite(method, segments);
  if (forbidden) return refuse(403, forbidden);

  const write = method !== "GET";
  if (write && !sameOrigin(request)) return refuse(403, "refused: not from this site");

  const rawSearch = new URL(request.url).search;
  const pathJoined = `/${segments.join("/")}`;
  const pathOrQueryBlocked = containsBlocked6888(null, rawSearch, pathJoined);
  if (pathOrQueryBlocked) return refuse(403, pathOrQueryBlocked);

  let payload: { bytes: ArrayBuffer; contentType: string; parsed?: unknown } | undefined;
  if (write) {
    const read = await payloadOf(request);
    if (read instanceof Response) return read;
    payload = read;
    if (payload) {
      const inspected =
        payload.parsed !== undefined
          ? payload.parsed
          : new TextDecoder().decode(payload.bytes.slice(0, Math.min(payload.bytes.byteLength, 65_536)));
      const bodyBlocked = containsBlocked6888(inspected, rawSearch, pathJoined);
      if (bodyBlocked) return refuse(403, bodyBlocked);
    }
  }

  const state = await readLinkState();
  if (state.mode !== "linked" || state.disabled) return refuse(409, "preview mode");

  const area = ceArea(segments);
  if (area) return answer(501, ceUnavailableBody(area));

  const route = matchRoute(method, segments);
  if (!route) return refuse(403, `refused: ${method} /${segments.join("/")} is not in the gateway's allow list`);

  if (!roleAllows(await viewerPermissions(request), route.minRole))
    return refuse(403, `refused: ${method} /${segments.join("/")} is for administrators (View as)`);

  const query = cleanQuery(rawSearch);
  if (query === null) return refuse(414, "query too long");

  try {
    const result = await gatewayCall(method, route.base, route.path, query, payload);
    return answer(result.status, result.body ?? (result.status < 300 ? { ok: true } : { error: "no body" }));
  } catch (error) {
    const problem = problemOf(error);
    return answer(error instanceof ChatwootError ? error.status : 500, { error: problem.message, problem });
  }
}

type Context = { params: Promise<{ path?: string[] }> };

export const GET = (request: Request, context: Context) => handle("GET", request, context);
export const POST = (request: Request, context: Context) => handle("POST", request, context);
export const PUT = (request: Request, context: Context) => handle("PUT", request, context);
export const PATCH = (request: Request, context: Context) => handle("PATCH", request, context);
export const DELETE = (request: Request, context: Context) => handle("DELETE", request, context);
