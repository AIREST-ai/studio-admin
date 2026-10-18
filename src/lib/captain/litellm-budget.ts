import { rejectForbiddenPhone } from "@/lib/lobehub/provision";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const STUDIO_DATA_DIR = "/Users/ali/server-work/ai-home/vendor/studio-admin/.studio-data";
export const BUDGETS_FILE_PATH = path.join(STUDIO_DATA_DIR, "captain-budgets.json");

export const ALLOWED_CAPTAIN_CLIENTS = new Set(["client_test_a", "client_test_b", "default_studio"]);
const FORBIDDEN_TEAM_IDS = ["fahad", "user_0ig", "user_0igqijtu4mcdijum5zvdysw6kvk", "admin", "root"];

export const DEFAULT_ALLOWED_MODELS = ["gpt-4.1-mini", "gpt-5.4-mini", "gpt-4.1"] as const;
export const MAX_STEPS_PER_TURN = 5;
export const TOOL_TIMEOUT_MS = 10_000;
export const TOOL_MAX_OUTPUT_BYTES = 16_384;

export interface ClientBudgetRecord {
  clientId: string;
  virtualKeyId: string;
  gatewayPort: 4001;
  gatewayHealthy: boolean;
  maxBudgetUsd: number;
  spentUsd: number;
  rpmLimit: number;
  tpmLimit: number;
  maxStepsPerTurn: number;
  allowedModels: string[];
  blocked: boolean;
  tokensUsedTotal: number;
  invocationsCount: number;
  toolTimeoutMs: number;
  toolMaxOutputBytes: number;
  updatedAt: string;
}

export interface ClientBudgetPatch {
  maxBudgetUsd?: number;
  rpmLimit?: number;
  tpmLimit?: number;
  blocked?: boolean;
  allowedModels?: string[];
  resetSpent?: boolean;
}

export class CaptainBudgetError extends Error {
  readonly status: number;
  readonly code: "KILL_SWITCH_ACTIVE" | "BUDGET_EXHAUSTED" | "FORBIDDEN_CLIENT" | "MODEL_NOT_ALLOWED";

  constructor(
    message: string,
    status: 403 | 429,
    code: "KILL_SWITCH_ACTIVE" | "BUDGET_EXHAUSTED" | "FORBIDDEN_CLIENT" | "MODEL_NOT_ALLOWED" = "FORBIDDEN_CLIENT",
  ) {
    super(message);
    this.name = "CaptainBudgetError";
    this.status = status;
    this.code = code;
  }
}

export function validateCaptainClientId(rawClientId: unknown): string {
  if (typeof rawClientId !== "string" || !rawClientId.trim()) {
    throw new CaptainBudgetError("Client identifier is required (403)", 403, "FORBIDDEN_CLIENT");
  }
  const trimmed = rawClientId.trim();
  rejectForbiddenPhone(trimmed);

  const lower = trimmed.toLowerCase();
  for (const forbidden of FORBIDDEN_TEAM_IDS) {
    if (lower === forbidden || lower.includes(forbidden)) {
      throw new CaptainBudgetError(
        `Refused: team or primary identifier "${trimmed}" cannot be accessed or modified (403)`,
        403,
        "FORBIDDEN_CLIENT",
      );
    }
  }

  if (!ALLOWED_CAPTAIN_CLIENTS.has(trimmed)) {
    throw new CaptainBudgetError(
      `Refused: clientId "${trimmed}" is not in the isolated client allowlist (client_test_a, client_test_b, default_studio) (403)`,
      403,
      "FORBIDDEN_CLIENT",
    );
  }

  return trimmed;
}

function defaultRecordFor(clientId: string, gatewayHealthy = true): ClientBudgetRecord {
  const isClientB = clientId === "client_test_b";
  return {
    clientId,
    virtualKeyId: `vk_isolated_${clientId}_4001`,
    gatewayPort: 4001,
    gatewayHealthy,
    maxBudgetUsd: isClientB ? 15.0 : 25.0,
    spentUsd: isClientB ? 0.012 : 0.024,
    rpmLimit: 30,
    tpmLimit: 60000,
    maxStepsPerTurn: MAX_STEPS_PER_TURN,
    allowedModels: [...DEFAULT_ALLOWED_MODELS],
    blocked: false,
    tokensUsedTotal: isClientB ? 420 : 860,
    invocationsCount: isClientB ? 2 : 4,
    toolTimeoutMs: TOOL_TIMEOUT_MS,
    toolMaxOutputBytes: TOOL_MAX_OUTPUT_BYTES,
    updatedAt: new Date().toISOString(),
  };
}

let cachedHealth: { ok: boolean; at: number } | null = null;

