"use client";
// FAH-14: رأس «كل شيء سمارت» فوق محادثة إيمه: ترحيب دافئ باسم العميل، ومؤشر البطارية الذكية، والأزرار السريعة
// الخمسة، ولوحة تقارير مسلية (كعكة القنوات، أعمدة الأسبوع، سباق الموظفين، رادار أداء إيمه). كل زر سريع يجيب
// إيمه عنه في سطرين ويضيء الرسم الذي يخصه. بيانات تجريبية، والسباق من تقييم الموظفين نفسه (evaluation-data).
import * as React from "react";

import { cn } from "cn";
import { Lightbulb, MessageCircleQuestion, Sparkles, Star, Sun, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useSignedInName } from "@/lib/cw/signed-in-profile";

import { BalanceHeader } from "../../_overview-ai/balance-header";
import { employees } from "../../_overview-ai/evaluation-data";

type Quick = "today" | "ask" | "staff" | "customers" | "idea";
type Chart = "pie" | "bars" | "race" | "radar";

const T = {
  hello: (name: string) => `أهلاً ${name}، يومك جميل`,
  helloSub: "إيمه رتّبت لك يومك. اضغط أي زر وتجيبك في سطرين.",
  emma: "إيمه",
  pie: "من أين جاء عملاؤك اليوم",
  bars: "محادثات الأسبوع: إيمه وفريقك",
  race: "سباق الموظفين",
  radar: "أداء إيمه",
  ai: "إيمه",
  staff: "الفريق",
};

const QUICK: { key: Quick; label: string; icon: typeof Sun; chart: Chart; answer: string }[] = [
  {
    key: "today",
    label: "ملخص اليوم",
    icon: Sun,
    chart: "bars",
    answer: "اليوم 312 محادثة. أنهيت 241 منها بنفسي، وحوّلت 71 لفريقك. لا شيء عالق الآن.",
  },
  {
    key: "ask",
    label: "استفسار",
    icon: MessageCircleQuestion,
    chart: "pie",
    answer: "اسألني أي شيء في المحادثة بالأسفل: عن عميل أو قناة أو رقم، وأجيبك فوراً.",
  },
  {
    key: "staff",
    label: "تقييم الموظفين",
    icon: Users,
    chart: "race",
    answer: "مريم في الصدارة هذا الأسبوع. أقترح أن يتعلم الفريق أسلوبها في طمأنة العميل من أول رد.",
  },
  {
    key: "customers",
    label: "تقييم العملاء",
    icon: Star,
    chart: "pie",
    answer: "87٪ من العملاء راضون. أكثر ما يزعج البقية تأخر الرد في المساء على واتساب.",
  },
  {
    key: "idea",
    label: "اقتراح ذكي",
    icon: Lightbulb,
    chart: "radar",
    answer: "لو فعّلت الرد المسائي على واتساب سأغطي ساعات الذروة، وتربح نحو 40 محادثة يومياً.",
  },
];

const channelShare = [
  { key: "whatsapp", label: "واتساب", value: 46, fill: "rgb(37 211 102)" },
  { key: "instagram", label: "إنستغرام", value: 24, fill: "rgb(225 48 108)" },
  { key: "telegram", label: "تيليجرام", value: 12, fill: "rgb(38 165 228)" },
  { key: "tiktok", label: "تيك توك", value: 11, fill: "rgb(254 44 85)" },
  { key: "snapchat", label: "سناب شات", value: 7, fill: "rgb(255 214 0)" },
];

const week = [
  { day: "سبت", ai: 182, staff: 64 },
  { day: "أحد", ai: 210, staff: 71 },
  { day: "اثنين", ai: 198, staff: 58 },
  { day: "ثلاثاء", ai: 236, staff: 66 },
  { day: "أربعاء", ai: 224, staff: 62 },
  { day: "خميس", ai: 251, staff: 70 },
  { day: "جمعة", ai: 241, staff: 71 },
];

const skills = [
  { skill: "سعادة العميل", value: 91 },
  { skill: "حل المشكلة", value: 86 },
  { skill: "فهم الحاجة", value: 88 },
  { skill: "سرعة الرد", value: 97 },
  { skill: "الود", value: 93 },
];

const weekConfig = {
  ai: { label: T.ai, color: "var(--chart-1)" },
  staff: { label: T.staff, color: "var(--chart-2)" },
} satisfies ChartConfig;
const pieConfig = Object.fromEntries(channelShare.map((c) => [c.key, { label: c.label, color: c.fill }])) satisfies ChartConfig;
const radarConfig = { value: { label: T.radar, color: "var(--chart-1)" } } satisfies ChartConfig;

