// L-2 (plan r1-chatwoot-link/خطة.md 2.1, 2.3, 4 phase 1): the ONE server-side client of the Chatwoot test copy
// ("chatwoot-copy", Chatwoot v4.18.0 CE). Same pattern as src/lib/twenty/server.ts. Only route handlers under
// src/app/api/chatwoot/ import it ("server-only" makes a client import a build error:
// node_modules/next/dist/docs/01-app/02-guides/data-security.md "Preventing client-side execution of server-only code").
// - Address locked to the test copy: http://127.0.0.1:8810 by default (M-1); CHATWOOT_URL is accepted only with host
//   127.0.0.1 or 100.86.173.123 and port 8810 or 8812. Anything else (inbox.airest.ai, qayyim-chatwoot on :3200, ...) is
//   refused here and never called: "refused: not the test copy".
// - Auth header "api_access_token" (app/controllers/concerns/access_token_auth_helper.rb:9-12 on v4.18.0; Bearer only
//   from v4.19.0). The token is read from its 600 file at each request (CHATWOOT_TOKEN_FILE, else
//   /Users/ali/lobehub-hub/chatwoot-copy/access-token.txt). It is never logged, returned or put in an error.
// - Identity check before any account read: GET /api must say version 4.18.0, GET /api/v1/profile must be
//   admin@chatwoot-copy.local with the account "AIREST Copy" (its id is read there, not assumed). Done once after the
//   server starts (cached on globalThis for 10 minutes), again when that is older.
// - 15 s timeout per call (AbortSignal.timeout, as twenty/server.ts). No retry (a retried write could run twice).
// - Phase 1 reads; L-3 (phase 2) adds the conversation writes at the end of this file: reply / private note,
//   status, agent or team assignment, labels. Same address lock, identity check and token handling as the reads.
// biome-ignore lint/correctness/noUndeclaredDependencies: Next.js resolves "server-only" itself (node_modules/next/dist/docs/01-app/02-guides/data-security.md)
import "server-only";

import {
  applyLinkedSectionDefaults,
  type LinkIdentity,
  type LinkMode,
  type LinkProblem,
  type LinkProblemKind,
  type LinkSection,
} from "@/lib/chatwoot-link-types";

import { containsBlocked6888, scrubSecrets } from "./gateway-policy";
import { profileIdentity } from "./map";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

// V-1 (2026-10-18, item 160.2 + 160.6): Studio Engine official live link to Chatwoot 3200 (with 8810 & 8812 kept for test/sim).
export const TEST_COPY_HOSTS = ["127.0.0.1", "100.86.173.123"];
export const TEST_COPY_HOST = TEST_COPY_HOSTS[0];
export const TEST_COPY_PORTS = ["3200", "8810", "8812"];
const DEFAULT_BASE_URL = `http://${TEST_COPY_HOST}:3200`;
/** Forbidden substrings that must never be called (e.g. external domain or lab port 8799). */
const FORBIDDEN = ["inbox.airest.ai", ":8799"];
export const EXPECTED_VERSION = "4.x";
export const CHATWOOT_V4_VERSION_REGEX = /^4\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
export const EXPECTED_EMAIL = "admin-test@airest.ai";
export const EXPECTED_ACCOUNT = "AIREST Test";
export const EXPECTED_ACCOUNT_ID = 1;
const TIMEOUT_MS = 15_000;
const IDENTITY_TTL_MS = 10 * 60_000;

export interface ExpectedOriginIdentity {
  target?: string;
  accountId?: number;
  email?: string;
  account?: string;
  allowedEmails?: string[];
  allowedAccounts?: string[];
}

interface LinkLockConfig {
  allowedHosts?: string[];
  allowedPorts?: string[];
  allowedTargets?: string[];
  forbiddenSubstrings?: string[];
  expectedVersion?: string;
  expectedVersionPattern?: string;
  expectedIdentityByOrigin?: Record<string, ExpectedOriginIdentity>;
  allowedIdentities?: ExpectedOriginIdentity[];
}

export const SYSTEM_VAULT_DIRS = ["/run/credentials/studio-admin.service", "/etc/airest-inbox"] as const;

function readAdapterEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(path.join(process.cwd(), ".chatwoot-adapter.env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    // optional file
  }
  return out;
}

function readLinkLock(): LinkLockConfig | null {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".chatwoot-link-lock.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as LinkLockConfig) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a secret file path from Linux system vault directories (`/run/credentials/studio-admin.service/` or
 * `/etc/airest-inbox/`) first, with safe fallback to `.chatwoot-adapter.env` and target-specific token files.
 */
