import { NextResponse } from "next/server";

import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const STATE_ROOT = path.join(process.cwd(), ".preview-state", "companies");
const HINDSIGHT_BASE = process.env.HINDSIGHT_URL || "http://127.0.0.1:8888";
const LITELLM_URL = process.env.LITELLM_URL || "http://127.0.0.1:4001/v1/chat/completions";
const LITELLM_KEY_PATH = "/Users/ali/lobehub-hub/agents-home/workers-gpt.key";

export interface ChannelConnection {
  id: string;
  label: string;
  connected: boolean;
  accountName: string;
  connectedAt: string;
  handle?: string;
}

export interface TodayIssue {
  id: string;
  title: string;
  sourceInbox: string;
  discoveredBy: string;
  approvedFix: string;
  updatedAt: string;
  status: "active" | "resolved";
}

export interface EvalCaseResult {
  id: string;
  customerText: string;
  agentReply: string;
  agentName: string;
  politeDodge: boolean;
  angerEscalation: boolean;
  politenessScore: number;
  resolutionScore: number;
  overallScore: number;
  verdictLabel: string;
  verdictTone: "danger" | "warning" | "success";
  explanation: string;
  coachingTip: string;
  axes: {
    understanding: number;
    action: number;
    resolution: number;
    effort: number;
    tone: number;
  };
  createdAt: string;
  evaluatedByModel?: string;
}

export interface StandardRoleMatrix {
  roleId: "owner" | "manager" | "supervisor" | "agent";
  title: string;
  subtitle: string;
  viewConversations: boolean;
  editEmma: boolean;
  viewReports: boolean;
  topUpBalance: boolean;
}

export interface CompanyEngineState {
  companyId: string;
  companyName: string;
  sector: string;
  employeeName: string;
  smartPlan: {
    placed: string[];
    activated: boolean;
    history: { id: string; text: string; time: string }[];
  };
  channels: Record<string, ChannelConnection>;
  memoryBank: {
    isolatedBankId: string;
    hindsightBankUrl: string;
    hindsightConnected: boolean;
    sampleSize: "50" | "100";
    source: string;
    lastLearnedAt: string;
    learnedCount: number;
    learnedStyle: string[];
    ownerRules: string[];
    todayIssues: TodayIssue[];
  };
  balance: {
    ai: {
      available: number;
      spentEvaluation: number;
      spentEmployee: number;
      dayOfMonth: number;
      daysLeft: number;
      batteryPct: number;
    };
    whatsapp: {
      availableCredit: string;
      currency: string;
      remainingConversations: number;
      approvedTemplates: number;
      pendingTemplates: number;
      daysLeft: number;
      batteryPct: number;
    };
  };
  standardRoles: StandardRoleMatrix[];
  evaluations: EvalCaseResult[];
  employee?: Record<string, unknown>;
  evaluator?: Record<string, unknown>;
  build?: Record<string, unknown>;
  notes?: { id: string; text: string; createdAt: string }[];
  smart?: { placed: string[]; activated: boolean; history: { id: string; text: string; time: string }[] };
  humanInbox?: Record<string, { text: string; learned: "approved" | "corrected"; updatedAt: string }>;
}

function sanitizeCompanyId(raw?: string | null): string {
  const cleaned = (raw || "airest-main").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return cleaned || "airest-main";
}

function hindsightBankName(companyId: string): string {
  return `tenant_${sanitizeCompanyId(companyId)}`;
}

async function retainInHindsight(
  companyId: string,
  content: string,
  context: string,
  tags: string[] = [],
): Promise<boolean> {
  const bankId = hindsightBankName(companyId);
  try {
    const res = await fetch(`${HINDSIGHT_BASE}/v1/default/banks/${encodeURIComponent(bankId)}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        async: true,
        items: [
          {
            content,
            context,
            tags: ["captain-engine", `company:${companyId}`, ...tags],
            metadata: { companyId, source: "studio-8820" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function recallFromHindsight(companyId: string, query: string): Promise<string[]> {
  const bankId = hindsightBankName(companyId);
  try {
    const res = await fetch(`${HINDSIGHT_BASE}/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: { text?: string; content?: string }[] };
    return (data.results ?? []).map((r) => r.text || r.content || "").filter(Boolean);
  } catch {
    return [];
  }
}

async function getLiteLLMKey(): Promise<string> {
  if (process.env.LITELLM_API_KEY) return process.env.LITELLM_API_KEY.trim();
  try {
    const raw = await fs.readFile(LITELLM_KEY_PATH, "utf8");
    return raw.trim();
  } catch {
    return "";
  }
}

