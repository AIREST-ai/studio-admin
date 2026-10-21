// حارس الدخول (2026-10-19، تثبيت app.airest.ai بأمر فهد): جلسة حقيقية بدل محاكاة المعاينة.
// - الجلسة: كعكة HttpOnly فيها البريد وموعد الانتهاء، موقّعة بـ HMAC-SHA256 بسر محلي في .studio-data/سر-الجلسة (صلاحيته 600).
// - مصدر الحساب: حسابات محلية (.studio-data/حسابات-الدخول.json، كلمات مرورها مشفّرة بـ scrypt، تُضاف بالسكربت
//   src/scripts/أضف-حساب-دخول.mjs) أو حساب في شات ووت عضو في الحساب المربوط (يتحقق منه مسار الدخول).
// يستعمله src/proxy.ts ومسارات /api/studio-auth، ويعمل في بيئة Node وحدها.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SESSION_COOKIE = "studio_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // أسبوع بالثواني

const DATA_DIR = path.join(process.cwd(), ".studio-data");
const SECRET_FILE = path.join(DATA_DIR, "سر-الجلسة");
const ACCOUNTS_FILE = path.join(DATA_DIR, "حسابات-الدخول.json");

export type SessionSource = "local" | "chatwoot";
export type Session = { email: string; name: string; source: SessionSource; exp: number };
type LocalAccount = { email: string; name: string; salt: string; hash: string; created: string };

let cachedSecret: Buffer | null = null;

/** السر يُنشأ مرة واحدة إن لم يوجد، ولا يُطبع ولا يُرسل. */
function secret(): Buffer {
  if (cachedSecret) return cachedSecret;
  if (!existsSync(SECRET_FILE)) writeFileSync(SECRET_FILE, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  const raw = readFileSync(SECRET_FILE, "utf8").trim();
  if (raw.length < 32) throw new Error("سر الجلسة قصير أو تالف");
  cachedSecret = Buffer.from(raw, "utf8");
  return cachedSecret;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function createSessionToken(email: string, name: string, source: SessionSource): string {
  const s: Session = { email, name, source, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = b64(JSON.stringify(s));
  return `${body}.${sign(body)}`;
}

/** يرجع الجلسة إن كان التوقيع صحيحاً ولم تنتهِ، وإلا null. */
export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const got = Buffer.from(token.slice(dot + 1));
  const want = Buffer.from(sign(body));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (typeof s.email !== "string" || typeof s.exp !== "number" || s.exp < Math.floor(Date.now() / 1000)) return null;
    return s;
  } catch {
    return null;
  }
}

function readAccounts(): LocalAccount[] {
  try {
    const parsed = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

/** حساب محلي: يرجع اسمه إن طابقت كلمة المرور، وإلا null. */
export function checkLocalAccount(email: string, password: string): { email: string; name: string } | null {
  const acc = readAccounts().find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (!acc) return null;
  const got = Buffer.from(hashPassword(password, acc.salt).hash, "hex");
  const want = Buffer.from(acc.hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want) ? { email: acc.email, name: acc.name } : null;
}

/** كعكة الجلسة: Secure حين يصل الطلب عبر https (النفق يرسل x-forwarded-proto). */
export function sessionCookieOptions(secure: boolean, maxAge = SESSION_MAX_AGE) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge };
}

export function isHttps(req: { headers: Headers; nextUrl?: URL }): boolean {
  return req.headers.get("x-forwarded-proto") === "https" || req.nextUrl?.protocol === "https:";
}