export function resolveSecretFilePath(targetPort?: string): string {
  if (process.env.CHATWOOT_TOKEN_FILE?.trim()) {
    return process.env.CHATWOOT_TOKEN_FILE.trim();
  }
  const envCfg = readAdapterEnv();
  const port =
    targetPort ||
    (() => {
      try {
        return new URL((process.env.CHATWOOT_URL ?? envCfg.CHATWOOT_URL ?? DEFAULT_BASE_URL).trim()).port || "3200";
      } catch {
        return "3200";
      }
    })();

  if (port === "8810" || port === "8812") {
    if (envCfg.CHATWOOT_TOKEN_FILE && envCfg.CHATWOOT_TOKEN_FILE.includes("access-token.txt")) {
      return envCfg.CHATWOOT_TOKEN_FILE;
    }
    return "/Users/ali/lobehub-hub/chatwoot-copy/access-token.txt";
  }

  const vaultDirs = [
    ...(process.env.CREDENTIALS_DIRECTORY ? [process.env.CREDENTIALS_DIRECTORY] : []),
    ...SYSTEM_VAULT_DIRS,
  ];
  const candidateNames = ["chatwoot_token", "cw_token", "live-3200-token.txt"];
  for (const dir of vaultDirs) {
    for (const name of candidateNames) {
      const candidate = path.join(dir, name);
      try {
        if (existsSync(candidate)) {
          const val = readFileSync(candidate, "utf8").trim();
          if (val && !/\s/.test(val)) return candidate;
        }
      } catch {
        // Unreadable by non-root or absent: safely fall back to next candidate
      }
    }
  }

  return envCfg.CHATWOOT_TOKEN_FILE || "/Users/ali/lobehub-hub/chatwoot-copy/live-3200-token.txt";
}

const tokenFile = () => resolveSecretFilePath();

/** Builds dual authentication headers (`api_access_token` + `Authorization: Bearer <token>`) for Chatwoot 4.18 & 4.19+. */
export function buildAuthHeaders(tok: string): Record<string, string> {
  return {
    Accept: "application/json",
    api_access_token: tok,
    Authorization: `Bearer ${tok}`,
  };
}

/** Checks whether a Chatwoot version string satisfies the flexible v4 contract (`/^4\.\d+\.\d+/`). */
export function isCompatibleChatwootVersion(version: string, expectedVersion = EXPECTED_VERSION): boolean {
  const clean = (version ?? "").trim();
  if (!clean) return false;
  const exp = (expectedVersion ?? EXPECTED_VERSION).trim();
  if (exp === "4.x" || exp.startsWith("4.") || exp.startsWith("^4")) {
    return CHATWOOT_V4_VERSION_REGEX.test(clean);
  }
  return clean === exp;
}

/**
 * Verifies the Chatwoot v4 API contract:
 * 1) Version matches v4 (`/^4\.\d+\.\d+/`, e.g. 4.18.0, 4.18.1, 4.19.0).
 * 2) Profile payload contains valid `email` and non-empty `accounts` array with numeric `id` and string `name`.
 * 3) Matches expected identity (by `accountId`, `account` name, and `email`).
 */
export function verifyChatwootContract(
  version: string,
  rawProfile: unknown,
  expected?: ExpectedOriginIdentity & { expectedVersion?: string },
): LinkIdentity {
  const expVer = expected?.expectedVersion ?? EXPECTED_VERSION;
  if (!isCompatibleChatwootVersion(version, expVer)) {
    throw new ChatwootError(
      "identity",
      `refused: incompatible Chatwoot version (${version}, expected ${expVer} matching /^4.\\d+.\\d+/)`,
      502,
    );
  }
  const profile = profileIdentity(rawProfile);
  if (!profile.email || !Array.isArray(profile.accounts) || profile.accounts.length === 0) {
    throw new ChatwootError(
      "identity",
      "refused: incompatible Chatwoot contract (profile missing email or accounts)",
      502,
    );
  }

  const allowedEmails = new Set<string>(
    [expected?.email, ...(expected?.allowedEmails ?? [])].filter((e): e is string => Boolean(e?.trim())),
  );
  if (allowedEmails.size > 0 && !allowedEmails.has(profile.email)) {
    throw new ChatwootError("identity", "refused: the token email does not match the expected admin identity", 502);
  }

  const allowedAccounts = new Set<string>(
    [expected?.account, ...(expected?.allowedAccounts ?? [])].filter((a): a is string => Boolean(a?.trim())),
  );
  const expectedAccId = typeof expected?.accountId === "number" && expected.accountId > 0 ? expected.accountId : null;

  const account = profile.accounts.find((each) => {
    const idMatches = expectedAccId !== null ? each.id === expectedAccId : true;
    const nameMatches = allowedAccounts.size > 0 ? allowedAccounts.has(each.name) : true;
    if (expectedAccId !== null && allowedAccounts.size > 0) {
      return idMatches && (nameMatches || each.name.toUpperCase().includes("AIREST"));
    }
    return idMatches && nameMatches;
  });

  if (!account) {
    throw new ChatwootError(
      "identity",
      `refused: no matching Chatwoot account found (expected accountId=${expectedAccId ?? "any"}, account="${expected?.account ?? "AIREST"}")`,
      502,
    );
  }

  return {
    version,
    accountId: account.id,
    accountName: account.name,
    email: profile.email,
    checkedAt: new Date().toISOString(),
  };
}

