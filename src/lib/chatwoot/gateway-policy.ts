// U-1 (item 159, "one API from Chatwoot to the Studio instead of wiring button by button"): the rules of the one gateway
// src/app/api/cw/[...path]/route.ts, kept in a plain module (no "server-only", no Next.js import) so the browser client
// (./unified-client.ts) and the offline tests can read the same lists the server enforces.
// - FORBIDDEN_WRITES: four admin areas no write may reach, whatever the role (task U-1 §1-a): the profile, the
//   account's webhooks, its agents, the account itself. Answered 403 before anything else.
// - ROUTES: the allow list, word for word from the task's tables §1-b (reads, GET only) and §1-c (the writes the page
//   uses today). Anything not listed: 403. Each row has the lowest role that may use it ("agent" or "admin").
// - CE_UNAVAILABLE: the ten areas the swagger names but Chatwoot v4.18.0 CE has no controller for (the enterprise
//   folder is removed from the CE image; config/routes.rb guards some with ChatwootApp.enterprise?). The gateway answers
//   them itself with an honest 501 and never calls Chatwoot.
// - scrubSecrets: every JSON answer goes through it before it leaves the server, because the gateway calls Chatwoot with
//   the administrator's token and some views then include secrets (task U-1 §2, first correction). File:line refs are
//   Chatwoot v4.18.0 app/views/api/v1/models/.

export type GatewayRole = "agent" | "admin";
export type GatewayMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type GatewayBase = "account-v1" | "account-v2" | "api-v1";

/** Keys removed wherever they appear in an answer (any depth, objects inside arrays too). */
export const SECRET_KEYS = [
  "access_token", // _user.json.jbuilder:7
  "api_access_token", // Chatwoot API header / payload token
  "pubsub_token", // _user.json.jbuilder:20
  "hmac_identifier", // _user.json.jbuilder:15
  "hmac_token", // _inbox.json.jbuilder:48,131
  "auth_token", // _inbox.json.jbuilder:83
  "api_key_sid", // _inbox.json.jbuilder:85
  "secret", // _inbox.json.jbuilder:132, _webhook.json.jbuilder:6
  "webhook_secret",
  "webhook_verify_token",
  "provider_config", // _inbox.json.jbuilder:147
  "page_access_token",
  "user_access_token",
  "token",
  "verify_token",
  "meta_admin_token",
  "app_secret",
  "meta_app_secrets",
  "client_secret",
  "api_key",
  "bot_token",
  "line_channel_secret",
  "line_channel_token",
  "imap_password",
  "smtp_password",
  "code", // V-37: WhatsApp Embedded Signup authorization code
  "omniauth_token", // V-37: Facebook OAuth token for page listing
  "waba_id", // V-37: WhatsApp Business Account ID (not a secret but scrub from logs)
] as const;

const SECRET_SET = new Set<string>(SECRET_KEYS);
const INLINE_SECRET_PATTERN =
  /(?:(page_access_token|user_access_token|api_access_token|access_token|verify_token|webhook_verify_token|meta_admin_token|bot_token|line_channel_secret|line_channel_token|imap_password|smtp_password|hmac_token|auth_token|api_key|secret|token)\s*[=:]\s*[^\s&"',;]+|\bEAA[A-Za-z0-9]{16,}\b|\b\d{6,15}:[A-Za-z0-9_-]{20,}\b|\bbot\d{6,15}:[A-Za-z0-9_-]{20,}\b)/gi;

/** A copy of `value` without any SECRET_KEYS key or inline token string, at any depth. */
export function scrubSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    if (
      value.includes("token") ||
      value.includes("TOKEN") ||
      value.includes("secret") ||
      value.includes("SECRET") ||
      value.includes("password") ||
      value.includes("PASSWORD") ||
      value.includes("api_key") ||
      value.includes("API_KEY") ||
      value.includes("EAA") ||
      (value.includes(":") && /\d/.test(value))
    ) {
      return value.replace(INLINE_SECRET_PATTERN, "[REDACTED]");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_SET.has(key.toLowerCase())) continue;
      out[key] = scrubSecrets(item);
    }
    return out;
  }
  return value;
}

