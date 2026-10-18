import { NextResponse } from "next/server";

import { buildDiscoveryDocument, corsHeaders, issuerFromRequest } from "@/lib/lobehub/oidc-provider";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  const document = buildDiscoveryDocument(issuerFromRequest(req));
  return NextResponse.json(document, { headers: corsHeaders() });
}
