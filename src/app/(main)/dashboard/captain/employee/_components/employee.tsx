"use client";
// موظف الذكاء البشري (بنود فهد 5-11، والمقترح المدموج القسم 3): شريط 3 خطوات قابلة للضغط وغير مقفلة
// (الاتفاق ← طريقة العمل ← التشغيل)، وتظهر خطوة واحدة في كل مرة. بيانات تجريبية وحالة محلية فقط.
import * as React from "react";

import { cn } from "cn";
import { Bot, Check, Inbox, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CaptainShell } from "../../_components/shared";
import { AgreementStep, type Message } from "./agreement-step";
import { AssistantSwitcher } from "./assistant-switcher";
import {
  type EmployeeSettings,
  initialSettings,
  LIVE_DISCOVERY_T,
  type StepKey,
  sectorOptions,
  steps,
  T,
} from "./data";
import { HumanInbox } from "./human-inbox";
import { LaunchStep } from "./launch-step";
import { WorkStep } from "./work-step";

interface TodayIssue {
  id: string;
  title: string;
  inbox: string;
  count: number;
  action: "solve" | "suggest" | "escalate";
}

const DEFAULT_ISSUES: TodayIssue[] = [
  {
    id: "iss-1",
    title: "استفسار متكرر عن تأخر تفعيل الباقة بعد السداد",
    inbox: "صندوق واتساب المبيعات",
    count: 14,
    action: "solve",
  },
  {
    id: "iss-2",
    title: "طلب استرجاع فرق الفاتورة الشهرية",
    inbox: "صندوق الفوترة",
    count: 8,
    action: "suggest",
  },
  {
    id: "iss-3",
    title: "انقطاع الراوتر المتكرر في الفترة المسائية",
    inbox: "صندوق الدعم الفني",
    count: 19,
    action: "escalate",
  },
];