export type ChatwootErrorKind = LinkProblemKind | "not-found";

/** An error with the Chatwoot status and its text only: no header, no token, no full URL with a query. */
export class ChatwootError extends Error {
  kind: ChatwootErrorKind;
  status: number;
  constructor(kind: ChatwootErrorKind, message: string, status: number) {
    super(message);
    this.name = "ChatwootError";
    this.kind = kind;
    this.status = status;
  }
}

export function problemOf(error: unknown): LinkProblem {
  if (error instanceof ChatwootError)
    return { kind: error.kind === "not-found" ? "error" : error.kind, message: error.message };
  return { kind: "error", message: "the preview server could not read the test copy" };
}

/** The target Chatwoot address, or "refused" before anything is called. */
export function chatwootTarget(): { url: string; host: string; port: string } {
  const envCfg = readAdapterEnv();
  const lockCfg = readLinkLock();
  const raw = (process.env.CHATWOOT_URL ?? envCfg.CHATWOOT_URL ?? "").trim() || DEFAULT_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ChatwootError("refused", "refused: not an allowed Chatwoot target (invalid URL)", 502);
  }
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  const host = `${parsed.hostname}:${port}`;
  const allowedHosts = Array.isArray(lockCfg?.allowedHosts) ? lockCfg.allowedHosts : TEST_COPY_HOSTS;
  const allowedPorts = Array.isArray(lockCfg?.allowedPorts) ? lockCfg.allowedPorts : TEST_COPY_PORTS;
  const allowedTargets = Array.isArray(lockCfg?.allowedTargets) ? lockCfg.allowedTargets : null;
  const forbidden = Array.isArray(lockCfg?.forbiddenSubstrings) ? lockCfg.forbiddenSubstrings : FORBIDDEN;
  const allowed =
    parsed.protocol === "http:" &&
    allowedHosts.includes(parsed.hostname) &&
    allowedPorts.includes(port) &&
    (allowedTargets === null || allowedTargets.includes(host)) &&
    !parsed.username &&
    !parsed.password &&
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !forbidden.some((name) => raw.toLowerCase().includes(name.toLowerCase()));
  if (!allowed) throw new ChatwootError("refused", `refused: target not allowed by link lock (${host})`, 502);
  return { url: `http://${parsed.hostname}:${port}`, host, port };
}

async function token(): Promise<string> {
  let text: string;
  try {
    const { port } = chatwootTarget();
    text = await readFile(resolveSecretFilePath(port), "utf8");
  } catch {
    try {
      text = await readFile(tokenFile(), "utf8");
    } catch {
      throw new ChatwootError("no-token", "not linked: no token", 503);
    }
  }
  const value = text.trim();
  if (!value || /\s/.test(value) || value.length > 256)
    throw new ChatwootError("no-token", "not linked: the token file does not hold one token", 503);
  return value;
}

function chatwootText(body: unknown): string {
  const b = (body && typeof body === "object" ? body : {}) as { error?: unknown; message?: unknown; errors?: unknown };
  if (typeof b.error === "string") return b.error;
  if (typeof b.message === "string") return b.message;
  if (Array.isArray(b.errors)) return b.errors.map(String).join("; ");
  return "";
}

/**
 * One call to Chatwoot (GET by default; POST/DELETE for writes). Sends both `api_access_token` and `Authorization: Bearer`.
 */
