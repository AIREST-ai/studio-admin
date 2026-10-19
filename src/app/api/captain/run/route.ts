import { NextResponse } from "next/server";

import {
  guardrails as seedGuardrails,
  guidelines as seedGuidelines,
} from "@/app/(main)/dashboard/captain/_components/data";
import {
  assertBudgetAllowsExecution,
  CaptainBudgetError,
  getClientLiteLLMVirtualKey,
  LITELLM_BASE_URL,
  recordClientUsage,
  SECRETS_DIR,
  STUDIO_DATA_DIR,
  validateCaptainClientId,
} from "@/lib/captain/litellm-budget";
import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import {
  assertSameOrigin,
  ProvisionForbiddenError,
  ProvisionValidationError,
  rejectForbiddenPhone,
  requireViewer,
} from "@/lib/lobehub/provision";

import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 64_000;
const CAPTAIN_STATE_FILE = path.join(STUDIO_DATA_DIR, "captain-state.json");
const HINDSIGHT_BASE_URL = "http://127.0.0.1:8888";
const ALLOWED_TEST_INBOX_ID = 3;
const FROZEN_LIVE_INBOXES = new Set([9, 10, "9", "10"]);

function respond(status: number, body: unknown) {
  return NextResponse.json(scrubSecrets(body), { status, headers: HEADERS });
}

function handleError(error: unknown) {
  if (error instanceof CaptainBudgetError) {
    return respond(error.status, { ok: false, code: error.code, error: error.message });
  }
  if (error instanceof ProvisionForbiddenError) {
    return respond(403, { ok: false, error: error.message });
  }
  if (error instanceof ProvisionValidationError) {
    return respond(400, { ok: false, error: error.message });
  }
  const message = error instanceof Error ? error.message : "Unexpected Captain assistant error";
  return respond(500, { ok: false, error: message });
}

async function readFallbackMasterKey(): Promise<string | null> {
  const candidates = ["/etc/airest-secrets/litellm_master_key", path.join(SECRETS_DIR, "litellm_master_key")];
  for (const candidate of candidates) {
    try {
      const raw = (await readFile(candidate, "utf8")).trim();
      if (raw.length >= 16) return raw;
    } catch {
      // continue
    }
  }
  return null;
}

async function verifyConversationInTestInbox(conversationId: number): Promise<void> {
  if (conversationId === 9 || conversationId === 10) {
    throw new ProvisionForbiddenError(
      "Refused: live customer conversations in inboxes 9 and 10 are strictly frozen (403)",
    );
  }
  try {
    const token = (await readFile("/Users/ali/lobehub-hub/chatwoot-copy/live-3200-token.txt", "utf8")).trim();
    if (!token) return;
    const res = await fetch(`http://127.0.0.1:3200/api/v1/accounts/1/conversations/${conversationId}`, {
      headers: { api_access_token: token },
      cache: "no-store",
      signal: AbortSignal.timeout(3_500),
    });
    if (!res.ok) return;
    const conv = (await res.json()) as {
      inbox_id?: number;
      meta?: { sender?: { phone_number?: string; identifier?: string } };
    };
    const serialized = JSON.stringify(conv);
    if (serialized.includes("6888")) {
      throw new ProvisionForbiddenError(
        "Refused: conversation associated with blocked 6888 number is strictly prohibited (403)",
      );
    }
    if (typeof conv.inbox_id === "number" && conv.inbox_id !== ALLOWED_TEST_INBOX_ID) {
      throw new ProvisionForbiddenError(
        `Refused: conversation ${conversationId} belongs to inbox_id=${conv.inbox_id}; only test inbox_id=3 (Studio Test) is permitted (403)`,
      );
    }
  } catch (err) {
    if (err instanceof ProvisionForbiddenError) throw err;
  }
}

