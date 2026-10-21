"use client";
// صفحة «مقيّم الذكاء» موظفاً (بنود فهد 12–47)، مبسّطة حسب المقترح المدموج (القسم 4): بلا تبويبات،
// مجموعتان بعنوانين صغيرين («إعدادات الموظف» و«تقييم الموظفين»)، وكل قسم عنصر Accordion عنوانه يعرض القيمة
// الحالية. أعلى الصفحة: مفتاح «يعمل»، وزر «جرّبني» يفتح نافذة جانبية، وقائمة فيها المساعدة وملاحظة للإدارة.
// شريط الحفظ يظهر عند أي تغيير فقط.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  AlertTriangle,
  BookOpen,
  CircleHelp,
  ClipboardCheck,
  Clock,
  Dumbbell,
  EllipsisVertical,
  Flame,
  FlaskConical,
  MessageSquareText,
  Radio,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DirectionProvider } from "@/components/ui/direction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { CaptainShell } from "../../_components/shared";
import { ChannelsSection, channelsSummary } from "./group-channels";
import { CriteriaSection, criteriaSummary, LimitsSection, limitsSummary } from "./group-criteria";
import { KnowledgeSection, knowledgeSummary, TrainingSection, trainingSummary } from "./group-knowledge";
import { PersonaSection, personaSummary } from "./group-persona";
import { TimingSection, timingSummary } from "./group-timing";
import { EvalProvider, useEvalStore } from "./state";
import { TryMeSheet } from "./try-me";
import { SettingsSection } from "./ui";

const T = {
  title: "مقيّم الذكاء",
  subtitle: "موظف ذكي يقيّم محادثات فريقك، يكشف التهرب اللطيف وتصعيد الغضب، ويدرّب الموظف الضعيف آلياً.",
  working: "يعمل",
  stopped: "متوقف",
  on: "تم تشغيل المقيّم",
  off: "تم إيقاف المقيّم",
  tryMe: "جرّبني",
  more: "المزيد",
  help: "المساعدة",
  note: "ملاحظة للإدارة",
  noteTitle: "اكتب ملاحظة للإدارة",
  noteDesc: "اقتراح أو مشكلة في نظام التقييم.",
  notePlaceholder: "اكتب ملاحظتك…",
  send: "إرسال",
  cancel: "إلغاء",
  sent: "وصلت ملاحظتك للإدارة",
  employeeGroup: "إعدادات الموظف",
  evalGroup: "تقييم الموظفين",
  knowledge: "المعرفة والتعلم",
  channels: "القنوات والوصول",
  timing: "الرد والتوقيت",
  persona: "الشخصية والصلاحيات",
  criteria: "معايير التقييم",
  training: "التدريب الآلي",
  limits: "الصلاحيات والحدود",
  unsaved: "لديك تغييرات لم تُحفظ",
  discard: "تجاهل",
  save: "حفظ التغييرات",
  saved: "تم حفظ إعدادات المقيّم",
  detectorTitle: "كاشف التهرب اللطيف وتصعيد نبرة الغضب (قراءة ما بين السطور)",
  detectorDesc:
    "يفحص المقيّم نية الرد الفعلي للموظف ونبرة العميل: حتى لو استخدم الموظف عبارات مؤدبة مثل «أبشر طال عمرك» دون حل، يكشفه فوراً.",
  presetDodgeBtn: "مثال: التهرب اللطيف",
  presetAngerBtn: "مثال: تصعيد الغضب + تهرب",
  presetGoodBtn: "مثال: معالجة فعلية",
  analyzeBtn: "تحليل المحادثة الآن",
  analyzing: "جارٍ التحليل…",
  customerLabel: "رسالة العميل",
  replyLabel: "رد الموظف",
  scoreLabel: "درجة التقييم:",
  dodgeDetected: "تم رصد تهرب لطيف!",
  dodgeClean: "لا يوجد تهرب",
  angerDetected: "نبرة غضب متصاعدة!",
  angerCalm: "نبرة العميل هادئة",
};

const PRESETS = {
  dodge: {
    customer: "الراوتر يفصل عندي منذ الصباح وأحتاج حل المشكلة اليوم.",
    reply: "أبشر طال عمرك ولا يهمك، إن شاء الله بنشوف الموضوع قريباً وتواصل مع القسم المختص.",
  },
  anger: {
    customer: "هذه ثالث مرة أتواصل معكم ولم يحل أحد مشكلتي! أريد المدير فوراً!",
    reply: "راجع القسم المختص ليست من مهامي.",
  },
  good: {
    customer: "لم تصلني الفاتورة الإلكترونية لهذا الشهر.",
    reply: "أرسلت لك الفاتورة الآن على بريدك الإلكتروني، وفعّلت لك الإرسال التلقائي بداية كل شهر. هل وصلتك؟",
  },
};