function Stepper({
  current,
  done,
  onPick,
}: {
  current: StepKey;
  done: Record<StepKey, boolean>;
  onPick: (step: StepKey) => void;
}) {
  return (
    <nav aria-label={T.stepsLabel}>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((st, i) => {
          const active = st.key === current;
          return (
            <li key={st.key}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onPick(st.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-start outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "border-primary bg-primary/5 hover:bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border font-medium text-sm tabular-nums",
                    active && "border-primary bg-primary text-primary-foreground",
                    !active &&
                      done[st.key] &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    !active && !done[st.key] && "text-muted-foreground",
                  )}
                >
                  {!active && done[st.key] ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium text-sm">{st.label}</span>
                  <span className="text-muted-foreground text-xs">{st.desc}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function EmployeePage() {
  const [saved, setSaved] = React.useState<EmployeeSettings>(initialSettings);
  const [s, setS] = React.useState<EmployeeSettings>(initialSettings);
  const [step, setStep] = React.useState<StepKey>("agree");
  const [visited, setVisited] = React.useState<Record<StepKey, boolean>>({ agree: false, work: false, launch: false });
  const [launched, setLaunched] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([{ id: 1, role: "assistant", text: T.greeting }]);
  const [issues, setIssues] = React.useState<TodayIssue[]>(DEFAULT_ISSUES);
  const [scanning, setScanning] = React.useState(false);
  const top = React.useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const emp = res?.state?.employee;
        if (emp) {
          const merged: EmployeeSettings = {
            ...initialSettings,
            ...emp,
          };
          setS(merged);
          setSaved(merged);
          if (emp.launched) {
            setLaunched(true);
          }
          if (Array.isArray(emp.todayIssues) && emp.todayIssues.length > 0) {
            setIssues(emp.todayIssues);
          }
        }
      })
      .catch(() => {});
  }, []);

  const syncEmployee = React.useCallback(
    async (nextState: EmployeeSettings & { launched?: boolean }): Promise<boolean> => {
      try {
        const res = await fetch("/api/captain-engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "employee.save",
            employee: nextState,
          }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { ok?: boolean };
        return Boolean(data?.ok);
      } catch {
        return false;
      }
    },
    [],
  );

  const patch = (p: Partial<EmployeeSettings>) =>
    setS((old) => {
      const next = Object.assign({}, old, p);
      void syncEmployee(next);
      return next;
    });

  async function rescanInboxes() {
    setScanning(true);
    try {
      const r = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "employee.learn",
          size: s.size,
          sampleSize: s.size,
          source: s.source,
          sector: s.sector,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const res = await r.json();
      if (!res?.ok) throw new Error("Failed");
      if (Array.isArray(res?.state?.employee?.todayIssues)) {
        setIssues(res.state.employee.todayIssues);
      }
      toast.success(LIVE_DISCOVERY_T.learnedToast);
    } catch {
      toast.error("تعذر تحديث ذاكرة الموظف من الخادم، يرجى المحاولة مجدداً");
    } finally {
      setScanning(false);
    }
  }

  function goTo(next: StepKey) {
    setStep(next);
    requestAnimationFrame(() => {
      const el = top.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function say(text: string) {
    const term = text.trim();
    if (!term) return;
    const now = Date.now();
    setMessages((list) => [
      ...list,
      { id: now, role: "user", text: term },
      { id: now + 1, role: "assistant", text: T.replyAdded(term) },
    ]);
    setS((old) => {
      const next = old.terms.includes(term) ? old : Object.assign({}, old, { terms: [...old.terms, term] });
      void syncEmployee(next);
      return next;
    });
  }

  function finishAgreement() {
    if (s.terms.length && !s.agreed) {
      patch({ agreed: true });
      setMessages((list) => [...list, { id: Date.now(), role: "assistant", text: T.replyDone(s.terms.length) }]);
    }
    setVisited((v) => Object.assign({}, v, { agree: true }));
    goTo("work");
  }

  async function launch() {
    const ok = await syncEmployee({ ...s, launched: true });
    if (!ok) {
      toast.error("تعذر حفظ إعدادات الموظف في الخادم");
      return;
    }
    setSaved(s);
    setLaunched(true);
    setVisited((v) => Object.assign({}, v, { launch: true }));
    if (s.active) toast.success(T.launched);
    else toast.success(T.savedStopped);
  }

  const done: Record<StepKey, boolean> = {
    agree: s.agreed || visited.agree,
    work: visited.work,
    launch: launched,
  };

  return (
    <CaptainShell title={T.title} subtitle={T.subtitle} nav={false} switcher={false} actions={<AssistantSwitcher />}>
      <div ref={top} className="flex scroll-mt-4 flex-col gap-4">
        {/* بطاقة الهوية الحية: اسم الموظف + قطاع الشركة + ما اكتشفه اليوم من صناديق الموظفين */}
        <Card className="border-sky-500/25 bg-linear-to-br from-sky-500/10 via-primary/5 to-card">
          <CardHeader className="gap-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <Bot className="size-4" />
                </span>
                <CardTitle className="text-base">{LIVE_DISCOVERY_T.cardTitle}</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <Inbox className="size-3.5" />
                  {LIVE_DISCOVERY_T.inboxesBadge}
                </Badge>
                <Button size="sm" variant="outline" onClick={rescanInboxes} disabled={scanning}>
                  <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} />
                  {scanning ? LIVE_DISCOVERY_T.scanning : LIVE_DISCOVERY_T.rescanBtn}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2">
                <span className="shrink-0 font-medium text-muted-foreground text-xs">{LIVE_DISCOVERY_T.nameLabel}</span>
                <Input
                  value={s.name ?? "إيمه"}
                  onChange={(e) => patch({ name: e.target.value })}
                  className="h-7 border-0 bg-transparent px-1 font-semibold text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2">
                <span className="shrink-0 font-medium text-muted-foreground text-xs">
                  {LIVE_DISCOVERY_T.sectorLabel}
                </span>
                <Select value={s.sector ?? "cars"} onValueChange={(v) => patch({ sector: v })}>
                  <SelectTrigger className="h-7 flex-1 border-0 bg-transparent px-1 font-semibold text-sm shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectorOptions.map((sec) => (
                      <SelectItem key={sec.value} value={sec.value}>
                        {sec.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2.5 pt-0 sm:grid-cols-3">
            {issues.map((iss) => (
              <div key={iss.id} className="flex flex-col justify-between gap-2 rounded-xl border bg-background/80 p-3">
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-1.5 text-xs">
                    <span className="font-medium text-muted-foreground">{iss.inbox}</span>
                    <Badge variant="secondary" className="tabular-nums text-[11px]">
                      {`${iss.count} محادثة`}
                    </Badge>
                  </div>
                  <p className="font-medium text-xs leading-relaxed">{iss.title}</p>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const order: TodayIssue["action"][] = ["solve", "suggest", "escalate"];
                      const nextAct = order[(order.indexOf(iss.action) + 1) % order.length];
                      const nextIssues = issues.map((x) => (x.id === iss.id ? { ...x, action: nextAct } : x));
                      setIssues(nextIssues);
                      void syncEmployee({ ...s, todayIssues: nextIssues } as EmployeeSettings & {
                        todayIssues?: TodayIssue[];
                      });
                      toast.success("تم تحديث إجراء المعالجة وحفظه في الخادم");
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-[11px] text-primary transition-colors hover:bg-primary/10"
                  >
                    <Sparkles className="size-3" />
                    {iss.action === "solve"
                      ? LIVE_DISCOVERY_T.solveAction
                      : iss.action === "suggest"
                        ? LIVE_DISCOVERY_T.suggestAction
                        : LIVE_DISCOVERY_T.escalateAction}
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <HumanInbox />

        <Stepper current={step} done={done} onPick={goTo} />

        {step === "agree" && (
          <AgreementStep s={s} patch={patch} messages={messages} onSay={say} onNext={finishAgreement} />
        )}
        {step === "work" && (
          <WorkStep
            s={s}
            patch={patch}
            onBack={() => goTo("agree")}
            onNext={() => {
              setVisited((v) => Object.assign({}, v, { work: true }));
              goTo("launch");
            }}
          />
        )}
        {step === "launch" && (
          <LaunchStep
            s={s}
            patch={patch}
            dirty={dirty}
            launched={launched}
            running={launched && saved.active}
            goTo={goTo}
            onRevert={() => {
              void (async () => {
                const ok = await syncEmployee(saved);
                if (!ok) {
                  toast.error("تعذر استعادة الإعدادات من الخادم");
                  return;
                }
                setS(saved);
                toast(T.reverted);
              })();
            }}
            onLaunch={() => void launch()}
          />
        )}
      </div>
    </CaptainShell>
  );
}
