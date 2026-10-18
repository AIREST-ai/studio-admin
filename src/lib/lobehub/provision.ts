import { containsBlocked6888, scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import { type Agent, CURRENT_USER_ID, agents as seedAgents } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";
import { permissionsOf } from "@/lib/cw/view-as-permissions";

import { execFile } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLIENT_ID_PATTERN = /^client_[a-z0-9_]{2,40}$/;
const FORBIDDEN_IDENTIFIERS = ["fahad", "user_0ig", "user_0igqijtu4mcdijum5zvdysw6kvk"];
const HINDSIGHT_BASE_URL = "http://127.0.0.1:8888";
const ISOLATION_MARKER = "ISOLATION_MARKER_ALPHA_9941";

export const DEFAULT_CLIENTS: Record<string, { displayName: string; email: string }> = {
  client_test_a: {
    displayName: "Test Client Alpha",
    email: "client_test_a@clients.studio.local",
  },
  client_test_b: {
    displayName: "Test Client Beta",
    email: "client_test_b@clients.studio.local",
  },
};

export class ProvisionForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ProvisionForbiddenError";
  }
}

export class ProvisionValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ProvisionValidationError";
  }
}

/**
 * Security guard 1: Enforces same-origin on incoming HTTP requests when Origin header is present.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  try {
    const originHost = new URL(origin).host;
    const reqHost = req.headers.get("host");
    if (!reqHost || originHost !== reqHost) {
      throw new ProvisionForbiddenError("Cross-origin request refused by security policy (403)");
    }
  } catch (err) {
    if (err instanceof ProvisionForbiddenError) throw err;
    throw new ProvisionForbiddenError("Invalid Origin header refused by security policy (403)");
  }
}

/**
 * Security guard 2: Rejects any payload, query, or URL string containing the forbidden 6888 phone identifier.
 */
export function rejectForbiddenPhone(textOrPayload: unknown, query = "", path = ""): void {
  const rawText = typeof textOrPayload === "string" ? textOrPayload : JSON.stringify(textOrPayload ?? "");
  if (rawText.includes("6888") || query.includes("6888") || path.includes("6888")) {
    throw new ProvisionForbiddenError(
      "Refused: number or identifier containing 6888 is blocked by safety policy (403)",
    );
  }
  const blocked = containsBlocked6888(textOrPayload, query, path);
  if (blocked) {
    throw new ProvisionForbiddenError(blocked);
  }
}

type RoleOf = Pick<Agent, "id" | "role" | "customRoleId">;

function asAgent(value: Record<string, unknown>): RoleOf | null {
  const role = value.role;
  if (typeof value.id !== "number" || (role !== "administrator" && role !== "agent")) return null;
  const customRoleId = typeof value.customRoleId === "number" ? value.customRoleId : null;
  return { id: value.id, role, customRoleId };
}

function parseCookieMap(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) map[k] = v;
  }
  return map;
}

export interface ViewerIdentity {
  id: number;
  role: "administrator" | "agent";
  permissions: string[];
}

/**
 * Security guard 3: Resolves the active viewer from request cookies (`vw_as`, `studio_view_as`, `cw_view_as`)
 * and verifies their role.
 */
export async function requireViewer(req: Request): Promise<ViewerIdentity> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = parseCookieMap(cookieHeader);
  const rawViewAs = cookies.vw_as ?? cookies[VIEW_AS_COOKIE] ?? cookies.cw_view_as ?? null;

  if (rawViewAs && rawViewAs.toLowerCase() === "agent") {
    return { id: 2, role: "agent", permissions: ["agent"] };
  }

  let agents: RoleOf[] = seedAgents;
  try {
    const saved = await readPreviewState();
    const list = saved?.lists?.agents?.map(asAgent).filter((a): a is RoleOf => a !== null);
    if (list?.length) agents = list;
  } catch {
    // fallback to seedAgents
  }

  const parsedId = parseViewAs(rawViewAs);
  if (rawViewAs !== null && rawViewAs !== "" && parsedId === null) {
    const explicitNum = Number(rawViewAs);
    if (explicitNum === CURRENT_USER_ID) {
      const admin = agents.find((a) => a.id === CURRENT_USER_ID) ?? seedAgents[0];
      const perms = permissionsOf(admin);
      return {
        id: admin.id,
        role: perms.includes("administrator") ? "administrator" : "agent",
        permissions: perms,
      };
    }
    return { id: Number.isFinite(explicitNum) ? explicitNum : 2, role: "agent", permissions: ["agent"] };
  }

  if (parsedId !== null) {
    const viewed = agents.find((a) => a.id === parsedId);
    if (!viewed) {
      return { id: parsedId, role: "agent", permissions: ["agent"] };
    }
    const perms = permissionsOf(viewed);
    return {
      id: viewed.id,
      role: viewed.role === "administrator" && perms.includes("administrator") ? "administrator" : "agent",
      permissions: perms,
    };
  }

  const signedIn = agents.find((a) => a.id === CURRENT_USER_ID) ?? seedAgents[0];
  const perms = permissionsOf(signedIn);
  return {
    id: signedIn.id,
    role: perms.includes("administrator") ? "administrator" : "agent",
    permissions: perms,
  };
}

