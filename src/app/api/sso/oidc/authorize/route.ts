import { NextResponse } from "next/server";

import {
  corsHeaders,
  issueAuthorizationCode,
  issuerFromRequest,
  OIDC_CLIENT_ID,
  oidcEndpoints,
  resolveSsoClientFromHint,
} from "@/lib/lobehub/oidc-provider";
import { ProvisionForbiddenError, ProvisionValidationError } from "@/lib/lobehub/provision";

export const dynamic = "force-dynamic";

function fail(status: number, error: string) {
  return NextResponse.json({ error, error_description: error }, { status, headers: corsHeaders() });
}

function handleError(error: unknown) {
  if (error instanceof ProvisionForbiddenError) return fail(403, error.message);
  if (error instanceof ProvisionValidationError) return fail(400, error.message);
  const message = error instanceof Error ? error.message : "authorization_error";
  return fail(500, message);
}

async function handleAuthorize(req: Request) {
  const url = new URL(req.url);
  let params = url.searchParams;
  if (req.method === "POST") {
    const raw = await req.text();
    const body = new URLSearchParams(raw);
    params = body;
  }

  const oidcClientId = params.get("client_id") ?? "";
  const responseType = params.get("response_type") ?? "code";
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  const nonce = params.get("nonce") ?? "";
  const scope = params.get("scope") ?? "openid profile email";
  const loginHint = params.get("login_hint") ?? params.get("studio_client") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const codeChallengeMethod = params.get("code_challenge_method") ?? "";

  if (responseType !== "code") {
    return fail(400, "Only response_type=code is supported");
  }
  if (!oidcClientId) {
    return fail(400, "client_id is required");
  }

  const studioClientId = resolveSsoClientFromHint(loginHint);
  const issued = await issueAuthorizationCode({
    studioClientId,
    oidcClientId,
    redirectUri,
    nonce,
    scope,
    codeChallenge,
    codeChallengeMethod,
  });

  if (redirectUri) {
    const target = new URL(redirectUri);
    target.searchParams.set("code", issued.code);
    if (state) target.searchParams.set("state", state);
    return NextResponse.redirect(target, { status: 302, headers: corsHeaders() });
  }

  const endpoints = oidcEndpoints(issuerFromRequest(req));
  return NextResponse.json(
    {
      code: issued.code,
      expires_in: issued.expiresIn,
      client_id: OIDC_CLIENT_ID,
      studio_client: studioClientId,
      token_endpoint: endpoints.token_endpoint,
    },
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    return await handleAuthorize(req);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    return await handleAuthorize(req);
  } catch (error) {
    return handleError(error);
  }
}
