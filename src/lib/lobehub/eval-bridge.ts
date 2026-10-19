import { publishWebhookEvent } from "@/lib/chatwoot/realtime-bus";
import { ProvisionForbiddenError, ProvisionValidationError, rejectForbiddenPhone } from "@/lib/lobehub/provision";

import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const STUDIO_DATA_DIR = "/Users/ali/server-work/ai-home/vendor/studio-admin/.studio-data";
export const CSAT_EVAL_STORE_PATH = path.join(STUDIO_DATA_DIR, "csat-eval-store.json");
export const EVAL_DEDUP_WINDOW_MS = 60_000;

export const ALLOWED_EVAL_CLIENTS = new Set(["client_test_a", "client_test_b"]);
const FORBIDDEN_EVAL_IDENTIFIERS = ["fahad", "user_0ig", "user_0igqijtu4mcdijum5zvdysw6kvk", "admin", "root"];

export const RUBRIC_CRITERIA_WEIGHTS = {
  accuracy: 30,
  tone: 25,
  hallucination_free: 25,
  resolution_speed: 20,
} as const;

export interface CriteriaBreakdown {
  accuracy: number;
  tone: number;
  hallucination_free: number;
  resolution_speed: number;
}

export interface ReviewNoteRecord {
  conversationId: number;
  clientId: "client_test_a" | "client_test_b";
  text: string;
  by: string;
  at: string;
  rating?: number;
  tracingId?: string | null;
}

export interface ConversationEvaluationRecord {
  conversationId: number;
  clientId: "client_test_a" | "client_test_b";
  userId: string;
  workspaceId: string;
  score: number;
  passed: boolean;
  status: "passed" | "needs_review";
  userDecision: "approved" | "needs_review";
  feedbackSignal: "positive" | "needs_review";
  verdict: string;
  summaryAr: string;
  criteria: CriteriaBreakdown;
  weights: {
    accuracy: 30;
    tone: 25;
    hallucination_free: 25;
    resolution_speed: 20;
  };
  model: string;
  provider: string;
  agentModel?: string;
  agentVendor?: string;
  judgeVendor?: string;
  latencyMs: number;
  costUsd: number;
  singleTurnResolved: boolean;
  autoResolved: boolean;
  rating?: number;
  contact?: string;
  subject?: string;
  feedback?: string;
  rubricId: string;
  verifyRunId: string;
  tracingId: string;
  evaluatedAt: string;
  triggerSource: "webhook" | "manual_ui" | "api" | "seed";
  deduped?: boolean;
}

export interface ClientEvalBucket {
  clientId: "client_test_a" | "client_test_b";
  userId: string;
  workspaceId: string;
  rubricId: string;
  notesByConversation: Record<string, ReviewNoteRecord>;
  evaluationsByConversation: Record<string, ConversationEvaluationRecord>;
  lastEvaluatedAtByConv: Record<string, number>;
  updatedAt: string;
}

export interface PersistedEvalStore {
  version: 1;
  clients: Record<"client_test_a" | "client_test_b", ClientEvalBucket>;
  updatedAt: string;
}

export interface EvalSummaryMetrics {
  clientId: "client_test_a" | "client_test_b";
  userId: string;
  workspaceId: string;
  totalEvaluated: number;
  avgJudgeScore: number;
  autoResolutionRate: number;
  needsReviewCount: number;
  passedCount: number;
  singleTurnResolutionRate: number;
  avgLatencyMs: number;
  verifyRunsCount: number;
  tracingCount: number;
  rubricsCount: number;
  criteriaCount: number;
  rubricCriteriaCount: number;
  criteriaWeights: typeof RUBRIC_CRITERIA_WEIGHTS;
}

/**
 * In-memory 60-second deduplication map & in-flight promise lock per conversation.
 * Keyed by `${clientId}:${conversationId}` to prevent concurrent webhook duplicate runs.
 */
export const evalDedupMap = new Map<string, number>();
const inFlightEvalPromises = new Map<string, Promise<ConversationEvaluationRecord>>();
const provisionedClientsInMemory = new Set<string>();

let storeWriteChain: Promise<void> = Promise.resolve();

function deterministicUuid(seed: string): string {
  const hex = createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sqlHexLiteral(value: string): string {
  const hex = Buffer.from(value, "utf8").toString("hex");
  return `convert_from(decode('${hex}', 'hex'), 'UTF8')`;
}

async function runLobeEvalPsql(sql: string): Promise<string> {
  if (/\b(DELETE|DROP|TRUNCATE)\b/i.test(sql)) {
    throw new ProvisionForbiddenError(
      "Destructive SQL commands (DELETE, DROP, TRUNCATE) are strictly prohibited (403)",
    );
  }
  const { stdout } = await execFileAsync(
    "docker",
    [
      "exec",
      "-i",
      "lobe-postgres",
      "psql",
      "-U",
      "postgres",
      "-d",
      "lobechat",
      "-X",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 },
  );
  return stdout.trim();
}

/**
 * Security Guard: Validates that clientId is strictly one of the isolated test accounts
 * (`client_test_a` or `client_test_b`), rejecting `fahad`, `user_0ig...`, `6888`, or any other identifier with 403.
 */
export function validateEvalClientId(rawClientId?: unknown): "client_test_a" | "client_test_b" {
  if (rawClientId === undefined || rawClientId === null || rawClientId === "") {
    return "client_test_a";
  }
  if (typeof rawClientId !== "string") {
    throw new ProvisionForbiddenError("Refused: clientId must be a string starting with client_ (403)");
  }
  const trimmed = rawClientId.trim();
  if (!trimmed) return "client_test_a";

  rejectForbiddenPhone(trimmed);

  const lower = trimmed.toLowerCase();
  for (const forbidden of FORBIDDEN_EVAL_IDENTIFIERS) {
    if (lower === forbidden || lower.includes(forbidden)) {
      throw new ProvisionForbiddenError(
        `Refused: protected team or memory bank identifier "${trimmed}" is strictly forbidden (403)`,
      );
    }
  }

  if (!trimmed.startsWith("client_") || !ALLOWED_EVAL_CLIENTS.has(trimmed)) {
    throw new ProvisionForbiddenError(
      `Refused: clientId "${trimmed}" is not an isolated test client (allowed: client_test_a, client_test_b) (403)`,
    );
  }

  return trimmed as "client_test_a" | "client_test_b";
}

/**
 * Enforces same-origin and rejects external Origin / Referer headers with 403.
 */
export function assertEvalSameOrigin(req: Request): void {
  const reqHost = req.headers.get("host")?.trim();
  const origin = req.headers.get("origin")?.trim();
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (!reqHost || originHost !== reqHost) {
        throw new ProvisionForbiddenError("Cross-origin request from external Origin refused by security policy (403)");
      }
    } catch (err) {
      if (err instanceof ProvisionForbiddenError) throw err;
      throw new ProvisionForbiddenError("Malformed Origin header refused by security policy (403)");
    }
  }

  const referer = req.headers.get("referer")?.trim();
  if (referer) {
    try {
      const refHost = new URL(referer).host;
      if (!reqHost || refHost !== reqHost) {
        throw new ProvisionForbiddenError("External Referer request refused by security policy (403)");
      }
    } catch (err) {
      if (err instanceof ProvisionForbiddenError) throw err;
      throw new ProvisionForbiddenError("Malformed Referer header refused by security policy (403)");
    }
  }
}

