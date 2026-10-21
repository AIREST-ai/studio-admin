// مسار الخروج (2026-10-19، حارس الدخول): يمسح كعكة الجلسة.
import { type NextRequest, NextResponse } from "next/server";

import { isHttps, SESSION_COOKIE, sessionCookieOptions } from "@/lib/جلسة-الدخول";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(isHttps(req), 0));
  return res;
}
