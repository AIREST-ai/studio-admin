"use client";
// إعدادات «مقيّم الذكاء» (بنود فهد 12–47، إملاء 2026-10-18 16:09): حالة محلية فقط بلا خادم.
// كل قسم في الصفحة يقرأ ويكتب من هذه الحالة، وشريط الحفظ يظهر حين تختلف عن آخر حفظ.
import * as React from "react";

export interface Rule {
  id: number;
  text: string;
}

export interface TrainItem {
  id: number;
  text: string;
  tone: "pos" | "neg";
  kept: boolean;
}

export interface Route {
  id: number;
  type: string;
  to: string;
}

export interface KnowledgeFile {
  id: number;
  name: string;
  size: string;
}

export const employees = ["حسن", "مريم", "سارة", "خالد", "نورة"];
export const teams = ["فريق الدعم التقني", "فريق المبيعات", "فريق الحسابات"];
export const inboxes = ["واتساب المبيعات", "إنستغرام المتجر", "صفحة فيسبوك", "دردشة الموقع"];
export const labels = ["شكوى", "طلب جديد", "دعم تقني", "استرجاع"];
export const workflows = ["توزيع المحادثات الجديدة", "رد خارج الدوام", "متابعة بعد الإغلاق"];

const initial = {
  enabled: true,
  // أ) المعرفة والتعلم
  files: [
    { id: 1, name: "دليل المنتجات.pdf", size: "2.4 م.ب" },
    { id: 2, name: "سياسة الاسترجاع والاستبدال.docx", size: "180 ك.ب" },
    { id: 3, name: "أسعار الشحن.xlsx", size: "64 ك.ب" },
  ] as KnowledgeFile[],
  liveLearning: true,
  trainCount: "50",
  trainItems: [
    { id: 1, text: "يرحّب بالعميل ويذكر اسمه في أول رد", tone: "pos", kept: true },
    { id: 2, text: "يعطي رقم الطلب وموعد الوصول بوضوح", tone: "pos", kept: false },
    { id: 3, text: "يترك المحادثة بلا رد أكثر من ساعة", tone: "neg", kept: true },
    { id: 4, text: "يعد بالاسترجاع قبل التحقق من الطلب", tone: "neg", kept: false },
    { id: 5, text: "يقترح منتجاً بديلاً عند نفاد الكمية", tone: "pos", kept: false },
  ] as TrainItem[],
  trainRemoved: [] as TrainItem[],
  humanCopy: "all",
  humanCopyPerson: "حسن",
  humanCopyWhat: ["tone", "solve"],
  memory: [{ id: 1, text: "معلومة محفوظة" }] as Rule[],
  // ب) القنوات والوصول
  msgAccess: true,
  msgLevel: "reply",
  msgPerms: ["files", "contact"],
  channels: ["whatsapp", "instagram", "facebook", "web"],
  assign: "all",
  assignInbox: inboxes[0],
  assignLabel: labels[0],
  // ج) الموظفون والرد
  staffScope: "all",
  staff: ["حسن", "مريم"],
  replyTo: "all",
  replyMode: "direct",
  takeOnRequest: true,
  complete: true,
  completeTo: "last",
  routes: [
    { id: 1, type: "دعم تقني", to: "فريق الدعم التقني" },
    { id: 2, type: "أسعار ومبيعات", to: "سارة" },
    { id: 3, type: "شكوى أو استرجاع", to: "مريم" },
  ] as Route[],
  fallback: "auto",
  // د) التوقيت والسلوك
  hoursMode: "custom",
  from: "09:00",
  to: "22:00",
  workflow: workflows[1],
  delay: "10",
  typing: false,
  voice: true,
  // هـ) الشخصية والصلاحيات
  persona: "template",
  personaText: "",
  template: "friendly",
  canLabel: true,
  canMove: true,
  showInbox: true,
  prefsBy: "person",
  prefsPerson: "سارة",
  fullManage: false,
  // و) معايير التقييم
  field: "store",
  problems: [
    { id: 1, text: "تأخر الشحن" },
    { id: 2, text: "استرجاع المبلغ" },
    { id: 3, text: "منتج تالف" },
    { id: 4, text: "صعوبة الدفع" },
  ] as Rule[],
  weak: [
    { id: 1, text: "التهرب من معالجة المشكلة" },
    { id: 2, text: "لا يعرف الإجابة ثم لا يرد" },
    { id: 3, text: "التأخر بالرد" },
    { id: 4, text: "سبب استياء الزبون" },
    { id: 5, text: "التهرب من الجواب" },
    { id: 6, text: "عدم معرفة المعطيات" },
    { id: 7, text: "ترك المحادثة معلقة" },
    { id: 8, text: "ادعاء تذكرة لم يُتحقق منه" },
  ] as Rule[],
  weakReason: true,
  positive: [
    { id: 1, text: "سعادة العميل" },
    { id: 2, text: "معالجة المشكلة فعلياً" },
    { id: 3, text: "فهم ما يحتاجه العميل" },
    { id: 4, text: "الرد بود مع العميل" },
    { id: 5, text: "اقتراحات أفضل" },
    { id: 6, text: "تقييم الوقت" },
  ] as Rule[],
  quality: ["speed", "accuracy", "solve"],
  qualityPct: 80,
  aiShare: "30",
  show: "both",
  limitDay: 50,
  limitWeek: 300,
  limitMonth: 1000,
};

export type EvalSettings = typeof initial;
type Setter = <K extends keyof EvalSettings>(
  key: K,
  value: EvalSettings[K] | ((prev: EvalSettings[K]) => EvalSettings[K]),
) => void;

const Ctx = React.createContext<{
  s: EvalSettings;
  set: Setter;
  saveEvaluatorSettings: (patch: Partial<EvalSettings>) => Promise<boolean>;
} | null>(null);

export function useEval() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useEval outside EvalProvider");
  return ctx;
}

export function useEvalStore() {
  const [saved, setSaved] = React.useState(initial);
  const [s, setS] = React.useState(initial);

  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const ev = res?.state?.evaluator as Partial<EvalSettings> | undefined;
        if (ev && typeof ev === "object") {
          const merged: EvalSettings = { ...initial, ...ev };
          setS(merged);
          setSaved(merged);
        }
      })
      .catch(() => {});
  }, []);

  const set = React.useCallback<Setter>((key, value) => {
    setS((p) => {
      const next = typeof value === "function" ? (value as (v: unknown) => unknown)(p[key]) : value;
      return { ...p, [key]: next };
    });
  }, []);
  const dirty = React.useMemo(() => JSON.stringify(s) !== JSON.stringify(saved), [s, saved]);
  return {
    value: {
      s,
      set,
      saveEvaluatorSettings: async (patch: Partial<EvalSettings>) => {
        try {
          const r = await fetch("/api/captain-engine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: "evaluator", patch }),
          });
          return r.ok;
        } catch {
          return false;
        }
      },
    },
    dirty,
    save: () => setSaved(s),
    reset: () => setS(saved),
  };
}

export const EvalProvider = Ctx.Provider;
