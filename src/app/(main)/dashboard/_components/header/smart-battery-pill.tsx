"use client";

import * as React from "react";

import Link from "next/link";

import { BatteryCharging, EyeOff, MessageSquareText, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const T = {
  pillLabel: "البطارية الذكية",
  title: "مؤشر البطارية الذكية للرصيد",
  subtitle: "قيم معاينة ثابتة — لا تمثل رصيداً حقيقياً",
  aiTitle: "رصيد الذكاء الاصطناعي (إيمه + المقيّم)",
  waTitle: "رصيد واتساب والقوالب",
  overview: "فتح نظرة عامة للذكاء",
  mock: "معاينة",
  mockHint: "الأرقام ثابتة للعرض فقط. الشحن الحقيقي يُفعل لاحقاً.",
};

export function SmartBatteryPill() {
  // MOCK PREVIEW — static values only, no live fetch
  const aiAvailable = 12480;
  const aiDays = 63;
  const aiPct = 92;
  const waCredit = "1,450";
  const waConvs = 3850;
  const waTemplates = 16;

  const aiCells = Math.max(1, Math.min(10, Math.round(aiPct / 10)));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={T.title}
          className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 text-xs transition-colors hover:bg-emerald-500/15 sm:inline-flex dark:text-emerald-300"
        >
          <EyeOff className="size-3 text-muted-foreground" />
          <BatteryCharging className="size-3.5" />
          <span>{T.pillLabel}</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-[11px] tabular-nums">
            {`${aiDays} يوماً`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3.5">
        <div className="grid gap-3">
          <div className="grid gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{T.title}</span>
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 text-[10px] dark:text-amber-300"
              >
                <EyeOff className="size-2.5" />
                {T.mock}
              </Badge>
            </div>
            <span className="text-muted-foreground text-xs">{T.subtitle}</span>
          </div>

          <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="size-3.5 text-emerald-600" />
                {T.aiTitle}
              </span>
              <Badge variant="secondary" className="text-[9px]">
                {T.mock}
              </Badge>
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
              {`${aiAvailable.toLocaleString("en-US")} نقطة (معاينة)`}
            </span>
          </div>

          <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <MessageSquareText className="size-3.5 text-sky-600" />
                {T.waTitle}
              </span>
              <Badge variant="secondary" className="text-[9px]">
                {T.mock}
              </Badge>
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
              {`${waCredit} ر.س (معاينة ثابتة) · ${waConvs.toLocaleString("en-US")} محادثة · ${waTemplates} قالباً`}
            </span>
          </div>

          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-amber-700 text-[11px] leading-relaxed dark:text-amber-300">
            {T.mockHint}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" className="flex-1" disabled>
              <EyeOff className="size-3.5" />
              الشحن معاينة
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