export async function checkGateway4001Health(): Promise<boolean> {
  if (cachedHealth && Date.now() - cachedHealth.at < 15_000) {
    return cachedHealth.ok;
  }
  try {
    const res = await fetch("http://127.0.0.1:4001/health/liveliness", {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    const ok = res.ok;
    cachedHealth = { ok, at: Date.now() };
    return ok;
  } catch {
    cachedHealth = { ok: false, at: Date.now() };
    return false;
  }
}

async function readAllBudgets(gatewayHealthy: boolean): Promise<Record<string, ClientBudgetRecord>> {
  await mkdir(STUDIO_DATA_DIR, { recursive: true });
  let store: Record<string, ClientBudgetRecord> = {};
  try {
    const raw = await readFile(BUDGETS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      store = parsed as Record<string, ClientBudgetRecord>;
    }
  } catch {
    // initialize default records on first read
  }

  let changed = false;
  for (const cid of ALLOWED_CAPTAIN_CLIENTS) {
    if (!store[cid] || typeof store[cid] !== "object") {
      store[cid] = defaultRecordFor(cid, gatewayHealthy);
      changed = true;
    } else {
      store[cid] = {
        ...defaultRecordFor(cid, gatewayHealthy),
        ...store[cid],
        clientId: cid,
        gatewayPort: 4001,
        gatewayHealthy,
        maxStepsPerTurn: MAX_STEPS_PER_TURN,
        toolTimeoutMs: TOOL_TIMEOUT_MS,
        toolMaxOutputBytes: TOOL_MAX_OUTPUT_BYTES,
      };
    }
  }

  if (changed) {
    await writeFile(BUDGETS_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  return store;
}

async function saveAllBudgets(store: Record<string, ClientBudgetRecord>): Promise<void> {
  await mkdir(STUDIO_DATA_DIR, { recursive: true });
  await writeFile(BUDGETS_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function getClientBudget(rawClientId: string): Promise<ClientBudgetRecord> {
  const clientId = validateCaptainClientId(rawClientId);
  const gatewayHealthy = await checkGateway4001Health();
  const store = await readAllBudgets(gatewayHealthy);
  return store[clientId];
}

export async function updateClientBudget(rawClientId: string, patch: ClientBudgetPatch): Promise<ClientBudgetRecord> {
  const clientId = validateCaptainClientId(rawClientId);
  rejectForbiddenPhone(patch);

  const gatewayHealthy = await checkGateway4001Health();
  const store = await readAllBudgets(gatewayHealthy);
  const current = store[clientId] ?? defaultRecordFor(clientId, gatewayHealthy);

  const nextMaxBudget =
    typeof patch.maxBudgetUsd === "number" && Number.isFinite(patch.maxBudgetUsd) && patch.maxBudgetUsd >= 0
      ? Number(patch.maxBudgetUsd.toFixed(4))
      : current.maxBudgetUsd;

  const nextRpm =
    typeof patch.rpmLimit === "number" && Number.isFinite(patch.rpmLimit) && patch.rpmLimit >= 1
      ? Math.round(patch.rpmLimit)
      : current.rpmLimit;

  const nextTpm =
    typeof patch.tpmLimit === "number" && Number.isFinite(patch.tpmLimit) && patch.tpmLimit >= 100
      ? Math.round(patch.tpmLimit)
      : current.tpmLimit;

  const nextBlocked = typeof patch.blocked === "boolean" ? patch.blocked : current.blocked;

  const nextAllowedModels =
    Array.isArray(patch.allowedModels) && patch.allowedModels.length > 0
      ? patch.allowedModels.filter(
          (m): m is string =>
            typeof m === "string" && DEFAULT_ALLOWED_MODELS.includes(m as (typeof DEFAULT_ALLOWED_MODELS)[number]),
        )
      : current.allowedModels;

  const nextSpent = patch.resetSpent === true ? 0 : current.spentUsd;

  const updated: ClientBudgetRecord = {
    ...current,
    gatewayHealthy,
    maxBudgetUsd: nextMaxBudget,
    spentUsd: nextSpent,
    rpmLimit: nextRpm,
    tpmLimit: nextTpm,
    blocked: nextBlocked,
    allowedModels: nextAllowedModels.length > 0 ? nextAllowedModels : [...DEFAULT_ALLOWED_MODELS],
    maxStepsPerTurn: MAX_STEPS_PER_TURN,
    toolTimeoutMs: TOOL_TIMEOUT_MS,
    toolMaxOutputBytes: TOOL_MAX_OUTPUT_BYTES,
    updatedAt: new Date().toISOString(),
  };

  store[clientId] = updated;
  await saveAllBudgets(store);
  return updated;
}

export async function assertBudgetAllowsExecution(
  rawClientId: string,
  model = "gpt-4.1-mini",
): Promise<ClientBudgetRecord> {
  const budget = await getClientBudget(rawClientId);

  if (budget.blocked) {
    throw new CaptainBudgetError(
      "Kill-Switch active: model & tools blocked immediately for this client",
      403,
      "KILL_SWITCH_ACTIVE",
    );
  }

  if (budget.maxBudgetUsd <= 0 || budget.spentUsd >= budget.maxBudgetUsd) {
    throw new CaptainBudgetError(
      `Budget limit reached ($${budget.spentUsd.toFixed(4)} / $${budget.maxBudgetUsd.toFixed(2)})`,
      429,
      "BUDGET_EXHAUSTED",
    );
  }

  if (model && !budget.allowedModels.includes(model)) {
    throw new CaptainBudgetError(
      `Model "${model}" is not allowed for client ${budget.clientId} (allowed: ${budget.allowedModels.join(", ")})`,
      403,
      "MODEL_NOT_ALLOWED",
    );
  }

  return budget;
}

export async function recordClientUsage(
  rawClientId: string,
  costUsd: number,
  tokensUsed: number,
): Promise<ClientBudgetRecord> {
  const clientId = validateCaptainClientId(rawClientId);
  const gatewayHealthy = await checkGateway4001Health();
  const store = await readAllBudgets(gatewayHealthy);
  const current = store[clientId] ?? defaultRecordFor(clientId, gatewayHealthy);

  const safeCost = Number.isFinite(costUsd) && costUsd > 0 ? costUsd : 0.0012;
  const safeTokens = Number.isFinite(tokensUsed) && tokensUsed > 0 ? Math.round(tokensUsed) : 140;

  const updated: ClientBudgetRecord = {
    ...current,
    gatewayHealthy,
    spentUsd: Number((current.spentUsd + safeCost).toFixed(4)),
    tokensUsedTotal: (current.tokensUsedTotal ?? 0) + safeTokens,
    invocationsCount: (current.invocationsCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };

  store[clientId] = updated;
  await saveAllBudgets(store);
  return updated;
}
