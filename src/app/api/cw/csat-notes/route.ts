import { NextResponse } from "next/server";

import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import {
  assertEvalSameOrigin,
  getClientEvalStateAndSummary,
  runConversationEvaluation,
  saveCsatReviewNote,
  validateEvalClientId,
} from "@/lib/lobehub/eval-bridge";
import {
  assertSameOrigin,
  ProvisionForbiddenError,
  ProvisionValidationError,
  rejectForbiddenPhone,
  requireViewer,
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
  const message = error instanceof Error ? error.message : "Unexpected csat-notes error";
  return respond(500, { ok: false, error: message });
}

export async function GET(req: Request) {
  try {
    assertSameOrigin(req);
    assertEvalSameOrigin(req);

    const url = new URL(req.url);
    rejectForbiddenPhone(req.url, url.search, url.pathname);

    await requireViewer(req);

    const headerClient = req.headers.get("x-studio-client-id")?.trim();
    const queryClient = url.searchParams.get("clientId")?.trim();
    if (headerClient && queryClient && headerClient !== queryClient) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant clientId mismatch between header and query",
      });
    }

    const clientId = validateEvalClientId(queryClient || headerClient || "client_test_a");
    const data = await getClientEvalStateAndSummary(clientId);

    return respond(200, {
      ok: true,
      clientId: data.clientId,
      userId: data.userId,
      workspaceId: data.workspaceId,
      rubricId: data.rubricId,
      notesByConversation: data.notesByConversation,
      evaluationsByConversation: data.evaluationsByConversation,
      summary: data.summary,
    });
  } catch (error) {
    return handleError(error);
  }
}

async function handleWrite(req: Request) {
  try {
    assertSameOrigin(req);
    assertEvalSameOrigin(req);

    const url = new URL(req.url);
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_BYTES) {
      return respond(413, { ok: false, error: "Request body too large" });
    }

    rejectForbiddenPhone(`${req.url}\n${bodyText}`, url.search, url.pathname);

    const viewer = await requireViewer(req);

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

    const headerClient = req.headers.get("x-studio-client-id")?.trim();
    const queryClient = url.searchParams.get("clientId")?.trim();
    const bodyClient = typeof body.clientId === "string" ? body.clientId.trim() : "";

    if (
      (headerClient && bodyClient && headerClient !== bodyClient) ||
      (headerClient && queryClient && headerClient !== queryClient) ||
      (body.targetClientId !== undefined &&
        String(body.targetClientId).trim() !== (bodyClient || queryClient || headerClient || "client_test_a")) ||
      (body.accountId !== undefined && Number(body.accountId) !== 1)
    ) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant or external account override is strictly forbidden",
      });
    }

    const clientId = validateEvalClientId(bodyClient || queryClient || headerClient || "client_test_a");
    const rawAction = typeof body.action === "string" ? body.action.trim() : "";
    const action = rawAction || (body.text !== undefined || body.note !== undefined ? "save_note" : "run_judge");

    if (action === "save_note") {
      const conversationId = Number(body.conversationId ?? body.id);
      const text = typeof body.text === "string" ? body.text : typeof body.note === "string" ? body.note : "";
      const by =
        typeof body.by === "string" && body.by.trim()
          ? body.by.trim()
          : viewer.role === "administrator"
            ? "Arham Khan"
            : `Agent #${viewer.id}`;
      const rating = typeof body.rating === "number" ? body.rating : undefined;

      const savedNote = await saveCsatReviewNote({
        clientId,
        conversationId,
        text,
        by,
        rating,
      });

      const updatedState = await getClientEvalStateAndSummary(clientId);

      return respond(200, {
        ok: true,
        action: "save_note",
        clientId,
        conversationId: savedNote.conversationId,
        note: savedNote,
        notesByConversation: updatedState.notesByConversation,
        evaluationsByConversation: updatedState.evaluationsByConversation,
        summary: updatedState.summary,
      });
    }

    if (action === "run_judge") {
      const conversationId = Number(body.conversationId ?? body.id);
      const rating = typeof body.rating === "number" ? body.rating : undefined;
      const feedback = typeof body.feedback === "string" ? body.feedback : undefined;
      const contact = typeof body.contact === "string" ? body.contact : undefined;
      const subject = typeof body.subject === "string" ? body.subject : undefined;
      const messagesText = typeof body.messagesText === "string" ? body.messagesText : undefined;
      const bypassDedup = body.force === true || body.bypassDedup === true;

      const evaluation = await runConversationEvaluation({
        clientId,
        conversationId,
        rating,
        feedback,
        contact,
        subject,
        messagesText,
        triggerSource: "manual_ui",
        bypassDedup,
      });

      const updatedState = await getClientEvalStateAndSummary(clientId);

      return respond(200, {
        ok: true,
        action: "run_judge",
        clientId,
        conversationId: evaluation.conversationId,
        evaluation,
        notesByConversation: updatedState.notesByConversation,
        evaluationsByConversation: updatedState.evaluationsByConversation,
        summary: updatedState.summary,
      });
    }

    return respond(400, { ok: false, error: `Unsupported action: ${action}` });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  return handleWrite(req);
}

export async function PUT(req: Request) {
  return handleWrite(req);
}