async function analyzeWithLiteLLM(
  customerText: string,
  agentReply: string,
  baseResult: EvalCaseResult,
): Promise<EvalCaseResult> {
  const key = await getLiteLLMKey();
  if (!key) return baseResult;
  try {
    const prompt = `أنت مقيّم ذكاء اصطناعي خبير في خدمة العملاء. حلل المحادثة التالية بدقة عالية (قراءة ما بين السطور لكشف التهرب اللطيف وتصعيد نبرة الغضب):
رسالة العميل: "${customerText}"
رد الموظف: "${agentReply}"

أجب بصيغة JSON فقط بدون أي نص إضافي:
{"score": رقم من 0 إلى 100, "politeDodge": true أو false, "angerEscalation": true أو false, "verdict": "حكم مختصر بالعربية", "reason": "تفسير دقيق بالعربية", "coachingTip": "نصيحة عملية للموظف بالعربية"}`;

    const res = await fetch(LITELLM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "azure-gpt-6.1-sol",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return baseResult;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return baseResult;
    const parsed = JSON.parse(match[0]) as {
      score?: number;
      politeDodge?: boolean;
      angerEscalation?: boolean;
      verdict?: string;
      reason?: string;
      coachingTip?: string;
    };
    const score =
      typeof parsed.score === "number" ? Math.min(100, Math.max(0, Math.round(parsed.score))) : baseResult.overallScore;
    const politeDodge = typeof parsed.politeDodge === "boolean" ? parsed.politeDodge : baseResult.politeDodge;
    const angerEscalation =
      typeof parsed.angerEscalation === "boolean" ? parsed.angerEscalation : baseResult.angerEscalation;
    return {
      ...baseResult,
      overallScore: score,
      politeDodge,
      angerEscalation,
      verdictLabel: parsed.verdict || baseResult.verdictLabel,
      explanation: parsed.reason || baseResult.explanation,
      coachingTip: parsed.coachingTip || baseResult.coachingTip,
      verdictTone: politeDodge || angerEscalation ? "danger" : score >= 75 ? "success" : "warning",
      evaluatedByModel: "azure-gpt-6.1-sol",
    };
  } catch {
    return baseResult;
  }
}

async function chatWithLiteLLM(params: {
  companyId: string;
  state: CompanyEngineState;
  userText: string;
  history?: { role: "user" | "assistant"; text?: string; content?: string }[];
  mode?: string;
  customPrompt?: string;
  customContext?: string;
  requestedModel?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ reply: string; model: string; latencyMs: number; liveGateway: boolean }> {
  const startedAt = Date.now();
  const key = await getLiteLLMKey();
  const recalled = await recallFromHindsight(params.companyId, params.userText);
  const rulesText = (params.state.memoryBank.ownerRules ?? []).join(" | ");
  const issuesText = (params.state.memoryBank.todayIssues ?? []).map((i) => `${i.title}: ${i.approvedFix}`).join(" | ");
  const recalledText = recalled.length > 0 ? `\nذاكرة Hindsight المسترجعة: ${recalled.slice(0, 3).join(" | ")}` : "";

  const baseSystemPrompt =
    params.customPrompt && params.customPrompt.trim()
      ? `${params.customPrompt.trim()}\n${params.customContext ? `معلومات إضافية: ${params.customContext.trim()}\n` : ""}`
      : params.mode === "evaluator"
        ? `أنت «${params.state.employeeName || "إيمه"}» المقيّم والموظف الذكي لشركة «${params.state.companyName}» في قطاع (${params.state.sector}). تردّ على العميل بلباقة وحل عملي فوري مباشر دون تهرب لطيف أو وعود عائمة.`
        : `أنت «${params.state.employeeName || "إيمه"}» المساعد الذكي لشركة «${params.state.companyName}» في قطاع (${params.state.sector}).`;

  const systemContent = `${baseSystemPrompt}
قواعد الشركة المعتمدة: ${rulesText}
حلول مشكلات اليوم: ${issuesText}${recalledText}
أجب باللغة العربية باختصار ووضوح وبأسلوب بشري مباشر يحل طلب العميل فوراً.`;

  const priorMessages = (params.history ?? [])
    .slice(-10)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.text ?? m.content ?? "").trim(),
    }))
    .filter((m) => m.content.length > 0);

  const messages = [
    { role: "system" as const, content: systemContent },
    ...priorMessages,
    { role: "user" as const, content: params.userText },
  ];

  if (key) {
    for (const candidateModel of ["azure-gpt-6.1-sol", "azure-deepseek-v4.1-flash"]) {
      try {
        const res = await fetch(LITELLM_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: candidateModel,
            messages,
            max_tokens: params.maxTokens ? Math.min(2048, Math.max(128, params.maxTokens)) : 500,
            ...(typeof params.temperature === "number" ? { temperature: params.temperature } : {}),
            ...(candidateModel.includes("gpt") ? { reasoning_effort: "low" } : {}),
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            model?: string;
            choices?: { message?: { content?: string } }[];
          };
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) {
            return {
              reply,
              model: data.model || candidateModel,
              latencyMs: Math.max(1, Date.now() - startedAt),
              liveGateway: true,
            };
          }
        }
      } catch {
        // Fall through to next candidate model
      }
    }
  }

  return {
    reply: "",
    model: "",
    latencyMs: Math.max(1, Date.now() - startedAt),
    liveGateway: false,
  };
}