interface EvalResult {
  score: number;
  politeDodge: { detected: boolean; reason: string };
  angerEscalation: { detected: boolean; level: string; reason: string };
  verdict: string;
  coachingTip: string;
}

function LiveDodgeDetectorCard() {
  const [customer, setCustomer] = React.useState(PRESETS.dodge.customer);
  const [reply, setReply] = React.useState(PRESETS.dodge.reply);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<EvalResult>({
    score: 48,
    politeDodge: {
      detected: true,
      reason: "رد مؤدب ظاهرياً («أبشر طال عمرك») لكنه خلا من أي إجراء عملي أو حل فعلي لمشكلة العميل.",
    },
    angerEscalation: {
      detected: false,
      level: "calm",
      reason: "نبرة العميل طبيعية.",
    },
    verdict: "سلبي — تهرب من معالجة المشكلة",
    coachingTip: "وجّه الموظف لتنفيذ خطوة عملية واضحة في نفس الرسالة بدل الوعود العائمة أو الإحالة المبهمة.",
  });

  function runAnalyze(custText: string, repText: string) {
    setLoading(true);
    fetch("/api/captain-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "evaluator.analyze",
        customerMessage: custText,
        agentReply: repText,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.evaluation) setResult(res.evaluation);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-amber-500/30 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-card p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold text-sm">
              <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
              رقابة التهرب اللطيف والكلام الدبلوماسي
            </span>
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              قراءة ما بين السطور · نشط
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            يرصد الردود الدبلوماسية المؤدبة ظاهرياً («أبشر طال عمرك»، «بنشوف الموضوع») التي تُغلق المحادثة دون تنفيذ إجراء
            عملي أو حل فعلي لمشكلة العميل.
          </p>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-destructive/30 bg-linear-to-br from-destructive/10 via-destructive/5 to-card p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold text-sm">
              <Flame className="size-4 text-destructive" />
              رقابة تصعيد نبرة الغضب والاحتقان
            </span>
            <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
              إنذار مبكر · نشط
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            يلتقط مؤشرات الإحباط المتكرر («ثالث مرة أتواصل»، «أريد المدير») ويُشعر المشرف فوراً قبل تفاقم الشكوى أو خسارة
            العميل.
          </p>
        </div>
      </div>

      <Card className="border-amber-500/30 bg-linear-to-br from-amber-500/10 via-primary/5 to-card">
        <CardHeader className="gap-2 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
              {T.detectorTitle}
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCustomer(PRESETS.dodge.customer);
                  setReply(PRESETS.dodge.reply);
                  runAnalyze(PRESETS.dodge.customer, PRESETS.dodge.reply);
                }}
              >
                {T.presetDodgeBtn}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCustomer(PRESETS.anger.customer);
                  setReply(PRESETS.anger.reply);
                  runAnalyze(PRESETS.anger.customer, PRESETS.anger.reply);
                }}
              >
                {T.presetAngerBtn}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCustomer(PRESETS.good.customer);
                  setReply(PRESETS.good.reply);
                  runAnalyze(PRESETS.good.customer, PRESETS.good.reply);
                }}
              >
                {T.presetGoodBtn}
              </Button>
            </div>
          </div>
          <CardDescription>{T.detectorDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">{T.customerLabel}</Label>
              <Textarea
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="min-h-16 bg-background/80 text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{T.replyLabel}</Label>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="min-h-16 bg-background/80 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 px-2.5 py-1 text-xs",
                  result.politeDodge.detected
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                )}
              >
                <AlertTriangle className="size-3.5" />
                {result.politeDodge.detected ? T.dodgeDetected : T.dodgeClean}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 px-2.5 py-1 text-xs",
                  result.angerEscalation.detected
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                )}
              >
                <Flame className="size-3.5" />
                {result.angerEscalation.detected ? T.angerDetected : T.angerCalm}
              </Badge>
              <span className="font-semibold text-sm tabular-nums">
                {`${T.scoreLabel} ${result.score}/100 · ${result.verdict}`}
              </span>
            </div>
            <Button size="sm" onClick={() => runAnalyze(customer, reply)} disabled={loading}>
              <Sparkles className="size-3.5" />
              {loading ? T.analyzing : T.analyzeBtn}
            </Button>
          </div>
          <div className="grid gap-1 rounded-xl border bg-background/80 p-3 text-xs">
            <p className="font-medium text-foreground">{result.politeDodge.reason}</p>
            <p className="text-muted-foreground">{result.coachingTip}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function submitNote() {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluator.note",
          note: clean,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok?: boolean };
      if (!data?.ok) throw new Error("Server rejected note");
      onOpenChange(false);
      setText("");
      toast.success(T.sent);
    } catch {
      toast.error("تعذر إرسال الملاحظة إلى الخادم، حاول مجدداً");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{T.noteTitle}</DialogTitle>
          <DialogDescription>{T.noteDesc}</DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-28"
          placeholder={T.notePlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{T.cancel}</Button>
          </DialogClose>
          <Button disabled={!text.trim() || sending} onClick={() => void submitNote()}>
            {T.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 font-medium text-muted-foreground text-sm">{children}</h2>;
}

const groupBox = "overflow-hidden rounded-xl border bg-card";

export function EvaluatorSettings() {
  const store = useEvalStore();
  const { s, set } = store.value;
  const [tryOpen, setTryOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dir, setDir] = React.useState<"ltr" | "rtl">("ltr");
  React.useEffect(() => setDir(document.documentElement.dir === "rtl" ? "rtl" : "ltr"), []);

  async function saveEvaluatorSettings(nextState = s, successMessage = T.saved) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluator.save",
          evaluator: nextState,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok?: boolean };
      if (!data?.ok) throw new Error("Server rejected evaluator save");
      store.save();
      toast.success(successMessage);
    } catch {
      toast.error("تعذر حفظ إعدادات المقيّم في الخادم، حاول مجدداً");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EvalProvider value={store.value}>
      <DirectionProvider dir={dir}>
        <CaptainShell
          title={T.title}
          subtitle={T.subtitle}
          switcher={false}
          nav={false}
          actions={
            <>
              <Label className="flex h-8 items-center gap-2 rounded-lg border px-3 font-medium text-sm">
                <span className={cn("size-2 rounded-full", s.enabled ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                {s.enabled ? T.working : T.stopped}
                <Switch
                  checked={s.enabled}
                  disabled={saving}
                  onCheckedChange={(v) => {
                    const nextState = { ...s, enabled: v };
                    set("enabled", v);
                    void (async () => {
                      try {
                        const res = await fetch("/api/captain-engine", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "evaluator.save",
                            evaluator: nextState,
                          }),
                        });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const data = (await res.json()) as { ok?: boolean };
                        if (!data?.ok) throw new Error("Failed");
                        toast.success(v ? T.on : T.off);
                      } catch {
                        set("enabled", !v);
                        toast.error("تعذر تحديث حالة المقيّم في الخادم");
                      }
                    })();
                  }}
                />
              </Label>
              <Button variant="outline" onClick={() => setTryOpen(true)}>
                <FlaskConical /> {T.tryMe}
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={T.more}>
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/help-center">
                      <CircleHelp /> {T.help}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                    <MessageSquareText /> {T.note}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        >
          <div className="grid min-w-0 gap-6">
            {/* كاشف التهرب اللطيف وتصعيد نبرة الغضب الحي */}
            <LiveDodgeDetectorCard />

            <section className="grid gap-2">
              <GroupTitle>{T.employeeGroup}</GroupTitle>
              <Accordion type="multiple" defaultValue={["knowledge"]} className={groupBox}>
                <SettingsSection value="knowledge" icon={BookOpen} title={T.knowledge} summary={knowledgeSummary(s)}>
                  <KnowledgeSection />
                </SettingsSection>
                <SettingsSection value="channels" icon={Radio} title={T.channels} summary={channelsSummary(s)}>
                  <ChannelsSection />
                </SettingsSection>
                <SettingsSection value="timing" icon={Clock} title={T.timing} summary={timingSummary(s)}>
                  <TimingSection />
                </SettingsSection>
                <SettingsSection value="persona" icon={ShieldCheck} title={T.persona} summary={personaSummary(s)}>
                  <PersonaSection />
                </SettingsSection>
              </Accordion>
            </section>

            <section className="grid gap-2">
              <GroupTitle>{T.evalGroup}</GroupTitle>
              <Accordion type="multiple" className={groupBox}>
                <SettingsSection value="criteria" icon={ClipboardCheck} title={T.criteria} summary={criteriaSummary(s)}>
                  <CriteriaSection onTalk={() => setTryOpen(true)} />
                </SettingsSection>
                <SettingsSection value="training" icon={Dumbbell} title={T.training} summary={trainingSummary(s)}>
                  <TrainingSection />
                </SettingsSection>
                <SettingsSection value="limits" icon={Scale} title={T.limits} summary={limitsSummary(s)}>
                  <LimitsSection />
                </SettingsSection>
              </Accordion>
            </section>

            {store.dirty && (
              <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
                <span className="flex items-center gap-2 font-medium text-sm">
                  <span className="size-2 rounded-full bg-amber-500" />
                  {T.unsaved}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" disabled={saving} onClick={store.reset}>
                    {T.discard}
                  </Button>
                  <Button disabled={saving} onClick={() => void saveEvaluatorSettings(s, T.saved)}>
                    {saving ? "جارٍ الحفظ..." : T.save}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CaptainShell>
        <TryMeSheet
          open={tryOpen}
          onOpenChange={setTryOpen}
          side={dir === "rtl" ? ("rtl" === dir ? "left" : "right") : "right"}
        />
        <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} />
      </DirectionProvider>
    </EvalProvider>
  );
}
