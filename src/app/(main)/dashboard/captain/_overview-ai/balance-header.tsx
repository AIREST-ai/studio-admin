"use client";
// أمر فهد البند 53: «يوضع في بداية الصفحة الرصيد بشكل محترف، ليس هذا الشكل البسيط».
// المقترح المدموج (القسم 1): بطاقة نظيفة فيها الرقم، و«يكفي نحو 63 يوماً»، وشريط صرف واحد، وزر رئيسي واحد «شحن الرصيد».
// التفصيل الذي كان ظاهراً (التقييم وموظف الذكاء البشري، ومعدل الصرف اليومي، والأيام المتبقية) والسجل صارا في
// نافذة جانبية واحدة يفتحها «سجل الصرف» أو «تفصيل الصرف». الشبكة باستعلام الحاوية لتلائم 1024 و1440 بلا قص.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  BatteryCharging,
  Bot,
  CalendarClock,
  EyeOff,
  ClipboardCheck,
  Gauge,
  History,
  MessageSquareText,
  Plus,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { balance, type SpendRow, spendLog } from "./evaluation-data";

const T = {
  batteryBadge: "مؤشر البطارية الذكية",
  available: "رصيد الذكاء الاصطناعي",
  waAvailable: "رصيد واتساب والقوالب",
  waCurrency: "ر.س",
  waConvs: "3,850 محادثة متاحة",
  waTemplates: "16 قالباً معتمداً",
  waDays: "يكفي نحو 48 يوماً بالمعدل الحالي",
  mock: "معاينة",
  waMockHint: "1,450 ر.س قيمة معاينة ثابتة — لا تمثل رصيداً حقيقياً",
  points: "نقطة",
  pointsN: (n: string) => `${n} نقطة`,
  perDay: (n: string) => `${n} نقطة يومياً`,
  rate: "معدل الصرف",
  month: "صرف هذا الشهر",
  ofTotal: (spent: string, total: string) => `${spent} من ${total} نقطة`,
  evaluation: "التقييم",
  employee: "موظف الذكاء البشري",
  daysLeft: "الأيام المتبقية",
  days: (n: number) => `${n} يوماً بالمعدل الحالي`,
  enough: (n: number) => `يكفي نحو ${n} يوماً بالمعدل الحالي`,
  unlimitedHint: "قيم معاينة ثابتة — لا تمثل رصيداً حقيقياً",
  topup: "شحن الرصيد",
  log: "سجل الصرف",
  details: "تفصيل الصرف",
  detailsDesc: "أين صُرف رصيدك هذا الشهر، وكم يكفي بالمعدل الحالي",
  logDesc: "آخر عمليات الصرف والشحن على رصيدك",
  close: "إغلاق",
  dot: (a: string, b: string) => `${a} · ${b}`,
  pct: (n: number) => `${n}٪`,
  barLabel: "ما صُرف هذا الشهر من مجموع الرصيد",
  full: "مشحونة بالكامل",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const kindMeta: Record<SpendRow["kind"], { icon: typeof Bot; label: string }> = {
  evaluation: { icon: ClipboardCheck, label: T.evaluation },
  employee: { icon: Bot, label: T.employee },
  topup: { icon: Plus, label: T.topup },
};

type View = "log" | "details";

function useBalanceMath() {
  const [liveBal, setLiveBal] = React.useState(balance);
  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const ai = res?.state?.balance?.ai;
        if (ai && typeof ai.available === "number") {
          setLiveBal({
            available: ai.available,
            spentEvaluation: Number(ai.spentEvaluation ?? balance.spentEvaluation),
            spentEmployee: Number(ai.spentEmployee ?? balance.spentEmployee),
            dayOfMonth: Number(ai.dayOfMonth ?? balance.dayOfMonth),
          });
        }
      })
      .catch(() => {});
  }, []);
  const spent = liveBal.spentEvaluation + liveBal.spentEmployee;
  const total = Math.max(1, spent + liveBal.available);
  const perDay = Math.max(1, spent / Math.max(1, liveBal.dayOfMonth));
  const daysLeft = Math.max(1, Math.floor(liveBal.available / perDay));
  return { available: liveBal.available, spent, total, perDay, daysLeft, spentPct: Math.round((spent / total) * 100) };
}

function Meter({ value, label, className }: { value: number; label?: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  );
}

// بطارية ذكية مقسّمة إلى 10 خلايا تقيس الرصيد بأيام التغطية (حتى لو شحن مليون ريال تبقى منطقية ومريحة للعين)
function SmartBatteryGraphic({
  days,
  tone = "emerald",
}: {
  days: number;
  tone?: "emerald" | "sky";
}) {
  const pct = Math.min(100, Math.max(12, Math.round((days / 60) * 100)));
  const activeCells = Math.max(1, Math.round(pct / 10));
  const fillClass =
    tone === "emerald"
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]"
      : "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.45)]";
  return (
    <div className="flex items-center gap-1.5" aria-label={`${pct}%`}>
      <div className="flex items-center gap-1 rounded-lg border-2 border-foreground/20 bg-background/80 p-1">
        {Array.from({ length: 10 }, (_, idx) => (
          <span
            key={idx}
            className={cn(
              "h-3.5 w-2 rounded-[3px] transition-all",
              idx < activeCells ? fillClass : "bg-muted-foreground/15",
            )}
          />
        ))}
      </div>
      <span className="h-2.5 w-1 rounded-e-sm bg-foreground/25" />
      <span className="font-semibold text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
        {T.pct(pct)}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-medium text-sm">{children}</h3>;
}

