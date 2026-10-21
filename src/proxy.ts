// حارس الدخول (2026-10-19، تثبيت app.airest.ai بأمر فهد). كان src/proxy.disabled.ts قالباً معطّلاً، فكانت كل صفحة
// وكل /api تفتح بلا جلسة (ومنها /api/cw/conversations بمحادثات حقيقية).
// - بلا جلسة صحيحة: مسارات /api ترد 401، والصفحات تُحوَّل إلى صفحة الدخول ومعها المسار المطلوب في next.
// - المستثنى: صفحات الدخول والتسجيل، ومسارا الدخول والخروج، وأصول Next، ونقاط تناديها خوادم أخرى بتحقق خاص بها.
// الجلسة نفسها في lib/جلسة-الدخول.ts.
import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/جلسة-الدخول";

const LOGIN_PATH = "/auth/v2/login";

/** بادئات تفتح بلا جلسة. */
const PUBLIC_PREFIXES = ["/auth/", "/api/studio-auth/"];

/** مسارات تامة تفتح بلا جلسة: أيقونات الموقع، ونقاط آلة لآلة لها تحقق خاص بها. */
const PUBLIC_EXACT = new Set<string>([
  "/favicon.ico",
  "/robots.txt",
  "/opengraph-image.png",
  "/twitter-image.png",
  // ويب هوك شات ووت: يتحقق بتوقيع HMAC في x-chatwoot-signature (api/cw/webhook/route.ts).
  "/api/cw/webhook",
  // قراءة سجل التدقيق لأدوات العملاء: ترويسة Bearer إلزامية (api/audit-log/read/route.ts).
  "/api/audit-log/read",
  // موفر هوية OIDC: يناديها خادم لوب هب ولها تحققها (client_secret أو Bearer) أو هي عامة بطبيعتها.
  // أما authorize فيبقى تحت الحارس لأنه يُفتح في المتصفح.
  "/api/sso/oidc/token",
  "/api/sso/oidc/jwks",
  "/api/sso/oidc/userinfo",
  "/api/sso/oidc/.well-known/openid-configuration",
  "/.well-known/openid-configuration",
]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  if (verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/") || pathname === "/api") {
    return NextResponse.json({ error: "unauthorized", message: "سجّل الدخول أولاً" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

// كل المسارات إلا أصول Next المبنية (ملفات ثابتة لا بيانات فيها). وNext يمرر _next/data للحارس دائماً.
export const config = {
  matcher: ["/((?!_next/static/|_next/image).*)"],
};