async function request(
  path: string,
  auth: boolean,
  write?: { method: "POST" | "DELETE" | "PUT" | "PATCH"; body?: unknown },
): Promise<unknown> {
  if (write) {
    const blocked = containsBlocked6888(write.body, "", path);
    if (blocked) throw new ChatwootError("refused", blocked, 403);
  }
  const { url, host } = chatwootTarget();
  const headers: Record<string, string> = auth ? buildAuthHeaders(await token()) : { Accept: "application/json" };
  if (write && write.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: write?.method ?? "GET",
      body: write && write.body !== undefined ? JSON.stringify(write.body) : undefined,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const late = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ChatwootError(
      "unreachable",
      late ? `unreachable: ${host} did not answer in ${TIMEOUT_MS / 1000} s` : `unreachable: ${host} did not answer`,
      504,
    );
  }
  if (response.status >= 300 && response.status < 400)
    throw new ChatwootError("refused", `refused: ${host} answered with a redirect`, 502);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text.trim() ? JSON.parse(text) : null;
  } catch {
    throw new ChatwootError("refused", `refused: ${host} did not answer JSON`, 502);
  }
  if (response.status === 401) throw new ChatwootError("no-token", "not linked: the token was not accepted (401)", 502);
  if (response.status === 404) throw new ChatwootError("not-found", "not found in Chatwoot", 404);
  if (!response.ok) {
    const said = chatwootText(body);
    throw new ChatwootError("error", `Chatwoot answered ${response.status}${said ? `: ${said}` : ""}`, 502);
  }
  return body;
}

interface IdentityCache {
  host: string;
  email: string;
  accountName: string;
  at: number;
  identity: LinkIdentity;
}
const cache = globalThis as typeof globalThis & { __studioChatwootIdentity?: IdentityCache };

/** GET /api (no token): reachability and version, as the status card shows them. */
export async function readVersion(): Promise<string> {
  const body = (await request("/api", false)) as { version?: unknown } | null;
  return typeof body?.version === "string" ? body.version : "unknown";
}

function resolveExpectedIdentityForTarget(
  url: string,
  host: string,
): ExpectedOriginIdentity & { expectedVersion: string } {
  const envCfg = readAdapterEnv();
  const lockCfg = readLinkLock();
  const byOrigin = lockCfg?.expectedIdentityByOrigin?.[url] ?? lockCfg?.expectedIdentityByOrigin?.[host];
  const matchedIdentity =
    byOrigin ??
    (Array.isArray(lockCfg?.allowedIdentities)
      ? lockCfg.allowedIdentities.find((item) => item.target === host)
      : undefined);

  const expectedVersion = (
    process.env.CHATWOOT_EXPECTED_VERSION ||
    envCfg.CHATWOOT_EXPECTED_VERSION ||
    lockCfg?.expectedVersion ||
    EXPECTED_VERSION
  ).trim();

  const envUrl = (envCfg.CHATWOOT_URL || DEFAULT_BASE_URL).trim();
  const isSameAsAdapterTarget = envUrl.includes(host);

  const email = (
    process.env.CHATWOOT_EXPECTED_EMAIL ||
    matchedIdentity?.email ||
    (isSameAsAdapterTarget ? envCfg.CHATWOOT_EXPECTED_EMAIL : undefined) ||
    EXPECTED_EMAIL
  ).trim();

  const account = (
    process.env.CHATWOOT_EXPECTED_ACCOUNT ||
    matchedIdentity?.account ||
    (isSameAsAdapterTarget ? envCfg.CHATWOOT_EXPECTED_ACCOUNT : undefined) ||
    EXPECTED_ACCOUNT
  ).trim();

  const accountIdRaw =
    process.env.CHATWOOT_EXPECTED_ACCOUNT_ID ||
    (matchedIdentity?.accountId !== undefined ? String(matchedIdentity.accountId) : undefined) ||
    (isSameAsAdapterTarget ? envCfg.CHATWOOT_EXPECTED_ACCOUNT_ID : undefined);
  const accountId = accountIdRaw ? Number(accountIdRaw) : EXPECTED_ACCOUNT_ID;

  return {
    target: host,
    email,
    account,
    accountId: Number.isFinite(accountId) && accountId > 0 ? accountId : EXPECTED_ACCOUNT_ID,
    allowedEmails: matchedIdentity?.allowedEmails,
    allowedAccounts: matchedIdentity?.allowedAccounts,
    expectedVersion,
  };
}

/** The identity check of plan 2.1 + V-1 flexible v4 contract check. Throws "refused"/"unreachable"/"no-token"/"identity". */
export async function checkIdentity(force = false): Promise<LinkIdentity> {
  const { url, host } = chatwootTarget();
  const expected = resolveExpectedIdentityForTarget(url, host);

  const saved = cache.__studioChatwootIdentity;
  if (
    !force &&
    saved &&
    saved.host === host &&
    saved.email === expected.email &&
    saved.accountName === expected.account &&
    Date.now() - saved.at < IDENTITY_TTL_MS
  ) {
    return saved.identity;
  }
  const version = await readVersion();
  const rawProfile = await request("/api/v1/profile", true);
  const identity = verifyChatwootContract(version, rawProfile, expected);

  cache.__studioChatwootIdentity = {
    host,
    email: expected.email ?? identity.email,
    accountName: expected.account ?? identity.accountName,
    at: Date.now(),
    identity,
  };
  return identity;
}