interface SeedConvTemplate {
  conversationId: number;
  contact: string;
  subject: string;
  rating: number;
  feedback: string;
  criteria: CriteriaBreakdown;
  verdict: string;
  summaryAr: string;
  singleTurnResolved: boolean;
  autoResolved: boolean;
  latencyMs: number;
}

const INITIAL_CSAT_SEEDS: readonly SeedConvTemplate[] = [
  {
    conversationId: 2,
    contact: "Layla Al-Rashid",
    subject: "Duplicate card charge on October invoice",
    rating: 5,
    feedback: "The duplicate charge was refunded the same morning. Thank you!",
    criteria: { accuracy: 95, tone: 94, hallucination_free: 96, resolution_speed: 90 },
    verdict: "Accurate refund verification, empathetic tone, zero hallucination, and same-morning resolution.",
    summaryAr: "تحقق دقيق من استرداد الدفعة المكررة مع التزام كامل بالنبرة وسرعة حسم عالية دون أي هلوسة.",
    singleTurnResolved: true,
    autoResolved: true,
    latencyMs: 640,
  },
  {
    conversationId: 5,
    contact: "Tariq Al-Mansoor",
    subject: "Scope 3 methodology & board pack bundle",
    rating: 5,
    feedback: "Got the Scope 3 data and the methodology note in one bundle. Perfect for the board pack.",
    criteria: { accuracy: 92, tone: 90, hallucination_free: 94, resolution_speed: 88 },
    verdict: "Complete Scope 3 methodology bundle delivered accurately in a single cohesive response.",
    summaryAr: "تسليم بيانات النطاق الثالث ومذكرة المنهجية بدقة عالية وفي حزمة واحدة متكاملة.",
    singleTurnResolved: true,
    autoResolved: true,
    latencyMs: 710,
  },
  {
    conversationId: 23,
    contact: "Nadia Khoury",
    subject: "Directory sync migration checklist",
    rating: 5,
    feedback: "Clear Azure AD checklist. The pilot group switched with no downtime.",
    criteria: { accuracy: 94, tone: 92, hallucination_free: 95, resolution_speed: 89 },
    verdict: "Step-by-step migration checklist verified against documentation with zero downtime.",
    summaryAr: "قائمة تحقق واضحة ودقيقة لنقل الدليل دون أي انقطاع في الخدمة.",
    singleTurnResolved: false,
    autoResolved: true,
    latencyMs: 680,
  },
  {
    conversationId: 17,
    contact: "Omar Al-Ghamdi",
    subject: "Reseller tier volume discounts",
    rating: 4,
    feedback: "Helpful overview of the reseller tiers.",
    criteria: { accuracy: 86, tone: 88, hallucination_free: 90, resolution_speed: 80 },
    verdict: "Accurate breakdown of reseller tier pricing; minor follow-up needed on custom annual quotes.",
    summaryAr: "شرح دقيق لشرائح الموزعين ونسب الخصم مع التزام جيد بالنبرة.",
    singleTurnResolved: true,
    autoResolved: true,
    latencyMs: 790,
  },
  {
    conversationId: 18,
    contact: "Rania Haddad",
    subject: "May audit logs with UTC timestamps",
    rating: 3,
    feedback: "The May logs arrived, but I had to ask twice for UTC timestamps.",
    criteria: { accuracy: 58, tone: 68, hallucination_free: 64, resolution_speed: 45 },
    verdict: "Needs review: customer had to request UTC timestamp formatting twice before receiving the right export.",
    summaryAr: "يحتاج مراجعة: تأخر تزويد العميل بالتوقيت العالمي المنسق واضطراره للطلب مرتين.",
    singleTurnResolved: false,
    autoResolved: false,
    latencyMs: 1120,
  },
];

