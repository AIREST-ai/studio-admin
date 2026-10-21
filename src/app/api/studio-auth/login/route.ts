// مسار الدخول الحقيقي (2026-10-19، حارس الدخول لتثبيت app.airest.ai). يقبل حساباً محلياً، أو حساب شات ووت عضواً
// في الحساب المربوط، ثم يضع كعكة الجلسة الموقّعة (lib/جلسة-الدخول.ts). لا يُحفظ ولا يُسجَّل ما يكتبه الزائر.
import { type NextRequest, NextResponse } from "next/server";

import { chatwootTarget, EXPECTED_ACCOUNT_ID } from "@/lib/chatwoot/server";
import {
  checkLocalAccount,
  createSessionToken,
  isHttps,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/جلسة-الدخول";

export const dynamic = "force-dynamic";

// حد المحاولات: 10 محاولات فاشلة لكل عنوان في 10 دقائق.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map<string, { n: number; since: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

function tooMany(ip: string): boolean {
  const f = fails.get(ip);
  if (!f || Date.now() - f.since > WINDOW_MS) return false;
  return f.n >= MAX_FAILS;
}

function noteFail(ip: string) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.since > WINDOW_MS) fails.set(ip, { n: 1, since: Date.now() });
  else f.n++;
}

/** حساب شات ووت: يُقبل فقط إن نجح دخوله وكان عضواً في الحساب المربوط بالاستوديو. */
async function checkChatwoot(
  email: string,
  password: string,
): Promise<{ email: string; name: string; role: "agent" | "administrator" | null; firstLogin: boolean } | null> {
  const accountId = Number(process.env.CHATWOOT_EXPECTED_ACCOUNT_ID || EXPECTED_ACCOUNT_ID);
  const res = await fetch(`${chatwootTarget().url.replace(/\/$/, "")}/auth/sign_in`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    data?: { email?: string; name?: string; sign_in_count?: number; accounts?: { id?: number; role?: string }[] };
  } | null;
  const d = body?.data;
  if (!d?.email || !d.accounts?.some((a) => Number(a.id) === accountId)) return null;
  const accountRole = d.accounts.find((account) => Number(account.id) === accountId)?.role;
  return {
    email: d.email,
    name: d.name || d.email,
    role: accountRole === "agent" || accountRole === "administrator" ? accountRole : null,
    firstLogin: d.sign_in_count === 1,
  };
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (tooMany(ip))
    return NextResponse.json({ error: "too_many", message: "محاولات كثيرة، حاول بعد دقائق" }, { status: 429 });

  const input = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  if (!email || !password || email.length > 254 || password.length > 256) {
    return NextResponse.json({ error: "invalid", message: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
  }

  let who: { email: string; name: string; role?: "agent" | "administrator" | null; firstLogin?: boolean } | null = null;
  let source: "local" | "chatwoot" = "local";
  who = checkLocalAccount(email, password);
  if (!who) {
    source = "chatwoot";
    try {
      who = await checkChatwoot(email, password);
    } catch {
      return NextResponse.json({ error: "unavailable", message: "خدمة الحسابات لا ترد الآن" }, { status: 503 });
    }
  }
  if (!who) {
    noteFail(ip);
    return NextResponse.json({ error: "denied", message: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });
  }

  fails.delete(ip);
  const res = NextResponse.json({
    ok: true,
    name: who.name,
    role: who.role ?? null,
    firstLogin: who.firstLogin ?? false,
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(who.email, who.name, source), sessionCookieOptions(isHttps(req)));
  return res;
}