/** GET under /api/v1/accounts/{the checked account}. */
export async function accountGet(path: string): Promise<unknown> {
  const identity = await checkIdentity();
  return request(`/api/v1/accounts/${identity.accountId}${path}`, true);
}

/** L-3: POST (JSON) under /api/v1/accounts/{the checked account}. Same identity check as accountGet. */
async function accountPost(path: string, body: unknown): Promise<unknown> {
  const identity = await checkIdentity();
  return request(`/api/v1/accounts/${identity.accountId}${path}`, true, { method: "POST", body });
}

/** V-1: DELETE under /api/v1/accounts/{the checked account} (used only for Studio's own webhook cleanup). */
async function accountDelete(path: string): Promise<unknown> {
  const identity = await checkIdentity();
  return request(`/api/v1/accounts/${identity.accountId}${path}`, true, { method: "DELETE" });
}

/* ------------------------------------------------------------------ reads (phase 1) ----------------------------- */

const PAGE_LIMIT = 40;

/** GET /inboxes (payload[]), for the inbox names a conversation shows (it carries only inbox_id). */
export function readInboxes(): Promise<unknown> {
  return accountGet("/inboxes");
}

/**
 * Every conversation, any status and assignee: GET /conversations?status=all&assignee_type=all&page=N, 25 a page
 * (conversation_finder.rb: DEFAULT_STATUS "open" unless status=all; per page CONVERSATION_RESULTS_PER_PAGE, 25).
 */
export async function readConversations(): Promise<{ payload: unknown[]; total: number }> {
  const payload: unknown[] = [];
  let total = 0;
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const body = (await accountGet(`/conversations?status=all&assignee_type=all&page=${page}`)) as {
      data?: { meta?: { all_count?: unknown }; payload?: unknown };
    } | null;
    const rows = Array.isArray(body?.data?.payload) ? body.data.payload : [];
    total = typeof body?.data?.meta?.all_count === "number" ? body.data.meta.all_count : payload.length + rows.length;
    payload.push(...rows);
    if (rows.length === 0 || payload.length >= total) break;
  }
  return { payload, total };
}

export function readConversation(id: number): Promise<unknown> {
  return accountGet(`/conversations/${id}`);
}

/**
 * All messages of a conversation, oldest first: GET /messages?after=<last id>, 100 a call, repeated while a call
 * returns 100 (message_finder.rb messages_after: created_at asc, id > after, limit 100; plan 2.5 step 4).
 * filter_internal_messages is not sent, so private notes and activity messages come too.
 */
export async function readMessages(id: number): Promise<unknown[]> {
  const out: unknown[] = [];
  let after = 0;
  for (let call = 0; call < PAGE_LIMIT; call++) {
    const body = (await accountGet(`/conversations/${id}/messages?after=${after}`)) as { payload?: unknown } | null;
    const rows = Array.isArray(body?.payload) ? (body.payload as { id?: unknown }[]) : [];
    out.push(...rows);
    const last = rows.at(-1)?.id;
    if (rows.length < 100 || typeof last !== "number") break;
    after = last;
  }
  return out;
}

/** Every contact Chatwoot lists: GET /contacts?page=N, 15 a page (contacts_controller.rb RESULTS_PER_PAGE). */
export async function readContacts(): Promise<{ payload: unknown[]; total: number }> {
  const payload: unknown[] = [];
  let total = 0;
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const body = (await accountGet(`/contacts?page=${page}`)) as {
      meta?: { count?: unknown };
      payload?: unknown;
    } | null;
    const rows = Array.isArray(body?.payload) ? body.payload : [];
    total = typeof body?.meta?.count === "number" ? body.meta.count : payload.length + rows.length;
    payload.push(...rows);
    if (rows.length === 0 || payload.length >= total) break;
  }
  return { payload, total };
}

export async function readContact(id: number): Promise<unknown> {
  const body = (await accountGet(`/contacts/${id}`)) as { payload?: unknown } | null;
  return body?.payload ?? null;
}

/** GET /contacts/{id}/conversations: the contact's latest 25 (contacts/conversations_controller.rb). */
export async function readContactConversations(id: number): Promise<unknown[]> {
  const body = (await accountGet(`/contacts/${id}/conversations`)) as { payload?: unknown } | null;
  return Array.isArray(body?.payload) ? body.payload : [];
}