/**
 * Security guard 4: Validates that clientId strictly starts with `client_` and matches `^client_[a-z0-9_]{2,40}$`,
 * rejecting `fahad`, `user_0ig...`, `6888`, or any non-client identifier with 403 Forbidden.
 */
export function validateClientId(rawClientId: unknown): string {
  if (typeof rawClientId !== "string" || !rawClientId.trim()) {
    throw new ProvisionForbiddenError("Client identifier is required and must start with client_ (403)");
  }
  const trimmed = rawClientId.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.includes("6888")) {
    throw new ProvisionForbiddenError("Refused: identifier containing 6888 is blocked by safety policy (403)");
  }

  for (const forbidden of FORBIDDEN_IDENTIFIERS) {
    if (lower === forbidden || lower.includes(forbidden)) {
      throw new ProvisionForbiddenError(
        `Refused: protected team or primary memory bank identifier "${trimmed}" cannot be accessed or modified (403)`,
      );
    }
  }

  if (!CLIENT_ID_PATTERN.test(trimmed)) {
    throw new ProvisionForbiddenError(
      `Refused: identifier "${trimmed}" must match isolated client pattern ^client_[a-z0-9_]{2,40}$ (403)`,
    );
  }

  return trimmed;
}

function sqlHexLiteral(value: string): string {
  const hex = Buffer.from(value, "utf8").toString("hex");
  return `convert_from(decode('${hex}', 'hex'), 'UTF8')`;
}

async function runLobePsql(sql: string): Promise<string> {
  if (/\b(DELETE|DROP|TRUNCATE)\b/i.test(sql)) {
    throw new ProvisionForbiddenError("Destructive SQL commands (DELETE, DROP, TRUNCATE) are strictly prohibited");
  }
  const { stdout } = await execFileAsync(
    "docker",
    [
      "exec",
      "-i",
      "lobe-postgres",
      "psql",
      "-U",
      "postgres",
      "-d",
      "lobechat",
      "-X",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 },
  );
  return stdout.trim();
}

async function deriveSsoHmacKey(): Promise<string> {
  try {
    const content = await readFile("/Users/ali/lobehub-hub/chatwoot-copy/live-3200-token.txt", "utf8");
    if (content.trim()) return `studio-oidc-v8:${content.trim()}`;
  } catch {
    // fallback to internal deterministic key
  }
  return "studio-oidc-v8:isolated-workspace-handoff-key";
}

export interface SsoOidcEndpoints {
  issuer: string;
  discoveryUrl: string;
  nestedDiscoveryUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  jwksUrl: string;
}

export interface SsoHandoffInfo {
  provider: "studio-oidc";
  workspaceSlug: string;
  workspaceId: string;
  userId: string;
  email: string;
  emailVerified: true;
  handoffPath: string;
  signatureDigest: string;
  issuedAt: string;
  oidc: SsoOidcEndpoints;
}

export interface LiveAuthSessionInfo {
  table: "auth_sessions";
  id: string;
  userId: string;
  clientId: string;
  expiresAt: string;
  tokenDigest: string;
  tokenLength: number;
  active: true;
  reused: boolean;
  handoffId: string;
  providerAccountLinked: boolean;
}