function DetailsSection() {
  const { spent, total, perDay, daysLeft } = useBalanceMath();
  const split = [
    { key: "evaluation", label: T.evaluation, value: balance.spentEvaluation, icon: ClipboardCheck },
    { key: "employee", label: T.employee, value: balance.spentEmployee, icon: Bot },
  ];
  return (
    <section className="grid gap-3">
      <SectionTitle>{T.details}</SectionTitle>
      <div className="grid gap-1.5 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{T.month}</span>
          <span className="text-muted-foreground tabular-nums">{T.ofTotal(fmt(spent), fmt(total))}</span>
        </div>
        <Meter value={Math.round((spent / total) * 100)} />
      </div>
      {split.map((s) => {
        const pct = Math.round((s.value / spent) * 100);
        return (
          <div key={s.key} className="grid gap-1.5 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <s.icon className="size-4 text-muted-foreground" />
                {s.label}
              </span>
              <span className="text-muted-foreground tabular-nums">{T.dot(T.pointsN(fmt(s.value)), T.pct(pct))}</span>
            </div>
            <Meter value={pct} />
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1 rounded-lg border p-3">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Gauge className="size-3.5" />
            {T.rate}
          </span>
          <span className="font-medium text-sm tabular-nums">{T.perDay(fmt(perDay))}</span>
        </div>
        <div className="grid gap-1 rounded-lg border p-3">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <CalendarClock className="size-3.5" />
            {T.daysLeft}
          </span>
          <span className="font-medium text-sm tabular-nums">{T.days(daysLeft)}</span>
        </div>
      </div>
    </section>
  );
}

function LogSection() {
  return (
    <section className="grid gap-2">
      <SectionTitle>{T.log}</SectionTitle>
      {spendLog.map((row) => {
        const meta = kindMeta[row.kind];
        const plus = row.points > 0;
        return (
          <div key={row.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <meta.icon className="size-4" />
            </div>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{row.title}</span>
              <span className="text-muted-foreground text-xs">{T.dot(meta.label, row.date)}</span>
            </div>
            <span
              dir="ltr"
              className={cn(
                "shrink-0 font-medium tabular-nums",
                plus ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
              )}
            >
              {plus ? "+" : "−"}
              {fmt(Math.abs(row.points))}
            </span>
          </div>
        );
      })}
    </section>
  );
}

function SpendSheet({ view, onClose }: { view: View | null; onClose: () => void }) {
  return (
    <Sheet open={view !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent showCloseButton={false} className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="flex-row items-start gap-3 border-b">
          <div className="grid gap-0.5">
            <SheetTitle>{view === "details" ? T.details : T.log}</SheetTitle>
            <SheetDescription>{view === "details" ? T.detailsDesc : T.logDesc}</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button size="icon" variant="ghost" aria-label={T.close} className="ms-auto">
              <X />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="grid flex-1 content-start gap-6 overflow-y-auto p-4">
          {view === "details" ? (
            <>
              <DetailsSection />
              <LogSection />
            </>
          ) : (
            <>
              <LogSection />
              <DetailsSection />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function BalanceHeader() {
  const [view, setView] = React.useState<View | null>(null);
  const { available, spent, total, daysLeft } = useBalanceMath();

  return (
    <Card className="@container/balance border-emerald-500/25 bg-linear-to-t from-emerald-500/5 via-primary/5 to-card shadow-xs dark:bg-card">
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <BatteryCharging className="size-3.5" />
              {T.batteryBadge}
            </Badge>
            <span className="text-muted-foreground text-xs">{T.unlimitedHint}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setView("details")}>
              <Gauge className="size-4" /> {T.details}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setView("log")}>
              <History className="size-4" /> {T.log}
            </Button>
            <Button size="sm" disabled>
              <EyeOff className="size-4" /> الشحن معاينة
            </Button>
          </div>
        </div>

        <div className="grid @3xl/balance:grid-cols-2 gap-4">
          {/* البطارية الأولى: رصيد الذكاء الاصطناعي */}
          <div className="grid gap-2.5 rounded-xl border bg-background/60 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <span className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="size-4" />
                </span>
                {T.available}
              </div>
              <SmartBatteryGraphic days={daysLeft} tone="emerald" />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-3xl tabular-nums leading-none tracking-tight">
                  {fmt(available)}
                </span>
                <span className="text-muted-foreground text-xs">{T.points}</span>
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {T.ofTotal(fmt(spent), fmt(total))}
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-emerald-700 text-xs dark:text-emerald-300">
              <CalendarClock className="size-3.5" />
              {T.enough(daysLeft)} · <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">{T.mock}</span>
            </p>
          </div>

          {/* البطارية الثانية: رصيد واتساب والقوالب */}
          <div className="grid gap-2.5 rounded-xl border bg-background/60 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <span className="flex size-7 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <MessageSquareText className="size-4" />
                </span>
                {T.waAvailable}
              </div>
              <SmartBatteryGraphic days={48} tone="sky" />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-3xl tabular-nums leading-none tracking-tight">1,450</span>
                <span className="text-muted-foreground text-xs">{T.waCurrency}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Badge variant="secondary" className="text-[11px]">{T.waConvs}</Badge>
                <Badge variant="outline" className="text-[11px]">{T.waTemplates}</Badge>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-sky-700 text-xs dark:text-sky-300">
              <Wallet className="size-3.5" />
              {T.waMockHint}
            </p>
          </div>
        </div>
      </CardContent>
      <SpendSheet view={view} onClose={() => setView(null)} />
    </Card>
  );
}
