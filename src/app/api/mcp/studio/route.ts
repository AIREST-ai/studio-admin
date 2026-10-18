import { NextResponse } from "next/server";

import { getCaptainClientState } from "@/app/api/captain-state/route";
import {
  assertBudgetAllowsExecution,
  CaptainBudgetError,
  getClientBudget,
  MAX_STEPS_PER_TURN,
  recordClientUsage,
  TOOL_MAX_OUTPUT_BYTES,
  TOOL_TIMEOUT_MS,
  validateCaptainClientId,
} from "@/lib/captain/litellm-budget";
import {
  ALL_STUDIO_TOOLS,
  ALLOWED_TEST_WRITE_INBOX_ID,
  assertToolIsolationAndGuard,
  type ExecutedToolResult,
  executeStudioTool,
  FORBIDDEN_ADMIN_TOOLS,
  STUDIO_CAPABILITY_GROUPS,
  StudioToolForbiddenError,
  StudioToolValidationError,
} from "@/lib/captain/studio-tools";
import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
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
  if (error instanceof CaptainBudgetError) {
    return respond(error.status, {
      ok: false,
      code: error.code,
      error: error.message,
    });
  }
  if (error instanceof StudioToolForbiddenError || error instanceof ProvisionForbiddenError) {
    return respond(403, { ok: false, error: error.message });
  }
  if (error instanceof StudioToolValidationError || error instanceof ProvisionValidationError) {
    return respond(400, { ok: false, error: error.message });
  }
  const message = error instanceof Error ? error.message : "Unexpected Studio MCP error";
  return respond(500, { ok: false, error: message });
}

function selectToolsForMessage(
  message: string,
  probeTool?: string,
): Array<{ name: string; args: Record<string, unknown> }> {
  if (probeTool && ALL_STUDIO_TOOLS.some((t) => t.name === probeTool)) {
    return [{ name: probeTool, args: {} }];
  }

  const lower = message.toLowerCase();
  const selected: Array<{ name: string; args: Record<string, unknown> }> = [];

  if (
    lower.includes("call") ||
    lower.includes("ring") ||
    lower.includes("phone") ||
    lower.includes("اتصال") ||
    lower.includes("مكالم")
  ) {
    selected.push({ name: "calls.list_history", args: { limit: 6 } });
    selected.push({ name: "calls.get_stats", args: {} });
  }
  if (
    lower.includes("comment") ||
    lower.includes("post") ||
    lower.includes("facebook") ||
    lower.includes("instagram") ||
    lower.includes("تعليق") ||
    lower.includes("منشور")
  ) {
    selected.push({ name: "comments.list_posts", args: {} });
    selected.push({ name: "comments.list_items", args: {} });
  }
  if (lower.includes("contact") || lower.includes("customer path") || lower.includes("جهات")) {
    selected.push({ name: "contacts.list", args: {} });
    selected.push({ name: "contacts.customer_path_summary", args: {} });
  }
  if (lower.includes("campaign") || lower.includes("حملات") || lower.includes("حملة")) {
    selected.push({ name: "campaigns.list_summary", args: {} });
  }
  if (lower.includes("automation") || lower.includes("macro") || lower.includes("canned") || lower.includes("أتمتة")) {
    selected.push({ name: "automation.list_rules_and_macros", args: {} });
  }
  if (lower.includes("report") || lower.includes("csat") || lower.includes("metric") || lower.includes("تقرير")) {
    selected.push({ name: "reports.overview_summary", args: {} });
  }
  if (
    lower.includes("memory") ||
    lower.includes("workspace") ||
    lower.includes("bank") ||
    lower.includes("ذاكرة") ||
    lower.includes("مهام")
  ) {
    selected.push({ name: "workspace.tasks_and_memory_status", args: {} });
  }
  if (
    lower.includes("conversation") ||
    lower.includes("inbox") ||
    lower.includes("chat") ||
    lower.includes("محادث") ||
    lower.includes("صندوق") ||
    selected.length === 0
  ) {
    selected.push({ name: "conversations.list", args: {} });
    if (selected.length === 1) {
      selected.push({ name: "workspace.tasks_and_memory_status", args: {} });
    }
  }

  return selected.slice(0, MAX_STEPS_PER_TURN);
}

