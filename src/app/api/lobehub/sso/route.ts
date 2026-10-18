import { NextResponse } from "next/server";

import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import {
  assertSameOrigin,
  buildSsoHandoff,
  createLiveAuthSession,
  getClientWorkspaceStatus,
  ProvisionForbiddenError,
  ProvisionValidationError,
  provisionClientWorkspace,
  rejectForbiddenPhone,
  requireViewer,
  validateClientId,
} from "@/lib/lobehub/provision";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

function respond(status: number, body: unknown) {
  return NextResponse.json(scrubSecrets(body), { status, headers: HEADERS });
}

function handleError(error: unknown) {
  if (error instanceof ProvisionForbiddenError) {
    return respond(403, { ok: false, error: error.message });
  }
  if (error instanceof ProvisionValidationError) {
    return respond(400, { ok: false, error: error.message });
  }
  const message = error instanceof Error ? error.message : "Unexpected SSO error";
  return respond(500, { ok: false, error: message });
}

async function activateIsolatedSso(req: Request, rawClientId: unknown) {
  assertSameOrigin(req);
  const viewer = await requireViewer(req);
  if (viewer.role !== "administrator") {
    return respond(403, {
      ok: false,
      error: "Administrator role required to activate an isolated SSO session",
    });
  }

  const clientId = validateClientId(rawClientId ?? "client_test_a");
  if (clientId !== "client_test_a" && clientId !== "client_test_b") {
    throw new ProvisionForbiddenError(
      "Refused: live SSO session is limited to isolated test accounts client_test_a and client_test_b (403)",
    );
  }

  let status = await getClientWorkspaceStatus(clientId);
  if (!status.provisioned) {
    status = await provisionClientWorkspace({ clientId });
  }
  const session = await createLiveAuthSession(clientId);
  const sso = await buildSsoHandoff(clientId, status.email);
  return respond(200, {
    ok: true,
    action: "sso_activate",
    authenticated: true,
    clientId,
    workspaceId: status.workspaceId,
    userId: status.userId,
    session,
    sso,
    status,
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    rejectForbiddenPhone(req.url, url.search, url.pathname);
    return await activateIsolatedSso(req, url.searchParams.get("clientId") ?? "client_test_a");
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const bodyText = await req.text();
    rejectForbiddenPhone(`${req.url}\n${bodyText}`, url.search, url.pathname);
    let body: Record<string, unknown> = {};
    if (bodyText.trim()) {
      const parsed = JSON.parse(bodyText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return respond(400, { ok: false, error: "Request body must be a JSON object" });
      }
      body = parsed as Record<string, unknown>;
    }
    rejectForbiddenPhone(body, url.search, url.pathname);
    return await activateIsolatedSso(req, body.clientId ?? url.searchParams.get("clientId") ?? "client_test_a");
  } catch (error) {
    return handleError(error);
  }
}