/* ------------------------------------------------------------------ writes (L-3, phase 2) ------------------------ */
// Chatwoot v4.18.0 sources these follow (tag v4.18.0):
// - reply / note: POST /conversations/{id}/messages {content, private} (conversations/messages_controller.rb create,
//   answers the message: views/api/v1/accounts/conversations/messages/create.json.jbuilder)
// - status: POST /conversations/{id}/toggle_status {status} (conversations_controller.rb toggle_status and
//   set_conversation_status; without snoozed_until a snoozed conversation wakes at the next reply)
// - agent: POST /conversations/{id}/assignments {assignee_id} (assignments_controller.rb set_agent; an id that is not
//   a user of the account, or null, leaves it unassigned: assignment_service.rb assignee find_by)
// - team: POST /conversations/{id}/assignments {team_id} (set_team; 0 = no team, an unknown id = 404)
// - labels: POST /conversations/{id}/labels {labels: [...]} REPLACES the whole list (label_concern.rb create
//   update_labels), so writeLabels is always given the full list (see the conversation route).

export function sendMessage(id: number, content: string, isPrivate: boolean): Promise<unknown> {
  return accountPost(`/conversations/${id}/messages`, { content, private: isPrivate, message_type: "outgoing" });
}

export function setStatus(id: number, status: "open" | "resolved" | "pending" | "snoozed"): Promise<unknown> {
  return accountPost(`/conversations/${id}/toggle_status`, { status });
}

export function assignAgent(id: number, assigneeId: number | null): Promise<unknown> {
  return accountPost(`/conversations/${id}/assignments`, { assignee_id: assigneeId });
}

export function assignTeam(id: number, teamId: number | null): Promise<unknown> {
  return accountPost(`/conversations/${id}/assignments`, { team_id: teamId ?? 0 });
}

/** GET /conversations/{id}/labels: {payload: ["a", "b"]} (conversations/labels/index.json.jbuilder). */
export async function readLabels(id: number): Promise<string[]> {
  const body = (await accountGet(`/conversations/${id}/labels`)) as { payload?: unknown } | null;
  return Array.isArray(body?.payload) ? body.payload.filter((label): label is string => typeof label === "string") : [];
}

/** POST /conversations/{id}/labels with the FULL list; answers the list Chatwoot kept. */
export async function writeLabels(id: number, labels: string[]): Promise<string[]> {
  const body = (await accountPost(`/conversations/${id}/labels`, { labels })) as { payload?: unknown } | null;
  return Array.isArray(body?.payload) ? body.payload.filter((label): label is string => typeof label === "string") : [];
}

/** For the pickers: GET /agents (array), GET /teams (array), GET /labels ({payload}). */
export function readAgents(): Promise<unknown> {
  return accountGet("/agents");
}
export function readTeams(): Promise<unknown> {
  return accountGet("/teams");
}
export function readAccountLabels(): Promise<unknown> {
  return accountGet("/labels");
}

/**
 * V-14: default linked-mode section flags for the link server. Notifications is on whenever `mode === "linked"`;
 * the `.preview-state/` files are not rewritten.
 */
export function defaultLinkedSections(
  mode: LinkMode,
  sections: Record<LinkSection, boolean>,
): Record<LinkSection, boolean> {
  return applyLinkedSectionDefaults(mode, sections);
}

/**
 * V-14: GET /api/v1/accounts/{id}/notifications of the linked account. Scrubbed before return.
 * Page size is Chatwoot's RESULTS_PER_PAGE (15).
 */
export async function readNotifications(page = 1): Promise<unknown> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  return scrubSecrets(await accountGet(`/notifications?page=${safePage}&includes[]=read&includes[]=snoozed`));
}

/* ------------------------------------------------------------------ U-1: the /api/cw gateway --------------------- */
// The one call of src/app/api/cw/[...path]/route.ts. Same address lock (chatwootTarget), same identity check (the
// account id comes from checkIdentity, never from the browser) and same token file as everything above; the token is
// put in the api_access_token header here and nowhere else. Unlike request(), a 4xx answer of Chatwoot (422 validation,
// 403, 404) is handed back with its status and JSON body, so the page sees what Chatwoot said. The gateway runs every
// answer through scrubSecrets (gateway-policy.ts) before it leaves the server.

/** Where the gateway path goes: /api/v1/accounts/{id}, /api/v2/accounts/{id}, or /api/v1 (profile). */
export type GatewayBase = "account-v1" | "account-v2" | "api-v1";

export interface GatewayAnswer {
  status: number;
  body: unknown;
}