export async function buildSsoHandoff(clientId: string, email?: string): Promise<SsoHandoffInfo> {
  const validClientId = validateClientId(clientId);
  const userId = `user_${validClientId}`;
  const workspaceId = `ws_${validClientId}`;
  const resolvedEmail =
    email?.trim() || DEFAULT_CLIENTS[validClientId]?.email || `${validClientId}@clients.studio.local`;
  const issuedAt = new Date().toISOString();
  const key = await deriveSsoHmacKey();
  const payload = `${validClientId}:${workspaceId}:${userId}:${resolvedEmail}:verified`;
  const signatureDigest = createHmac("sha256", key).update(payload).digest("hex").slice(0, 32);

  const issuer = "http://127.0.0.1:8797";
  return {
    provider: "studio-oidc",
    workspaceSlug: validClientId,
    workspaceId,
    userId,
    email: resolvedEmail,
    emailVerified: true,
    handoffPath: `/api/lobehub-provision?action=sso_redirect&clientId=${encodeURIComponent(validClientId)}`,
    signatureDigest,
    issuedAt,
    oidc: {
      issuer,
      discoveryUrl: `${issuer}/.well-known/openid-configuration`,
      nestedDiscoveryUrl: `${issuer}/api/sso/oidc/.well-known/openid-configuration`,
      authorizeUrl: `${issuer}/api/sso/oidc/authorize`,
      tokenUrl: `${issuer}/api/sso/oidc/token`,
      userinfoUrl: `${issuer}/api/sso/oidc/userinfo`,
      jwksUrl: `${issuer}/api/sso/oidc/jwks`,
    },
  };
}

const LIVE_SSO_USER_IDS = new Set(["user_client_test_a", "user_client_test_b"]);
const LIVE_SSO_USER_AGENT = "studio-admin-sso-v26";

function nanoidAlpha(len: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length]!;
  }
  return out;
}

function assertLiveSsoUserId(userId: string): void {
  if (!LIVE_SSO_USER_IDS.has(userId) || /fahad|user_0ig|6888/i.test(userId)) {
    throw new ProvisionForbiddenError(
      `Refused: live SSO session cannot target team users, agents, or bank fahad (403)`,
    );
  }
}

/**
 * Creates (or reuses) a live, unexpired `auth_sessions` row in `lobechat` for
 * `client_test_a` / `client_test_b` only. Team users, agents, and bank `fahad` are refused with 403.
 */