/** The nine areas absent from Chatwoot v4.18.0 CE (first path segment under /api/cw/; V-3 lifted `calls` to live bridge :3483). */
export const CE_UNAVAILABLE = {
  custom_roles: "Custom roles (enterprise/app/controllers/api/v1/accounts/custom_roles_controller.rb)",
  sla_policies: "SLA policies (enterprise/app/controllers/api/v1/accounts/sla_policies_controller.rb)",
  agent_capacity_policies:
    "Agent capacity policies (enterprise/app/controllers/api/v1/accounts/agent_capacity_policies_controller.rb)",
  audit_logs: "Audit logs (enterprise/app/controllers/api/v1/accounts/audit_logs_controller.rb)",
  "captain/assistants":
    "Captain assistants (enterprise/app/controllers/api/v1/accounts/captain/assistants_controller.rb)",
  companies: "Companies (enterprise/app/controllers/api/v1/accounts/companies_controller.rb)",
  applied_slas: "Applied SLAs (enterprise/app/controllers/api/v1/accounts/applied_slas_controller.rb)",
  reporting_events: "Reporting events (config/routes.rb:275 `if ChatwootApp.enterprise?`)",
  saml_settings: "SAML settings (enterprise/app/controllers/api/v1/accounts/saml_settings_controller.rb)",
} as const;
export type CeUnavailableArea = keyof typeof CE_UNAVAILABLE | "calls";

/** The body the gateway answers for a CE-absent area (status 501). The client shows it as "not in this edition". */
export interface CeUnavailableBody {
  error: string;
  available: false;
  edition: "ce";
  version: "4.18.0";
  area: CeUnavailableArea;
  detail: string;
}

export function ceUnavailableBody(area: CeUnavailableArea): CeUnavailableBody {
  if (!Object.hasOwn(CE_UNAVAILABLE, area)) {
    return null as unknown as CeUnavailableBody;
  }
  return {
    error: `not available in Chatwoot 4.18.0 CE: ${area}`,
    available: false,
    edition: "ce",
    version: "4.18.0",
    area,
    detail: CE_UNAVAILABLE[area as keyof typeof CE_UNAVAILABLE],
  };
}

interface RouteRow {
  methods: readonly GatewayMethod[];
  /** Segments; ":id" stands for a positive whole number. */
  pattern: readonly string[];
  base: GatewayBase;
  minRole: GatewayRole;
}

const ID = ":id";
const v1 = (
  pattern: string,
  minRole: GatewayRole = "agent",
  methods: readonly GatewayMethod[] = ["GET"],
): RouteRow => ({
  methods,
  pattern: pattern.split("/"),
  base: "account-v1",
  minRole,
});

const v2 = (
  pattern: string,
  minRole: GatewayRole = "admin",
  methods: readonly GatewayMethod[] = ["GET"],
): RouteRow => ({
  methods,
  pattern: pattern.split("/"),
  base: "account-v2",
  minRole,
});