export async function gatewayCall(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  base: GatewayBase,
  path: string,
  query: string,
  payload?: { bytes: ArrayBuffer; contentType: string; parsed?: unknown },
): Promise<GatewayAnswer> {
  if (method !== "GET") {
    const inspected =
      payload?.parsed !== undefined
        ? payload.parsed
        : payload?.bytes
          ? new TextDecoder().decode(payload.bytes.slice(0, Math.min(payload.bytes.byteLength, 65_536)))
          : null;
    const blocked = containsBlocked6888(inspected, query, path);
    if (blocked) throw new ChatwootError("refused", blocked, 403);
  }
  const identity = await checkIdentity();
  const prefix =
    base === "api-v1"
      ? "/api/v1"
      : `/api/${base === "account-v2" ? "v2" : "v1"}/accounts/${encodeURIComponent(String(identity.accountId))}`;
  const { url, host } = chatwootTarget();
  const headers: Record<string, string> = buildAuthHeaders(await token());
  if (payload) headers["Content-Type"] = payload.contentType;
  let response: Response;
  try {
    response = await fetch(`${url}${prefix}${path}${query}`, {
      method,
      body: payload ? payload.bytes : undefined,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const late = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ChatwootError(
      "unreachable",
      late ? `unreachable: ${host} did not answer in ${TIMEOUT_MS / 1000} s` : `unreachable: ${host} did not answer`,
      504,
    );
  }
  if (response.status >= 300 && response.status < 400)
    throw new ChatwootError("refused", `refused: ${host} answered with a redirect`, 502);
  if (response.status === 401) throw new ChatwootError("no-token", "not linked: the token was not accepted (401)", 502);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text.trim() ? JSON.parse(text) : null;
  } catch {
    // Rails answers an unknown route or a crash with HTML: say so, never pass the page on.
    if (response.status === 404) return { status: 404, body: { error: "not found in Chatwoot" } };
    throw new ChatwootError("error", `Chatwoot answered ${response.status} without JSON`, 502);
  }
  if (response.status >= 500) {
    const said = chatwootText(body);
    throw new ChatwootError("error", `Chatwoot answered ${response.status}${said ? `: ${said}` : ""}`, 502);
  }
  return { status: response.status, body };
}

/* ------------------------------------------------------------------ U-4 & V-1: webhook secret & auto-sync -------- */

interface WebhookSecretCache {
  host: string;
  at: number;
  secrets: string[];
}

const webhookSecretCache = globalThis as typeof globalThis & {
  __studioChatwootWebhookSecrets?: WebhookSecretCache;
};

const WEBHOOK_SECRET_TTL_MS = 60_000;

export const DEFAULT_STUDIO_WEBHOOK_URL = "http://172.17.0.1:8797/api/cw/webhook";

export const STUDIO_WEBHOOK_SUBSCRIPTIONS = [
  "conversation_status_changed",
  "conversation_updated",
  "conversation_created",
  "contact_created",
  "contact_updated",
  "message_created",
  "message_updated",
  "webwidget_triggered",
  "inbox_created",
  "inbox_updated",
  "conversation_typing_on",
  "conversation_typing_off",
] as const;

const STUDIO_WEBHOOK_HOSTS = new Set(["172.17.0.1", "172.28.0.1", "127.0.0.1", "localhost", "host.docker.internal"]);

/**
 * Strictly checks whether a webhook URL belongs ONLY to Studio (`:8797/api/cw/webhook`).
 * Never matches any other service, port, or webhook path.
 */
export function isStudioWebhookUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === "http:" &&
      parsed.port === "8797" &&
      parsed.pathname === "/api/cw/webhook" &&
      STUDIO_WEBHOOK_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function extractWebhookRows(body: unknown): Array<{ id: number; url: string; secret?: string; name?: string }> {
  const b =
    body && typeof body === "object"
      ? (body as { payload?: { webhooks?: unknown } | unknown[]; webhooks?: unknown })
      : null;
  const payloadObj = b?.payload && typeof b.payload === "object" && !Array.isArray(b.payload) ? b.payload : null;
  const rows = Array.isArray(payloadObj?.webhooks)
    ? payloadObj.webhooks
    : Array.isArray(b?.payload)
      ? b.payload
      : Array.isArray(b?.webhooks)
        ? b.webhooks
        : [];
  const out: Array<{ id: number; url: string; secret?: string; name?: string }> = [];
  for (const item of rows) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const id = typeof rec.id === "number" ? rec.id : Number(rec.id);
      const url = typeof rec.url === "string" ? rec.url.trim() : "";
      if (Number.isFinite(id) && id > 0 && url) {
        out.push({
          id,
          url,
          secret: typeof rec.secret === "string" ? rec.secret.trim() : undefined,
          name: typeof rec.name === "string" ? rec.name.trim() : undefined,
        });
      }
    }
  }
  return out;
}

export interface StudioWebhookSyncResult {
  action: "existing" | "created" | "removed" | "noop" | "skipped";
  webhookId: number | null;
  url: string | null;
  otherWebhooksPreserved: number;
}

/**
 * V-1 requirement 3: Safely synchronizes ONLY Studio's own webhook (`http://172.17.0.1:8797/api/cw/webhook`)
 * in the target Chatwoot account without ever deleting, editing, or disabling any other webhook.
 */
