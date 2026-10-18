import { NextResponse } from "next/server";

import {
  corsHeaders,
  exchangeAuthorizationCode,
  issuerFromRequest,
  parseClientCredentials,
} from "@/lib/lobehub/oidc-provider";
import { ProvisionForbiddenError, ProvisionValidationError } from "@/lib/lobehub/provision";

export const dynamic = "force-dynamic";

function fail(status: number, error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status, headers: corsHeaders() });
}

function handleError(error: unknown) {
  if (error instanceof ProvisionForbiddenError) return fail(403, "access_denied", error.message);
  if (error instanceof ProvisionValidationError) return fail(400, "invalid_request", error.message);
  const message = error instanceof Error ? error.message : "server_error";
  return fail(500, "server_error", message);
}

async function parseBody(req: Request): Promise<Record<string, string>> {
  const raw = await req.text();
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") && raw.trim()) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  }
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  try {
    const body = await parseBody(req);
    if ((body.grant_type || "authorization_code") !== "authorization_code") {
      return fail(400, "unsupported_grant_type", "Only authorization_code is supported");
    }
    if (!body.code) {
      return fail(400, "invalid_request", "code is required");
    }
    const creds = parseClientCredentials(req, body);
    const tokens = await exchangeAuthorizationCode({
      code: body.code,
      oidcClientId: creds.id,
      oidcClientSecret: creds.secret,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
      issuer: issuerFromRequest(req),
    });
    return NextResponse.json(tokens, { headers: corsHeaders() });
  } catch (error) {
    return handleError(error);
  }
}
