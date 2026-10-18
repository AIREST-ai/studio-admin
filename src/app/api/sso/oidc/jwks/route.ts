import { NextResponse } from "next/server";

import { corsHeaders, getJwks } from "@/lib/lobehub/oidc-provider";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  const jwks = await getJwks();
  return NextResponse.json(jwks, { headers: corsHeaders() });
}