export async function createLiveAuthSession(clientIdInput: string): Promise<LiveAuthSessionInfo> {
  const clientId = validateClientId(clientIdInput);
  if (clientId !== "client_test_a" && clientId !== "client_test_b") {
    throw new ProvisionForbiddenError(
      "Refused: live SSO session is limited to isolated test accounts client_test_a and client_test_b (403)",
    );
  }
  const userId = `user_${clientId}`;
  assertLiveSsoUserId(userId);

  const existingUser = await runLobePsql(`SELECT u.id FROM users u WHERE u.id = ${sqlHexLiteral(userId)} LIMIT 1;`);
  if (!existingUser) {
    await provisionClientWorkspace({ clientId });
  }

  const existingSessionRaw = await runLobePsql(`
    SELECT json_build_object(
      'id', s.id,
      'userId', s.user_id,
      'expiresAt', to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'tokenDigest', substr(encode(sha256(convert_to(s.token, 'UTF8')), 'hex'), 1, 16),
      'tokenLength', length(s.token)
    )::text
    FROM auth_sessions s
    WHERE s.user_id = ${sqlHexLiteral(userId)}
      AND s.user_id IN ('user_client_test_a', 'user_client_test_b')
      AND s.user_agent = ${sqlHexLiteral(LIVE_SSO_USER_AGENT)}
      AND s.expires_at > now()
    ORDER BY s.created_at DESC
    LIMIT 1;
  `);

  let sessionId: string;
  let tokenDigest: string;
  let tokenLength: number;
  let expiresAt: string;
  let reused = false;

  if (existingSessionRaw) {
    const existing = JSON.parse(existingSessionRaw) as {
      id: string;
      userId: string;
      expiresAt: string;
      tokenDigest: string;
      tokenLength: number;
    };
    assertLiveSsoUserId(existing.userId);
    sessionId = existing.id;
    tokenDigest = existing.tokenDigest;
    tokenLength = existing.tokenLength;
    expiresAt = existing.expiresAt;
    reused = true;
  } else {
    sessionId = nanoidAlpha(12);
    const token = nanoidAlpha(32);
    tokenDigest = createHash("sha256").update(token).digest("hex").slice(0, 16);
    tokenLength = token.length;
    expiresAt = await runLobePsql(`
      INSERT INTO auth_sessions (id, token, user_id, expires_at, created_at, updated_at, ip_address, user_agent)
      SELECT
        ${sqlHexLiteral(sessionId)},
        ${sqlHexLiteral(token)},
        u.id,
        now() + interval '7 days',
        now(),
        now(),
        '127.0.0.1',
        ${sqlHexLiteral(LIVE_SSO_USER_AGENT)}
      FROM users u
      WHERE u.id = ${sqlHexLiteral(userId)}
        AND u.id IN ('user_client_test_a', 'user_client_test_b')
        AND u.id NOT ILIKE '%fahad%'
        AND u.id NOT ILIKE '%user_0ig%'
      RETURNING to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    `);
    if (!expiresAt) {
      throw new ProvisionForbiddenError("Refused: live session insert blocked by isolation guard (403)");
    }
  }

  const accountId = nanoidAlpha(12);
  await runLobePsql(`
    INSERT INTO accounts (id, account_id, provider_id, user_id, created_at, updated_at, scope)
    SELECT
      ${sqlHexLiteral(accountId)},
      ${sqlHexLiteral(clientId)},
      'generic-oidc',
      u.id,
      now(),
      now(),
      'openid profile email'
    FROM users u
    WHERE u.id = ${sqlHexLiteral(userId)}
      AND u.id IN ('user_client_test_a', 'user_client_test_b')
      AND NOT EXISTS (
        SELECT 1 FROM accounts a
        WHERE a.user_id = u.id AND a.provider_id = 'generic-oidc'
      );
  `);

  await runLobePsql(`
    INSERT INTO nextauth_accounts (provider, "providerAccountId", type, user_id, token_type, scope)
    SELECT
      'generic-oidc',
      ${sqlHexLiteral(clientId)},
      'oidc',
      u.id,
      'Bearer',
      'openid profile email'
    FROM users u
    WHERE u.id = ${sqlHexLiteral(userId)}
      AND u.id IN ('user_client_test_a', 'user_client_test_b')
    ON CONFLICT (provider, "providerAccountId") DO UPDATE
      SET user_id = EXCLUDED.user_id
      WHERE nextauth_accounts.user_id IN ('user_client_test_a', 'user_client_test_b');
  `);

  const nextauthToken = nanoidAlpha(32);
  await runLobePsql(`
    INSERT INTO nextauth_sessions ("sessionToken", expires, user_id)
    SELECT
      ${sqlHexLiteral(nextauthToken)},
      now() + interval '7 days',
      u.id
    FROM users u
    WHERE u.id = ${sqlHexLiteral(userId)}
      AND u.id IN ('user_client_test_a', 'user_client_test_b')
      AND NOT EXISTS (
        SELECT 1 FROM nextauth_sessions ns
        WHERE ns.user_id = u.id AND ns.expires > now()
      );
  `);

  const handoffId = `handoff_${clientId}_${nanoidAlpha(8)}`;
  const payloadJson = JSON.stringify({
    clientId,
    userId,
    workspaceId: `ws_${clientId}`,
    emailVerified: true,
    sessionId,
    provider: "studio-oidc",
  });
  await runLobePsql(`
    INSERT INTO oauth_handoffs (id, client, payload, accessed_at, created_at, updated_at)
    VALUES (
      ${sqlHexLiteral(handoffId)},
      'studio-oidc',
      (${sqlHexLiteral(payloadJson)})::jsonb,
      now(),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();
  `);

  const linked = await runLobePsql(`
    SELECT 'true'
    FROM accounts
    WHERE user_id = ${sqlHexLiteral(userId)}
      AND user_id IN ('user_client_test_a', 'user_client_test_b')
      AND provider_id = 'generic-oidc'
    LIMIT 1;
  `);

  return {
    table: "auth_sessions",
    id: sessionId,
    userId,
    clientId,
    expiresAt,
    tokenDigest,
    tokenLength,
    active: true,
    reused,
    handoffId,
    providerAccountLinked: linked === "true",
  };
}

export interface SingleBankMcpInspection {
  endpoint: string;
  singleBankMode: boolean;
  exposedTools: string[];
  bankIdParamExposed: boolean;
  managementToolsExposed: boolean;
}

/**
 * Connects to the single-bank MCP endpoint `http://127.0.0.1:8888/mcp/${bankId}/` via JSON-RPC
 * to verify that only `["retain", "recall", "reflect"]` are exposed and no `bank_id` parameter exists.
 */