/** §1-b reads (GET only), §1-c conversation/contact writes, and U-3 settings writes & report reads. */
export const ROUTES: readonly RouteRow[] = [
  // ---- §1-b reads
  { methods: ["GET"], pattern: ["profile"], base: "api-v1", minRole: "agent" },
  { methods: ["GET"], pattern: ["accounts", ID], base: "api-v1", minRole: "admin" },
  v1("conversations"),
  v1("conversations/meta"),
  v1(`conversations/${ID}`),
  v1(`conversations/${ID}/messages`),
  v1(`conversations/${ID}/attachments`),
  v1(`conversations/${ID}/labels`),
  v1(`conversations/${ID}/participants`),
  v1("contacts"),
  v1("contacts/search"),
  v1(`contacts/${ID}`),
  v1(`contacts/${ID}/conversations`),
  v1(`contacts/${ID}/contact_inboxes`),
  v1("search"),
  v1("search/conversations"),
  v1("search/messages"),
  v1("search/contacts"),
  v1("inboxes"),
  v1(`inboxes/${ID}`),
  v1(`inbox_members/${ID}`),
  v1("agents"),
  v1("teams"),
  v1(`teams/${ID}`),
  v1(`teams/${ID}/team_members`),
  v1("labels"),
  v1(`labels/${ID}`),
  v1("canned_responses"),
  v1("macros"),
  v1(`macros/${ID}`),
  v1("custom_filters"),
  v1(`custom_filters/${ID}`),
  v1("custom_attribute_definitions"),
  v1(`custom_attribute_definitions/${ID}`),
  v1("notifications"),
  // V-14: mark-all-read and per-notification read state (Chatwoot routes.rb:331-340).
  v1("notifications/read_all", "agent", ["POST"]),
  v1(`notifications/${ID}`, "agent", ["PATCH", "PUT"]),
  v1("automation_rules", "admin"),
  v1(`automation_rules/${ID}`, "admin"),
  v1("webhooks", "admin"),
  // ---- U-3 Reports (v2 + v1 CSAT)
  v2("reports"),
  v2("reports/summary"),
  v2("reports/bot_summary"),
  v2("reports/conversations"),
  v2("reports/bot_metrics"),
  v2("reports/first_response_time_distribution"),
  v2("reports/inbox_label_matrix"),
  v2("reports/outgoing_messages_count"),
  v2("live_reports/conversation_metrics"),
  v2("live_reports/grouped_conversation_metrics"),
  v2("summary_reports/agent"),
  v2("summary_reports/inbox"),
  v2("summary_reports/team"),
  v2("summary_reports/label"),
  v2("summary_reports/channel"),
  v1("csat_survey_responses", "admin"),
  v1("csat_survey_responses/metrics", "admin"),
  // ---- §1-c writes the page uses today
  v1(`conversations/${ID}/messages`, "agent", ["POST"]),
  v1(`conversations/${ID}/toggle_status`, "agent", ["POST"]),
  v1(`conversations/${ID}/toggle_priority`, "agent", ["POST"]),
  v1(`conversations/${ID}/assignments`, "agent", ["POST"]),
  v1(`conversations/${ID}/labels`, "agent", ["POST"]),
  v1("contacts", "agent", ["POST"]),
  v1(`contacts/${ID}`, "agent", ["PUT", "PATCH"]),
  v1(`contacts/${ID}`, "admin", ["DELETE"]),
  // ---- U-3 allowed settings writes
  v1("canned_responses", "agent", ["POST"]),
  v1(`canned_responses/${ID}`, "agent", ["PUT", "PATCH", "DELETE"]),
  v1("labels", "admin", ["POST"]),
  v1(`labels/${ID}`, "admin", ["PUT", "PATCH", "DELETE"]),
  v1("teams", "admin", ["POST"]),
  v1(`teams/${ID}`, "admin", ["PUT", "PATCH", "DELETE"]),
  v1(`teams/${ID}/team_members`, "admin", ["POST", "PATCH", "DELETE"]),
  v1("inboxes", "admin", ["POST"]),
  v1(`inboxes/${ID}`, "admin", ["PUT", "PATCH", "DELETE"]),
  v1("inbox_members", "admin", ["POST", "PATCH", "DELETE"]),
  v1("macros", "agent", ["POST"]),
  v1(`macros/${ID}`, "agent", ["PUT", "PATCH", "DELETE"]),
  v1(`macros/${ID}/execute`, "agent", ["POST"]),
  v1("automation_rules", "admin", ["POST"]),
  v1(`automation_rules/${ID}`, "admin", ["PUT", "PATCH", "DELETE"]),
  v1(`automation_rules/${ID}/clone`, "admin", ["POST"]),
  v1("custom_attribute_definitions", "admin", ["POST"]),
  v1(`custom_attribute_definitions/${ID}`, "admin", ["PUT", "PATCH", "DELETE"]),
  v1("custom_filters", "agent", ["POST"]),
  v1(`custom_filters/${ID}`, "agent", ["PUT", "PATCH", "DELETE"]),
  // ---- V-3 (item 160.9): lift 501 block on calls path
  v1("calls"),
  v1("calls/history"),
  v1("calls", "agent", ["POST"]),
  // ---- V-5 (item 160.8): allow comments paths in ROUTES and lift any 501 block
  v1("comments"),
  v1("comments/posts", "agent", ["GET", "POST"]),
  v1("comments/comments", "agent", ["GET", "POST"]),
  v1("comments/audit", "agent", ["GET", "POST"]),
  v1("comments/status", "agent", ["GET", "POST"]),
  v1("comments/updates", "agent", ["GET", "POST"]),
  v1("comments/whoami", "agent", ["GET", "POST"]),
  v1("comments/mark_read", "agent", ["POST"]),
  v1("comments/mark_all_read", "agent", ["POST"]),
  v1("comments/reply", "agent", ["POST"]),
  v1("comments/private_reply", "agent", ["POST"]),
  v1("comments/hide", "agent", ["POST"]),
  v1("comments/unhide", "agent", ["POST"]),
  v1("comments/delete", "agent", ["POST"]),
  v1("comments/like", "agent", ["POST"]),
  v1("comments/unlike", "agent", ["POST"]),
  v1("comments/block", "agent", ["POST"]),
  v1("comments/unblock", "agent", ["POST"]),
  v1("comments", "agent", ["POST"]),
  // ---- V-15: Read-only access to help-center portals/articles/categories and campaigns (write locked during Meta review)
  v1("portals"),
  v1(`portals/${ID}`),
  v1(`portals/${ID}/articles`),
  v1(`portals/${ID}/categories`),
  v1("campaigns"),
  v1(`campaigns/${ID}`),
  // ---- V-16: the 15 previously refused conversation/contact writes (Chatwoot v4.18.0 routes.rb)
  v1("conversations", "agent", ["POST"]),
  v1(`conversations/${ID}/mute`, "agent", ["POST"]),
  v1(`conversations/${ID}/unmute`, "agent", ["POST"]),
  v1(`conversations/${ID}/unread`, "agent", ["POST"]),
  v1(`conversations/${ID}/transcript`, "agent", ["POST"]),
  v1(`conversations/${ID}/participants`, "agent", ["POST", "PUT", "PATCH", "DELETE"]),
  v1(`conversations/${ID}/messages/${ID}`, "agent", ["DELETE"]),
  v1(`contacts/${ID}/notes`),
  v1(`contacts/${ID}/notes`, "agent", ["POST"]),
  v1(`contacts/${ID}/notes/${ID}`),
  v1(`contacts/${ID}/notes/${ID}`, "agent", ["PUT", "PATCH", "DELETE"]),
  v1(`contacts/${ID}/labels`),
  v1(`contacts/${ID}/labels`, "agent", ["POST"]),
  v1("actions/contact_merge", "agent", ["POST"]),
  // ---- V-37: Meta channel linking wizard (Facebook Messenger, Instagram, WhatsApp) — admin only
  v1("callbacks/facebook_pages", "admin", ["POST"]),
  v1("callbacks/register_facebook_page", "admin", ["POST"]),
  v1("instagram/authorization", "admin", ["POST"]),
  v1("whatsapp/authorization", "admin", ["POST"]),
];

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const NUMBER = /^\d{1,10}$/;