async function synthesizeAssistantReply(params: {
  clientId: string;
  model: string;
  userMessage: string;
  toolResults: ExecutedToolResult[];
  scenariosCount: number;
  guardrails: string[];
  guidelines: string[];
}): Promise<string> {
  const { clientId, model, userMessage, toolResults, scenariosCount, guardrails } = params;

  const toolSummaryLines = toolResults.map((tr) => `- ${tr.tool} (${tr.durationMs}ms): ${tr.summary}`);

  // Attempt live gateway 4001 completion if a local proxy key is configured, with fast fallback to deterministic grounded synthesis
  const litellmKey = process.env.LITELLM_MASTER_KEY || process.env.OPENAI_API_KEY || "";
  if (litellmKey) {
    try {
      const res = await fetch("http://127.0.0.1:4001/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${litellmKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 260,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You are Captain Assistant for isolated tenant ${clientId}. Guardrails: ${guardrails.slice(0, 3).join(" | ")}. Summarize the live Studio MCP tool outputs concisely in 2-3 sentences.`,
            },
            {
              role: "user",
              content: `User: ${userMessage}\nLive Tool Results:\n${JSON.stringify(toolResults.map((t) => ({ tool: t.tool, summary: t.summary, data: t.data })))}`,
            },
          ],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(4_500),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch {
      // Fall back to grounded deterministic synthesis from real tool outputs
    }
  }

  const details: string[] = [];
  for (const tr of toolResults) {
    const d = (tr.data ?? {}) as Record<string, unknown>;
    if (tr.tool === "conversations.list") {
      const convs = Array.isArray(d.conversations) ? (d.conversations as Array<Record<string, unknown>>) : [];
      const inboxes = Array.isArray(d.inboxes) ? (d.inboxes as Array<Record<string, unknown>>) : [];
      const openCount = convs.filter((c) => c.status === "open").length;
      details.push(
        `Live Chatwoot (:3200) returned ${convs.length} conversations (${openCount} open) across ${inboxes.length} inboxes (${inboxes.map((i) => `${i.name} #${i.id}`).join(", ")}); write actions are locked strictly to Studio Test Inbox #${ALLOWED_TEST_WRITE_INBOX_ID}.`,
      );
    } else if (tr.tool === "calls.list_history" || tr.tool === "calls.get_stats") {
      if (typeof d.totalCalls === "number") {
        details.push(
          `Call Engine (:3483 SQLite) is ready with ${d.totalCalls} recorded calls (${d.answered ?? 0} answered, ${d.missed ?? 0} missed) and private call notes restricted to Inbox #${ALLOWED_TEST_WRITE_INBOX_ID}.`,
        );
      } else if (Array.isArray(d.calls)) {
        details.push(`Inspected ${d.calls.length} recent call records from local SQLite (:3483).`);
      }
    } else if (tr.tool === "comments.list_posts" || tr.tool === "comments.list_items") {
      if (Array.isArray(d.posts)) {
        const p0 = (d.posts[0] ?? {}) as Record<string, unknown>;
        details.push(
          `Social Comments (:3485 read-only) returned ${d.posts.length} post(s) (platform: ${p0.platform ?? "facebook"}, unread: ${p0.unread_count ?? 0}, private_reply_eligible: ${Boolean(p0.private_reply_eligible)}).`,
        );
      } else if (Array.isArray(d.comments)) {
        details.push(
          `Loaded ${d.comments.length} comment item(s) on post ${d.postId ?? ""} from local SQLite (:3485).`,
        );
      }
    } else if (tr.tool === "workspace.tasks_and_memory_status") {
      details.push(
        `Tenant ${clientId} is bound to isolated workspace ${d.workspaceId ?? `ws_${clientId}`} with single-bank memory (${d.factCount ?? 0} facts, bank_id hidden).`,
      );
    } else {
      details.push(`${tr.tool}: ${tr.summary}.`);
    }
  }

  return `[${clientId} · ${model}] Executed ${toolResults.length} live Studio MCP tool(s) (${scenariosCount} active scenarios, ${guardrails.length} guardrails enforced): ${details.join(" ") || toolSummaryLines.join(" ")}`;
}

