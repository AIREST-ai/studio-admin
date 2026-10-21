"use client";
// أمر فهد البندان 48 و49: «هذه البطاقة نفسها يوضع عليها اسم الموظف، وتحتوي مختصر عن التقييم: ايجابي، تقييم سلبي»
// و«عند الضغط عليها تدخله إلى مؤشرات كاملة: لماذا هذا الموظف ليس جيد، لماذا سيء».
// المقترح المدموج (القسم 1): البطاقة مبسطة (الاسم والقسم، ونسبة الإيجابي كبيرة، والسلبي صغير، وسهم الاتجاه فقط).
// كل ما كان في البطاقة (عدد المحادثات المقيّمة، ونقاط الاتجاه، وأقوى نقطة أو أبرز ضعف) صار في النافذة الجانبية
// مع المؤشرات الكاملة: الدرجة، وأقوى نقطة وأضعفها، ولماذا هذا التقييم، والأسباب بأعدادها، وأمثلة من المحادثات.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { ThumbsDown, ThumbsUp, TrendingDown, TrendingUp, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { type EmployeeEval, employees, type Reason } from "./evaluation-data";

const T = {
  heading: "تقييم الموظفين",
  sub: "ملخص تقييم كل موظف من محادثاته. اضغط على البطاقة لترى سبب التقييم كاملاً.",
  positive: "إيجابي",
  negative: (n: number) => `سلبي ${n}٪`,
  pct: (n: number) => `${n}٪`,
  rated: (n: number) => `${n} محادثة مقيّمة`,
  // العزل ⁦…⁩ يبقي الإشارة قبل الرقم داخل السطر العربي.
  trend: (n: number) => `⁦${n > 0 ? "+" : "−"}${Math.abs(n)}⁩ نقاط`,
  trendUp: "التقييم يتحسن",
  trendDown: "التقييم يتراجع",
  trendLabel: "الاتجاه",
  strongest: "أقوى نقطة",
  weakest: "أضعف نقطة",
  score: "الدرجة",
  of100: "من 100",
  positiveLabel: "إيجابي",
  negativeLabel: "سلبي",
  why: "لماذا هذا التقييم",
  strengths: "نقاط القوة",
  weaknesses: "أسباب الضعف",
  inConv: (n: number) => `${n} محادثة`,
  evidence: "أمثلة من المحادثات",
  customer: "العميل: ",
  employee: "الموظف: ",
  close: "إغلاق",
  dot: (a: string, b: string) => `${a} · ${b}`,
  open: (name: string) => `افتح تقييم ${name}`,
  splitLabel: "نسبة التقييم الإيجابي والسلبي",
};

