import { NextResponse } from "next/server";

import {
  assistants as seedAssistants,
  connectedInboxes as seedConnectedInboxes,
  documents as seedDocuments,
  faqs as seedFaqs,
  guardrails as seedGuardrails,
  guidelines as seedGuidelines,
  scenarios as seedScenarios,
  suggestions as seedSuggestions,
  tools as seedTools,
} from "@/app/(main)/dashboard/captain/_components/data";
import {
  CaptainBudgetError,
  getClientBudget,
  STUDIO_DATA_DIR,
  updateClientBudget,
  validateCaptainClientId,
} from "@/lib/captain/litellm-budget";
import { STUDIO_CAPABILITY_GROUPS } from "@/lib/captain/studio-tools";
import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import {
  assertSameOrigin,
  DEFAULT_CLIENTS,
  ProvisionForbiddenError,
  ProvisionValidationError,
  rejectForbiddenPhone,
  requireViewer,
} from "@/lib/lobehub/provision";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export const CAPTAIN_STATE_FILE_PATH = path.join(STUDIO_DATA_DIR, "captain-state.json");
const HEADERS = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 128_000;

const STATE_KEYS = [
  "assistants",
  "connectedInboxes",
  "documents",
  "faqs",
  "guardrails",
  "guidelines",
  "scenarios",
  "suggestions",
  "tools",
] as const;

type StateKey = (typeof STATE_KEYS)[number];

export interface PersistedCaptainClientState {
  clientId: string;
  displayName: string;
  assistants: typeof seedAssistants;
  connectedInboxes: typeof seedConnectedInboxes;
  documents: Array<(typeof seedDocuments)[number] & { content?: string }>;
  faqs: typeof seedFaqs;
  guardrails: string[];
  guidelines: string[];
  scenarios: typeof seedScenarios;
  suggestions: typeof seedSuggestions;
  tools: typeof seedTools;
  updatedAt: string;
}

function respond(status: number, body: unknown) {
  return NextResponse.json(scrubSecrets(body), { status, headers: HEADERS });
}

function defaultStateForClient(clientId: string): PersistedCaptainClientState {
  const isClientB = clientId === "client_test_b";
  const displayName = DEFAULT_CLIENTS[clientId]?.displayName ?? (isClientB ? "Test Client Beta" : "Test Client Alpha");
  return {
    clientId,
    displayName,
    assistants: structuredClone(seedAssistants),
    connectedInboxes: structuredClone(seedConnectedInboxes),
    documents: structuredClone(seedDocuments),
    faqs: structuredClone(seedFaqs),
    guardrails: [
      ...seedGuardrails,
      isClientB
        ? "Tenant boundary: respond strictly using Test Client Beta (client_test_b) isolated workspace and memory."
        : "Tenant boundary: respond strictly using Test Client Alpha (client_test_a) isolated workspace and memory.",
    ],
    guidelines: [...seedGuidelines],
    scenarios: structuredClone(seedScenarios),
    suggestions: structuredClone(seedSuggestions),
    tools: structuredClone(seedTools),
    updatedAt: new Date().toISOString(),
  };
}

async function readAllCaptainStates(): Promise<Record<string, PersistedCaptainClientState>> {
  await mkdir(STUDIO_DATA_DIR, { recursive: true });
  let store: Record<string, PersistedCaptainClientState> = {};
  try {
    const raw = await readFile(CAPTAIN_STATE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      store = parsed as Record<string, PersistedCaptainClientState>;
    }
  } catch {
    // initialize below
  }

  let changed = false;
  for (const cid of ["client_test_a", "client_test_b", "default_studio"]) {
    if (!store[cid] || typeof store[cid] !== "object") {
      store[cid] = defaultStateForClient(cid);
      changed = true;
    }
  }

  if (changed) {
    await writeFile(CAPTAIN_STATE_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
  return store;
}

async function saveAllCaptainStates(store: Record<string, PersistedCaptainClientState>): Promise<void> {
  await mkdir(STUDIO_DATA_DIR, { recursive: true });
  await writeFile(CAPTAIN_STATE_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function getCaptainClientState(rawClientId: string): Promise<PersistedCaptainClientState> {
  const clientId = validateCaptainClientId(rawClientId);
  const store = await readAllCaptainStates();
  return store[clientId] ?? defaultStateForClient(clientId);
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
  const message = error instanceof Error ? error.message : "Unexpected captain-state error";
  return respond(500, { ok: false, error: message });
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
        error: "403 Forbidden: Cross-tenant clientId mismatch between session header and query",
      });
    }

    const clientId = validateCaptainClientId(queryClient || headerClient || "client_test_a");
    const [state, budget] = await Promise.all([getCaptainClientState(clientId), getClientBudget(clientId)]);

    return respond(200, {
      ok: true,
      clientId,
      displayName: state.displayName,
      state,
      budget,
      capabilityGroupsCount: STUDIO_CAPABILITY_GROUPS.length,
    });
  } catch (error) {
    return handleError(error);
  }
}