/** True when every segment is a plain word or number (no "..", no encoded slash, no empty part). */
export function validSegments(segments: readonly string[]): boolean {
  return segments.length > 0 && segments.length <= 6 && segments.every((segment) => SEGMENT.test(segment));
}

/** §1-a + V-1: a write to the profile, the webhooks, the agents, the integrations or the account itself. Always 403. */
export function forbiddenWrite(method: string, segments: readonly string[]): string | null {
  if (method === "GET" || method === "HEAD") return null;
  const first = segments[0];
  if (first === "profile") return "writes to the profile are refused by the gateway";
  if (first === "webhooks") return "writes to the account's webhooks are refused by the gateway";
  if (first === "agents") return "writes to the account's agents are refused by the gateway";
  if (first === "accounts" || first === "account") return "writes to the account settings are refused by the gateway";
  if (first === "integrations") return "writes to the account's integrations are refused by the gateway";
  return null;
}

export const BLOCKED_PHONE_SUFFIX = "6888";

/** V-16: frozen Meta-review inboxes. Sensitive writes never reach these. */
export const FROZEN_LIVE_INBOX_IDS = new Set<number>([9, 10]);
/** V-16: the only inbox allowed for sensitive writes during Meta review (Studio Test). */
export const TEST_INBOX_ID = 3;
/** V-16: the only conversation allowed for mute/unmute/transcript/delete-message during Meta review. */
export const TEST_CONVERSATION_ID = 2;

// 2026-10-19 أمر فهد «جرب الرسائل والمحادثات بنفسك»: الرد في كل المحادثات مفتوح؛ الكتم والنص والحذف تبقى مقفلة.
const SENSITIVE_CONVERSATION_MEMBER = new Set(["mute", "unmute", "transcript"]);

function bodyInboxId(body: unknown): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).inbox_id;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d{1,10}$/.test(raw)) return Number(raw);
  return null;
}

