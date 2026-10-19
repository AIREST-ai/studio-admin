// V-37: Serves Meta public identifiers (APP_ID, CONFIGURATION_ID, API version) to the browser.
// Secrets (APP_SECRET) are NEVER served — they stay in the server environment.
// The endpoint requires linked mode; in preview mode it returns available: false.
import { type NextRequest, NextResponse } from "next/server";

import { readLinkState } from "@/lib/chatwoot/mode";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

function isAgentViewer(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  if (/(?:^|;\s*)(?:studio_view_as|cw_view_as|vw_as)\s*=\s*(?:2|agent)\b/i.test(cookieHeader)) {
    return true;
  }
  const studioCookie = req.cookies.get("studio_view_as")?.value?.trim().toLowerCase();
  const cwCookie = req.cookies.get("cw_view_as")?.value?.trim().toLowerCase();
  const vwCookie = req.cookies.get("vw_as")?.value?.trim().toLowerCase();
  return (
    studioCookie === "2" ||
    studioCookie === "agent" ||
    cwCookie === "2" ||
    cwCookie === "agent" ||
    vwCookie === "2" ||
    vwCookie === "agent"
  );
}

function isHttpsRequest(req: NextRequest): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto === "https") return true;
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const state = await readLinkState();
  const linked = state.mode === "linked" && !state.disabled;

  // Read public identifiers from environment (server-side only — never exposed to client).
  const fbAppId = process.env.FB_APP_ID?.trim() || process.env.NEXT_PUBLIC_FB_APP_ID?.trim() || "";
  const whatsappAppId = process.env.WHATSAPP_APP_ID?.trim() || process.env.NEXT_PUBLIC_WHATSAPP_APP_ID?.trim() || "";
  const whatsappConfigId =
    process.env.WHATSAPP_CONFIGURATION_ID?.trim() || process.env.NEXT_PUBLIC_WHATSAPP_CONFIGURATION_ID?.trim() || "";
  const instagramAppId = process.env.INSTAGRAM_APP_ID?.trim() || process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID?.trim() || "";
  const fbApiVersion = process.env.FACEBOOK_API_VERSION?.trim() || "v22.0";

  const httpsReady = isHttpsRequest(req);
  const adminRoleReady = linked && !isAgentViewer(req);

  return NextResponse.json(
    {
      available: linked,
      mode: state.mode,
      facebook: {
        appId: fbAppId || null,
        version: fbApiVersion,
        configured: Boolean(fbAppId),
      },
      whatsapp: {
        appId: whatsappAppId || fbAppId || null, // WhatsApp often uses same FB app
        configurationId: whatsappConfigId || null,
        version: fbApiVersion,
        configured: Boolean(whatsappAppId || fbAppId) && Boolean(whatsappConfigId),
      },
      instagram: {
        appId: instagramAppId || fbAppId || null, // Instagram uses FB app
        version: fbApiVersion,
        configured: Boolean(instagramAppId || fbAppId),
      },
      // Readiness indicators requested by V-25/V-37
      readiness: {
        https: httpsReady,
        adminRole: adminRoleReady,
        metaAppConfigured: Boolean(fbAppId),
      },
    },
    { status: 200, headers },
  );
}