function defaultState(companyId: string): CompanyEngineState {
  const bankId = hindsightBankName(companyId);
  return {
    companyId,
    companyName: companyId === "airest-main" ? "شركة فهد الرئيسية" : `شركة معزولة (${companyId})`,
    sector: "معرض سيارات",
    employeeName: "إيمه",
    smartPlan: {
      placed: ["whatsapp", "instagram", "email", "webchat", "hours", "tone"],
      activated: false,
      history: [
        { id: "h-1", text: `تم تهيئة العزل الكامل لذاكرة الشركة في بنك Hindsight (${bankId})`, time: "قبل قليل" },
      ],
    },
    channels: {
      whatsapp: {
        id: "whatsapp",
        label: "واتساب للأعمال",
        connected: true,
        accountName: "+974 5500 1234 · واتساب الرسمي",
        connectedAt: "متصل",
      },
      instagram: {
        id: "instagram",
        label: "إنستغرام",
        connected: true,
        accountName: "@airest_official",
        connectedAt: "متصل",
      },
      messenger: {
        id: "messenger",
        label: "فيسبوك ماسنجر",
        connected: false,
        accountName: "",
        connectedAt: "",
      },
      facebook: {
        id: "facebook",
        label: "صفحة فيسبوك",
        connected: false,
        accountName: "",
        connectedAt: "",
      },
      tiktok: {
        id: "tiktok",
        label: "تيك توك للأعمال",
        connected: false,
        accountName: "",
        connectedAt: "",
      },
      email: {
        id: "email",
        label: "البريد الإلكتروني",
        connected: true,
        accountName: "support@company.com",
        connectedAt: "متصل",
      },
      webchat: {
        id: "webchat",
        label: "محادثة الموقع المباشرة",
        connected: true,
        accountName: "https://your-store.com",
        connectedAt: "متصل",
      },
    },
    memoryBank: {
      isolatedBankId: bankId,
      hindsightBankUrl: `${HINDSIGHT_BASE}/v1/default/banks/${bankId}/memories`,
      hindsightConnected: false,
      sampleSize: "50",
      source: "inboxes",
      lastLearnedAt: "الآن",
      learnedCount: 0,
      learnedStyle: [
        "الترحيب المختصر الدافئ بلهجة بشرية طبيعية دون تملق آلي أو تكرار جمل معلبة",
        "التريث الطبيعي (٢ إلى ٤ ثوانٍ) ومراجعة حالة الطلب قبل كتابة الجواب",
        "ذكر الحل العملي مباشرة وتجنب سؤال العميل عن معلومات أرسلها للتو",
      ],
      ownerRules: [
        "لا تذكر أبداً أنك روبوت، وتعامل بوعي ومهنية كموظف حقيقي في الشركة",
        "عند وجود خلل عام في منتج اليوم، اعتذر بوضوح وطبّق الحل المعتمد من صندوق الموظفين فوراً",
      ],
      todayIssues: [
        {
          id: "iss-1",
          title: "تأخر تحديث بوليصة الشحن السريع لبعض طلبات الصباح",
          sourceInbox: "صندوق المبيعات وواتساب",
          discoveredBy: "سارة العتيبي (تكرر في 6 محادثات اليوم)",
          approvedFix: "إرسال رابط التتبع المباشر للعميل وتأكيد وصول المندوب الليلة دون الحاجة لإعادة الطلب.",
          updatedAt: "تم التحديث قبل 15 دقيقة",
          status: "active",
        },
        {
          id: "iss-2",
          title: "استفسارات تقسيط الدفعة الأولى على البطاقات الائتمانية",
          sourceInbox: "صندوق الفوترة",
          discoveredBy: "خالد المنصوري (تكرر في 4 محادثات اليوم)",
          approvedFix: "توضيح أن التقسيط متاح على 4 دفعات بلا فوائد وإرسال رابط التفعيل الفوري.",
          updatedAt: "تم التحديث اليوم",
          status: "active",
        },
      ],
    },
    balance: {
      ai: {
        available: 12480,
        spentEvaluation: 2140,
        spentEmployee: 1380,
        dayOfMonth: 18,
        daysLeft: 63,
        batteryPct: 78,
      },
      whatsapp: {
        availableCredit: "1,450",
        currency: "ر.س",
        remainingConversations: 3850,
        approvedTemplates: 16,
        pendingTemplates: 2,
        daysLeft: 48,
        batteryPct: 82,
      },
    },
    standardRoles: [
      {
        roleId: "owner",
        title: "المالك (Owner)",
        subtitle: "صلاحية كاملة على الشركة، القنوات، إيمه، التقارير، وشحن الرصيد",
        viewConversations: true,
        editEmma: true,
        viewReports: true,
        topUpBalance: true,
      },
      {
        roleId: "manager",
        title: "المدير (Manager)",
        subtitle: "إدارة الفريق، تعديل إيمه، ومراجعة التقارير وتنبيهات التهرب",
        viewConversations: true,
        editEmma: true,
        viewReports: true,
        topUpBalance: false,
      },
      {
        roleId: "supervisor",
        title: "المشرف (Supervisor)",
        subtitle: "متابعة المحادثات اليومية وتقارير جودة الموظفين دون تعديل الفوترة",
        viewConversations: true,
        editEmma: false,
        viewReports: true,
        topUpBalance: false,
      },
      {
        roleId: "agent",
        title: "الموظف (Agent)",
        subtitle: "الرد على محادثات العملاء في الصناديق المخصصة له فقط",
        viewConversations: true,
        editEmma: false,
        viewReports: false,
        topUpBalance: false,
      },
    ],
    evaluations: [
      {
        id: "ev-dodge-1",
        customerText: "مرحبا كيف الحال لدي مشكلة في هاتفي، وهذه الخدمة لا تعمل منذ الصباح.",
        agentReply: "أهلاً وسهلاً بك يا مرحبا أنت تؤمر وتدلل، جرب تطفي التلفون وتشغله مرة ثانية وإن شاء الله يضبط.",
        agentName: "حمد المري",
        politeDodge: true,
        angerEscalation: false,
        politenessScore: 94,
        resolutionScore: 12,
        overallScore: 34,
        verdictLabel: "تهرب لطيف مرفوض (طرد خفي للعميل)",
        verdictTone: "danger",
        explanation:
          "الموظف استخدم عبارات ترحيب معسولة («تؤمر وتدلل»)، لكنه صرف العميل بحل سطحي («أطفئ الهاتف») دون فحص الخدمة أو نقل المشكلة للقسم المختص، مما سيجبر العميل على التواصل مجدداً وهو غاضب.",
        coachingTip: "وجّه الموظف لفحص حالة الخدمة فعلياً في النظام وتنفيذ الحل قبل إغلاق المحادثة.",
        axes: {
          understanding: 25,
          action: 10,
          resolution: 12,
          effort: 20,
          tone: 94,
        },
        createdAt: "قبل 20 دقيقة",
      },
      {
        id: "ev-anger-1",
        customerText: "لقد تأخرتم جداً! أين أنتم؟ هذه ثالث مرة أتواصل معكم اليوم ولا أحد يحل المشكلة!",
        agentReply: "سأحولك لقسم آخر الآن.",
        agentName: "عمر الشحي",
        politeDodge: true,
        angerEscalation: true,
        politenessScore: 40,
        resolutionScore: 15,
        overallScore: 22,
        verdictLabel: "تصعيد غضب حاد + تحويل بلا حل",
        verdictTone: "danger",
        explanation:
          "رصد المقيّم نبرة غضب متصاعدة من العميل («تأخرتم، أين أنتم، ثالث مرة»)، ومع ذلك قام الموظف بتحويله آلياً دون تهدئته أو تسليم ملخص المشكلة للمشرف.",
        coachingTip: "عند رصد تكرار الشكوى أو الغضب، يجب التدخل الفوري بحل موثق وإشعار المشرف المناوب.",
        axes: {
          understanding: 30,
          action: 15,
          resolution: 15,
          effort: 10,
          tone: 40,
        },
        createdAt: "قبل ساعة",
      },
      {
        id: "ev-good-1",
        customerText: "مرحبا، الخدمة متوقفة في خطي منذ ساعة وأحتاجها للعمل ضروري.",
        agentReply:
          "أهلاً بك، فحصت خطك الآن ووجدت تعليقاً في باقة البيانات وأعدت تنشيطها فوراً من النظام. جرب الآن وأنا معك على الخط للتأكد.",
        agentName: "مريم الكواري",
        politeDodge: false,
        angerEscalation: false,
        politenessScore: 92,
        resolutionScore: 96,
        overallScore: 95,
        verdictLabel: "حل حقيقي كامل بأسلوب بشري",
        verdictTone: "success",
        explanation: "فهمت المشكلة من أول رسالة، وفحصت النظام فعلياً، وأنجزت الحل دون مماطلة أو تملق فارغ.",
        coachingTip: "أداء نموذجي يجمع بين اللباقة والحل الجذري الفوري من أول رد.",
        axes: {
          understanding: 96,
          action: 95,
          resolution: 96,
          effort: 94,
          tone: 92,
        },
        createdAt: "قبل ساعتين",
      },
    ],
    employee: {
      name: "إيمه",
      sector: "cars",
      terms: [
        "الرد بأسلوب بشري طبيعي قريب من فريق المبيعات والدعم",
        "قراءة صناديق الموظفين واكتشاف المشاكل المتكررة يومياً",
      ],
      agreed: false,
      does: { add: true, suggest: true, learn: true },
      auto: false,
      work: { human: true, learn: true, review: true },
      size: "50",
      source: "inboxes",
      pick: "",
      handoff: "إضافة تلقائية للموظفين",
      active: true,
      launched: false,
    },
    evaluator: {
      enabled: true,
    },
    build: {
      brainMode: "emma",
      provider: "openai",
      model: "gpt-4.1-mini",
      prompt: "",
      context: "",
      memory: "10",
      temperature: 0.7,
      maxLength: "512",
      connected: true,
    },
    notes: [],
  };
}