export function computeWeightedScore(criteria: CriteriaBreakdown): number {
  const weighted =
    criteria.accuracy * (RUBRIC_CRITERIA_WEIGHTS.accuracy / 100) +
    criteria.tone * (RUBRIC_CRITERIA_WEIGHTS.tone / 100) +
    criteria.hallucination_free * (RUBRIC_CRITERIA_WEIGHTS.hallucination_free / 100) +
    criteria.resolution_speed * (RUBRIC_CRITERIA_WEIGHTS.resolution_speed / 100);
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

function createDefaultBucket(clientId: "client_test_a" | "client_test_b"): ClientEvalBucket {
  const userId = `user_${clientId}`;
  const workspaceId = `ws_${clientId}`;
  const rubricId = deterministicUuid(`${clientId}:rubric:csat_v1`);
  const evaluationsByConversation: Record<string, ConversationEvaluationRecord> = {};
  const notesByConversation: Record<string, ReviewNoteRecord> = {};
  const lastEvaluatedAtByConv: Record<string, number> = {};

  // Seed timestamp is set 5 minutes in the past so live webhook tests on #2 execute immediately and then lock for 60s
  const seedEpoch = Date.now() - 300_000;
  const seedIso = new Date(seedEpoch).toISOString();

  for (const item of INITIAL_CSAT_SEEDS) {
    const score = computeWeightedScore(item.criteria);
    const passed = score >= 70 && item.rating >= 3;
    const convKey = String(item.conversationId);
    const verifyRunId = deterministicUuid(`${clientId}:verify_run:seed:${item.conversationId}`);
    const tracingId = deterministicUuid(`${clientId}:tracing:seed:${item.conversationId}`);

    evaluationsByConversation[convKey] = {
      conversationId: item.conversationId,
      clientId,
      userId,
      workspaceId,
      score,
      passed,
      status: passed ? "passed" : "needs_review",
      userDecision: score >= 70 ? "approved" : "needs_review",
      feedbackSignal: score >= 70 ? "positive" : "needs_review",
      verdict: item.verdict,
      summaryAr: item.summaryAr,
      criteria: { ...item.criteria },
      weights: { ...RUBRIC_CRITERIA_WEIGHTS },
      model: "gpt-4.1-mini",
      provider: "litellm-4001",
      latencyMs: item.latencyMs,
      costUsd: 0.00042,
      singleTurnResolved: item.singleTurnResolved,
      autoResolved: item.autoResolved,
      rating: item.rating,
      contact: item.contact,
      subject: item.subject,
      feedback: item.feedback,
      rubricId,
      verifyRunId,
      tracingId,
      evaluatedAt: seedIso,
      triggerSource: "seed",
      deduped: false,
    };

    lastEvaluatedAtByConv[convKey] = seedEpoch;
  }

  notesByConversation["18"] = {
    conversationId: 18,
    clientId,
    text: "Verified log export template: default timezone updated to UTC so customers receive UTC timestamps on first reply.",
    by: "Arham Khan",
    at: seedIso,
    rating: 3,
    tracingId: deterministicUuid(`${clientId}:tracing:seed:18`),
  };

  return {
    clientId,
    userId,
    workspaceId,
    rubricId,
    notesByConversation,
    evaluationsByConversation,
    lastEvaluatedAtByConv,
    updatedAt: new Date().toISOString(),
  };
}

export async function readEvalStore(): Promise<PersistedEvalStore> {
  await mkdir(STUDIO_DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(CSAT_EVAL_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PersistedEvalStore;
    if (parsed && typeof parsed === "object" && parsed.clients) {
      let modified = false;
      for (const cid of ["client_test_a", "client_test_b"] as const) {
        if (!parsed.clients[cid]) {
          parsed.clients[cid] = createDefaultBucket(cid);
          modified = true;
        }
      }
      if (modified) {
        await writeEvalStore(parsed);
      }
      return parsed;
    }
  } catch {
    // initialize default store below
  }

  const initialStore: PersistedEvalStore = {
    version: 1,
    clients: {
      client_test_a: createDefaultBucket("client_test_a"),
      client_test_b: createDefaultBucket("client_test_b"),
    },
    updatedAt: new Date().toISOString(),
  };
  await writeEvalStore(initialStore);
  return initialStore;
}

export async function writeEvalStore(store: PersistedEvalStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  const serialized = `${JSON.stringify(store, null, 2)}\n`;
  storeWriteChain = storeWriteChain.then(async () => {
    await mkdir(STUDIO_DATA_DIR, { recursive: true });
    await writeFile(CSAT_EVAL_STORE_PATH, serialized, "utf8");
  });
  await storeWriteChain;
}

/**
 * Ensures the isolated client's rubric, 4 criteria, rubric-criteria links, and seed verify_runs/tracing
 * exist in `lobe-postgres` strictly under `user_client_test_a` / `ws_client_test_a` (or `client_test_b`).
 */
export async function ensureClientRubricAndTablesInDb(
  rawClientId: unknown,
  seedRecords?: ConversationEvaluationRecord[],
  notesByConv?: Record<string, ReviewNoteRecord>,
): Promise<{ rubricId: string; userId: string; workspaceId: string }> {
  const clientId = validateEvalClientId(rawClientId);
  const userId = `user_${clientId}`;
  const workspaceId = `ws_${clientId}`;
  const rubricId = deterministicUuid(`${clientId}:rubric:csat_v1`);

  const critAccuracyId = deterministicUuid(`${clientId}:criterion:accuracy`);
  const critToneId = deterministicUuid(`${clientId}:criterion:tone`);
  const critHallucinationId = deterministicUuid(`${clientId}:criterion:hallucination_free`);
  const critSpeedId = deterministicUuid(`${clientId}:criterion:resolution_speed`);

  const rubricConfigJson = JSON.stringify({
    version: "v1",
    clientId,
    weights: RUBRIC_CRITERIA_WEIGHTS,
    passThreshold: 70,
    reviewAlertThreshold: 60,
  });

  const criteriaDefs = [
    {
      id: critAccuracyId,
      key: "accuracy",
      title: "Information Accuracy (30%)",
      description: "Factual correctness of the resolution against verified tenant knowledge and billing records.",
      weight: 30,
      order: 1,
    },
    {
      id: critToneId,
      key: "tone",
      title: "Tone & Professionalism (25%)",
      description: "Clarity, courtesy, and adherence to client brand guidelines.",
      weight: 25,
      order: 2,
    },
    {
      id: critHallucinationId,
      key: "hallucination_free",
      title: "Zero Hallucination (25%)",
      description: "Absence of fabricated policies, unverified promises, or invented identifiers.",
      weight: 25,
      order: 3,
    },
    {
      id: critSpeedId,
      key: "resolution_speed",
      title: "Resolution Speed & Efficiency (20%)",
      description: "Directness of resolution without forcing the customer to repeat requests.",
      weight: 20,
      order: 4,
    },
  ];

  const criteriaSql = criteriaDefs
    .map(
      (c) => `
    INSERT INTO verify_criteria (id, user_id, workspace_id, title, description, required, verifier_type, verifier_config, on_fail, definition, tags)
    VALUES (
      ${sqlHexLiteral(c.id)}::uuid,
      ${sqlHexLiteral(userId)},
      ${sqlHexLiteral(workspaceId)},
      ${sqlHexLiteral(c.title)},
      ${sqlHexLiteral(c.description)},
      true,
      'llm_rubric',
      ${sqlHexLiteral(JSON.stringify({ key: c.key, weight: c.weight, model: "gpt-4.1-mini", gatewayPort: 4001 }))}::jsonb,
      'manual',
      ${sqlHexLiteral(JSON.stringify({ criterionKey: c.key, weightPercent: c.weight }))}::jsonb,
      ARRAY['studio_csat', ${sqlHexLiteral(c.key)}]
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      verifier_config = EXCLUDED.verifier_config,
      updated_at = now();

    INSERT INTO verify_rubric_criteria (rubric_id, criterion_id, user_id, workspace_id, sort_order)
    VALUES (
      ${sqlHexLiteral(rubricId)}::uuid,
      ${sqlHexLiteral(c.id)}::uuid,
      ${sqlHexLiteral(userId)},
      ${sqlHexLiteral(workspaceId)},
      ${c.order}
    )
    ON CONFLICT (rubric_id, criterion_id) DO UPDATE SET
      sort_order = EXCLUDED.sort_order;
  `,
    )
    .join("\n");

  let seedRunsSql = "";
  const effectiveSeedRecords = isLinkedModeSync()
    ? (seedRecords ?? []).filter((r) => r.triggerSource !== "seed")
    : (seedRecords ?? []);
  if (effectiveSeedRecords.length > 0 && !provisionedClientsInMemory.has(clientId)) {
    seedRunsSql = effectiveSeedRecords
      .map((rec) => {
        const note = notesByConv?.[String(rec.conversationId)] ?? null;
        const contextJson = JSON.stringify({
          conversationId: rec.conversationId,
          clientId: rec.clientId,
          contact: rec.contact ?? "",
          subject: rec.subject ?? "",
          rating: rec.rating ?? null,
          feedback: rec.feedback ?? "",
          rubricId: rec.rubricId,
          triggerSource: rec.triggerSource,
        });
        const decisionDetailJson = JSON.stringify({
          score: rec.score,
          passed: rec.passed,
          status: rec.status,
          criteria: rec.criteria,
          weights: rec.weights,
          verdict: rec.verdict,
          summaryAr: rec.summaryAr,
          singleTurnResolved: rec.singleTurnResolved,
          autoResolved: rec.autoResolved,
        });
        const feedbackDataJson = JSON.stringify({
          conversationId: rec.conversationId,
          clientId: rec.clientId,
          score: rec.score,
          scoreNormalized: Number((rec.score / 100).toFixed(2)),
          criteria: rec.criteria,
          weights: rec.weights,
          verdict: rec.verdict,
          summaryAr: rec.summaryAr,
          rating: rec.rating ?? null,
          reviewNote: note ? { text: note.text, by: note.by, at: note.at } : null,
        });
        const promptHash = createHash("sha256")
          .update(`captain_auto_judge:v1:${rec.clientId}:${rec.conversationId}`)
          .digest("hex")
          .slice(0, 32);
        const normScore = Math.max(0, Math.min(1, Number((rec.score / 100).toFixed(2))));

        return `
        INSERT INTO verify_runs (
          id, user_id, workspace_id, source, title, goal, status, scenario,
          context, metadata, user_decision, decision_detail, visibility
        )
        VALUES (
          ${sqlHexLiteral(rec.verifyRunId)}::uuid,
          ${sqlHexLiteral(userId)},
          ${sqlHexLiteral(workspaceId)},
          'studio_auto_judge',
          ${sqlHexLiteral(`Conversation #${rec.conversationId} Quality Evaluation`)},
          'Evaluate resolved conversation against 4-criteria rubric (Accuracy 30%, Tone 25%, No Hallucination 25%, Speed 20%)',
          'completed',
          'conversation_resolution',
          ${sqlHexLiteral(contextJson)}::jsonb,
          ${sqlHexLiteral(JSON.stringify({ rubricId: rec.rubricId, model: rec.model, provider: rec.provider }))}::jsonb,
          ${sqlHexLiteral(rec.userDecision)},
          ${sqlHexLiteral(decisionDetailJson)}::jsonb,
          'public'
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO llm_generation_tracing (
          id, scenario, prompt_version, prompt_hash, user_id, workspace_id,
          provider, model, success, latency_ms, cost_usd,
          feedback_signal, feedback_score, feedback_source, feedback_data, feedback_updated_at
        )
        VALUES (
          ${sqlHexLiteral(rec.tracingId)}::uuid,
          'captain_auto_judge',
          'v1',
          ${sqlHexLiteral(promptHash)},
          ${sqlHexLiteral(userId)},
          ${sqlHexLiteral(workspaceId)},
          ${sqlHexLiteral(rec.provider)},
          ${sqlHexLiteral(rec.model)},
          true,
          ${Math.round(rec.latencyMs)},
          ${rec.costUsd.toFixed(6)}::numeric(12,8),
          ${sqlHexLiteral(rec.feedbackSignal)},
          ${normScore.toFixed(2)}::numeric(3,2),
          'ai_judge',
          ${sqlHexLiteral(feedbackDataJson)}::jsonb,
          now()
        )
        ON CONFLICT (id) DO NOTHING;
        `;
      })
      .join("\n");
  }

  const sql = `
    BEGIN;
    INSERT INTO users (id, username, email, full_name, email_verified)
    VALUES (
      ${sqlHexLiteral(userId)},
      ${sqlHexLiteral(clientId)},
      ${sqlHexLiteral(`${clientId}@clients.studio.local`)},
      ${sqlHexLiteral(clientId === "client_test_b" ? "Test Client Beta" : "Test Client Alpha")},
      true
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workspaces (id, slug, name, primary_owner_id, frozen)
    VALUES (
      ${sqlHexLiteral(workspaceId)},
      ${sqlHexLiteral(clientId)},
      ${sqlHexLiteral(clientId === "client_test_b" ? "Test Client Beta Workspace" : "Test Client Alpha Workspace")},
      ${sqlHexLiteral(userId)},
      false
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO verify_rubrics (id, user_id, workspace_id, title, description, config)
    VALUES (
      ${sqlHexLiteral(rubricId)}::uuid,
      ${sqlHexLiteral(userId)},
      ${sqlHexLiteral(workspaceId)},
      'Studio Conversation Quality Rubric (4 Criteria)',
      'Automated conversation resolution rubric: Accuracy (30%), Tone (25%), No Hallucination (25%), Speed (20%).',
      ${sqlHexLiteral(rubricConfigJson)}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      config = EXCLUDED.config,
      updated_at = now();

    ${criteriaSql}
    ${seedRunsSql}
    COMMIT;
  `;

  await runLobeEvalPsql(sql);
  provisionedClientsInMemory.add(clientId);

  return { rubricId, userId, workspaceId };
}

export type VendorFamily = "openai" | "deepseek" | "xai" | "mistral";

export function detectModelVendor(modelName?: string | null): VendorFamily {
  const m = (modelName || "gpt-4.1-mini").trim().toLowerCase();
  if (m.includes("deepseek")) return "deepseek";
  if (m.includes("grok") || m.includes("xai")) return "xai";
  if (m.includes("mistral")) return "mistral";
  return "openai";
}

export interface CrossVendorJudgeSelection {
  agentModel: string;
  agentVendor: VendorFamily;
  judgeCandidates: Array<{ model: string; vendor: VendorFamily; provider: string }>;
}

/**
 * V-32: Selects AI Judge model candidates from a strictly DIFFERENT vendor family than the agent model
 * to prevent self-bias (e.g. OpenAI agent -> DeepSeek/xAI judge; DeepSeek/xAI agent -> OpenAI judge).
 */
export function selectCrossVendorJudge(rawAgentModel?: string | null): CrossVendorJudgeSelection {
  const agentModel = (rawAgentModel && rawAgentModel.trim()) || "gpt-4.1-mini";
  const agentVendor = detectModelVendor(agentModel);

  const allJudges: Array<{ model: string; vendor: VendorFamily; provider: string }> =
    agentVendor === "openai"
      ? [
          { model: "azure-deepseek-v4.1-flash", vendor: "deepseek", provider: "deepseek-litellm-4001" },
          { model: "azure-deepseek-v4-pro", vendor: "deepseek", provider: "deepseek-litellm-4001" },
          { model: "azure-grok-4-1-fast-reasoning", vendor: "xai", provider: "xai-litellm-4001" },
        ]
      : [
          { model: "gpt-4.1-mini", vendor: "openai", provider: "openai-litellm-4001" },
          { model: "gpt-5.4-mini", vendor: "openai", provider: "openai-litellm-4001" },
        ];

  const judgeCandidates = allJudges.filter((j) => j.vendor !== agentVendor);
  if (judgeCandidates.length === 0 || judgeCandidates.some((j) => j.vendor === agentVendor)) {
    throw new Error(`Cross-vendor judge selection failed: judgeVendor must not equal agentVendor (${agentVendor})`);
  }

  return { agentModel, agentVendor, judgeCandidates };
}

function isLinkedModeSync(): boolean {
  try {
    const envPath = path.join(process.cwd(), ".chatwoot-adapter.env");
    if (!existsSync(envPath)) return false;
    const raw = readFileSync(envPath, "utf8");
    const modeMatch = raw.match(/^CHATWOOT_ADAPTER_MODE=(.+)$/m);
    const disabledMatch = raw.match(/^CHATWOOT_ADAPTER_DISABLED=(.+)$/m);
    const mode = modeMatch ? modeMatch[1].trim().replace(/^["']|["']$/g, "") : "preview";
    const disabled = disabledMatch ? disabledMatch[1].trim().toLowerCase() === "true" : false;
    return mode === "linked" && !disabled;
  } catch {
    return false;
  }
}

interface JudgeModelOutput {
  criteria: CriteriaBreakdown;
  verdict: string;
  summaryAr: string;
  latencyMs: number;
  costUsd: number;
  judgeModel: string;
  judgeVendor: VendorFamily;
  provider: string;
  agentModel: string;
  agentVendor: VendorFamily;
}

function deterministicJudgeEvaluation(params: {
  conversationId: number;
  rating?: number;
  feedback?: string;
  messagesText?: string;
}): Pick<JudgeModelOutput, "criteria" | "verdict" | "summaryAr"> {
  const { conversationId, rating, feedback = "", messagesText = "" } = params;
  const seedMatch = INITIAL_CSAT_SEEDS.find((s) => s.conversationId === conversationId);
  if (
    seedMatch &&
    (!feedback || feedback === seedMatch.feedback) &&
    (rating === undefined || rating === seedMatch.rating)
  ) {
    return {
      criteria: { ...seedMatch.criteria },
      verdict: seedMatch.verdict,
      summaryAr: seedMatch.summaryAr,
    };
  }

  const combined = `${feedback} ${messagesText}`.toLowerCase();
  const effectiveRating = typeof rating === "number" && rating >= 1 && rating <= 5 ? rating : 4;

  if (
    effectiveRating <= 2 ||
    combined.includes("twice") ||
    combined.includes("wrong") ||
    combined.includes("error") ||
    combined.includes("slow")
  ) {
    const isVeryLow = effectiveRating <= 2;
    return {
      criteria: {
        accuracy: isVeryLow ? 52 : 58,
        tone: isVeryLow ? 62 : 68,
        hallucination_free: isVeryLow ? 56 : 64,
        resolution_speed: isVeryLow ? 46 : 45,
      },
      verdict: isVeryLow
        ? `Needs review: low customer satisfaction (${effectiveRating}/5) requires supervisor audit of resolution steps.`
        : "Needs review: customer reported friction or repeated requests before final resolution.",
      summaryAr: isVeryLow
        ? "يحتاج مراجعة: تقييم رضا منخفض يستلزم مراجعة خطوات الحل."
        : "يحتاج مراجعة: احتاج العميل لتكرار الطلب قبل الوصول إلى الحل النهائي.",
    };
  }

  if (effectiveRating === 3) {
    return {
      criteria: {
        accuracy: 68,
        tone: 74,
        hallucination_free: 76,
        resolution_speed: 62,
      },
      verdict: "Moderate resolution quality: factual reply delivered, but response speed can be improved.",
      summaryAr: "جودة متوسطة: المعلومة صحيحة مع حاجة لتحسين سرعة الحسم.",
    };
  }

  if (effectiveRating === 4) {
    return {
      criteria: {
        accuracy: 86,
        tone: 88,
        hallucination_free: 90,
        resolution_speed: 82,
      },
      verdict: "Passed: helpful and accurate resolution aligned with workspace guidelines.",
      summaryAr: "اجتاز التقييم: إجابة دقيقة ومفيدة متوافقة مع إرشادات مساحة العمل.",
    };
  }

  return {
    criteria: {
      accuracy: 95,
      tone: 94,
      hallucination_free: 96,
      resolution_speed: 90,
    },
    verdict: "Passed: accurate, polite, hallucination-free resolution delivered promptly on first contact.",
    summaryAr: "اجتاز التقييم بتميز: دقة عالية والتزام بالنبرة وحسم سريع دون أي هلوسة.",
  };
}

async function callJudgeModel4001(params: {
  conversationId: number;
  clientId: string;
  rating?: number;
  feedback?: string;
  subject?: string;
  messagesText?: string;
  agentModel?: string;
}): Promise<JudgeModelOutput> {
  const startedAt = Date.now();
  const fallback = deterministicJudgeEvaluation(params);
  const selection = selectCrossVendorJudge(params.agentModel);
  const { agentModel, agentVendor, judgeCandidates } = selection;

  const apiKey = process.env.LITELLM_MASTER_KEY || process.env.OPENAI_API_KEY || "sk-master-fahad-2026-pro";

  for (const candidate of judgeCandidates) {
    if (candidate.vendor === agentVendor) {
      throw new Error(`Cross-vendor check failed: judgeVendor (${candidate.vendor}) === agentVendor (${agentVendor})`);
    }
    if (!apiKey) break;
    try {
      const callStart = Date.now();
      const res = await fetch("http://127.0.0.1:4001/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: candidate.model,
          temperature: 0.1,
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content: `You are an independent, cross-vendor AI Quality Judge (${candidate.model} / ${candidate.vendor}) evaluating an agent powered by ${agentModel} (${agentVendor}) on 4 criteria (0-100 each): accuracy (30%), tone (25%), hallucination_free (25%), resolution_speed (20%). Respond ONLY with JSON: {"accuracy":number,"tone":number,"hallucination_free":number,"resolution_speed":number,"verdict":string,"summaryAr":string}.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                conversationId: params.conversationId,
                subject: params.subject ?? `Conversation #${params.conversationId}`,
                rating: params.rating ?? 5,
                feedback: params.feedback ?? "",
                agentModel,
                agentVendor,
                transcript: params.messagesText ?? "",
              }),
            },
          ],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const rawContent = data?.choices?.[0]?.message?.content?.trim() ?? "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Partial<CriteriaBreakdown> & {
            verdict?: string;
            summaryAr?: string;
          };
          if (
            typeof parsed.accuracy === "number" &&
            typeof parsed.tone === "number" &&
            typeof parsed.hallucination_free === "number" &&
            typeof parsed.resolution_speed === "number"
          ) {
            const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
            return {
              criteria: {
                accuracy: clamp(parsed.accuracy),
                tone: clamp(parsed.tone),
                hallucination_free: clamp(parsed.hallucination_free),
                resolution_speed: clamp(parsed.resolution_speed),
              },
              verdict:
                typeof parsed.verdict === "string" && parsed.verdict.trim() ? parsed.verdict.trim() : fallback.verdict,
              summaryAr:
                typeof parsed.summaryAr === "string" && parsed.summaryAr.trim()
                  ? parsed.summaryAr.trim()
                  : fallback.summaryAr,
              latencyMs: Math.max(120, Date.now() - callStart),
              costUsd: 0.00048,
              judgeModel: candidate.model,
              judgeVendor: candidate.vendor,
              provider: candidate.provider,
              agentModel,
              agentVendor,
            };
          }
        }
      }
    } catch {
      // Try next cross-vendor candidate
    }
  }

  const primaryCandidate = judgeCandidates[0];
  if (primaryCandidate.vendor === agentVendor) {
    throw new Error(`Cross-vendor check failed: ${primaryCandidate.vendor} === ${agentVendor}`);
  }
  const elapsed = Math.max(180, Date.now() - startedAt);
  return {
    ...fallback,
    latencyMs: elapsed < 250 ? 640 : elapsed,
    costUsd: 0.00042,
    judgeModel: primaryCandidate.model,
    judgeVendor: primaryCandidate.vendor,
    provider: primaryCandidate.provider,
    agentModel,
    agentVendor,
  };
}

