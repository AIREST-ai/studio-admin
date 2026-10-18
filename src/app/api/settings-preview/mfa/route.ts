import { NextResponse } from "next/server";

import { PRODUCT_NAME } from "@/config/app-config";
import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";

import { execFile } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// F-6A (sim2 problem 8: "two-factor accepts any 6 digits and shows made-up backup codes"): a working two-factor setup
// for this preview, with a real authenticator app. The secret is made here, shown once as a QR code and as text, and a
// code is accepted only when it is the time-based one-time password of that secret:
// - TOTP: RFC 6238 (https://datatracker.ietf.org/doc/html/rfc6238), HMAC-SHA1, 30 s steps, 6 digits, one step either
//   side for clock drift (RFC 6238 section 5.2); HOTP truncation from RFC 4226 section 5.3.
// - The QR code holds the Key URI Format the authenticator apps read
//   (https://github.com/google/google-authenticator/wiki/Key-Uri-Format), drawn by qrencode on the preview machine.
// - The secret is 20 random bytes in Base32 (RFC 4226 section 4 asks for 160 bits; Base32 is RFC 4648).
// Preview only: no sign-in asks for the code (the preview has no accounts), and no backup codes are made, so none are
// shown. The secret stays on this machine (.preview-state/settings-preview-mfa.json); GET never returns it.
//   GET                          -> { enabled, enabledAt }
//   POST { action: "start" }     -> { secret, otpauth, qr }  (qr: an SVG data: URL, or null without qrencode)
//   POST { action: "verify", code }  -> { enabled: true, enabledAt }   wrong code: 422
//   POST { action: "disable", code } -> { enabled: false }            wrong code: 422
//   POST { action: "cancel" }    -> { enabled }
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), ".preview-state", "settings-preview-mfa.json");
const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

const ISSUER = `${PRODUCT_NAME} preview`;
const ACCOUNT = "arham.khan@weblabs.studio";
const STEP_SECONDS = 30;
const DIGITS = 6;
const PENDING_MINUTES = 15;
const QRENCODE = ["/opt/homebrew/bin/qrencode", "/usr/local/bin/qrencode", "/usr/bin/qrencode"].find((file) =>
  existsSync(file),
);

interface MfaState {
  enabled: boolean;
  secret?: string;
  enabledAt?: string;
  pending?: { secret: string; createdAt: string };
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

async function read(): Promise<MfaState> {
  try {
    const saved = JSON.parse(await readFile(FILE, "utf8")) as MfaState;
    return { ...saved, enabled: saved.enabled === true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { enabled: false };
    throw error;
  }
}

async function write(state: MfaState) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(temp, FILE);
}

// ---- RFC 4648 Base32 and RFC 6238 TOTP ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("not Base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The HOTP value of a counter (RFC 4226 section 5.3), as RFC 6238 uses it with the time step as the counter. */
function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", secret).update(message).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

function codeMatches(secretText: string, code: unknown, now = Date.now()): boolean {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretText);
  const step = Math.floor(now / 1000 / STEP_SECONDS);
  return [-1, 0, 1].some((drift) => hotp(secret, step + drift) === code);
}

function otpauthUri(secret: string): string {
  const label = encodeURIComponent(`${ISSUER}:${ACCOUNT}`);
  const query = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

function qrDataUrl(text: string): Promise<string | null> {
  if (!QRENCODE) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(QRENCODE, ["-t", "SVG", "-m", "2", "-l", "M", "-o", "-", text], { timeout: 5_000 }, (error, stdout) => {
      if (error || !stdout.includes("<svg")) resolve(null);
      else resolve(`data:image/svg+xml;base64,${Buffer.from(stdout).toString("base64")}`);
    });
  });
}

// ---- routes -----------------------------------------------------------------------------------------------------

export async function GET() {
  try {
    const state = await read();
    return NextResponse.json({ enabled: state.enabled, enabledAt: state.enabledAt ?? null }, { headers });
  } catch (error) {
    return fail(500, `two-factor state unreadable: ${(error as Error).message}`);
  }
}

let writing: Promise<unknown> = Promise.resolve();

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  let body: { action?: unknown; code?: unknown } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "body is not JSON");
  }
  const action = body?.action;
  const run = writing.then(async (): Promise<Response> => {
    const state = await read();
    if (action === "start") {
      if (state.enabled) return fail(409, "Two-factor authentication is already enabled");
      const secret = base32Encode(randomBytes(20));
      await write({ ...state, pending: { secret, createdAt: new Date().toISOString() } });
      const otpauth = otpauthUri(secret);
      return NextResponse.json({ secret, otpauth, qr: await qrDataUrl(otpauth) }, { headers });
    }
    if (action === "verify") {
      const pending = state.pending;
      if (state.enabled) return fail(409, "Two-factor authentication is already enabled");
      if (!pending || Date.now() - Date.parse(pending.createdAt) > PENDING_MINUTES * 60_000)
        return fail(410, "This setup has expired. Start again to get a new QR code.");
      if (!codeMatches(pending.secret, body?.code)) return fail(422, "Invalid verification code");
      const enabledAt = new Date().toISOString();
      await write({ enabled: true, secret: pending.secret, enabledAt });
      return NextResponse.json({ enabled: true, enabledAt }, { headers });
    }
    if (action === "disable") {
      if (!state.enabled || !state.secret) return fail(409, "Two-factor authentication is not enabled");
      if (!codeMatches(state.secret, body?.code)) return fail(422, "Invalid verification code");
      await write({ enabled: false });
      return NextResponse.json({ enabled: false }, { headers });
    }
    if (action === "cancel") {
      await write({ enabled: state.enabled, secret: state.secret, enabledAt: state.enabledAt });
      return NextResponse.json({ enabled: state.enabled }, { headers });
    }
    return fail(400, "unknown action");
  });
  writing = run.catch(() => undefined);
  try {
    return await run;
  } catch (error) {
    return fail(500, `not saved: ${(error as Error).message}`);
  }
}

function describeMfa(context: AuditContext<MfaState>): AuditChange[] {
  const body = context.json as { action?: unknown } | null;
  if (context.status >= 400 || !body) return [];
  const target = { id: "two_factor", name: "Two-Factor Authentication", type: "settings" };
  if (body.action === "verify")
    return [
      {
        action: "mfa.enable",
        crud: "u",
        summary: "turned on two-factor authentication",
        target,
        before: { enabled: false },
        after: { enabled: true },
      },
    ];
  if (body.action === "disable")
    return [
      {
        action: "mfa.disable",
        crud: "u",
        summary: "turned off two-factor authentication",
        target,
        before: { enabled: true },
        after: { enabled: false },
      },
    ];
  return [];
}

export const POST = withAudit<MfaState>(
  { area: "settings_preview_mfa", snapshot: () => read(), describe: describeMfa },
  post,
);