async function readCompanyState(companyId: string): Promise<CompanyEngineState> {
  const id = sanitizeCompanyId(companyId);
  const file = path.join(STATE_ROOT, `${id}.json`);
  const defaults = defaultState(id);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<CompanyEngineState>;
    return {
      ...defaults,
      ...parsed,
      companyId: id,
      channels: {
        ...defaults.channels,
        ...(parsed.channels ?? {}),
      },
      memoryBank: {
        ...defaults.memoryBank,
        ...(parsed.memoryBank ?? {}),
        isolatedBankId: hindsightBankName(id),
        hindsightBankUrl: `${HINDSIGHT_BASE}/v1/default/banks/${hindsightBankName(id)}/memories`,
      },
      standardRoles: parsed.standardRoles ?? defaults.standardRoles,
      employee: {
        ...(defaults.employee ?? {}),
        ...(parsed.employee ?? {}),
      },
      evaluator: {
        ...(defaults.evaluator ?? {}),
        ...(parsed.evaluator ?? {}),
      },
      build: {
        ...(defaults.build ?? {}),
        ...(parsed.build ?? {}),
      },
      notes: Array.isArray(parsed.notes) ? parsed.notes : (defaults.notes ?? []),
    };
  } catch {
    await writeCompanyState(id, defaults);
    return defaults;
  }
}

async function writeCompanyState(companyId: string, state: CompanyEngineState): Promise<void> {
  const id = sanitizeCompanyId(companyId);
  await fs.mkdir(STATE_ROOT, { recursive: true });
  const file = path.join(STATE_ROOT, `${id}.json`);
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
}

