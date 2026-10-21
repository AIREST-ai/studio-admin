"use client";
// Chatwoot: components-next/captain/pageComponents/overview/v2 (OverviewV2, OverviewSummaryCard, ResolutionFlowCard,
// ResolutionTrendCard, CsatCard, UsageCard, KnowledgeCoverageCard, RangeSelector, InboxBanner, CoverageBanner,
// AssistantDrilldownDrawer). Studio: heading outside, stat cards on top (default/_components/metric-cards.tsx).
import * as React from "react";

import Link from "next/link";

import {
  ArrowRight,
  Bot,
  ChartNoAxesColumn,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Cpu,
  CreditCard,
  Hourglass,
  Info,
  MessagesSquare,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { BalanceHeader } from "../_overview-ai/balance-header";
import { EmployeeEvaluation } from "../_overview-ai/employee-cards";
import { AssistantPicker, RangePicker } from "../_overview-ai/top-pickers";
import { handoffReasons, trend } from "./data";
import { CaptainShell, useCurrentAssistant } from "./shared";
import { useActiveCaptainClient, useCaptainList } from "./store";

const PAGE_T = {
  title: "نظرة عامة",
  subtitle: "الأقسام الذهبية للذكاء الاصطناعي، مؤشر البطارية الذكية، وتقييم موظفيك في مكان واحد.",
  showReports: "التقارير التفصيلية للذكاء",
  hideReports: "إخفاء التقارير التفصيلية",
  goldenHeading: "أقسامك الذكية الذهبية",
  goldenSub: "كل ما تحتاجه لتجهيز قنواتك وتشغيل موظفك الذكي وتقييم فريقك وبناء عقلك الخاص بنقرة واحدة.",
  summaryTitle: "موجز إيمه الذكي هذا الأسبوع",
  summarySub: "قراءة فورية لأداء المحادثات وجودة ردود الفريق",
  billingTitle: "الرصيد والفوترة",
  billingDesc: "إدارة شحن رصيد الذكاء الاصطناعي وباقة واتساب والقوالب",
  openSection: "افتح القسم",
};

const GOLDEN_CARDS = [
  {
    href: "/dashboard/captain/smart",
    title: "كل شيء سمارت · إيمه",
    badge: "ربط فوري بنفس المكان",
    desc: "إيمه تجهّز لك واتساب وإنستغرام وفيسبوك وماسنجر وتيك توك بزر «اربط الآن» الزجاجي دون مغادرة الصفحة.",
    icon: Sparkles,
    tone: "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30",
    iconTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  {
    href: "/dashboard/captain/employee",
    title: "موظف الذكاء البشري",
    badge: "يتعلم من محادثات فريقك",
    desc: "موظف بشري الأسلوب يتعلم من صناديق فريقك ويكتشف مشاكل اليوم تلقائياً ليرد أو يقترح أو يعمل باستقلالية.",
    icon: Bot,
    tone: "from-sky-500/15 via-sky-500/5 to-transparent border-sky-500/30",
    iconTone: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  {
    href: "/dashboard/captain/evaluator",
    title: "مقيّم الذكاء",
    badge: "يكشف التهرب اللطيف والغضب",
    desc: "يقرأ ما بين السطور ليكشف التهرب اللطيف وتصعيد نبرة غضب العميل، ويدرّب الموظف الضعيف آلياً.",
    icon: ClipboardCheck,
    tone: "from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30",
    iconTone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  {
    href: "/dashboard/captain/build",
    title: "اربط ذكاءك",
    badge: "عقل إيمه أو عقلك الخاص",
    desc: "اختر عقل إيمه الجاهز أو اربط مفتاحك الخاص مع بنك ذاكرة معزول كلياً لشركتك.",
    icon: Cpu,
    tone: "from-violet-500/15 via-violet-500/5 to-transparent border-violet-500/30",
    iconTone: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  },
] as const;

const rangeOptions = [
  { value: "this_week", label: "هذا الأسبوع" },
  { value: "last_week", label: "الأسبوع الماضي" },
  { value: "last_30", label: "آخر 30 يوماً" },
  { value: "this_month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" },
];

interface Metric {
  metricId: string;
  label: string;
  value: string;
  change: string;
  up: boolean;
  support: string;
  hint: string;
  note?: string;
  total: number;
  icon: typeof MessagesSquare;
}

const rangeScale: Record<string, number> = {
  this_week: 1,
  last_week: 0.89,
  last_30: 4.3,
  this_month: 1.9,
  last_month: 4.1,
};
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

interface LiveEngineSummary {
  totalConversations: number;
  autoResolved: number;
  handedOff: number;
  autoResolvePct: number;
  dodgeCount: number;
  angerCount: number;
  learnedCount: number;
  issuesCount: number;
}

function metricsFor(scale: number, live: LiveEngineSummary): Metric[] {
  const n = (base: number) => Math.round(base * scale);
  const handled = n(live.totalConversations);
  const resolved = n(live.autoResolved);
  const replies = n(Math.round(live.totalConversations * 0.9));
  const handoff = Math.max(0, handled - resolved);
  const rate = (value: string) => (handled ? value : "—");
  return [
    {
      metricId: "hours_saved",
      label: "الوقت والجهد الموفّر للفريق",
      value: `${Math.round((replies * 2) / 60)} ساعة`,
      change: "+6 ساعات",
      up: true,
      support: `${fmt(replies)} رد عام`,
      hint: "تقدير وقت الرد الذي وفّرته إيمه على موظفيك.",
      note: "بناءً على دقيقتين موفرتين لكل رد عام.",
      total: replies,
      icon: Hourglass,
    },
    {
      metricId: "durable_resolution_rate",
      label: "حلول بقيت مغلقة دون عودة",
      value: rate("93%"),
      change: "+1%",
      up: true,
      support: `${fmt(Math.round(resolved * 0.93))} من ${fmt(resolved)}`,
      hint: "نسبة المحادثات المحلولة التي بقيت مغلقة بعد سبعة أيام.",
      note: "تُحتسب المحادثات التي مضى على إغلاقها سبعة أيام.",
      total: Math.round(resolved * 0.93),
      icon: ShieldCheck,
    },
    {
      metricId: "conversations_handled",
      label: "المحادثات المعالجة",
      value: fmt(handled),
      change: "+12%",
      up: true,
      support: `مقابل ${fmt(Math.round(handled * 0.89))} في الفترة السابقة`,
      hint: "المحادثات التي ردّت عليها إيمه أو حوّلتها بملخص واضح لفريقك.",
      total: handled,
      icon: MessagesSquare,
    },
    {
      metricId: "auto_resolution_rate",
      label: "نسبة الحل الذاتي",
      value: rate(`${live.autoResolvePct}%`),
      change: "+3.2%",
      up: true,
      support: `${fmt(resolved)} من ${fmt(handled)}`,
      hint: "نسبة المحادثات التي حلّتها إيمه بالكامل دون تدخل بشري.",
      total: resolved,
      icon: CheckCheck,
    },
    {
      metricId: "handoff_rate",
      label: "نسبة التحويل للفريق",
      value: rate(`${Math.max(0, 100 - live.autoResolvePct)}%`),
      change: "-1.9%",
      up: false,
      support: `${fmt(handoff)} من ${fmt(handled)}`,
      hint: "نسبة المحادثات التي حُوّلت إلى موظفي الفريق.",
      total: handoff,
      icon: UserRoundCheck,
    },
    {
      metricId: "conversation_depth",
      label: "متوسط الرسائل لكل محادثة",
      value: rate("2.4"),
      change: "-0.3",
      up: false,
      support: "متوسط ردود إيمه",
      hint: "متوسط عدد الردود في كل محادثة تمت معالجتها.",
      note: "العدد الأقل يعني وصول العميل للحل بسرعة أكبر.",
      total: handled,
      icon: MessagesSquare,
    },
    {
      metricId: "reopen_rate",
      label: "معدل إعادة الفتح",
      value: rate("7%"),
      change: "-1%",
      up: false,
      support: `${fmt(Math.round(resolved * 0.07))} من ${fmt(resolved)}`,
      hint: "نسبة المحادثات المغلقة التي عاد إليها العميل لاحقاً.",
      note: "انخفاض النسبة يعني ثبات الحل من أول مرة.",
      total: Math.round(resolved * 0.07),
      icon: Repeat,
    },
    {
      metricId: "median_resolution_seconds",
      label: "متوسط زمن الحل",
      value: rate("4 دقائق"),
      change: "-40 ث",
      up: false,
      support: "من وصول الرسالة حتى إغلاقها",
      hint: "الزمن المعتاد منذ استلام إيمه للمحادثة وحتى حلّها.",
      note: "انخفاض الزمن يعني استجابة أسرع للعميل.",
      total: resolved,
      icon: Clock,
    },
  ];
}

const rateTrend = [
  { day: "الإثنين", current: 66, previous: 61 },
  { day: "الثلاثاء", current: 68, previous: 63 },
  { day: "الأربعاء", current: 72, previous: 65 },
  { day: "الخميس", current: 69, previous: 66 },
  { day: "الجمعة", current: 71, previous: 64 },
  { day: "السبت", current: 74, previous: 67 },
  { day: "الأحد", current: 74, previous: 68 },
];

const chartConfig = {
  handled: { label: "المعالجة", color: "var(--chart-2)" },
  resolved: { label: "المحلولة ذاتياً", color: "var(--chart-1)" },
} satisfies ChartConfig;

const rateConfig = {
  current: { label: "الفترة الحالية", color: "var(--chart-1)" },
  previous: { label: "الفترة السابقة", color: "var(--chart-3)" },
} satisfies ChartConfig;

function Hint({ text, note }: { text: string; note?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger type="button" className="inline-flex items-center">
        <Info className="size-3.5 shrink-0 cursor-help text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p>{text}</p>
        {note && <p className="mt-1 opacity-80">{note}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function FaqSuggestionBanner() {
  const suggestions = useCaptainList("suggestions");
  const pendingSuggestions = suggestions.slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <CardTitle>اقتراحات الأسئلة الشائعة</CardTitle>
        <CardDescription>
          راجع السؤال والجواب قبل اعتمادهما. الأعداد تخص بيانات مساحة الاختبار وليست أداء شركتك.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        {pendingSuggestions.length ? (
          <ul className="grid min-w-0 gap-2">
            {pendingSuggestions.map((suggestion) => (
              <li key={suggestion.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 break-words">{suggestion.question}</span>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/captain/faqs/suggestions" aria-label={`مراجعة: ${suggestion.question}`}>
                    مراجعة
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">لا توجد اقتراحات للمراجعة حالياً.</p>
        )}
        <Link href="/dashboard/captain/faqs/suggestions" className="justify-self-start text-primary hover:underline">
          عرض كل الاقتراحات ({suggestions.length})
        </Link>
      </CardContent>
    </Card>
  );
}

export function CaptainOverview() {
  const assistant = useCurrentAssistant();
  const [clientId, setClientId] = useActiveCaptainClient();
  const [evalSummary, setEvalSummary] = React.useState<{
    clientId: string;
    totalEvaluated: number;
    avgJudgeScore: number;
    verifyRunsCount: number;
    tracingCount: number;
  } | null>(null);

  React.useEffect(() => {
    fetch(`/api/cw/csat-notes?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok && data.summary) {
          setEvalSummary(data.summary);
        }
      })
      .catch(() => {});
  }, [clientId]);
  const [point, setPoint] = React.useState(0);
  const [reportsOpen, setReportsOpen] = React.useState(false);
  const [range, setRange] = React.useState("this_week");
  const [live, setLive] = React.useState<LiveEngineSummary>(() => {
    const initialHandled = trend.reduce((acc, d) => acc + d.handled, 0);
    const initialResolved = trend.reduce((acc, d) => acc + d.resolved, 0);
    const pct = initialHandled > 0 ? Math.round((initialResolved / initialHandled) * 100) : 71;
    return {
      totalConversations: initialHandled,
      autoResolved: initialResolved,
      handedOff: Math.max(0, initialHandled - initialResolved),
      autoResolvePct: pct,
      dodgeCount: 2,
      angerCount: 1,
      learnedCount: 12,
      issuesCount: 2,
    };
  });

  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.liveStats) {
          setLive((prev) => ({
            ...prev,
            ...res.liveStats,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const noHistory = assistant.inboxes === 0 && assistant.faqs === 0 && assistant.documents === 0;
  const metrics = metricsFor(noHistory ? 0 : (rangeScale[range] ?? 1), live);
  const points = [
    `عالجت إيمه ${metrics[2].value} محادثة وحلّت ${metrics[3].value} منها ذاتياً من أول رد دون تدخل بشري.`,
    `رصد مقيّم الذكاء ${live.dodgeCount} حالات تهرب لطيف و${live.angerCount} حالات تصعيد غضب وفعّل التدريب الآلي لمعالجتها.`,
    `تعلّم موظف الذكاء ${live.learnedCount} عنصراً معرفياً في بنك Hindsight المعزول واكتشف ${live.issuesCount} مشكلات متكررة اليوم.`,
  ];
  const [trendView, setTrendView] = React.useState("count");
  const [aligned, setAligned] = React.useState(true);
  const totalReasons = handoffReasons.reduce((s, r) => s + r.value, 0);
  const flowTotal = Math.max(1, live.totalConversations);
  const flowColumns = [
    [{ label: "إجمالي المحادثات", value: live.totalConversations, dot: "bg-chart-2" }],
    [
      { label: "حُلّت عبر إيمه", value: live.autoResolved, dot: "bg-chart-1" },
      { label: "حُوّلت للفريق", value: live.handedOff, dot: "bg-sky-500" },
    ],
    [
      { label: "بقيت مغلقة", value: Math.round(live.autoResolved * 0.93), dot: "bg-emerald-500" },
      { label: "أعيد فتحها خلال 7 أيام", value: Math.round(live.autoResolved * 0.07), dot: "bg-amber-500" },
      { label: "أُغلقت مع الفريق", value: Math.round(live.handedOff * 0.9), dot: "bg-violet-500" },
    ],
  ];

  return (
    <CaptainShell
      title={PAGE_T.title}
      subtitle={PAGE_T.subtitle}
      nav={false}
      switcher={false}
      className="@container/overview"
      actions={
        <>
          <div
            className="inline-flex items-center rounded-md border bg-background p-0.5 text-xs"
            data-testid="captain-overview-client-switcher"
          >
            <button
              type="button"
              data-testid="overview-switch-client-test-a"
              onClick={() => setClientId("client_test_a")}
              className={
                clientId === "client_test_a"
                  ? "rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground"
                  : "rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              client_test_a
            </button>
            <button
              type="button"
              data-testid="overview-switch-client-test-b"
              onClick={() => setClientId("client_test_b")}
              className={
                clientId === "client_test_b"
                  ? "rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground"
                  : "rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              client_test_b
            </button>
            {evalSummary ? (
              <span className="px-2 text-muted-foreground tabular-nums" data-testid="overview-eval-badge">
                {evalSummary.avgJudgeScore}% · {evalSummary.verifyRunsCount} runs
              </span>
            ) : null}
          </div>
          <AssistantPicker />
          {noHistory ? (
            <Button variant="outline" disabled>
              Not enough reporting history yet
            </Button>
          ) : (
            <RangePicker label="Range" value={range} options={rangeOptions} onChange={setRange} />
          )}
        </>
      }
    >
      {/* أمر فهد البند 53 + البطارية الذكية لرصيد الذكاء ورصيد واتساب والقوالب */}
      <BalanceHeader />

      {/* الأقسام الذهبية للذكاء الاصطناعي في الصدارة بعد إزالة الزوائد */}
      <section className="grid gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold text-lg tracking-tight">{PAGE_T.goldenHeading}</h2>
          <p className="text-muted-foreground text-sm">{PAGE_T.goldenSub}</p>
        </div>
        <div className="grid @3xl/overview:grid-cols-2 @6xl/overview:grid-cols-4 gap-3">
          {GOLDEN_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="group block">
                <Card
                  className={`h-full border bg-gradient-to-br ${card.tone} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <CardHeader className="gap-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex size-9 items-center justify-center rounded-xl border ${card.iconTone}`}>
                        <Icon className="size-4" />
                      </span>
                      <Badge variant="outline" className="bg-background/70 text-[11px] backdrop-blur-sm">
                        {card.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
                    <p className="text-muted-foreground text-xs leading-relaxed">{card.desc}</p>
                    <span className="inline-flex items-center gap-1 font-medium text-primary text-xs group-hover:underline">
                      {PAGE_T.openSection}
                      <ArrowRight className="size-3.5 rtl:rotate-180" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* اقتراحات الأسئلة الشائعة من الكابتن — العامل الثالث CMP-249 */}
      <FaqSuggestionBanner />

      {/* أمر فهد البندان 48 و49: بطاقات تقييم الموظفين وكشف التهرب اللطيف */}
      <EmployeeEvaluation />

      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-4 text-primary" />
            {PAGE_T.summaryTitle}
          </CardTitle>
          <CardDescription>{PAGE_T.summarySub}</CardDescription>
          <CardAction className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Previous summary point"
              disabled={point === 0}
              onClick={() => setPoint(point - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {point + 1} / {points.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Next summary point"
              disabled={point === points.length - 1}
              onClick={() => setPoint(point + 1)}
            >
              <ChevronRight />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-base">{points[point]}</p>
        </CardContent>
      </Card>

      {/* التقارير المفصّلة مطوية تحت زر واحد حتى لا تطول الصفحة */}
      <Collapsible open={reportsOpen} onOpenChange={setReportsOpen} className="grid gap-4">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="justify-self-start">
            <ChartNoAxesColumn /> {reportsOpen ? PAGE_T.hideReports : PAGE_T.showReports}
            <ChevronDown className={reportsOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>مسار حل المحادثات</CardTitle>
              <CardDescription>تدفّق المحادثات بين إيمه وأعضاء الفريق</CardDescription>
            </CardHeader>
            <CardContent className="grid @2xl/overview:grid-cols-[1fr_auto_1fr_auto_1fr] @2xl/overview:items-center gap-4">
              {flowColumns.map((col, ci) => (
                <React.Fragment key={col[0].label}>
                  {ci > 0 && (
                    <ArrowRight className="@2xl/overview:block hidden size-4 text-muted-foreground rtl:rotate-180" />
                  )}
                  <div className="grid gap-2">
                    {col.map((n) => (
                      <div key={n.label} className="grid gap-1.5 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="inline-flex items-center gap-2">
                            <span className={`size-2 rounded-full ${n.dot}`} />
                            {n.label}
                          </span>
                          <span className="font-medium tabular-nums">{n.value.toLocaleString()}</span>
                        </div>
                        <Progress value={Math.round((n.value / flowTotal) * 100)} className="h-1" />
                      </div>
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </CardContent>
          </Card>

          <div className="grid @5xl/overview:grid-cols-[2fr_1fr] gap-4">
            <Card>
              <CardHeader>
                <CardTitle>اتجاه الحل الذاتي</CardTitle>
                <CardDescription>
                  {trendView === "count"
                    ? "عدد المحادثات المعالجة والمحلولة ذاتياً"
                    : "مقارنة نسبة الحل الذاتي بالفترة السابقة"}
                </CardDescription>
                <CardAction>
                  <Tabs value={trendView} onValueChange={setTrendView}>
                    <TabsList>
                      <TabsTrigger value="count">العدد</TabsTrigger>
                      <TabsTrigger value="rate">النسبة</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-3">
                {trendView === "rate" ? (
                  <>
                    <Label className="flex items-center gap-2 font-normal text-sm">
                      <Switch checked={aligned} onCheckedChange={setAligned} /> مقارنة أيام الأسبوع المتناظرة
                      <Hint
                        text="قارن نسب الحل الذاتي بين أيام الأسبوع المتناظرة (مثل الإثنين مع الإثنين)."
                        note="يُقارن اليوم حتى نفس الساعة من اليوم المناظر."
                      />
                    </Label>
                    <ChartContainer config={rateConfig} className="h-56 w-full">
                      <LineChart data={aligned ? rateTrend : [...rateTrend].reverse()} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} width={36} unit="%" domain={[50, 80]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                          dataKey="current"
                          stroke="var(--color-current)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          dataKey="previous"
                          stroke="var(--color-previous)"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ChartContainer>
                  </>
                ) : (
                  <ChartContainer config={chartConfig} className="h-64 w-full">
                    <BarChart data={trend} margin={{ left: 0, right: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="handled" fill="var(--color-handled)" radius={4} isAnimationActive={false} />
                      <Bar dataKey="resolved" fill="var(--color-resolved)" radius={4} isAnimationActive={false} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>أسباب التحويل للفريق</CardTitle>
                <CardDescription>{totalReasons} تحويلاً في هذه الفترة</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {handoffReasons.map((r) => {
                  const pct = Math.round((r.value / totalReasons) * 100);
                  return (
                    <div key={r.label} className="grid gap-1.5">
                      <div className="flex justify-between text-sm">
                        <span>{r.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {r.value} ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid @xl/overview:grid-cols-2 gap-4">
        <Link href="/dashboard/captain/smart">
          <Card className="flex-row items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="grid gap-0.5">
              <span className="font-medium text-sm">كل شيء سمارت · إيمه</span>
              <span className="text-muted-foreground text-xs">اربط قنواتك واضبط إعداداتك بالمحادثة في نفس المكان</span>
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/settings/billing">
          <Card className="flex-row items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <CreditCard className="size-4" />
            </div>
            <div className="grid gap-0.5">
              <span className="font-medium text-sm">{PAGE_T.billingTitle}</span>
              <span className="text-muted-foreground text-xs">{PAGE_T.billingDesc}</span>
            </div>
          </Card>
        </Link>
      </div>
    </CaptainShell>
  );
}
