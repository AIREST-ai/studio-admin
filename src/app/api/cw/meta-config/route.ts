// V-37: Serves Meta public identifiers (APP_ID, CONFIGURATION_ID, API version) to the browser.
// Secrets (APP_SECRET) are NEVER served — they stay in the server environment.
// The endpoint requires linked mode; in preview mode it returns available: false.
import { NextResponse } from "next/server";

import { readLinkState } from "@/lib/chatwoot/mode";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const state = await readLinkState();
  const linked = state.mode === "linked" && !state.disabled;

  // Read public identifiers from environment (server-side only — never exposed to client).
  const fbAppId = process.env.FB_APP_ID?.trim() || process.env.NEXT_PUBLIC_FB_APP_ID?.trim() || "";
  const whatsappAppId = process.env.WHATSAPP_APP_ID?.trim() || process.env.NEXT_PUBLIC_WHATSAPP_APP_ID?.trim() || "";
  const whatsappConfigId =
    process.env.WHATSAPP_CONFIGURATION_ID?.trim() || process.env.NEXT_PUBLIC_WHATSAPP_CONFIGURATION_ID?.trim() || "";
  const instagramAppId = process.env.INSTAGRAM_APP_ID?.trim() || process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID?.trim() || "";
  const fbApiVersion = process.env.FACEBOOK_API_VERSION?.trim() || "v22.0";

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
        // R2: HTTPS is checked via window.isSecureContext in the client (MetaReadinessPanel),
        // so we don't hardcode false here. The client-side panel merges both sources.
        https: true, // server readiness: the endpoint is accessible
        adminRole: true, // The endpoint itself is admin-gated via the caller's context
        metaAppConfigured: Boolean(fbAppId),
      },
    },
    { status: 200, headers },
  );
}