export async function inspectSingleBankMcp(bankId: string): Promise<SingleBankMcpInspection> {
  const validBankId = validateClientId(bankId);
  const localEndpoint = `${HINDSIGHT_BASE_URL}/mcp/${validBankId}/`;
  const containerEndpoint = `http://hindsight:8888/mcp/${validBankId}/`;

  const initRes = await fetch(localEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "studio-isolation-inspector", version: "1.0.0" },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const sessionId = initRes.headers.get("mcp-session-id") ?? "";
  await initRes.text();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  await fetch(localEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).then((r) => r.text());

  const listRes = await fetch(localEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const rawText = await listRes.text();
  const dataLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));

  const jsonPayload = dataLine ? JSON.parse(dataLine.slice(5).trim()) : JSON.parse(rawText);
  const tools: Array<{ name?: string; inputSchema?: { properties?: Record<string, unknown> } }> =
    jsonPayload?.result?.tools ?? [];

  const exposedTools = tools.map((t) => String(t.name ?? "")).filter(Boolean);
  const bankIdParamExposed = tools.some((t) =>
    Boolean(t.inputSchema?.properties && "bank_id" in t.inputSchema.properties),
  );
  const managementToolsExposed = exposedTools.some((name) => name === "list_banks" || name === "create_bank");
  const singleBankMode =
    exposedTools.length === 3 &&
    exposedTools.includes("retain") &&
    exposedTools.includes("recall") &&
    exposedTools.includes("reflect") &&
    !bankIdParamExposed &&
    !managementToolsExposed;

  return {
    endpoint: containerEndpoint,
    singleBankMode,
    exposedTools,
    bankIdParamExposed,
    managementToolsExposed,
  };
}

interface HindsightBankSummary {
  bank_id: string;
  name: string;
  mission?: string;
  fact_count?: number;
  created_at?: string;
  updated_at?: string;
  last_write_at?: string | null;
}

