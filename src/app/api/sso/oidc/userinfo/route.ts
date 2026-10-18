import { NextResponse } from "next/server";

import { corsHeaders, resolveAccessToken } from "@/lib/lobehub/oidc-provider";
import { ProvisionForbiddenError, ProvisionValidationError } from "@/lib/lobehub/provision";

export const dynamic = "force-dynamic";

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: corsHeaders() });
}

function handleError(error: unknown) {
  if (error instanceof ProvisionForbiddenError) return fail(403, error.message);
  if (error instanceof ProvisionValidationError) return fail(400, error.message);
  const message = error instanceof Error ? error.message : "userinfo_error";
  return fail(500, message);
}

function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return "";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return fail(401, "missing_bearer_token");
    const claims = await resolveAccessToken(token);
    return NextResponse.json(claims, { headers: corsHeaders() });
  } catch (error) {
    return handleError(error);
  }
}