async function handleUpsert(req: Request) {
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
    const rawBodyClient =
      typeof body.clientId === "string"
        ? body.clientId.trim()
        : typeof url.searchParams.get("clientId") === "string"
          ? url.searchParams.get("clientId")!.trim()
          : headerClient || "client_test_a";

    if (body.targetClientId !== undefined && String(body.targetClientId).trim() !== rawBodyClient) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant targetClientId override is strictly forbidden",
      });
    }
    if (headerClient && rawBodyClient && headerClient !== rawBodyClient) {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Cross-tenant clientId override is strictly forbidden",
      });
    }

    const clientId = validateCaptainClientId(rawBodyClient);

    const hasBudgetOrAdminMutation =
      body.budget !== undefined ||
      body.maxBudgetUsd !== undefined ||
      body.blocked !== undefined ||
      body.rpmLimit !== undefined ||
      body.tpmLimit !== undefined ||
      body.resetSpent !== undefined ||
      body.allowedModels !== undefined ||
      body.key === "tools" ||
      body.tools !== undefined;

    if (hasBudgetOrAdminMutation && viewer.role !== "administrator") {
      return respond(403, {
        ok: false,
        error: "403 Forbidden: Administrator role required to modify budgets, Kill-Switch, or tools",
      });
    }

    const store = await readAllCaptainStates();
    const current = store[clientId] ?? defaultStateForClient(clientId);

    // 1. Apply single list update `{ key, value }` from store.ts
    if (typeof body.key === "string" && STATE_KEYS.includes(body.key as StateKey) && Array.isArray(body.value)) {
      const k = body.key as StateKey;
      (current as unknown as Record<string, unknown>)[k] = body.value;
    }

    // 2. Apply direct list keys if provided
    for (const k of STATE_KEYS) {
      if (Array.isArray(body[k])) {
        (current as unknown as Record<string, unknown>)[k] = body[k];
      }
    }

    // 3. Apply convenience append operations (`addScenario`, `addGuideline`, `addGuardrail`)
    if (body.addScenario && typeof body.addScenario === "object" && !Array.isArray(body.addScenario)) {
      const s = body.addScenario as Record<string, unknown>;
      const nextId = current.scenarios.reduce((m, item) => Math.max(m, item.id), 0) + 1;
      current.scenarios = [
        ...current.scenarios,
        {
          id: typeof s.id === "number" ? s.id : nextId,
          title: String(s.title ?? "Custom Scenario"),
          description: String(s.description ?? ""),
          instruction: String(s.instruction ?? s.title ?? ""),
          tools: Array.isArray(s.tools) ? s.tools.map(String) : [],
          enabled: s.enabled !== false,
        },
      ];
    }
    if (typeof body.addGuideline === "string" && body.addGuideline.trim()) {
      current.guidelines = [...current.guidelines, body.addGuideline.trim()];
    }
    if (typeof body.addGuardrail === "string" && body.addGuardrail.trim()) {
      current.guardrails = [...current.guardrails, body.addGuardrail.trim()];
    }

    current.updatedAt = new Date().toISOString();
    store[clientId] = current;
    await saveAllCaptainStates(store);

    // 4. Apply budget / Kill-Switch updates if present
    const budgetPatchObj =
      body.budget && typeof body.budget === "object" && !Array.isArray(body.budget)
        ? (body.budget as Record<string, unknown>)
        : body;

    let budget = await getClientBudget(clientId);
    if (
      budgetPatchObj.maxBudgetUsd !== undefined ||
      budgetPatchObj.blocked !== undefined ||
      budgetPatchObj.rpmLimit !== undefined ||
      budgetPatchObj.tpmLimit !== undefined ||
      budgetPatchObj.resetSpent !== undefined ||
      budgetPatchObj.allowedModels !== undefined
    ) {
      budget = await updateClientBudget(clientId, {
        maxBudgetUsd: typeof budgetPatchObj.maxBudgetUsd === "number" ? budgetPatchObj.maxBudgetUsd : undefined,
        blocked: typeof budgetPatchObj.blocked === "boolean" ? budgetPatchObj.blocked : undefined,
        rpmLimit: typeof budgetPatchObj.rpmLimit === "number" ? budgetPatchObj.rpmLimit : undefined,
        tpmLimit: typeof budgetPatchObj.tpmLimit === "number" ? budgetPatchObj.tpmLimit : undefined,
        resetSpent: typeof budgetPatchObj.resetSpent === "boolean" ? budgetPatchObj.resetSpent : undefined,
        allowedModels: Array.isArray(budgetPatchObj.allowedModels)
          ? budgetPatchObj.allowedModels.map(String)
          : undefined,
      });
    }

    return respond(200, {
      ok: true,
      clientId,
      state: current,
      budget,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  return handleUpsert(req);
}

export async function PUT(req: Request) {
  return handleUpsert(req);
}