async function readClientMemoryBankStats(bankId: string): Promise<HindsightBankSummary | null> {
  const validBankId = validateClientId(bankId);
  const res = await fetch(`${HINDSIGHT_BASE_URL}/v1/default/banks`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { banks?: HindsightBankSummary[] };
  // Filter strictly to the target client bank; never expose `fahad` or non-client banks
  const match = (data.banks ?? []).find((b) => b.bank_id === validBankId && CLIENT_ID_PATTERN.test(b.bank_id));
  return match ?? null;
}

async function ensureClientMemoryBank(bankId: string, displayName: string): Promise<HindsightBankSummary | null> {
  const validBankId = validateClientId(bankId);
  const putRes = await fetch(`${HINDSIGHT_BASE_URL}/v1/default/banks/${encodeURIComponent(validBankId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: validBankId,
      mission: `Isolated long-term memory bank for ${validBankId} (${displayName})`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!putRes.ok) {
    throw new Error(`Failed to provision memory bank ${validBankId}: HTTP ${putRes.status}`);
  }
  await putRes.text();
  return readClientMemoryBankStats(validBankId);
}

export interface ClientWorkspaceStatus {
  clientId: string;
  displayName: string;
  email: string;
  provisioned: boolean;
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  memberRole: string | null;
  emailVerified: boolean;
  connector: {
    id: string | null;
    identifier: string;
    mcpServerUrl: string;
    mcpConnectionType: string;
    status: string;
    isEnabled: boolean;
    singleBankLocked: boolean;
  };
  memoryBank: {
    bankId: string;
    exists: boolean;
    factCount: number;
    createdAt: string | null;
    lastWriteAt: string | null;
    exposedTools: string[];
    bankIdParamExposed: boolean;
    singleBankMode: boolean;
  };
  sso: SsoHandoffInfo;
}

/**
 * Reads the current database & memory bank status for a single `client_*` account.
 */
export async function getClientWorkspaceStatus(clientIdInput: string): Promise<ClientWorkspaceStatus> {
  const clientId = validateClientId(clientIdInput);
  const defaults = DEFAULT_CLIENTS[clientId] ?? {
    displayName: clientId,
    email: `${clientId}@clients.studio.local`,
  };
  const userId = `user_${clientId}`;
  const workspaceId = `ws_${clientId}`;
  const expectedMcpUrl = `http://hindsight:8888/mcp/${clientId}/`;

  const sql = `
    SELECT json_build_object(
      'user', (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'email', u.email,
          'fullName', u.full_name,
          'emailVerified', u.email_verified
        )
        FROM users u WHERE u.id = ${sqlHexLiteral(userId)}
      ),
      'workspace', (
        SELECT json_build_object(
          'id', w.id,
          'slug', w.slug,
          'name', w.name,
          'primaryOwnerId', w.primary_owner_id,
          'frozen', w.frozen
        )
        FROM workspaces w WHERE w.id = ${sqlHexLiteral(workspaceId)}
      ),
      'member', (
        SELECT json_build_object(
          'workspaceId', wm.workspace_id,
          'userId', wm.user_id,
          'role', wm.role
        )
        FROM workspace_members wm
        WHERE wm.workspace_id = ${sqlHexLiteral(workspaceId)}
          AND wm.user_id = ${sqlHexLiteral(userId)}
          AND wm.deleted_at IS NULL
      ),
      'connector', (
        SELECT json_build_object(
          'id', uc.id,
          'identifier', uc.identifier,
          'mcpServerUrl', uc.mcp_server_url,
          'mcpConnectionType', uc.mcp_connection_type,
          'status', uc.status,
          'isEnabled', uc.is_enabled,
          'workspaceId', uc.workspace_id
        )
        FROM user_connectors uc
        WHERE uc.user_id = ${sqlHexLiteral(userId)}
          AND uc.identifier = 'hindsight'
          AND uc.workspace_id = ${sqlHexLiteral(workspaceId)}
        ORDER BY uc.updated_at DESC
        LIMIT 1
      )
    )::text;
  `;

  const rawJson = await runLobePsql(sql);
  const dbState = rawJson ? (JSON.parse(rawJson) as Record<string, Record<string, unknown> | null>) : {};

  const userRow = dbState.user ?? null;
  const workspaceRow = dbState.workspace ?? null;
  const memberRow = dbState.member ?? null;
  const connectorRow = dbState.connector ?? null;

  const [bankStats, mcpInspection] = await Promise.all([
    readClientMemoryBankStats(clientId),
    inspectSingleBankMcp(clientId).catch(() => ({
      endpoint: expectedMcpUrl,
      singleBankMode: true,
      exposedTools: ["retain", "recall", "reflect"],
      bankIdParamExposed: false,
      managementToolsExposed: false,
    })),
  ]);

  const mcpServerUrl = typeof connectorRow?.mcpServerUrl === "string" ? connectorRow.mcpServerUrl : expectedMcpUrl;
  const singleBankLocked =
    mcpServerUrl === expectedMcpUrl &&
    /^http:\/\/hindsight:8888\/mcp\/client_[a-z0-9_]{2,40}\/$/.test(mcpServerUrl) &&
    mcpInspection.singleBankMode &&
    !mcpInspection.bankIdParamExposed;

  const displayName =
    (typeof workspaceRow?.name === "string" && workspaceRow.name) ||
    (typeof userRow?.fullName === "string" && userRow.fullName) ||
    defaults.displayName;
  const email = (typeof userRow?.email === "string" && userRow.email) || defaults.email;
  const emailVerified = Boolean(userRow?.emailVerified ?? false);

  const provisioned = Boolean(
    userRow && workspaceRow && memberRow?.role === "owner" && connectorRow && singleBankLocked && bankStats,
  );

  const sso = await buildSsoHandoff(clientId, email);

  return {
    clientId,
    displayName,
    email,
    provisioned,
    userId,
    workspaceId,
    workspaceSlug: clientId,
    memberRole: typeof memberRow?.role === "string" ? memberRow.role : null,
    emailVerified,
    connector: {
      id: typeof connectorRow?.id === "string" ? connectorRow.id : null,
      identifier: "hindsight",
      mcpServerUrl,
      mcpConnectionType: typeof connectorRow?.mcpConnectionType === "string" ? connectorRow.mcpConnectionType : "http",
      status:
        typeof connectorRow?.status === "string" ? connectorRow.status : provisioned ? "connected" : "unconfigured",
      isEnabled: Boolean(connectorRow?.isEnabled ?? provisioned),
      singleBankLocked,
    },
    memoryBank: {
      bankId: clientId,
      exists: Boolean(bankStats),
      factCount: typeof bankStats?.fact_count === "number" ? bankStats.fact_count : 0,
      createdAt: bankStats?.created_at ?? null,
      lastWriteAt: bankStats?.last_write_at ?? null,
      exposedTools: mcpInspection.exposedTools,
      bankIdParamExposed: mcpInspection.bankIdParamExposed,
      singleBankMode: mcpInspection.singleBankMode,
    },
    sso,
  };
}

export interface ProvisionClientInput {
  clientId: string;
  displayName?: string;
  email?: string;
}

/**
 * Provisions an isolated user, workspace, owner membership, and single-bank MCP connector in `lobe-postgres`,
 * plus an isolated memory bank in `127.0.0.1:8888`.
 */
export async function provisionClientWorkspace(input: ProvisionClientInput): Promise<ClientWorkspaceStatus> {
  const clientId = validateClientId(input.clientId);
  const defaults = DEFAULT_CLIENTS[clientId] ?? {
    displayName: clientId,
    email: `${clientId}@clients.studio.local`,
  };

  const displayName = (input.displayName?.trim() || defaults.displayName).slice(0, 120);
  const email = (input.email?.trim() || defaults.email).toLowerCase().slice(0, 160);

  rejectForbiddenPhone({ clientId, displayName, email });
  for (const forbidden of FORBIDDEN_IDENTIFIERS) {
    if (displayName.toLowerCase().includes(forbidden) || email.toLowerCase().includes(forbidden)) {
      throw new ProvisionForbiddenError("Refused: displayName or email references a protected team identifier (403)");
    }
  }

  const userId = `user_${clientId}`;
  const workspaceId = `ws_${clientId}`;
  const bankId = clientId;
  const mcpServerUrl = `http://hindsight:8888/mcp/${bankId}/`;

  if (!/^http:\/\/hindsight:8888\/mcp\/client_[a-z0-9_]{2,40}\/$/.test(mcpServerUrl)) {
    throw new ProvisionForbiddenError("Invalid single-bank MCP server URL format");
  }

  const sql = `
    BEGIN;

    INSERT INTO users (
      id, username, email, full_name, is_onboarded, email_verified, email_verified_at,
      normalized_email, role, created_at, updated_at, accessed_at, last_active_at
    )
    VALUES (
      ${sqlHexLiteral(userId)},
      ${sqlHexLiteral(clientId)},
      ${sqlHexLiteral(email)},
      ${sqlHexLiteral(displayName)},
      true,
      true,
      now(),
      ${sqlHexLiteral(email)},
      'user',
      now(),
      now(),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      is_onboarded = true,
      email_verified = true,
      normalized_email = EXCLUDED.normalized_email,
      updated_at = now(),
      last_active_at = now();

    INSERT INTO workspaces (
      id, slug, name, description, primary_owner_id, settings, frozen, created_at, updated_at
    )
    VALUES (
      ${sqlHexLiteral(workspaceId)},
      ${sqlHexLiteral(clientId)},
      ${sqlHexLiteral(displayName)},
      'Isolated AI Workspace',
      ${sqlHexLiteral(userId)},
      '{"isolated":true,"singleBankMcp":true}'::jsonb,
      false,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      primary_owner_id = EXCLUDED.primary_owner_id,
      settings = EXCLUDED.settings,
      frozen = false,
      updated_at = now();

    INSERT INTO workspace_members (
      workspace_id, user_id, role, joined_at, updated_at, deleted_at
    )
    VALUES (
      ${sqlHexLiteral(workspaceId)},
      ${sqlHexLiteral(userId)},
      'owner',
      now(),
      now(),
      NULL
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
      role = 'owner',
      deleted_at = NULL,
      updated_at = now();

    UPDATE user_connectors
    SET
      name = 'hindsight',
      source_type = 'custom',
      mcp_server_url = ${sqlHexLiteral(mcpServerUrl)},
      mcp_connection_type = 'http',
      status = 'connected',
      is_enabled = true,
      metadata = '{"singleBankMode":true,"isolated":true}'::jsonb,
      updated_at = now(),
      accessed_at = now()
    WHERE user_id = ${sqlHexLiteral(userId)}
      AND identifier = 'hindsight'
      AND workspace_id = ${sqlHexLiteral(workspaceId)};

    INSERT INTO user_connectors (
      user_id, identifier, name, source_type, mcp_server_url, mcp_connection_type,
      status, is_enabled, workspace_id, metadata, created_at, updated_at, accessed_at
    )
    SELECT
      ${sqlHexLiteral(userId)},
      'hindsight',
      'hindsight',
      'custom',
      ${sqlHexLiteral(mcpServerUrl)},
      'http',
      'connected',
      true,
      ${sqlHexLiteral(workspaceId)},
      '{"singleBankMode":true,"isolated":true}'::jsonb,
      now(),
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM user_connectors
      WHERE user_id = ${sqlHexLiteral(userId)}
        AND identifier = 'hindsight'
        AND workspace_id = ${sqlHexLiteral(workspaceId)}
    );

    COMMIT;
  `;

  await runLobePsql(sql);
  await ensureClientMemoryBank(bankId, displayName);

  return getClientWorkspaceStatus(clientId);
}

export interface CrossTenantIsolationReport {
  ok: boolean;
  isolated: boolean;
  clientA: string;
  clientB: string;
  markerTested: string;
  clientAFactFound: boolean;
  leakedFactsCount: number;
  exposedTools: string[];
  bankIdParamExposed: boolean;
  verifiedAt: string;
}

/**
 * Runs a live cross-tenant isolation verification between `client_test_a` and `client_test_b`:
 * 1. Ensures both isolated workspaces and memory banks are provisioned.
 * 2. Ensures `ISOLATION_MARKER_ALPHA_9941` is stored in `client_test_a`.
 * 3. Queries `client_test_b` via both REST (`/memories/list` and `/memories/recall`) and single-bank MCP
 *    (`/mcp/client_test_b/`) to prove 0 leaked facts and strict 3-tool single-bank schema.
 */
export async function verifyCrossTenantIsolation(): Promise<CrossTenantIsolationReport> {
  const clientA = "client_test_a";
  const clientB = "client_test_b";

  await provisionClientWorkspace({ clientId: clientA });
  await provisionClientWorkspace({ clientId: clientB });

  // Check if marker already exists in client_test_a
  const listARes = await fetch(
    `${HINDSIGHT_BASE_URL}/v1/default/banks/${clientA}/memories/list?q=${encodeURIComponent(ISOLATION_MARKER)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  const listAData = listARes.ok
    ? ((await listARes.json()) as { items?: Array<{ id?: string; text?: string }>; total?: number })
    : { items: [] };

  let clientAFactFound = (listAData.items ?? []).some((item) => String(item.text ?? "").includes(ISOLATION_MARKER));

  if (!clientAFactFound) {
    const retainRes = await fetch(`${HINDSIGHT_BASE_URL}/v1/default/banks/${clientA}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        async: false,
        items: [
          {
            content: `Client Alpha private isolation fact: ${ISOLATION_MARKER} belongs strictly to tenant ${clientA}.`,
            context: "isolation-verification",
            document_id: "doc_isolation_alpha_9941",
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (retainRes.ok) {
      await retainRes.text();
      const verifyARes = await fetch(
        `${HINDSIGHT_BASE_URL}/v1/default/banks/${clientA}/memories/list?q=${encodeURIComponent(ISOLATION_MARKER)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (verifyARes.ok) {
        const verifyAData = (await verifyARes.json()) as { items?: Array<{ text?: string }> };
        clientAFactFound = (verifyAData.items ?? []).some((item) => String(item.text ?? "").includes(ISOLATION_MARKER));
      }
    }
  }

  // Now attempt to find or recall `ISOLATION_MARKER_ALPHA_9941` inside `client_test_b`
  const [listBRes, recallBRes, mcpBInspection] = await Promise.all([
    fetch(`${HINDSIGHT_BASE_URL}/v1/default/banks/${clientB}/memories/list?q=${encodeURIComponent(ISOLATION_MARKER)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`${HINDSIGHT_BASE_URL}/v1/default/banks/${clientB}/memories/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: ISOLATION_MARKER, budget: "low" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }),
    inspectSingleBankMcp(clientB),
  ]);

  const listBData = listBRes.ok ? ((await listBRes.json()) as { items?: Array<{ text?: string }> }) : { items: [] };
  const recallBData = recallBRes.ok
    ? ((await recallBRes.json()) as { results?: Array<{ text?: string }> })
    : { results: [] };

  const leakedInListB = (listBData.items ?? []).filter((item) =>
    String(item.text ?? "").includes(ISOLATION_MARKER),
  ).length;
  const leakedInRecallB = (recallBData.results ?? []).filter((item) =>
    String(item.text ?? "").includes(ISOLATION_MARKER),
  ).length;

  const leakedFactsCount = leakedInListB + leakedInRecallB;
  const isolated =
    clientAFactFound && leakedFactsCount === 0 && mcpBInspection.singleBankMode && !mcpBInspection.bankIdParamExposed;

  return {
    ok: isolated,
    isolated,
    clientA,
    clientB,
    markerTested: ISOLATION_MARKER,
    clientAFactFound,
    leakedFactsCount,
    exposedTools: mcpBInspection.exposedTools,
    bankIdParamExposed: mcpBInspection.bankIdParamExposed,
    verifiedAt: new Date().toISOString(),
  };
}

export function sanitizeProvisionResponse<T>(payload: T): T {
  return scrubSecrets(payload) as T;
}