function ReportCard({
  title,
  lit,
  className,
  children,
}: {
  title: string;
  lit: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "gap-2 py-4 transition-all duration-500",
        lit ? "border-primary/50 shadow-[0_0_0_1px_var(--primary),0_12px_40px_-12px_var(--primary)]" : "opacity-90",
        className,
      )}
    >
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

function Race() {
  const runners = [...employees].sort((a, b) => b.score - a.score).slice(0, 5);
  return (
    <ol className="grid gap-2.5">
      {runners.map((e, i) => (
        <li key={e.id} className="grid gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{`${i + 1}. ${e.name}`}</span>
            <span className="text-muted-foreground tabular-nums">{e.score}</span>
          </div>
          <div className="relative h-5 rounded-full bg-[repeating-linear-gradient(90deg,var(--muted)_0_10px,transparent_10px_14px)]">
            <div
              className="absolute inset-y-0 right-0 rounded-full bg-linear-to-l from-primary/10 to-primary/40 transition-[width] duration-1000 ease-out"
              style={{ width: `${e.score}%` }}
            >
              <span className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 -scale-x-100 text-base leading-none">
                🏎️
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SmartHub() {
  const name = useSignedInName("فهد");
  const [quick, setQuick] = React.useState<Quick | null>(null);
  const [liveToday, setLiveToday] = React.useState<{ total: number; resolved: number; handoff: number } | null>(null);

  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.liveStats) {
          setLiveToday({
            total: Number(res.liveStats.totalConversations ?? 312),
            resolved: Number(res.liveStats.autoResolved ?? 241),
            handoff: Number(res.liveStats.handedOff ?? 71),
          });
        }
      })
      .catch(() => {});
  }, []);

  const dynamicQuick = React.useMemo(
    () =>
      QUICK.map((q) =>
        q.key === "today" && liveToday
          ? {
              ...q,
              answer: `اليوم ${liveToday.total} محادثة. أنهيت ${liveToday.resolved} منها بنفسي، وحوّلت ${liveToday.handoff} لفريقك. لا شيء عالق الآن.`,
            }
          : q,
      ),
    [liveToday],
  );
  const current = dynamicQuick.find((q) => q.key === quick);
  const lit = (c: Chart) => current?.chart === c;

  return (
    <div className="flex flex-col gap-4">
      <BalanceHeader />

      <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-primary/10 via-card to-card">
        <CardContent className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-semibold text-2xl tracking-tight">{T.hello(name)}</h2>
            <p className="text-muted-foreground text-sm">{T.helloSub}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dynamicQuick.map((q) => (
              <Button
                key={q.key}
                variant={quick === q.key ? "default" : "outline"}
                className="h-10 gap-2 rounded-full px-4"
                onClick={() => setQuick(quick === q.key ? null : q.key)}
              >
                <q.icon className="size-4" />
                {q.label}
              </Button>
            ))}
          </div>
          <div
            className={cn(
              "grid transition-all duration-300",
              current ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <p className="flex items-start gap-2 rounded-2xl border bg-background/70 p-3 text-sm leading-relaxed">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <span className="font-semibold">{`${T.emma}: `}</span>
                  {current?.answer}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <ReportCard title={T.pie} lit={lit("pie")}>
          <ChartContainer config={pieConfig} className="mx-auto aspect-square h-48">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <Pie data={channelShare} dataKey="value" nameKey="key" innerRadius={48} strokeWidth={3}>
                {channelShare.map((c) => (
                  <Cell key={c.key} fill={c.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
            {channelShare.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: c.fill }} />
                {`${c.label} ${c.value}٪`}
              </span>
            ))}
          </div>
        </ReportCard>

        <ReportCard title={T.bars} lit={lit("bars")}>
          <ChartContainer config={weekConfig} className="h-56 w-full">
            <BarChart data={week} margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="ai" stackId="a" fill="var(--color-ai)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="staff" stackId="a" fill="var(--color-staff)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ReportCard>

        <ReportCard title={T.race} lit={lit("race")}>
          <Race />
        </ReportCard>

        <ReportCard title={T.radar} lit={lit("radar")}>
          <ChartContainer config={radarConfig} className="mx-auto aspect-square h-56">
            <RadarChart data={skills}>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <PolarGrid />
              <PolarAngleAxis dataKey="skill" fontSize={10} />
              <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.35} stroke="var(--color-value)" />
            </RadarChart>
          </ChartContainer>
        </ReportCard>
      </div>
    </div>
  );
}