export function analyzeEvaluation(
  customerText: string,
  agentReply: string,
  agentName = "موظف الاختبار",
): EvalCaseResult {
  const c = customerText.trim();
  const r = agentReply.trim();

  const angerWords = [
    "تاخرتم",
    "تأخرتم",
    "اين انتم",
    "أين أنتم",
    "ثالث مرة",
    "غاضب",
    "سيء",
    "مهزلة",
    "ولا احد",
    "ولا أحد",
    "انتظر منذ",
    "أريد المدير",
    "اريد المدير",
    "لم يحل",
  ];
  const sweetWords = [
    "تؤمر",
    "تدلل",
    "يا مرحبا",
    "اهلا وسهلا",
    "أهلاً وسهلاً",
    "حبيبي",
    "عيوني",
    "غالي",
    "أبشر طال عمرك",
    "ابشر طال عمرك",
    "ولا يهمك",
  ];
  const dodgePhrases = [
    "جرب تطفي",
    "طفي التلفون",
    "أعد تشغيل",
    "حولك",
    "سأحولك",
    "ليست من مهامي",
    "قسم آخر",
    "القسم المختص",
    "بنشوف الموضوع",
    "لاحقاً",
    "قريباً",
  ];
  const realActionWords = [
    "فحصت",
    "عدلت",
    "أرسلت",
    "فعّلت",
    "تأكدت من النظام",
    "أعدت المبلغ",
    "ربطت",
    "تم حل",
    "أعدت تنشيط",
  ];

  const hasAnger = angerWords.some((w) => c.includes(w));
  const hasSweet = sweetWords.some((w) => r.includes(w));
  const hasDodge = dodgePhrases.some((w) => r.includes(w));
  const hasRealAction = realActionWords.some((w) => r.includes(w));

  const politeDodge = (hasSweet && hasDodge && !hasRealAction) || (hasDodge && !hasRealAction);
  const politenessScore = hasSweet ? 94 : hasRealAction ? 90 : 65;
  const resolutionScore = politeDodge ? 14 : hasRealAction ? 95 : hasAnger ? 35 : 78;
  const overallScore = politeDodge
    ? Math.round(resolutionScore * 0.75 + politenessScore * 0.25)
    : Math.round(resolutionScore * 0.65 + politenessScore * 0.35);

  let verdictLabel = "معالجة متوازنة";
  let verdictTone: "danger" | "warning" | "success" = "success";
  let explanation = "الرد يعالج استفسار العميل بوضوح ودون تهرب.";
  let coachingTip = "استمر على هذا النهج المباشر في تقديم الحلول الموثقة للعميل.";

  if (politeDodge && hasAnger) {
    verdictLabel = "خطر مزدوج: تصعيد غضب + تهرب من الحل";
    verdictTone = "danger";
    explanation = "العميل في حالة غضب وتصعيد، والرد يتهرب من المعالجة الفعلية بدل التدخل الفوري وحل أصل المشكلة.";
    coachingTip = "يجب التدخل الفوري لتهدئة العميل وتنفيذ الإجراء في النظام دون إحالته لقسم مجهول.";
  } else if (politeDodge) {
    verdictLabel = "سلبي — تهرب لطيف من معالجة المشكلة";
    verdictTone = "danger";
    explanation = "رد مؤدب ظاهرياً («أبشر طال عمرك / تؤمر وتدلل») لكنه خلا من أي إجراء عملي أو حل فعلي لمشكلة العميل.";
    coachingTip = "وجّه الموظف لتنفيذ خطوة عملية واضحة في نفس الرسالة بدل الوعود العائمة أو الإحالة المبهمة.";
  } else if (hasAnger && !hasRealAction) {
    verdictLabel = "تصعيد نبرة غضب يحتاج تدخلاً فورياً";
    verdictTone = "warning";
    explanation = "نبرة العميل حادة بسبب التأخير أو تكرار التواصل، والرد لم يقدم إثباتاً عملياً ينهي سبب الغضب.";
    coachingTip = "اعتذر عن التأخير بوضوح وقدّم حلاً عملياً فورياً ينهي معاناة العميل.";
  } else if (hasRealAction) {
    verdictLabel = "إيجابي — حل حقيقي موثق بأسلوب بشري";
    verdictTone = "success";
    explanation = "الرد جمع بين الاحترام والفعل المباشر في النظام لحل المشكلة من جذورها دون مماطلة.";
    coachingTip = "أداء ممتاز! تم إنجاز الحل الفعلي وتوثيقه للعميل من أول رد.";
  }

  return {
    id: `ev-${Date.now()}`,
    customerText: c,
    agentReply: r,
    agentName,
    politeDodge,
    angerEscalation: hasAnger,
    politenessScore,
    resolutionScore,
    overallScore,
    verdictLabel,
    verdictTone,
    explanation,
    coachingTip,
    axes: {
      understanding: politeDodge ? 28 : hasRealAction ? 95 : 75,
      action: politeDodge ? 12 : hasRealAction ? 96 : 70,
      resolution: resolutionScore,
      effort: politeDodge ? 18 : hasRealAction ? 92 : 74,
      tone: politenessScore,
    },
    createdAt: "الآن",
    evaluatedByModel: "captain-hybrid-sol",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = sanitizeCompanyId(searchParams.get("companyId") || request.headers.get("x-company-id"));
  const state = await readCompanyState(companyId);
  const recalled = await recallFromHindsight(companyId, "أسلوب الشركة وقواعد المالك ومشكلات اليوم");
  const evals = state.evaluations ?? [];
  const dodgeCount = evals.filter((e) => e.politeDodge).length;
  const angerCount = evals.filter((e) => e.angerEscalation).length;
  const connectedChannelsCount = Object.values(state.channels ?? {}).filter((c) => c.connected).length;
  const dynamicLearnedCount =
    recalled.length +
    (state.memoryBank.ownerRules?.length ?? 0) +
    (state.memoryBank.todayIssues?.length ?? 0) +
    evals.length +
    (state.smartPlan.history?.length ?? 0);
  const humanInboxLearned = Object.keys(state.humanInbox ?? {}).length;
  state.memoryBank.hindsightConnected = recalled.length > 0;
  state.memoryBank.learnedCount = dynamicLearnedCount + humanInboxLearned;
  state.smart = state.smartPlan;

  const totalConversations = Math.max(
    evals.length,
    Math.round((state.balance.ai.spentEmployee + state.balance.ai.spentEvaluation) / 3),
  );
  const resolvedRatio = evals.length > 0 ? Math.max(0.55, (evals.length - dodgeCount) / evals.length) : 0.71;
  const autoResolved = Math.round(totalConversations * resolvedRatio);
  const handedOff = Math.max(0, totalConversations - autoResolved);

  return NextResponse.json({
    ok: true,
    hindsightConnected: state.memoryBank.hindsightConnected,
    learnedCount: dynamicLearnedCount,
    state,
    liveStats: {
      totalConversations,
      autoResolved,
      handedOff,
      autoResolvePct: Math.round(resolvedRatio * 100),
      dodgeCount,
      angerCount,
      connectedChannelsCount,
      learnedCount: dynamicLearnedCount,
      issuesCount: state.memoryBank.todayIssues?.length ?? 0,
    },
    hindsight: {
      bankId: hindsightBankName(companyId),
      endpoint: `${HINDSIGHT_BASE}/v1/default/banks/${hindsightBankName(companyId)}/memories`,
      recalledCount: recalled.length,
      recalledPreview: recalled.slice(0, 3),
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = sanitizeCompanyId(
    (body.companyId as string) || request.headers.get("x-company-id") || "airest-main",
  );
  const state = await readCompanyState(companyId);
  const action = String(body.action || "");

  if (action === "connect-channel" || action === "channel.connect") {
    const channelId = String(body.channelId || "whatsapp");
    const handle = typeof body.handle === "string" ? body.handle.trim() : "";
    const label = String(body.label || state.channels[channelId]?.label || channelId);
    const accountName = String(
      body.accountName || handle || state.channels[channelId]?.accountName || `حساب ${label} الرسمي`,
    );
    const isConnected = body.connected !== false;
    state.channels[channelId] = {
      id: channelId,
      label,
      connected: isConnected,
      accountName,
      handle: handle || state.channels[channelId]?.handle || accountName,
      connectedAt: isConnected ? "متصل الآن" : "غير متصل",
    };
    if (isConnected && !state.smartPlan.placed.includes(channelId)) {
      state.smartPlan.placed.push(channelId);
    }
    state.smartPlan.history.unshift({
      id: `h-${Date.now()}`,
      text: `تم ربط قناة «${label}» (${accountName}) وتفعيل «${state.employeeName}» عليها بنجاح`,
      time: "الآن",
    });
    const hindsightRetained = await retainInHindsight(
      companyId,
      `تم ربط قناة ${label} (${accountName}) للشركة ${companyId}`,
      "channel-connection",
      ["channel", channelId],
    );
    await writeCompanyState(companyId, state);
    return NextResponse.json({
      ok: true,
      action,
      channel: state.channels[channelId],
      channels: state.channels,
      hindsightRetained,
      state,
    });
  }

  if (action === "smart-update" || action === "smart.update" || action === "smart.save") {
    if (Array.isArray(body.placed)) {
      state.smartPlan.placed = body.placed.map(String);
    }
    if (typeof body.activated === "boolean") {
      state.smartPlan.activated = body.activated;
    }
    state.smart = state.smartPlan;
    const entryText =
      typeof body.historyEntry === "string" && body.historyEntry.trim()
        ? body.historyEntry.trim()
        : `تحديث خطة كل شيء سمارت: العناصر (${state.smartPlan.placed.join("، ") || "بداية جديدة"}) · التفعيل: ${state.smartPlan.activated ? "مفعّل" : "قيد الإعداد"}`;
    state.smartPlan.history.unshift({
      id: `h-${Date.now()}`,
      text: entryText,
      time: "الآن",
    });
    const hindsightRetained = await retainInHindsight(companyId, entryText, "emma-smart-plan", ["smart-plan"]);
    state.memoryBank.hindsightConnected = hindsightRetained;
    await writeCompanyState(companyId, state);
    return NextResponse.json({ ok: true, action, hindsightRetained, state });
  }

  if (action === "inbox.learn") {
    const convId = String(body.convId || "c1");
    const lineId = String(body.lineId || "c1-2");
    const text = String(body.text || "").trim();
    const learned: "approved" | "corrected" = body.learned === "corrected" ? "corrected" : "approved";
    const customerText = String(body.customerText || "").trim();
    state.humanInbox = state.humanInbox ?? {};
    state.humanInbox[`${convId}:${lineId}`] = {
      text,
      learned,
      updatedAt: new Date().toISOString(),
    };
    const styleNote =
      learned === "corrected"
        ? `تصحيح رد إيمه في المحادثة (${convId}): "${text}"${customerText ? ` رداً على "${customerText}"` : ""}`
        : `اعتماد أسلوب إيمه في المحادثة (${convId}): "${text}"`;
    state.memoryBank.learnedStyle = [styleNote, ...(state.memoryBank.learnedStyle ?? [])].slice(0, 30);
    state.memoryBank.learnedCount = (state.memoryBank.learnedCount ?? 0) + 1;
    state.memoryBank.lastLearnedAt = "الآن (محفوظ في بنك Hindsight المعزول)";
    const hindsightRetained = await retainInHindsight(companyId, styleNote, "human-inbox-learning", [
      "human-inbox",
      learned,
      convId,
    ]);
    state.memoryBank.hindsightConnected = hindsightRetained;
    await writeCompanyState(companyId, state);
    return NextResponse.json({
      ok: true,
      action,
      learnedEntry: state.humanInbox[`${convId}:${lineId}`],
      hindsightRetained,
      state,
    });
  }

  if (action === "balance.topup") {
    const addedPoints = Math.max(0, Number(body.points || body.credits || 0));
    if (addedPoints > 0) {
      state.balance.ai.available += addedPoints;
      const perDay = Math.max(
        1,
        (state.balance.ai.spentEvaluation + state.balance.ai.spentEmployee) /
          Math.max(1, state.balance.ai.dayOfMonth || 18),
      );
      state.balance.ai.daysLeft = Math.max(1, Math.round(state.balance.ai.available / perDay));
      state.balance.ai.batteryPct = Math.min(100, Math.max(15, Math.round((state.balance.ai.daysLeft / 60) * 100)));
      await retainInHindsight(
        companyId,
        `تم شحن رصيد الذكاء الاصطناعي بـ ${addedPoints} نقطة للشركة ${companyId}`,
        "balance-topup",
        ["balance", "topup"],
      );
      await writeCompanyState(companyId, state);
    }
    return NextResponse.json({ ok: true, action, balance: state.balance, state });
  }

  if (action === "employee.save") {
    const incomingEmp =
      body.employee && typeof body.employee === "object" ? (body.employee as Record<string, unknown>) : {};
    state.employee = {
      ...(state.employee ?? {}),
      ...incomingEmp,
      updatedAt: new Date().toISOString(),
    };
    if (typeof incomingEmp.name === "string" && incomingEmp.name.trim()) {
      state.employeeName = incomingEmp.name.trim();
    }
    if (typeof incomingEmp.sector === "string" && incomingEmp.sector.trim()) {
      state.sector = incomingEmp.sector.trim();
    }
    const size = (incomingEmp.size ?? body.sampleSize) === "50" ? "50" : "100";
    const source = String(incomingEmp.source || body.source || state.memoryBank.source || "inboxes");
    state.memoryBank.sampleSize = size;
    state.memoryBank.source = source;
    if (Array.isArray(incomingEmp.terms) && incomingEmp.terms.length > 0) {
      state.memoryBank.ownerRules = incomingEmp.terms.map(String);
    }

    const retained = await retainInHindsight(
      companyId,
      `تم حفظ إعدادات موظف الذكاء البشري (${state.employeeName}) في قطاع (${state.sector}) بعدد بنود (${Array.isArray(incomingEmp.terms) ? incomingEmp.terms.length : 0}) وحالة التشغيل (${incomingEmp.active ? "نشط" : "متوقف"}).`,
      "employee-settings",
      ["employee", "save"],
    );
    state.memoryBank.hindsightConnected = retained;
    await writeCompanyState(companyId, state);
    return NextResponse.json({
      ok: true,
      action,
      employee: state.employee,
      hindsightRetained: retained,
      state,
    });
  }

  if (action === "learn-conversations" || action === "employee.learn") {
    const requestedLimit = Number(body.sampleSize || body.size) === 50 ? 50 : 100;
    const size = requestedLimit === 50 ? "50" : "100";
    const source = String(body.source || state.memoryBank.source || "inboxes");
    const sector = String(body.sector || state.sector || "معرض سيارات");
    state.sector = sector;
    state.memoryBank.sampleSize = size;
    state.memoryBank.source = source;

    const recalledMemories = await recallFromHindsight(companyId, "محادثات العملاء ومشكلات الصناديق وأسلوب الرد");
    const evalSamples = (state.evaluations ?? []).map(
      (ev) => `العميل: ${ev.customerText} | رد الموظف (${ev.agentName}): ${ev.agentReply} | الحكم: ${ev.verdictLabel}`,
    );
    const corpus = [...evalSamples, ...recalledMemories].slice(0, requestedLimit);
    const actualAnalyzedCount = corpus.length;

    const llmAnalysis = await chatWithLiteLLM({
      companyId,
      state,
      userText: `حلّل هذه السجلات الفعلية (${actualAnalyzedCount} سجل) في قطاع (${sector}) واستخرج أهم المشكلات الحقيقية المتكررة بصيغة JSON فقط كمصفوفة عناصر تحتوي على title وinbox وcount وaction:\n${corpus.join("\n")}`,
      mode: "evaluator",
      maxTokens: 300,
    });

    if (!llmAnalysis.liveGateway || !llmAnalysis.reply) {
      return NextResponse.json(
        { ok: false, error: "تعذر الاتصال ببوابة النماذج الحية لتحليل المحادثات", liveGateway: false },
        { status: 502 },
      );
    }

    let discoveredIssues: { id: string; title: string; inbox: string; count: number; action: string }[] = [];
    try {
      const match = llmAnalysis.reply.match(/\[.*\]/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          discoveredIssues = parsed.slice(0, 5).map((item: any, idx: number) => ({
            id: `iss-${Date.now()}-${idx + 1}`,
            title: String(item.title || "ملاحظة مستخرجة من السجل الحي"),
            inbox: String(item.inbox || source),
            count: Math.max(1, Number(item.count) || 1),
            action: String(item.action || "review"),
          }));
        }
      }
    } catch {
      discoveredIssues = [];
    }

    state.memoryBank.learnedCount = actualAnalyzedCount;
    state.memoryBank.lastLearnedAt = new Date().toISOString();
    state.balance.ai.available = Math.max(0, state.balance.ai.available - 1);
    state.balance.ai.spentEmployee += 1;

    state.employee = {
      ...(state.employee ?? {}),
      size,
      source,
      analyzedCount: actualAnalyzedCount,
      todayIssues: discoveredIssues,
      lastLearnedAt: new Date().toISOString(),
      model: llmAnalysis.model,
      latencyMs: llmAnalysis.latencyMs,
    };

    const retained = await retainInHindsight(
      companyId,
      `تحليل حي لعدد ${actualAnalyzedCount} سجل محادثة فعلي في قطاع ${sector} عبر النموذج ${llmAnalysis.model}`,
      "employee-learning",
      ["employee", `analyzed:${actualAnalyzedCount}`],
    );
    state.memoryBank.hindsightConnected = retained;
    await writeCompanyState(companyId, state);
    return NextResponse.json({
      ok: true,
      action,
      analyzedCount: actualAnalyzedCount,
      model: llmAnalysis.model,
      latencyMs: llmAnalysis.latencyMs,
      hindsightRetained: retained,
      state,
    });
  }

  if (action === "evaluator.save") {
    const incomingEval =
      body.evaluator && typeof body.evaluator === "object" ? (body.evaluator as Record<string, unknown>) : {};
    state.evaluator = {
      ...(state.evaluator ?? {}),
      ...incomingEval,
      updatedAt: new Date().toISOString(),
    };
    const retained = await retainInHindsight(
      companyId,
      `تم حفظ إعدادات مقيّم الذكاء للشركة ${companyId} (حالة التفعيل: ${incomingEval.enabled !== false ? "يعمل" : "متوقف"})`,
      "evaluator-settings",
      ["evaluator", "save"],
    );
    await writeCompanyState(companyId, state);
    return NextResponse.json({
      ok: true,
      action,
      evaluator: state.evaluator,
      hindsightRetained: retained,
      state,
    });
  }

  if (action === "evaluator.note") {
    const noteText = String(body.note || body.text || "").trim();
    if (!noteText) {
      return NextResponse.json({ ok: false, error: "النص مطلوب" }, { status: 400 });
    }
    const noteEntry = {
      id: `note-${Date.now()}`,
      text: noteText,
      createdAt: new Date().toISOString(),
    };
    state.notes = [noteEntry, ...(state.notes ?? [])].slice(0, 50);
    await retainInHindsight(companyId, `ملاحظة للإدارة في نظام التقييم: ${noteText}`, "evaluator-note", [
      "evaluator",
      "note",
    ]);
    await writeCompanyState(companyId, state);
    return NextResponse.json({ ok: true, action, note: noteEntry, notes: state.notes, state });
  }

  if (action === "build.save" || action === "build.test") {
    const incomingBuild = body.build && typeof body.build === "object" ? (body.build as Record<string, unknown>) : {};
    const startedAt = Date.now();
    let liveTestOk = true;
    let modelUsed = String(incomingBuild.model || state.build?.model || "azure-gpt-6.1-sol");

    if (action === "build.test" || body.testConnection === true) {
      const chatRes = await chatWithLiteLLM({
        companyId,
        state,
        userText: "اختبار اتصال سريع",
        mode: "build",
        customPrompt: String(incomingBuild.prompt || state.build?.prompt || ""),
        customContext: String(incomingBuild.context || state.build?.context || ""),
        requestedModel: modelUsed,
        maxTokens: 60,
      });
      liveTestOk = Boolean(chatRes.reply);
      modelUsed = chatRes.model;
    }

    const latencyMs = Math.max(12, Date.now() - startedAt);
    state.build = {
      ...(state.build ?? {}),
      ...incomingBuild,
      connected: liveTestOk,
      verifiedModel: modelUsed,
      latencyMs,
      updatedAt: new Date().toISOString(),
    };
    await retainInHindsight(
      companyId,
      `تم حفظ واختبار إعدادات «اربط ذكاءك» للشركة ${companyId} (النموذج: ${modelUsed})`,
      "build-ai-settings",
      ["build", "save"],
    );
    await writeCompanyState(companyId, state);
    return NextResponse.json({
      ok: true,
      action,
      build: state.build,
      latencyMs,
      model: modelUsed,
      state,
    });
  }

  if (
    action === "chat" ||
    action === "try-me.chat" ||
    action === "test-chat.send" ||
    action === "evaluator.chat" ||
    action === "build.chat"
  ) {
    const userText = String(body.message || body.text || body.customerText || "").trim();
    if (!userText) {
      return NextResponse.json({ ok: false, error: "الرسالة مطلوبة" }, { status: 400 });
    }
    const mode =
      action === "try-me.chat" || action === "evaluator.chat" || body.mode === "evaluator" ? "evaluator" : "build";
    const history = Array.isArray(body.history)
      ? (body.history as { role: "user" | "assistant"; text?: string; content?: string }[])
      : Array.isArray(body.messages)
        ? (body.messages as { role: "user" | "assistant"; text?: string; content?: string }[])
        : [];

    const chatRes = await chatWithLiteLLM({
      companyId,
      state,
      userText,
      history,
      mode,
      customPrompt: String(body.prompt || state.build?.prompt || ""),
      customContext: String(body.context || state.build?.context || ""),
      requestedModel: String(body.model || state.build?.model || "azure-gpt-6.1-sol"),
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      maxTokens: typeof body.maxLength === "number" ? body.maxLength : undefined,
    });

    const evalSummary = analyzeEvaluation(userText, chatRes.reply, state.employeeName || "إيمه");

    if (!chatRes.liveGateway || !chatRes.reply) {
      return NextResponse.json(
        { ok: false, error: "تعذر الاتصال ببوابة النماذج الحية", liveGateway: false },
        { status: 502 },
      );
    }

    state.balance.ai.available = Math.max(0, state.balance.ai.available - 1);
    if (mode === "evaluator") {
      state.balance.ai.spentEvaluation += 1;
    } else {
      state.balance.ai.spentEmployee += 1;
    }

    await retainInHindsight(
      companyId,
      `محادثة اختبار (${mode}): العميل: "${userText}" | الرد (${chatRes.model}): "${chatRes.reply}"`,
      `live-chat-${mode}`,
      ["chat", mode],
    );
    await writeCompanyState(companyId, state);

    return NextResponse.json({
      ok: true,
      action,
      reply: chatRes.reply,
      model: chatRes.model,
      latencyMs: chatRes.latencyMs,
      liveGateway: chatRes.liveGateway,
      evaluation: {
        score: evalSummary.overallScore,
        verdict: evalSummary.verdictLabel,
        politeDodge: {
          detected: evalSummary.politeDodge,
          reason: evalSummary.explanation,
        },
        angerEscalation: {
          detected: evalSummary.angerEscalation,
          level: evalSummary.angerEscalation ? "high" : "calm",
          reason: evalSummary.angerEscalation ? "رصد كلمات غضب وتكرار شكوى في رسالة العميل." : "نبرة العميل طبيعية.",
        },
        coachingTip: evalSummary.coachingTip,
      },
      state,
    });
  }

  if (action === "evaluate-case" || action === "evaluator.analyze") {
    const customerText = String(body.customerText || body.customerMessage || "");
    const agentReply = String(body.agentReply || "");
    const agentName = String(body.agentName || "موظف خدمة العملاء");
    const baseResult = analyzeEvaluation(customerText, agentReply, agentName);
    const result = await analyzeWithLiteLLM(customerText, agentReply, baseResult);

    state.evaluations.unshift(result);
    state.evaluations = state.evaluations.slice(0, 15);
    await retainInHindsight(
      companyId,
      `تقييم محادثة للموظف ${agentName}: درجة ${result.overallScore}/100 (${result.verdictLabel}) — ${result.explanation}`,
      "evaluator-analysis",
      ["evaluator", result.politeDodge ? "polite-dodge" : "clean"],
    );
    await writeCompanyState(companyId, state);

    return NextResponse.json({
      ok: true,
      result,
      evaluation: {
        score: result.overallScore,
        politeDodge: {
          detected: result.politeDodge,
          reason: result.explanation,
        },
        angerEscalation: {
          detected: result.angerEscalation,
          level: result.angerEscalation ? "high" : "calm",
          reason: result.angerEscalation ? "رصد كلمات غضب وتكرار شكوى في رسالة العميل." : "نبرة العميل طبيعية.",
        },
        verdict: result.verdictLabel,
        coachingTip: result.coachingTip,
        model: result.evaluatedByModel,
      },
      state,
    });
  }

  if (action === "roles.save") {
    if (Array.isArray(body.standardRoles)) {
      state.standardRoles = body.standardRoles as StandardRoleMatrix[];
      await retainInHindsight(
        companyId,
        `تم تحديث مصفوفة الأدوار والصلاحيات القياسية للشركة ${companyId}`,
        "roles-permissions",
        ["roles"],
      );
      await writeCompanyState(companyId, state);
    }
    return NextResponse.json({ ok: true, state });
  }

  return NextResponse.json({ ok: true, state });
}