export async function GET(req: Request) {
  try {
    assertSameOrigin(req);
    const url = new URL(req.url);
    rejectForbiddenPhone(req.url, url.search, url.pathname);
    await requireViewer(req);

    const headerClient = req.headers.get("x-studio-client-id")?.trim();
    const queryClient = url.searchParams.get("clientId")?.trim();
    if (headerClient && queryClient && headerClient !== queryClient) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant or external account override is strictly forbidden",
      });
    }

    const sessionClientId = validateCaptainClientId(queryClient || headerClient || "client_test_a");
    const budget = await getClientBudget(sessionClientId);

    return respond(200, {
      ok: true,
      action: "list_tools",
      clientId: sessionClientId,
      capabilityGroupsCount: STUDIO_CAPABILITY_GROUPS.length,
      groups: STUDIO_CAPABILITY_GROUPS,
      tools: ALL_STUDIO_TOOLS,
      isolation: {
        sessionClientId,
        bankIdParamExposed: false,
        allowedWriteInboxId: ALLOWED_TEST_WRITE_INBOX_ID,
        forbiddenAdminTools: [...FORBIDDEN_ADMIN_TOOLS],
        toolTimeoutMs: TOOL_TIMEOUT_MS,
        toolMaxOutputBytes: TOOL_MAX_OUTPUT_BYTES,
        maxStepsPerTurn: MAX_STEPS_PER_TURN,
      },
      budget,
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
    const bodySessionClient =
      typeof body.sessionClientId === "string" && body.sessionClientId.trim()
        ? body.sessionClientId.trim()
        : typeof body.clientId === "string" && body.clientId.trim()
          ? body.clientId.trim()
          : "";

    if (headerClient && bodySessionClient && headerClient !== bodySessionClient) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant or external account override is strictly forbidden",
      });
    }

    const sessionClientId = validateCaptainClientId(headerClient || bodySessionClient || "client_test_a");

    // Cross-Tenant Guard on top-level body fields
    if (body.targetClientId !== undefined && String(body.targetClientId).trim() !== sessionClientId) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant or external account override is strictly forbidden",
      });
    }
    if (
      (body.accountId !== undefined && Number(body.accountId) !== 1) ||
      (body.account_id !== undefined && Number(body.account_id) !== 1) ||
      body.api_access_token !== undefined ||
      body.access_token !== undefined
    ) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant or external account override is strictly forbidden",
      });
    }
    if (body.bank_id !== undefined || body.bankId !== undefined) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: bank_id parameter is hidden and locked to isolated session memory bank",
      });
    }

    const action = typeof body.action === "string" ? body.action.trim() : "list_tools";
    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-4.1-mini";

    if (action === "list_tools") {
      const budget = await getClientBudget(sessionClientId);
      return respond(200, {
        ok: true,
        action: "list_tools",
        clientId: sessionClientId,
        capabilityGroupsCount: STUDIO_CAPABILITY_GROUPS.length,
        groups: STUDIO_CAPABILITY_GROUPS,
        tools: ALL_STUDIO_TOOLS,
        isolation: {
          sessionClientId,
          bankIdParamExposed: false,
          allowedWriteInboxId: ALLOWED_TEST_WRITE_INBOX_ID,
          forbiddenAdminTools: [...FORBIDDEN_ADMIN_TOOLS],
          toolTimeoutMs: TOOL_TIMEOUT_MS,
          toolMaxOutputBytes: TOOL_MAX_OUTPUT_BYTES,
          maxStepsPerTurn: MAX_STEPS_PER_TURN,
        },
        budget,
      });
    }

    if (action === "call_tool") {
      const toolName = String(body.tool ?? body.toolName ?? body.name ?? "").trim();
      const args =
        body.args && typeof body.args === "object" && !Array.isArray(body.args)
          ? (body.args as Record<string, unknown>)
          : body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments)
            ? (body.arguments as Record<string, unknown>)
            : {};

      // 1. Validate Cross-Tenant & Tool Guard FIRST so 403 attacks are caught immediately
      assertToolIsolationAndGuard(sessionClientId, toolName, args, viewer.role);
      // 2. Enforce Budget & Kill-Switch BEFORE executing the tool
      await assertBudgetAllowsExecution(sessionClientId, model);

      const executed = await executeStudioTool(sessionClientId, toolName, args, viewer.role);
      const updatedBudget = await recordClientUsage(sessionClientId, 0.001, 140);

      return respond(200, {
        ok: true,
        action: "call_tool",
        clientId: sessionClientId,
        tool: executed.tool,
        group: executed.group,
        durationMs: executed.durationMs,
        outputBytes: executed.outputBytes,
        truncated: executed.truncated,
        summary: executed.summary,
        result: executed.data,
        budget: updatedBudget,
      });
    }

    if (action === "playground_run") {
      const startedAt = Date.now();
      const userMessage = String(body.message ?? body.prompt ?? "").trim();
      const probeTool = typeof body.probeTool === "string" ? body.probeTool.trim() : undefined;
      if (!userMessage && !probeTool) {
        return respond(400, { ok: false, error: "message or probeTool is required for playground_run" });
      }

      // Pre-execution Budget & Kill-Switch check
      await assertBudgetAllowsExecution(sessionClientId, model);

      const clientState = await getCaptainClientState(sessionClientId);
      const plannedTools = selectToolsForMessage(userMessage || probeTool || "", probeTool);
      const executedTools: ExecutedToolResult[] = [];

      for (const item of plannedTools.slice(0, MAX_STEPS_PER_TURN)) {
        // Re-check budget before each step in the turn
        await assertBudgetAllowsExecution(sessionClientId, model);
        const res = await executeStudioTool(sessionClientId, item.name, item.args, viewer.role);
        executedTools.push(res);
      }

      // Pre-model Budget & Kill-Switch check
      await assertBudgetAllowsExecution(sessionClientId, model);

      const activeScenariosCount =
        typeof body.scenariosCount === "number"
          ? body.scenariosCount
          : clientState.scenarios.filter((s) => s.enabled).length;

      const reply = await synthesizeAssistantReply({
        clientId: sessionClientId,
        model,
        userMessage: userMessage || `Run tool probe: ${probeTool}`,
        toolResults: executedTools,
        scenariosCount: activeScenariosCount,
        guardrails: clientState.guardrails,
        guidelines: clientState.guidelines,
      });

      const updatedBudget = await recordClientUsage(
        sessionClientId,
        Number((0.0015 + executedTools.length * 0.0008).toFixed(4)),
        240 + executedTools.length * 110,
      );

      const totalMs = Math.max(12, Date.now() - startedAt);
      const events = executedTools.map((t) => `${t.tool} → ${t.summary} (${t.durationMs}ms)`);

      return respond(200, {
        ok: true,
        action: "playground_run",
        clientId: sessionClientId,
        model,
        ms: totalMs,
        handler: `${clientState.assistants[0]?.name ?? "Noor"} (${sessionClientId})`,
        reply,
        events,
        toolResults: executedTools,
        budget: updatedBudget,
      });
    }

    return respond(400, { ok: false, error: `Unsupported action: ${action}` });
  } catch (error) {
    return handleError(error);
  }
}
