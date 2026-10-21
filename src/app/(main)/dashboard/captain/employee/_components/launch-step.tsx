"use client";
// الخطوة الثالثة «التشغيل» (خريطة صفحة الذكاء 35: موظف موجود يعمل بخيار تنشيط): المفتاح، وملخص قصير، و«تشغيل».
import type * as React from "react";

import { ArrowLeftRight, BookOpen, Briefcase, Database, GraduationCap, ListChecks, Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { type Tone, ToneBadge } from "../../_components/shared";
import {
  doesOptions,
  type EmployeeSettings,
  type Patch,
  pickLists,
  type StepKey,
  sizeOptions,
  sourceOptions,
  T,
  type WorkKey,
  workOptions,
} from "./data";
import { IconSquare, SwitchRow } from "./ui";

function SummaryRow({
  icon,
  label,
  value,
  onEdit,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <li className="flex items-center gap-3 p-3">
      <IconSquare icon={icon} />
      <div className="grid flex-1 gap-0.5">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-medium text-sm leading-snug">{value}</span>
      </div>
      <Button variant="ghost" onClick={onEdit}>
        {T.edit}
      </Button>
    </li>
  );
}

export function LaunchStep({
  s,
  patch,
  dirty,
  launched,
  running,
  goTo,
  onRevert,
  onLaunch,
}: {
  s: EmployeeSettings;
  patch: Patch;
  dirty: boolean;
  launched: boolean;
  running: boolean;
  goTo: (step: StepKey) => void;
  onRevert: () => void;
  onLaunch: () => void;
}) {
  const learnKeys = (Object.keys(workOptions) as WorkKey[]).filter((k) => s.work[k]);
  const learnValue = learnKeys.map((k) => workOptions[k].label).join(T.listSep);
  const source = sourceOptions.find((o) => o.value === s.source)?.label ?? "";
  const pickValue = pickLists[s.source] ? `: ${s.pick || T.sumPickMissing}` : "";
  const size = sizeOptions.find((o) => o.value === s.size);
  const status: { tone: Tone; label: string } = launched
    ? { tone: running ? "green" : "amber", label: running ? T.running : T.stopped }
    : { tone: "muted", label: T.notLaunched };

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{T.launchTitle}</CardTitle>
          <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
        </div>
        <CardDescription>{T.launchDesc}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        <div className="rounded-lg border">
          <SwitchRow
            icon={Power}
            label={T.activeLabel}
            desc={T.activeDesc}
            checked={s.active}
            onChange={(v) => patch({ active: v })}
          />
        </div>

        <div className="grid gap-2">
          <span className="font-medium text-sm">{T.summaryTitle}</span>
          <ul className="divide-y rounded-lg border">
            <SummaryRow
              icon={ListChecks}
              label={T.sumTerms}
              value={T.sumTermsValue(s.terms.length)}
              onEdit={() => goTo("agree")}
            />
            <SummaryRow
              icon={Briefcase}
              label={T.sumMode}
              value={
                [...doesOptions.filter((o) => s.does[o.value]).map((o) => o.desc), ...(s.auto ? [T.autoOn] : [])].join(
                  T.listSep,
                ) || T.doesNone
              }
              onEdit={() => goTo("work")}
            />
            <SummaryRow
              icon={GraduationCap}
              label={T.sumLearn}
              value={learnValue || T.sumLearnNone}
              onEdit={() => goTo("work")}
            />
            <SummaryRow
              icon={Database}
              label={T.sumSource}
              value={`${source}${pickValue}`}
              onEdit={() => goTo("work")}
            />
            <SummaryRow
              icon={BookOpen}
              label={T.sumSize}
              value={size ? `${size.label}${T.listSep}${size.cost} ${T.points}` : ""}
              onEdit={() => goTo("work")}
            />
            <SummaryRow icon={ArrowLeftRight} label={T.sumHandoff} value={s.handoff} onEdit={() => goTo("work")} />
          </ul>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t py-4">
        {dirty && launched && (
          <>
            <span className="me-auto text-muted-foreground text-sm">{T.unsaved}</span>
            <Button variant="outline" onClick={onRevert}>
              {T.revert}
            </Button>
          </>
        )}
        <Button onClick={onLaunch} disabled={launched && !dirty}>
          <Power />
          {s.active ? T.launch : T.saveStopped}
        </Button>
      </CardFooter>
    </Card>
  );
}
