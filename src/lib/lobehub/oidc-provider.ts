import {
  DEFAULT_CLIENTS,
  ProvisionForbiddenError,
  ProvisionValidationError,
  validateClientId,
} from "@/lib/lobehub/provision";

import {
  createHash,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const OIDC_CLIENT_ID = "lobehub-studio";
export const ALLOWED_SSO_CLIENTS = ["client_test_a", "client_test_b"] as const;
export type AllowedSsoClient = (typeof ALLOWED_SSO_CLIENTS)[number];

// 2026-10-19 (نسخة الإنتاج لـ app.airest.ai): مجلد بيانات النسخة نفسها لا مجلد studio-admin، حتى لا تكتب النسخة في ملفات الأصل.
const SSO_DATA_DIR = path.join(process.cwd(), ".studio-data", "sso");
const SSO_STATE_FILE = path.join(SSO_DATA_DIR, "oidc-state.json");
const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_SEC = 3600;
const ID_TOKEN_TTL_SEC = 3600;

const FORBIDDEN_HINTS = ["fahad", "user_0ig", "user_0igqijtu4mcdijum5zvdysw6kvk", "6888"];

export const DEFAULT_REDIRECT_URIS = [
  "http://127.0.0.1:3210/api/auth/callback/generic-oidc",
  "http://localhost:3210/api/auth/callback/generic-oidc",
  "http://127.0.0.1:8797/api/sso/oidc/dev-callback",
] as const;

interface AuthorizationCodeRecord {
  clientId: AllowedSsoClient;
  oidcClientId: string;
  redirectUri: string;
  nonce: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
  consumed: boolean;
}

interface AccessTokenRecord {
  clientId: AllowedSsoClient;
  scope: string;
  expiresAt: number;
}

interface OidcStateFile {
  kid: string;
  publicKeyPem: string;
  privateKeyPem: string;
  clientId: string;
  clientSecret: string;
  codes: Record<string, AuthorizationCodeRecord>;
  accessTokens: Record<string, AccessTokenRecord>;
}

function isAllowedSsoClient(value: string): value is AllowedSsoClient {
  return (ALLOWED_SSO_CLIENTS as readonly string[]).includes(value);
}

function assertNoForbiddenHint(raw: string): void {
  const lower = raw.toLowerCase();
  for (const forbidden of FORBIDDEN_HINTS) {
    if (lower.includes(forbidden)) {
      throw new ProvisionForbiddenError(
        `Refused: protected team or primary memory bank identifier cannot be used with SSO (403)`,
      );
    }
  }
}

export function assertIsolatedSsoClient(rawClientId: unknown): AllowedSsoClient {
  const clientId = validateClientId(rawClientId);
  assertNoForbiddenHint(clientId);
  if (!isAllowedSsoClient(clientId)) {
    throw new ProvisionForbiddenError(
      `Refused: SSO live session is limited to isolated test accounts client_test_a and client_test_b (403)`,
    );
  }
  return clientId;
}

export function resolveSsoClientFromHint(rawHint: string | null | undefined): AllowedSsoClient {
  const hint = (rawHint ?? "").trim();
  if (!hint) {
    throw new ProvisionValidationError("login_hint or studio_client is required for the isolated SSO client");
  }
  assertNoForbiddenHint(hint);
  const lower = hint.toLowerCase();
  if (lower === "client_test_a" || lower === "user_client_test_a" || lower === "client_test_a@clients.studio.local") {
    return "client_test_a";
  }
  if (lower === "client_test_b" || lower === "user_client_test_b" || lower === "client_test_b@clients.studio.local") {
    return "client_test_b";
  }
  if (lower.startsWith("client_")) {
    return assertIsolatedSsoClient(hint);
  }
  throw new ProvisionForbiddenError("Refused: SSO login hint is not an isolated test client (403)");
}

export function issuerFromRequest(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "127.0.0.1:8797";
  const protoHeader = req.headers.get("x-forwarded-proto");
  const proto = protoHeader === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

export function oidcEndpoints(issuer: string) {
  const base = `${issuer}/api/sso/oidc`;
  return {
    issuer,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    userinfo_endpoint: `${base}/userinfo`,
    jwks_uri: `${base}/jwks`,
    discovery_url: `${issuer}/.well-known/openid-configuration`,
    nested_discovery_url: `${base}/.well-known/openid-configuration`,
  };
}

export function buildDiscoveryDocument(issuer: string) {
  const endpoints = oidcEndpoints(issuer);
  return {
    issuer: endpoints.issuer,
    authorization_endpoint: endpoints.authorization_endpoint,
    token_endpoint: endpoints.token_endpoint,
    userinfo_endpoint: endpoints.userinfo_endpoint,
    jwks_uri: endpoints.jwks_uri,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    claims_supported: ["sub", "email", "email_verified", "name", "preferred_username"],
    code_challenge_methods_supported: ["S256", "plain"],
    response_modes_supported: ["query"],
  };
}

async function ensureState(): Promise<OidcStateFile> {
  await mkdir(SSO_DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(SSO_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as OidcStateFile;
    if (parsed?.privateKeyPem && parsed?.publicKeyPem && parsed?.clientSecret && parsed?.kid) {
      parsed.codes = parsed.codes ?? {};
      parsed.accessTokens = parsed.accessTokens ?? {};
      parsed.clientId = parsed.clientId || OIDC_CLIENT_ID;
      return parsed;
    }
  } catch {
    // generate a fresh signing key on first run
  }

  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const state: OidcStateFile = {
    kid: `studio-oidc-${randomBytes(6).toString("hex")}`,
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    clientId: OIDC_CLIENT_ID,
    clientSecret: randomBytes(32).toString("hex"),
    codes: {},
    accessTokens: {},
  };
  await persistState(state);
  return state;
}

async function persistState(state: OidcStateFile): Promise<void> {
  await mkdir(SSO_DATA_DIR, { recursive: true });
  await writeFile(SSO_STATE_FILE, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
}

function pruneExpired(state: OidcStateFile, now = Date.now()): void {
  for (const [code, rec] of Object.entries(state.codes)) {
    if (rec.consumed || rec.expiresAt <= now) delete state.codes[code];
  }
  for (const [token, rec] of Object.entries(state.accessTokens)) {
    if (rec.expiresAt <= now) delete state.accessTokens[token];
  }
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(payload: Record<string, unknown>, privateKeyPem: string, kid: string): string {
  const header = { alg: "RS256", typ: "JWT", kid };
  const unsigned = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKeyPem).toString("base64url")}`;
}

function publicJwk(publicKeyPem: string, kid: string): Record<string, string> {
  const key = createPublicKey(publicKeyPem);
  const jwk = key.export({ format: "jwk" }) as { kty?: string; n?: string; e?: string };
  return {
    kty: jwk.kty ?? "RSA",
    n: jwk.n ?? "",
    e: jwk.e ?? "AQAB",
    kid,
    use: "sig",
    alg: "RS256",
  };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseBasicClientAuth(header: string | null): { id: string; secret: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { id: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export async function getJwks(): Promise<{ keys: Record<string, string>[] }> {
  const state = await ensureState();
  return { keys: [publicJwk(state.publicKeyPem, state.kid)] };
}

export function isolatedUserClaims(clientId: AllowedSsoClient) {
  const defaults = DEFAULT_CLIENTS[clientId];
  return {
    sub: `user_${clientId}`,
    email: defaults.email,
    email_verified: true as const,
    name: defaults.displayName,
    preferred_username: clientId,
  };
}

export async function issueAuthorizationCode(input: {
  studioClientId: AllowedSsoClient;
  oidcClientId: string;
  redirectUri: string;
  nonce?: string;
  scope?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}): Promise<{ code: string; expiresIn: number }> {
  if (input.oidcClientId !== OIDC_CLIENT_ID) {
    throw new ProvisionForbiddenError("Unknown OIDC client_id (403)");
  }
  if (
    input.redirectUri &&
    !DEFAULT_REDIRECT_URIS.includes(input.redirectUri as (typeof DEFAULT_REDIRECT_URIS)[number])
  ) {
    throw new ProvisionValidationError("redirect_uri is not registered for the studio OIDC client");
  }
  const state = await ensureState();
  pruneExpired(state);
  const code = `ac_${randomBytes(24).toString("hex")}`;
  state.codes[code] = {
    clientId: input.studioClientId,
    oidcClientId: input.oidcClientId,
    redirectUri: input.redirectUri,
    nonce: input.nonce ?? "",
    scope: input.scope || "openid profile email",
    codeChallenge: input.codeChallenge ?? "",
    codeChallengeMethod: input.codeChallengeMethod ?? "",
    expiresAt: Date.now() + CODE_TTL_MS,
    consumed: false,
  };
  await persistState(state);
  return { code, expiresIn: Math.floor(CODE_TTL_MS / 1000) };
}

function verifyPkce(record: AuthorizationCodeRecord, verifier: string | undefined): void {
  if (!record.codeChallenge) return;
  if (!verifier) {
    throw new ProvisionValidationError("code_verifier is required");
  }
  if (record.codeChallengeMethod === "S256") {
    const digest = createHash("sha256").update(verifier).digest("base64url");
    if (!timingSafeStringEqual(digest, record.codeChallenge)) {
      throw new ProvisionForbiddenError("PKCE verification failed (403)");
    }
    return;
  }
  if (!timingSafeStringEqual(verifier, record.codeChallenge)) {
    throw new ProvisionForbiddenError("PKCE verification failed (403)");
  }
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  oidcClientId: string;
  oidcClientSecret: string;
  redirectUri?: string;
  codeVerifier?: string;
  issuer: string;
}): Promise<{
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  id_token: string;
  scope: string;
}> {
  const state = await ensureState();
  if (input.oidcClientId !== state.clientId || !timingSafeStringEqual(input.oidcClientSecret, state.clientSecret)) {
    throw new ProvisionForbiddenError("Invalid OIDC client credentials (403)");
  }
  pruneExpired(state);
  const record = state.codes[input.code];
  if (!record || record.consumed || record.expiresAt <= Date.now()) {
    throw new ProvisionForbiddenError("Authorization code is invalid or expired (403)");
  }
  if (input.redirectUri && record.redirectUri && input.redirectUri !== record.redirectUri) {
    throw new ProvisionValidationError("redirect_uri does not match the authorization request");
  }
  verifyPkce(record, input.codeVerifier);
  record.consumed = true;
  delete state.codes[input.code];

  const studioClientId = assertIsolatedSsoClient(record.clientId);
  const accessToken = `at_${randomBytes(24).toString("hex")}`;
  state.accessTokens[accessToken] = {
    clientId: studioClientId,
    scope: record.scope,
    expiresAt: Date.now() + ACCESS_TTL_SEC * 1000,
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = isolatedUserClaims(studioClientId);
  const idToken = signJwt(
    {
      iss: input.issuer,
      aud: OIDC_CLIENT_ID,
      iat: now,
      exp: now + ID_TOKEN_TTL_SEC,
      nonce: record.nonce || undefined,
      ...claims,
    },
    state.privateKeyPem,
    state.kid,
  );
  await persistState(state);

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SEC,
    id_token: idToken,
    scope: record.scope,
  };
}

export async function resolveAccessToken(
  token: string,
): Promise<ReturnType<typeof isolatedUserClaims> & { scope: string }> {
  const state = await ensureState();
  pruneExpired(state);
  const record = state.accessTokens[token];
  if (!record || record.expiresAt <= Date.now()) {
    throw new ProvisionForbiddenError("Access token is invalid or expired (403)");
  }
  const clientId = assertIsolatedSsoClient(record.clientId);
  return { ...isolatedUserClaims(clientId), scope: record.scope };
}

export function parseClientCredentials(req: Request, body: Record<string, string>): { id: string; secret: string } {
  const basic = parseBasicClientAuth(req.headers.get("authorization"));
  const id = body.client_id || basic?.id || "";
  const secret = body.client_secret || basic?.secret || "";
  if (!id || !secret) {
    throw new ProvisionValidationError("client_id and client_secret are required");
  }
  return { id, secret };
}

export async function readOidcClientPublicInfo(): Promise<{
  clientId: string;
  secretConfigured: boolean;
  kid: string;
}> {
  const state = await ensureState();
  return {
    clientId: state.clientId,
    secretConfigured: Boolean(state.clientSecret),
    kid: state.kid,
  };
}

export function corsHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