/**
 * V-16 Meta-review guard for destructive/sensitive writes.
 * - delete message, mute/unmute, transcript: conversation id must be 2
 * - create conversation: inbox_id must be 3, never 9 or 10
 * - merge: refused if the body names inbox 9 or 10
 * Returns a 403 reason, or null when the request may proceed.
 */
export function frozenSensitiveWriteReason(method: string, segments: readonly string[], body?: unknown): string | null {
  if (method === "GET" || method === "HEAD") return null;

  if (method === "DELETE" && segments.length === 4 && segments[0] === "conversations" && segments[2] === "messages") {
    const convId = NUMBER.test(segments[1]) ? Number(segments[1]) : 0;
    if (convId !== TEST_CONVERSATION_ID) {
      return "refused: deleting a message is limited to Studio Test conversation 2 during Meta review (403)";
    }
  }

  if (
    method === "POST" &&
    segments.length === 3 &&
    segments[0] === "conversations" &&
    SENSITIVE_CONVERSATION_MEMBER.has(segments[2])
  ) {
    const convId = NUMBER.test(segments[1]) ? Number(segments[1]) : 0;
    if (convId !== TEST_CONVERSATION_ID) {
      return `refused: ${segments[2]} is limited to Studio Test conversation 2 during Meta review (403)`;
    }
    // V-17 r2: additionally check inbox_id from body for POST /conversations/2/messages
    if (segments[2] === "messages") {
      const inboxId = bodyInboxId(body);
      if (inboxId !== null && FROZEN_LIVE_INBOX_IDS.has(inboxId)) {
        return "refused: sending a message to frozen live inboxes 9 and 10 is blocked (403)";
      }
    }
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "conversations") {
    const inboxId = bodyInboxId(body);
    if (inboxId !== null && FROZEN_LIVE_INBOX_IDS.has(inboxId)) {
      return "refused: creating a conversation on frozen live inboxes 9 and 10 is blocked (403)";
    }
    if (inboxId !== TEST_INBOX_ID) {
      return "refused: creating a conversation is limited to Studio Test inbox 3 during Meta review (403)";
    }
  }

  if (method === "POST" && segments.length === 2 && segments[0] === "actions" && segments[1] === "contact_merge") {
    const inboxId = bodyInboxId(body);
    if (inboxId !== null && FROZEN_LIVE_INBOX_IDS.has(inboxId)) {
      return "refused: merging contacts of frozen live inboxes 9 and 10 is blocked (403)";
    }
  }

  return null;
}

/**
 * V-1 safety guard: checks if a string is or contains a WhatsApp/phone number or identifier ending in 6888
 * (e.g., "9647755566888", "+9647755566888", "07755566888", or any format ending in 6888).
 */
export function isBlocked6888String(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const compact = trimmed.replace(/[\s().-]/g, "");
  if (/^\+?\d*6888$/i.test(compact)) return true;
  if (/(?:^|[^\d])\+?964\d*6888(?:\b|$)/.test(compact)) return true;
  if (/(?:^|[^\d])\+?\d{3,}6888(?:\b|$)/.test(compact)) return true;
  return false;
}

