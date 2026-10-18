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
  verifyCrossTenantIsolation,
} from "@/lib/lobehub/provision";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 64_000;

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
  const message = error instanceof Error ? error.message : "Unexpected provisioning error";
  return respond(500, { ok: false, error: message });
}

export async function GET(req: Request) {
  try {
    assertSameOrigin(req);
    const url = new URL(req.url);
    rejectForbiddenPhone(req.url, url.search, url.pathname);

    const viewer = await requireViewer(req);
    if (viewer.role !== "administrator") {
      return respond(403, {
        ok: false,
        error: "Administrator role required to provision or manage isolated AI workspaces",
      });
    }

    const rawClientId = url.searchParams.get("clientId") ?? "client_test_a";
    const clientId = validateClientId(rawClientId);
    const action = url.searchParams.get("action") ?? "status";

    if (action === "sso_redirect") {
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
        action: "sso_redirect",
        authenticated: true,
        clientId,
        workspaceId: status.workspaceId,
        userId: status.userId,
        session,
        sso,
        status,
      });
    }

    const [clientAStatus, clientBStatus] = await Promise.all([
      getClientWorkspaceStatus("client_test_a"),
      getClientWorkspaceStatus("client_test_b"),
    ]);

    const activeClient =
      clientId === "client_test_a"
        ? clientAStatus
        : clientId === "client_test_b"
          ? clientBStatus
          : await getClientWorkspaceStatus(clientId);

    return respond(200, {
      ok: true,
      activeClient,
      clients: {
        client_test_a: clientAStatus,
        client_test_b: clientBStatus,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const url = new URL(req.url);
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_BYTES) {
      return respond(413, { ok: false, error: "Request body too large" });
    }

    rejectForbiddenPhone(`${req.url}\n${bodyText}`, url.search, url.pathname);

    const viewer = await requireViewer(req);
    if (viewer.role !== "administrator") {
      return respond(403, {
        ok: false,
        error: "Administrator role required to provision or manage isolated AI workspaces",
      });
    }

    let body: Record<string, unknown> = {};
    if (bodyText.trim()) {
      try {
        const parsed = JSON.parse(bodyText) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return respond(400, { ok: false, error: "Request body must be a JSON object" });
        }
        body = parsed as Record<string, unknown>;
      } catch {
        return respond(400, { ok: false, error: "Request body is not valid JSON" });
      }
    }

    rejectForbiddenPhone(body, url.search, url.pathname);

    if (body.clientId !== undefined) {
      validateClientId(body.clientId);
    }

    const action = typeof body.action === "string" ? body.action.trim() : "provision";

    if (action === "sso_activate" || action === "sso_redirect") {
      const clientId = validateClientId(body.clientId ?? "client_test_a");
      if (clientId !== "client_test_a" && clientId !== "client_test_b") {
        throw new ProvisionForbiddenError(
          "Refused: live SSO session is limited to isolated test accounts client_test_a and client_test_b (403)",
        );
      }
      let activeClient = await getClientWorkspaceStatus(clientId);
      if (!activeClient.provisioned) {
        activeClient = await provisionClientWorkspace({
          clientId,
          displayName: typeof body.displayName === "string" ? body.displayName : undefined,
          email: typeof body.email === "string" ? body.email : undefined,
        });
      }
      const session = await createLiveAuthSession(clientId);
      const sso = await buildSsoHandoff(clientId, activeClient.email);
      return respond(200, {
        ok: true,
        action: "sso_activate",
        authenticated: true,
        clientId,
        workspaceId: activeClient.workspaceId,
        userId: activeClient.userId,
        session,
        sso,
        status: activeClient,
        activeClient,
      });
    }

    if (action === "verify_isolation") {
      const isolation = await verifyCrossTenantIsolation();
      const [clientAStatus, clientBStatus] = await Promise.all([
        getClientWorkspaceStatus("client_test_a"),
        getClientWorkspaceStatus("client_test_b"),
      ]);
      return respond(200, {
        ok: isolation.ok,
        action: "verify_isolation",
        isolation,
        clients: {
          client_test_a: clientAStatus,
          client_test_b: clientBStatus,
        },
      });
    }

    if (action === "provision") {
      const clientId = validateClientId(body.clientId ?? "client_test_a");
      const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
      const email = typeof body.email === "string" ? body.email : undefined;

      const activeClient = await provisionClientWorkspace({
        clientId,
        displayName,
        email,
      });

      const [clientAStatus, clientBStatus] = await Promise.all([
        clientId === "client_test_a" ? Promise.resolve(activeClient) : getClientWorkspaceStatus("client_test_a"),
        clientId === "client_test_b" ? Promise.resolve(activeClient) : getClientWorkspaceStatus("client_test_b"),
      ]);

      return respond(200, {
        ok: true,
        action: "provision",
        activeClient,
        clients: {
          client_test_a: clientAStatus,
          client_test_b: clientBStatus,
        },
      });
    }

    return respond(400, { ok: false, error: `Unsupported action: ${action}` });
  } catch (error) {
    return handleError(error);
  }
}