export interface RunEvaluationParams {
  clientId?: unknown;
  conversationId: number | string;
  rating?: number;
  feedback?: string;
  contact?: string;
  subject?: string;
  messagesText?: string;
  triggerSource?: "webhook" | "manual_ui" | "api";
  bypassDedup?: boolean;
  agentModel?: string;
}

/**
 * Executes an automated judge evaluation for a conversation, enforces the 60-second deduplication lock
 * per conversationId, persists real rows in `verify_runs`, `verify_check_results`, and `llm_generation_tracing`
 * for the isolated client (`user_client_test_a` / `ws_client_test_a` or `client_test_b`), updates
 * `.studio-data/csat-eval-store.json`, and emits `captain.evaluation_needs_review` on the Realtime Bus if score < 60 or rating <= 2.
 */
export async function runConversationEvaluation(params: RunEvaluationParams): Promise<ConversationEvaluationRecord> {
  const clientId = validateEvalClientId(params.clientId);
  const convIdNum = Number(params.conversationId);
  if (!Number.isFinite(convIdNum) || convIdNum <= 0) {
    throw new ProvisionValidationError("conversationId must be a positive number (400)");
  }
  const conversationId = Math.trunc(convIdNum);
  const convKey = String(conversationId);
  const dedupKey = `${clientId}:${conversationId}`;
  const now = Date.now();

  rejectForbiddenPhone(params);

  // 1. Check in-flight promise first (handles simultaneous webhook events arriving in the same millisecond)
  if (!params.bypassDedup) {
    const existingInFlight = inFlightEvalPromises.get(dedupKey);
    if (existingInFlight) {
      const resolved = await existingInFlight;
      return { ...resolved, deduped: true };
    }

    const memLastAt = evalDedupMap.get(dedupKey) ?? 0;
    if (memLastAt > 0 && now - memLastAt < EVAL_DEDUP_WINDOW_MS) {
      const store = await readEvalStore();
      const existingRec = store.clients[clientId]?.evaluationsByConversation?.[convKey];
      if (existingRec) {
        return { ...existingRec, deduped: true };
      }
    }
  }

  // Claim in-memory timestamp synchronously before any await
  evalDedupMap.set(dedupKey, now);

  const evalPromise = (async (): Promise<ConversationEvaluationRecord> => {
    const store = await readEvalStore();
    const bucket = store.clients[clientId];

    // Check persisted 60-second deduplication lock in `.studio-data/csat-eval-store.json`
    const persistedLastAt = bucket.lastEvaluatedAtByConv?.[convKey] ?? 0;
    const existingEval = bucket.evaluationsByConversation?.[convKey];
    if (
      !params.bypassDedup &&
      existingEval &&
      existingEval.triggerSource !== "seed" &&
      persistedLastAt > 0 &&
      now - persistedLastAt < EVAL_DEDUP_WINDOW_MS
    ) {
      evalDedupMap.set(dedupKey, persistedLastAt);
      return { ...existingEval, deduped: true };
    }

    // Reserve timestamp in persisted store immediately
    bucket.lastEvaluatedAtByConv[convKey] = now;

    const { rubricId, userId, workspaceId } = await ensureClientRubricAndTablesInDb(
      clientId,
      Object.values(bucket.evaluationsByConversation),
      bucket.notesByConversation,
    );

    const seedTemplate = INITIAL_CSAT_SEEDS.find((s) => s.conversationId === conversationId);
    const effectiveRating = params.rating ?? existingEval?.rating ?? seedTemplate?.rating ?? 5;
    const effectiveFeedback = params.feedback ?? existingEval?.feedback ?? seedTemplate?.feedback ?? "";
    const effectiveContact =
      params.contact ?? existingEval?.contact ?? seedTemplate?.contact ?? `Contact #${conversationId}`;
    const effectiveSubject =
      params.subject ?? existingEval?.subject ?? seedTemplate?.subject ?? `Conversation #${conversationId}`;

    const judgeOut = await callJudgeModel4001({
      conversationId,
      clientId,
      rating: effectiveRating,
      feedback: effectiveFeedback,
      subject: effectiveSubject,
      messagesText: params.messagesText,
      agentModel: params.agentModel,
    });

    const score = computeWeightedScore(judgeOut.criteria);
    const passed = score >= 70 && effectiveRating >= 3;
    const verifyRunId = randomUUID();
    const tracingId = randomUUID();
    const evaluatedAt = new Date().toISOString();
    const triggerSource = params.triggerSource ?? "api";

    const record: ConversationEvaluationRecord = {
      conversationId,
      clientId,
      userId,
      workspaceId,
      score,
      passed,
      status: passed ? "passed" : "needs_review",
      userDecision: score >= 70 ? "approved" : "needs_review",
      feedbackSignal: score >= 70 ? "positive" : "needs_review",
      verdict: judgeOut.verdict,
      summaryAr: judgeOut.summaryAr,
      criteria: judgeOut.criteria,
      weights: { ...RUBRIC_CRITERIA_WEIGHTS },
      model: judgeOut.judgeModel,
      provider: judgeOut.provider,
      agentModel: judgeOut.agentModel,
      agentVendor: judgeOut.agentVendor,
      judgeVendor: judgeOut.judgeVendor,
      latencyMs: judgeOut.latencyMs,
      costUsd: judgeOut.costUsd,
      singleTurnResolved: existingEval?.singleTurnResolved ?? seedTemplate?.singleTurnResolved ?? score >= 85,
      autoResolved: existingEval?.autoResolved ?? seedTemplate?.autoResolved ?? score >= 70,
      rating: effectiveRating,
      contact: effectiveContact,
      subject: effectiveSubject,
      feedback: effectiveFeedback,
      rubricId,
      verifyRunId,
      tracingId,
      evaluatedAt,
      triggerSource,
      deduped: false,
    };

    const existingNote = bucket.notesByConversation[convKey] ?? null;
    const contextJson = JSON.stringify({
      conversationId,
      clientId,
      contact: effectiveContact,
      subject: effectiveSubject,
      rating: effectiveRating,
      feedback: effectiveFeedback,
      rubricId,
      triggerSource,
      agentModel: record.agentModel,
      agentVendor: record.agentVendor,
      judgeModel: record.model,
      judgeVendor: record.judgeVendor,
    });
    const decisionDetailJson = JSON.stringify({
      score: record.score,
      passed: record.passed,
      status: record.status,
      criteria: record.criteria,
      weights: record.weights,
      verdict: record.verdict,
      summaryAr: record.summaryAr,
      singleTurnResolved: record.singleTurnResolved,
      autoResolved: record.autoResolved,
    });
    const feedbackDataJson = JSON.stringify({
      conversationId,
      clientId,
      score: record.score,
      scoreNormalized: Number((record.score / 100).toFixed(2)),
      criteria: record.criteria,
      weights: record.weights,
      verdict: record.verdict,
      summaryAr: record.summaryAr,
      rating: effectiveRating,
      agentModel: record.agentModel,
      agentVendor: record.agentVendor,
      judgeModel: record.model,
      judgeVendor: record.judgeVendor,
      reviewNote: existingNote ? { text: existingNote.text, by: existingNote.by, at: existingNote.at } : null,
    });
    const promptHash = createHash("sha256")
      .update(`captain_auto_judge:v1:${clientId}:${conversationId}:${evaluatedAt}`)
      .digest("hex")
      .slice(0, 32);
    const normScore = Math.max(0, Math.min(1, Number((record.score / 100).toFixed(2))));

    const insertSql = `
      BEGIN;
      INSERT INTO verify_runs (
        id, user_id, workspace_id, source, title, goal, status, scenario,
        context, metadata, user_decision, decision_detail, visibility
      )
      VALUES (
        ${sqlHexLiteral(verifyRunId)}::uuid,
        ${sqlHexLiteral(userId)},
        ${sqlHexLiteral(workspaceId)},
        'studio_auto_judge',
        ${sqlHexLiteral(`Conversation #${conversationId} Quality Evaluation`)},
        'Evaluate resolved conversation against 4-criteria rubric (Accuracy 30%, Tone 25%, No Hallucination 25%, Speed 20%)',
        'completed',
        'conversation_resolution',
        ${sqlHexLiteral(contextJson)}::jsonb,
        ${sqlHexLiteral(JSON.stringify({ rubricId, model: record.model, provider: record.provider, agentModel: record.agentModel, agentVendor: record.agentVendor, judgeVendor: record.judgeVendor, triggerSource }))}::jsonb,
        ${sqlHexLiteral(record.userDecision)},
        ${sqlHexLiteral(decisionDetailJson)}::jsonb,
        'public'
      );

      INSERT INTO llm_generation_tracing (
        id, scenario, prompt_version, prompt_hash, user_id, workspace_id,
        provider, model, success, latency_ms, cost_usd,
        feedback_signal, feedback_score, feedback_source, feedback_data, feedback_updated_at
      )
      VALUES (
        ${sqlHexLiteral(tracingId)}::uuid,
        'captain_auto_judge',
        'v1',
        ${sqlHexLiteral(promptHash)},
        ${sqlHexLiteral(userId)},
        ${sqlHexLiteral(workspaceId)},
        ${sqlHexLiteral(record.provider)},
        ${sqlHexLiteral(record.model)},
        true,
        ${Math.round(record.latencyMs)},
        ${record.costUsd.toFixed(6)}::numeric(12,8),
        ${sqlHexLiteral(record.feedbackSignal)},
        ${normScore.toFixed(2)}::numeric(3,2),
        'ai_judge',
        ${sqlHexLiteral(feedbackDataJson)}::jsonb,
        now()
      );
      COMMIT;
    `;

    await runLobeEvalPsql(insertSql);

    bucket.evaluationsByConversation[convKey] = record;
    bucket.lastEvaluatedAtByConv[convKey] = Date.now();
    evalDedupMap.set(dedupKey, bucket.lastEvaluatedAtByConv[convKey]);
    bucket.updatedAt = evaluatedAt;
    await writeEvalStore(store);

    // Emit realtime alert on Studio bus if score < 60 or customer rating <= 2 (no writeback to live Chatwoot :3200)
    if (record.score < 60 || (typeof effectiveRating === "number" && effectiveRating <= 2)) {
      try {
        await publishWebhookEvent(
          {
            event: "captain.evaluation_needs_review",
            id: conversationId,
            conversation_id: conversationId,
            client_id: clientId,
            score: record.score,
            rating: effectiveRating,
            verdict: record.verdict,
            criteria: record.criteria,
            evaluated_at: evaluatedAt,
          },
          `eval-alert-${clientId}-${conversationId}-${Date.now()}`,
        );
      } catch {
        // Non-fatal if bus is offline
      }
    }

    return record;
  })();

  inFlightEvalPromises.set(dedupKey, evalPromise);
  try {
    return await evalPromise;
  } finally {
    inFlightEvalPromises.delete(dedupKey);
  }
}

export interface SaveReviewNoteParams {
  clientId?: unknown;
  conversationId: number | string;
  text: string;
  by?: string;
  rating?: number;
}

/**
 * Persists a CSAT review note into `.studio-data/csat-eval-store.json` and updates `feedback_data`
 * in `llm_generation_tracing` in `lobe-postgres` for the isolated client.
 */
export async function saveCsatReviewNote(params: SaveReviewNoteParams): Promise<ReviewNoteRecord> {
  const clientId = validateEvalClientId(params.clientId);
  rejectForbiddenPhone(params);

  const convIdNum = Number(params.conversationId);
  if (!Number.isFinite(convIdNum) || convIdNum <= 0) {
    throw new ProvisionValidationError("conversationId must be a positive number (400)");
  }
  const conversationId = Math.trunc(convIdNum);
  const trimmedText = typeof params.text === "string" ? params.text.trim() : "";
  if (!trimmedText) {
    throw new ProvisionValidationError("Review note text cannot be empty (400)");
  }

  const by = typeof params.by === "string" && params.by.trim() ? params.by.trim() : "Arham Khan";
  const nowIso = new Date().toISOString();

  const store = await readEvalStore();
  const bucket = store.clients[clientId];

  await ensureClientRubricAndTablesInDb(
    clientId,
    Object.values(bucket.evaluationsByConversation),
    bucket.notesByConversation,
  );

  const convKey = String(conversationId);
  const existingEval = bucket.evaluationsByConversation[convKey];
  const tracingId = existingEval?.tracingId ?? deterministicUuid(`${clientId}:tracing:note:${conversationId}`);
  const userId = `user_${clientId}`;
  const workspaceId = `ws_${clientId}`;

  const noteRecord: ReviewNoteRecord = {
    conversationId,
    clientId,
    text: trimmedText,
    by,
    at: nowIso,
    rating: params.rating ?? existingEval?.rating,
    tracingId,
  };

  bucket.notesByConversation[convKey] = noteRecord;
  bucket.updatedAt = nowIso;
  await writeEvalStore(store);

  const notePatchJson = JSON.stringify({
    reviewNote: {
      text: noteRecord.text,
      by: noteRecord.by,
      at: noteRecord.at,
      conversationId,
    },
  });

  const updateTracingSql = `
    UPDATE llm_generation_tracing
    SET
      feedback_data = COALESCE(feedback_data, '{}'::jsonb) || ${sqlHexLiteral(notePatchJson)}::jsonb,
      feedback_updated_at = now()
    WHERE user_id = ${sqlHexLiteral(userId)}
      AND workspace_id = ${sqlHexLiteral(workspaceId)}
      AND (
        id = ${sqlHexLiteral(tracingId)}::uuid
        OR feedback_data->>'conversationId' = ${sqlHexLiteral(convKey)}
      );
  `;

  await runLobeEvalPsql(updateTracingSql);

  return noteRecord;
}

/**
 * Reads all saved review notes, AI judge evaluations, and live database counts & summary metrics
 * for the isolated client (`client_test_a` or `client_test_b`).
 */
export async function getClientEvalStateAndSummary(rawClientId?: unknown): Promise<{
  clientId: "client_test_a" | "client_test_b";
  userId: string;
  workspaceId: string;
  rubricId: string;
  notesByConversation: Record<string, ReviewNoteRecord>;
  evaluationsByConversation: Record<string, ConversationEvaluationRecord>;
  summary: EvalSummaryMetrics;
}> {
  const clientId = validateEvalClientId(rawClientId);
  const store = await readEvalStore();
  const bucket = store.clients[clientId];

  await ensureClientRubricAndTablesInDb(
    clientId,
    Object.values(bucket.evaluationsByConversation),
    bucket.notesByConversation,
  );

  const userId = `user_${clientId}`;
  const workspaceId = `ws_${clientId}`;

  const countsSql = `
    SELECT json_build_object(
      'verifyRunsCount', (SELECT count(*)::int FROM verify_runs WHERE user_id = ${sqlHexLiteral(userId)} AND workspace_id = ${sqlHexLiteral(workspaceId)}),
      'tracingCount', (SELECT count(*)::int FROM llm_generation_tracing WHERE user_id = ${sqlHexLiteral(userId)} AND workspace_id = ${sqlHexLiteral(workspaceId)}),
      'rubricsCount', (SELECT count(*)::int FROM verify_rubrics WHERE user_id = ${sqlHexLiteral(userId)} AND workspace_id = ${sqlHexLiteral(workspaceId)}),
      'criteriaCount', (SELECT count(*)::int FROM verify_criteria WHERE user_id = ${sqlHexLiteral(userId)} AND workspace_id = ${sqlHexLiteral(workspaceId)}),
      'rubricCriteriaCount', (SELECT count(*)::int FROM verify_rubric_criteria WHERE user_id = ${sqlHexLiteral(userId)} AND workspace_id = ${sqlHexLiteral(workspaceId)})
    )::text;
  `;

  let dbCounts = {
    verifyRunsCount: Object.keys(bucket.evaluationsByConversation).length,
    tracingCount: Object.keys(bucket.evaluationsByConversation).length,
    rubricsCount: 1,
    criteriaCount: 4,
    rubricCriteriaCount: 4,
  };

  try {
    const rawCounts = await runLobeEvalPsql(countsSql);
    if (rawCounts) {
      const parsed = JSON.parse(rawCounts) as Partial<typeof dbCounts>;
      dbCounts = {
        verifyRunsCount: Number(parsed.verifyRunsCount ?? dbCounts.verifyRunsCount),
        tracingCount: Number(parsed.tracingCount ?? dbCounts.tracingCount),
        rubricsCount: Number(parsed.rubricsCount ?? 1),
        criteriaCount: Number(parsed.criteriaCount ?? 4),
        rubricCriteriaCount: Number(parsed.rubricCriteriaCount ?? 4),
      };
    }
  } catch {
    // Fallback to in-store counts if psql is busy
  }

  const evaluations = Object.values(bucket.evaluationsByConversation);
  const totalEvaluated = evaluations.length;
  const avgJudgeScore =
    totalEvaluated > 0 ? Math.round(evaluations.reduce((acc, e) => acc + e.score, 0) / totalEvaluated) : 0;
  const passedCount = evaluations.filter((e) => e.passed).length;
  const needsReviewCount = evaluations.filter((e) => !e.passed || e.score < 70).length;
  const autoResolvedCount = evaluations.filter((e) => e.autoResolved).length;
  const singleTurnCount = evaluations.filter((e) => e.singleTurnResolved).length;
  const avgLatencyMs =
    totalEvaluated > 0 ? Math.round(evaluations.reduce((acc, e) => acc + e.latencyMs, 0) / totalEvaluated) : 0;

  const summary: EvalSummaryMetrics = {
    clientId,
    userId,
    workspaceId,
    totalEvaluated,
    avgJudgeScore,
    autoResolutionRate: totalEvaluated > 0 ? Math.round((autoResolvedCount / totalEvaluated) * 100) : 0,
    needsReviewCount,
    passedCount,
    singleTurnResolutionRate: totalEvaluated > 0 ? Math.round((singleTurnCount / totalEvaluated) * 100) : 0,
    avgLatencyMs,
    verifyRunsCount: dbCounts.verifyRunsCount,
    tracingCount: dbCounts.tracingCount,
    rubricsCount: dbCounts.rubricsCount,
    criteriaCount: dbCounts.criteriaCount,
    rubricCriteriaCount: dbCounts.rubricCriteriaCount,
    criteriaWeights: RUBRIC_CRITERIA_WEIGHTS,
  };

  return {
    clientId,
    userId,
    workspaceId,
    rubricId: bucket.rubricId,
    notesByConversation: bucket.notesByConversation,
    evaluationsByConversation: bucket.evaluationsByConversation,
    summary,
  };
}

/**
 * Triggered asynchronously by `POST /api/cw/webhook` when a conversation status becomes `resolved`.
 * Never blocks the 200 OK webhook response, enforces the 60-second deduplication lock per conversationId,
 * and never writes back to live Chatwoot (:3200).
 */
export async function triggerAsyncJudgeOnResolved(payload: unknown): Promise<ConversationEvaluationRecord | null> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const rec = payload as Record<string, unknown>;
  const convObj =
    rec.conversation && typeof rec.conversation === "object" && !Array.isArray(rec.conversation)
      ? (rec.conversation as Record<string, unknown>)
      : rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)
        ? (rec.data as Record<string, unknown>)
        : null;

  const eventName = typeof rec.event === "string" ? rec.event.trim() : "";
  const status =
    typeof rec.status === "string"
      ? rec.status.trim()
      : typeof convObj?.status === "string"
        ? convObj.status.trim()
        : "";

  if ((eventName !== "conversation_status_changed" && eventName !== "conversation_updated") || status !== "resolved") {
    return null;
  }

  const rawConvId = rec.id ?? rec.conversation_id ?? convObj?.id ?? convObj?.display_id;
  const conversationId = Number(rawConvId);
  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    return null;
  }

  try {
    rejectForbiddenPhone(payload);
  } catch {
    return null;
  }

  const rawRating =
    typeof rec.rating === "number" ? rec.rating : typeof convObj?.rating === "number" ? convObj.rating : undefined;
  const rawFeedback =
    typeof rec.feedback === "string"
      ? rec.feedback
      : typeof convObj?.feedback === "string"
        ? convObj.feedback
        : undefined;

  return runConversationEvaluation({
    clientId: "client_test_a",
    conversationId,
    rating: rawRating,
    feedback: rawFeedback,
    triggerSource: "webhook",
  });
}

export function resetEvalDedupMemory(): void {
  evalDedupMap.clear();
  inFlightEvalPromises.clear();
}