async function loadIsolatedCaptainContext(clientId: string): Promise<{
  guardrails: string[];
  guidelines: string[];
  memoryFacts: string[];
}> {
  const validClientId = validateCaptainClientId(clientId);
  let guardrails: string[] = [...seedGuardrails];
  let guidelines: string[] = [...seedGuidelines];

  try {
    const raw = await readFile(CAPTAIN_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, { guardrails?: string[]; guidelines?: string[] }>;
    const clientState = parsed?.[validClientId];
    if (clientState) {
      if (Array.isArray(clientState.guardrails) && clientState.guardrails.length > 0) {
        guardrails = clientState.guardrails.slice(0, 8);
      }
      if (Array.isArray(clientState.guidelines) && clientState.guidelines.length > 0) {
        guidelines = clientState.guidelines.slice(0, 8);
      }
    }
  } catch {
    // use default seed guardrails & guidelines
  }

  const memoryFacts: string[] = [];
  if (validClientId.startsWith("client_")) {
    try {
      const memRes = await fetch(
        `${HINDSIGHT_BASE_URL}/v1/default/banks/${encodeURIComponent(validClientId)}/memories/list?limit=5`,
        { method: "GET", cache: "no-store", signal: AbortSignal.timeout(3_000) },
      );
      if (memRes.ok) {
        const memData = (await memRes.json()) as {
          items?: Array<{ text?: string; content?: string }>;
        };
        for (const item of memData.items ?? []) {
          const txt = (item.text ?? item.content ?? "").trim();
          if (txt && !txt.includes("6888")) {
            memoryFacts.push(txt);
          }
        }
      }
    } catch {
      // memory bank optional fallback
    }
  }

  return { guardrails, guidelines, memoryFacts };
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
    await requireViewer(req);

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

    const rawInboxId = body.inboxId ?? body.inbox_id ?? ALLOWED_TEST_INBOX_ID;
    if (
      FROZEN_LIVE_INBOXES.has(rawInboxId as number | string) ||
      String(rawInboxId).toLowerCase().includes("facebook") ||
      String(rawInboxId).toLowerCase().includes("instagram") ||
      String(rawInboxId).toLowerCase().includes("messenger")
    ) {
      throw new ProvisionForbiddenError(
        "Refused: live customer inboxes 9 and 10 (Messenger/Instagram) are strictly frozen and forbidden (403)",
      );
    }

    const numericInboxId = typeof rawInboxId === "number" ? rawInboxId : Number(rawInboxId);
    if (Number.isFinite(numericInboxId) && numericInboxId !== ALLOWED_TEST_INBOX_ID) {
      throw new ProvisionForbiddenError(
        `Refused: inbox_id=${numericInboxId} is outside the isolated test inbox (inbox_id=3 Studio Test) (403)`,
      );
    }

    const rawConversationId = body.conversationId ?? body.conversation_id ?? 2;
    const conversationId = typeof rawConversationId === "number" ? rawConversationId : Number(rawConversationId) || 2;
    await verifyConversationInTestInbox(conversationId);

    const clientId = validateCaptainClientId(body.clientId ?? "client_test_a");
    const requestedModel = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-4.1-mini";

    // Enforce budget & Kill-Switch BEFORE calling AI Gateway 4001
    await assertBudgetAllowsExecution(clientId, requestedModel);

    const { guardrails, guidelines, memoryFacts } = await loadIsolatedCaptainContext(clientId);

    const mode = typeof body.mode === "string" ? body.mode.trim() : "reply_suggestion";
    const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "Customer";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "Support Inquiry";
    const draftText = typeof body.draftText === "string" ? body.draftText.trim() : "";

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const formattedThread = rawMessages
      .slice(-6)
      .map((m) => {
        if (!m || typeof m !== "object") return "";
        const rec = m as { kind?: string; text?: string; role?: string; content?: string };
        const speaker = rec.kind === "incoming" || rec.role === "user" ? contactName : "Agent";
        const content = (rec.text ?? rec.content ?? "").trim();
        return content ? `${speaker}: ${content}` : "";
      })
      .filter(Boolean)
      .join("\n");

    const systemPrompt = [
      `You are Captain, the isolated AI reply assistant for customer workspace ${clientId}.`,
      "Your task is to generate a concise, ready-to-review draft reply (or note) for the human support agent.",
      "IMPORTANT: Never claim an action was already taken unless stated in the thread. Output ONLY the suggested message text without surrounding quotes.",
      `Guardrails:\n- ${guardrails.join("\n- ")}`,
      `Response Guidelines:\n- ${guidelines.join("\n- ")}`,
      memoryFacts.length > 0 ? `Isolated Memory Bank (${clientId}) Facts:\n- ${memoryFacts.join("\n- ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const userPrompt = [
      `Conversation #${conversationId} (Test Inbox #${ALLOWED_TEST_INBOX_ID} - Studio Test)`,
      `Customer: ${contactName} | Subject: ${subject} | Action Mode: ${mode}`,
      formattedThread ? `Recent Messages:\n${formattedThread}` : "",
      draftText ? `Current Agent Draft:\n${draftText}` : "",
      mode === "summarize"
        ? "Write a brief 2-3 bullet private summary note of this conversation for the support team."
        : draftText
          ? `Transform or improve the agent's current draft according to mode "${mode}".`
          : "Draft a helpful, polite reply to the customer's latest message.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const apiKey = (await getClientLiteLLMVirtualKey(clientId)) ?? (await readFallbackMasterKey());
    if (!apiKey) {
      return respond(500, { ok: false, error: "LiteLLM virtual key unavailable in vault" });
    }

    const gatewayRes = await fetch(`${LITELLM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: requestedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 240,
        temperature: 0.3,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!gatewayRes.ok) {
      const errBody = await gatewayRes.text().catch(() => "");
      return respond(gatewayRes.status === 401 || gatewayRes.status === 429 ? 429 : 502, {
        ok: false,
        error: `AI Gateway rejected execution (HTTP ${gatewayRes.status})`,
        detail: errBody.slice(0, 240),
      });
    }

    const completion = (await gatewayRes.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const suggestion = (completion.choices?.[0]?.message?.content ?? "").trim();
    if (!suggestion) {
      return respond(502, { ok: false, error: "AI Gateway returned an empty suggestion" });
    }

    const promptTokens = completion.usage?.prompt_tokens ?? 120;
    const completionTokens = completion.usage?.completion_tokens ?? 45;
    const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens;
    const costUsd = Number((totalTokens * 0.000002).toFixed(6));

    const updatedBudget = await recordClientUsage(clientId, costUsd, totalTokens);

    return respond(200, {
      ok: true,
      clientId,
      inboxId: ALLOWED_TEST_INBOX_ID,
      conversationId,
      draftOnly: true,
      autoSent: false,
      mode,
      model: completion.model ?? requestedModel,
      suggestion,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
      },
      contextUsed: {
        guardrailsCount: guardrails.length,
        guidelinesCount: guidelines.length,
        memoryFactsCount: memoryFacts.length,
      },
      budget: updatedBudget,
    });
  } catch (error) {
    return handleError(error);
  }
}