export async function syncStudioWebhook(
  mode: "linked" | "preview",
  options?: { removeOnPreview?: boolean; studioWebhookUrl?: string },
): Promise<StudioWebhookSyncResult> {
  const envCfg = readAdapterEnv();
  const targetUrl = (
    options?.studioWebhookUrl ||
    process.env.CHATWOOT_STUDIO_WEBHOOK_URL ||
    envCfg.CHATWOOT_STUDIO_WEBHOOK_URL ||
    DEFAULT_STUDIO_WEBHOOK_URL
  ).trim();

  try {
    const existingRows = extractWebhookRows(await accountGet("/webhooks"));
    const studioRows = existingRows.filter((row) => isStudioWebhookUrl(row.url) || row.url === targetUrl);
    const otherCount = existingRows.length - studioRows.length;

    if (mode === "linked") {
      if (studioRows.length > 0) {
        await readWebhookSecrets(true);
        return {
          action: "existing",
          webhookId: studioRows[0].id,
          url: studioRows[0].url,
          otherWebhooksPreserved: otherCount,
        };
      }
      const created = await accountPost("/webhooks", {
        webhook: {
          name: "Studio Engine Realtime Webhook",
          url: targetUrl,
          subscriptions: [...STUDIO_WEBHOOK_SUBSCRIPTIONS],
        },
      });
      const createdObj =
        created && typeof created === "object"
          ? ((created as { payload?: { webhook?: Record<string, unknown> } }).payload?.webhook ??
            (created as { webhook?: Record<string, unknown> }).webhook ??
            (created as Record<string, unknown>))
          : null;
      const createdId = typeof createdObj?.id === "number" ? createdObj.id : null;
      await readWebhookSecrets(true);
      return {
        action: "created",
        webhookId: createdId,
        url: targetUrl,
        otherWebhooksPreserved: otherCount,
      };
    }

    if (options?.removeOnPreview === true && studioRows.length > 0) {
      for (const row of studioRows) {
        if (isStudioWebhookUrl(row.url)) {
          await accountDelete(`/webhooks/${row.id}`);
        }
      }
      return {
        action: "removed",
        webhookId: studioRows[0].id,
        url: studioRows[0].url,
        otherWebhooksPreserved: otherCount,
      };
    }

    return {
      action: "noop",
      webhookId: studioRows[0]?.id ?? null,
      url: studioRows[0]?.url ?? null,
      otherWebhooksPreserved: otherCount,
    };
  } catch {
    return {
      action: "skipped",
      webhookId: null,
      url: null,
      otherWebhooksPreserved: 0,
    };
  }
}

/**
 * Reads the active webhook signing secrets configured on Chatwoot (GET /api/v1/accounts/{id}/webhooks)
 * on the server only, before scrubSecrets removes them for browser responses. Never returned to the client.
 */
export async function readWebhookSecrets(force = false): Promise<string[]> {
  const envCfg = readAdapterEnv();
  let vaultSecret = "";
  for (const dir of SYSTEM_VAULT_DIRS) {
    const candidate = path.join(dir, "chatwoot_webhook_secret");
    try {
      if (existsSync(candidate)) {
        vaultSecret = readFileSync(candidate, "utf8").trim();
        if (vaultSecret) break;
      }
    } catch {
      // ignore unreadable vault file
    }
  }
  const envSecret = (vaultSecret || process.env.CHATWOOT_WEBHOOK_SECRET || envCfg.CHATWOOT_WEBHOOK_SECRET || "").trim();
  let host = "";
  try {
    host = chatwootTarget().host;
  } catch {
    host = "";
  }
  const cached = webhookSecretCache.__studioChatwootWebhookSecrets;
  if (
    !force &&
    cached &&
    cached.host === host &&
    Date.now() - cached.at < WEBHOOK_SECRET_TTL_MS &&
    cached.secrets.length > 0
  ) {
    return envSecret && !cached.secrets.includes(envSecret) ? [envSecret, ...cached.secrets] : cached.secrets;
  }

  const secrets: string[] = [];
  if (envSecret) secrets.push(envSecret);

  try {
    const rows = extractWebhookRows(await accountGet("/webhooks"));
    for (const item of rows) {
      if (item.secret && !secrets.includes(item.secret)) {
        secrets.push(item.secret);
      }
    }
    if (secrets.length > 0) {
      webhookSecretCache.__studioChatwootWebhookSecrets = { host, at: Date.now(), secrets };
    }
  } catch {
    if (cached?.host === host && cached.secrets.length) {
      for (const s of cached.secrets) {
        if (!secrets.includes(s)) secrets.push(s);
      }
    }
  }

  return secrets;
}
