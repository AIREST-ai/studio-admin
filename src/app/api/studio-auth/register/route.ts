import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import { ChatwootError, checkIdentity, EXPECTED_ACCOUNT_ID, gatewayCall } from "@/lib/chatwoot/server";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(100, "الاسم طويل جدًا"),
  email: z.email("البريد الإلكتروني غير صالح").max(254, "البريد الإلكتروني طويل جدًا"),
});

type AgentRecord = { id: number; email: string; name?: string; role: string };

function agentRecords(body: unknown): AgentRecord[] {
  let payload = body;
  if (!Array.isArray(body)) {
    payload = body && typeof body === "object" && "payload" in body ? body.payload : null;
  }
  if (!Array.isArray(payload)) throw new Error("تعذرت قراءة مستخدمي الحساب");
  return payload.filter(
    (agent): agent is AgentRecord =>
      agent !== null &&
      typeof agent === "object" &&
      typeof agent.id === "number" &&
      typeof agent.email === "string" &&
      typeof agent.role === "string",
  );
}

function failureMessage(body: unknown, fallback: string) {
  const safe = scrubSecrets(body);
  if (!safe || typeof safe !== "object") return fallback;
  const fields = safe as { message?: unknown; error?: unknown; errors?: unknown };
  if (typeof fields.message === "string") return fields.message;
  if (typeof fields.error === "string") return fields.error;
  if (Array.isArray(fields.errors)) {
    const messages = fields.errors.filter((message): message is string => typeof message === "string");
    if (messages.length > 0) return messages.join("؛ ");
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  if (process.env.STUDIO_SIGNUP_ENABLED !== "true") {
    return NextResponse.json(
      { error: "signup_disabled", message: "التسجيل الجديد مغلق حاليًا. فتح التسجيل يحتاج إذن مالك الاستوديو." },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "origin_denied", message: "مصدر طلب التسجيل غير مسموح." }, { status: 403 });
  }

  const input = signupSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: "invalid", message: input.error.issues[0].message }, { status: 400 });
  }

  const email = input.data.email.trim().toLowerCase();
  try {
    const identity = await checkIdentity();
    if (identity.accountId !== EXPECTED_ACCOUNT_ID) {
      return NextResponse.json(
        { error: "account_denied", message: "التسجيل غير مسموح خارج حساب الاستوديو المربوط." },
        { status: 403 },
      );
    }

    const before = await gatewayCall("GET", "account-v1", "/agents", "");
    if (before.status !== 200) {
      return NextResponse.json(
        { error: "read_failed", message: failureMessage(before.body, "تعذرت قراءة مستخدمي الحساب؛ لم يُنشأ حساب.") },
        { status: before.status },
      );
    }
    if (agentRecords(before.body).some((agent) => agent.email.toLowerCase() === email)) {
      return NextResponse.json(
        { error: "already_registered", message: "هذا البريد مسجل في الاستوديو بالفعل. لم تُغيّر عضويته أو دوره." },
        { status: 409 },
      );
    }

    const agent = { name: input.data.name, email, role: "agent" };
    const parsed = { agent };
    const created = await gatewayCall("POST", "account-v1", "/agents", "", {
      bytes: new TextEncoder().encode(JSON.stringify(parsed)).buffer,
      contentType: "application/json",
      parsed,
    });
    if (created.status !== 200 && created.status !== 201) {
      return NextResponse.json(
        { error: "registration_failed", message: failureMessage(created.body, "رفضت خدمة الحسابات إنشاء الموظف.") },
        { status: created.status },
      );
    }

    const after = await gatewayCall("GET", "account-v1", "/agents", "");
    const saved =
      after.status === 200 ? agentRecords(after.body).find((record) => record.email.toLowerCase() === email) : null;
    if (saved?.role !== "agent") {
      return NextResponse.json(
        {
          error: "verification_failed",
          message:
            "استقبلت الخدمة طلب الإنشاء، لكن تعذر تأكيد حفظ الموظف ودوره. لا تكرر التسجيل قبل مراجعة مالك الخدمة.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        id: saved.id,
        name: saved.name || input.data.name,
        role: "agent",
        requiresActivation: true,
        message:
          "حُفظ مستخدم موظف في الاستوديو. أكمل دعوة خدمة الحسابات لتفعيل الحساب وتعيين كلمة المرور؛ لم تُنشأ جلسة دخول.",
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "unavailable",
        message: failureMessage(
          error instanceof ChatwootError ? { message: error.message } : null,
          "تعذر تأكيد عملية التسجيل من خدمة الحسابات. راجع مالك الخدمة قبل تكرار المحاولة.",
        ),
      },
      { status: error instanceof ChatwootError ? error.status : 503 },
    );
  }
}