function SplitBar({ positive, className }: { positive: number; className?: string }) {
  return (
    <div
      role="img"
      aria-label={T.splitLabel}
      className={cn("flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${positive}%` }} />
      <div className="h-full flex-1 rounded-full bg-destructive/70" />
    </div>
  );
}

function ReasonList({ title, items, total, good }: { title: string; items: Reason[]; total: number; good: boolean }) {
  return (
    <div className="grid gap-3">
      <h3 className="flex items-center gap-2 font-medium text-sm">
        {good ? (
          <ThumbsUp className="size-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <ThumbsDown className="size-4 text-destructive" />
        )}
        {title}
      </h3>
      {items.map((it) => {
        const pct = Math.round((it.count / total) * 100);
        return (
          <div key={it.label} className="grid gap-1.5">
            <div className="flex justify-between gap-2 text-sm">
              <span>{it.label}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{T.inConv(it.count)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", good ? "bg-emerald-500" : "bg-destructive/70")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HighlightPoint({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-lg border p-3",
        good ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs",
          good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        )}
      >
        {good ? <ThumbsUp className="size-3.5" /> : <ThumbsDown className="size-3.5" />}
        {label}
      </span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}

function EmployeeSheet({ employee, onClose }: { employee: EmployeeEval | null; onClose: () => void }) {
  return (
    <Sheet open={employee !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent showCloseButton={false} className="w-full gap-0 sm:max-w-lg">
        {employee && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted font-medium text-muted-foreground">
                  {employee.name.charAt(0)}
                </div>
                <div className="grid min-w-0 gap-0.5">
                  <SheetTitle>{employee.name}</SheetTitle>
                  <SheetDescription>{T.dot(employee.team, T.rated(employee.conversations))}</SheetDescription>
                </div>
                <SheetClose asChild>
                  <Button size="icon" variant="ghost" aria-label={T.close} className="ms-auto">
                    <X />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>
            <div className="grid flex-1 content-start gap-6 overflow-y-auto p-4">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[
                    { k: "score", label: `${T.score} ${T.of100}`, value: `${employee.score}`, tone: "" },
                    { k: "pos", label: T.positiveLabel, value: T.pct(employee.positive), tone: "" },
                    { k: "neg", label: T.negativeLabel, value: T.pct(100 - employee.positive), tone: "" },
                    {
                      k: "trend",
                      label: T.trendLabel,
                      value: T.trend(employee.trend),
                      tone: employee.trend > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    },
                  ].map((s) => (
                    <div key={s.k} className="grid gap-0.5 rounded-lg border p-3">
                      <div className={cn("font-semibold text-lg tabular-nums", s.tone)}>{s.value}</div>
                      <div className="text-muted-foreground text-xs">{s.label}</div>
                    </div>
                  ))}
                </div>
                <SplitBar positive={employee.positive} />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <HighlightPoint label={T.strongest} value={employee.strengths[0].label} good />
                <HighlightPoint label={T.weakest} value={employee.weaknesses[0].label} good={false} />
              </div>

              <div className="grid gap-1.5 rounded-lg border bg-muted/40 p-3">
                <span className="font-medium text-sm">{T.why}</span>
                <p className="text-muted-foreground text-sm">{employee.why}</p>
              </div>

              <ReasonList
                title={T.weaknesses}
                items={employee.weaknesses}
                total={employee.conversations}
                good={false}
              />
              <ReasonList title={T.strengths} items={employee.strengths} total={employee.conversations} good />

              <div className="grid gap-2">
                <h3 className="font-medium text-sm">{T.evidence}</h3>
                {employee.examples.map((ex) => (
                  <Link
                    key={`${ex.id}-${ex.reason}`}
                    href="/dashboard/chat"
                    className="grid gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1",
                          ex.positive
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-destructive/20 bg-destructive/10 text-destructive",
                        )}
                      >
                        {ex.positive ? <ThumbsUp /> : <ThumbsDown />}
                        {ex.reason}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{T.dot(`#${ex.id}`, ex.time)}</span>
                    </div>
                    <p>
                      <span className="text-muted-foreground">{T.customer}</span>
                      {ex.customer}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{T.employee}</span>
                      {ex.reply}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function EmployeeEvaluation() {
  const [open, setOpen] = React.useState<EmployeeEval | null>(null);
  return (
    <section className="@container/eval flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-xl tracking-tight">{T.heading}</h2>
        <p className="text-muted-foreground text-sm">{T.sub}</p>
      </div>
      {/* 4 أعمدة على العريض (1440)، وعمودان أو 3 على 1024، بحسب عرض المحتوى لا عرض الشاشة. */}
      <div className="grid @3xl/eval:grid-cols-3 @5xl/eval:grid-cols-4 @lg/eval:grid-cols-2 grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
        {employees.map((e) => {
          const up = e.trend > 0;
          return (
            <Card
              key={e.id}
              role="button"
              tabIndex={0}
              aria-label={T.open(e.name)}
              onClick={() => setOpen(e)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setOpen(e);
                }
              }}
              className="cursor-pointer transition-colors hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted font-medium text-muted-foreground text-sm">
                    {e.name.charAt(0)}
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium text-sm leading-snug">{e.name}</span>
                    <span className="font-normal text-muted-foreground text-xs">{e.team}</span>
                  </span>
                </CardTitle>
                <CardAction>
                  <span
                    role="img"
                    aria-label={up ? T.trendUp : T.trendDown}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border",
                      up
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-destructive/20 bg-destructive/10 text-destructive",
                    )}
                  >
                    {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-3xl tabular-nums leading-none tracking-tight">
                    {T.pct(e.positive)}
                  </span>
                  <span className="text-muted-foreground text-sm">{T.positive}</span>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">{T.negative(100 - e.positive)}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <EmployeeSheet employee={open} onClose={() => setOpen(null)} />
    </section>
  );
}
