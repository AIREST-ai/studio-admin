"use client";

import * as React from "react";
import Link from "next/link";

import { BatteryCharging, MessageSquareText, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const T = {
  pillLabel: "البطارية الذكية",
  title: "مؤشر البطارية الذكية للرصيد",
  subtitle: "يقيس الرصيد بأيام التغطية الفعلية لتشحن أي مبلغ بلا سقف",
  aiTitle: "رصيد الذكاء الاصطناعي (إيمه + المقيّم)",
  waTitle: "رصيد واتساب والقوالب",
  topup: "شحن الرصيد والفوترة",
  overview: "فتح نظرة عامة للذكاء",
};

export function SmartBatteryPill() {
  const [aiAvailable, setAiAvailable] = React.useState(12480);
  const [aiDays, setAiDays] = React.useState(63);
  const [aiPct, setAiPct] = React.useState(92);
  const [waCredit, setWaCredit] = React.useState("1,450");
  const [waConvs, setWaConvs] = React.useState(3850);
  const [waTemplates, setWaTemplates] = React.useState(16);
  const [waDays, setWaDays] = React.useState(48);

  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const ai = res?.state?.balance?.ai;
        const wa = res?.state?.balance?.whatsapp;
        if (ai && typeof ai.available === "number") {
          setAiAvailable(ai.available);
          if (typeof ai.daysLeft === "number") setAiDays(ai.daysLeft);
          if (typeof ai.batteryPct === "number") setAiPct(ai.batteryPct);
        }
        if (wa) {
          if (wa.availableCredit) setWaCredit(String(wa.availableCredit));
          if (typeof wa.remainingConversations === "number") setWaConvs(wa.remainingConversations);
          if (typeof wa.approvedTemplates === "number") setWaTemplates(wa.approvedTemplates);
          if (typeof wa.daysLeft === "number") setWaDays(wa.daysLeft);
        }
      })
      .catch(() => {});
  }, []);

  const aiCells = Math.max(1, Math.min(10, Math.round(aiPct / 10)));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={T.title}
          className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 text-xs transition-colors hover:bg-emerald-500/15 sm:inline-flex dark:text-emerald-300"
        >
          <BatteryCharging className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{T.pillLabel}</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-[11px] tabular-nums">
            {`${aiDays} يوماً`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3.5">
        <div className="grid gap-3">
          <div className="grid gap-0.5">
            <span className="font-semibold text-sm">{T.title}</span>
            <span className="text-muted-foreground text-xs">{T.subtitle}</span>
          </div>

          <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="size-3.5 text-emerald-600" />
                {T.aiTitle}
              </span>
              <span className="font-semibold text-emerald-600 tabular-nums">{`${aiPct}%`}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={i < aiCells ? "h-2 flex-1 rounded-xs bg-emerald-500" : "h-2 flex-1 rounded-xs bg-muted"}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-[11px]">
              {`${aiAvailable.toLocaleString("en-US")} نقطة · يكفي نحو ${aiDays} يوماً`}
            </span>
          </div>

          <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <MessageSquareText className="size-3.5 text-sky-600" />
                {T.waTitle}
              </span>
              <span className="font-semibold text-sky-600 tabular-nums">80%</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={i < 8 ? "h-2 flex-1 rounded-xs bg-sky-500" : "h-2 flex-1 rounded-xs bg-muted"}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-[11px]">
              {`${waCredit} ر.س · ${waConvs.toLocaleString("en-US")} محادثة · ${waTemplates} قالباً · يكفي نحو ${waDays} يوماً`}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" className="flex-1" asChild>
              <Link href="/dashboard/settings/billing">
                <Plus className="size-3.5" />
                {T.topup}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/captain">{T.overview}</Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