function findBlocked6888InValue(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return false;
  if (typeof value === "string") return isBlocked6888String(value);
  if (typeof value === "number" && Number.isFinite(value)) return isBlocked6888String(String(value));
  if (Array.isArray(value)) return value.some((item) => findBlocked6888InValue(item, depth + 1));
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isBlocked6888String(k) || findBlocked6888InValue(v, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Returns a 403 reason string when a write/call/message/contact/conversation request targets or references
 * the blocked WhatsApp number ending in 6888; otherwise null.
 */
export function containsBlocked6888(payload: unknown, query = "", path = ""): string | null {
  if (path && isBlocked6888String(path)) {
    return "refused: number ending in 6888 is blocked by gateway safety policy (403)";
  }
  if (query) {
    try {
      const params = new URLSearchParams(query);
      for (const [, val] of params.entries()) {
        if (isBlocked6888String(val)) {
          return "refused: number ending in 6888 is blocked by gateway safety policy (403)";
        }
      }
    } catch {
      if (isBlocked6888String(query)) {
        return "refused: number ending in 6888 is blocked by gateway safety policy (403)";
      }
    }
  }
  if (findBlocked6888InValue(payload)) {
    return "refused: number ending in 6888 is blocked by gateway safety policy (403)";
  }
  return null;
}

/**
 * The CE-absent area a path is in, or null. Captain is matched on "captain/assistants" only: CE keeps
 * captain/preferences and captain/tasks (app/controllers/api/v1/accounts/captain/).
 * V-3 (item 160.9): `calls` is lifted out of CE 501 block and served via Studio's live call bridge (:3483).
 */
export function ceArea(segments: readonly string[]): CeUnavailableArea | null {
  const first = segments[0];
  if (first === "calls" || first === "comments") return null;
  if (first === "captain") return segments[1] === "assistants" ? "captain/assistants" : null;
  return first && first !== "captain/assistants" && Object.hasOwn(CE_UNAVAILABLE, first)
    ? (first as CeUnavailableArea)
    : null;
}

export interface RouteMatch {
  base: GatewayBase;
  /** Chatwoot path under the base, e.g. "/conversations/7/messages". */
  path: string;
  minRole: GatewayRole;
  write: boolean;
}

/** The allow-list row of a request, or null (not listed: 403). */
export function matchRoute(method: string, segments: readonly string[]): RouteMatch | null {
  const candidates =
    segments[0] === "v2" && segments.length > 1
      ? [
          { segs: segments, v2Only: false },
          { segs: segments.slice(1), v2Only: true },
        ]
      : [{ segs: segments, v2Only: false }];
  for (const { segs, v2Only } of candidates) {
    for (const row of ROUTES) {
      if (v2Only && row.base !== "account-v2") continue;
      if (!row.methods.includes(method as GatewayMethod)) continue;
      if (row.pattern.length !== segs.length) continue;
      const same = row.pattern.every((part, i) =>
        part === ID ? NUMBER.test(segs[i]) && Number(segs[i]) > 0 : part === segs[i],
      );
      if (same) return { base: row.base, path: `/${segs.join("/")}`, minRole: row.minRole, write: method !== "GET" };
    }
  }
  return null;
}

function isAgentCookieOverride(): boolean {
  if (typeof window !== "undefined") return false;
  try {
    const proc = process as unknown as {
      cwd: () => string;
      getBuiltinModule?: (id: string) => { createRequire?: (p: string) => (m: string) => Record<string, unknown> };
    };
    const reqFn = proc.getBuiltinModule?.("module")?.createRequire?.(`${proc.cwd()}/package.json`);
    const ext = reqFn?.("next/dist/server/app-render/work-unit-async-storage.external") as
      | {
          workUnitAsyncStorage?: {
            getStore?: () => {
              cookies?: { get?: (k: string) => { value?: string } | undefined };
              headers?: { get?: (k: string) => string | null };
            };
          };
        }
      | undefined;
    const store = ext?.workUnitAsyncStorage?.getStore?.();
    const cwViewAs = store?.cookies?.get?.("cw_view_as")?.value ?? store?.headers?.get?.("cookie");
    if (typeof cwViewAs === "string" && /(?:^|;\s*)(?:cw_view_as|studio_view_as)\s*=\s*agent\b/i.test(cwViewAs)) {
      return true;
    }
    if (store?.cookies?.get?.("cw_view_as")?.value?.toLowerCase() === "agent") return true;
    if (store?.cookies?.get?.("studio_view_as")?.value?.toLowerCase() === "agent") return true;
  } catch {
    // offline or client environment
  }
  return false;
}

/**
 * Whether the permissions of the person the page is viewed as (src/lib/cw/view-as-permissions.ts permissionsOf, from
 * the View as cookie) reach the row's role. "admin" rows need "administrator"; "agent" rows any account role.
 */
export function roleAllows(permissions: readonly string[], minRole: GatewayRole): boolean {
  const effective = isAgentCookieOverride() ? ["agent"] : permissions;
  if (minRole === "admin") return effective.includes("administrator");
  return effective.some((permission) => ["administrator", "agent", "custom_role"].includes(permission));
}

/** Query keys never passed on (a token in the URL would reach Chatwoot's logs). */
const DROPPED_QUERY = new Set([
  "api_access_token",
  "access_token",
  "page_access_token",
  "user_access_token",
  "token",
  "secret",
  "account_id",
]);

/** The request's query string, minus DROPPED_QUERY, or "" (at most 2000 characters, else null). */
export function cleanQuery(search: string): string | null {
  if (search.length > 2000) return null;
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) if (DROPPED_QUERY.has(key.toLowerCase())) params.delete(key);
  const text = params.toString();
  return text ? `?${text}` : "";
}
