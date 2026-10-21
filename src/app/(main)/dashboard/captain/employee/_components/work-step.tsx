"use client";
// الخطوة الثانية «طريقة العمل» (البنود 7-10، وخريطة صفحة الذكاء 32، 39، 40): أربع بطاقات قصيرة،
// والباقي تحت «إعدادات متقدمة» مطوية.
import * as React from "react";

import { cn } from "cn";
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  Coins,
  Database,
  GraduationCap,
  Settings2,
  Zap,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  type DoesKey,
  doesOptions,
  type EmployeeSettings,
  handoffOptions,
  learningKeys,
  type Patch,
  pickLists,
  type SourceKey,
  sizeOptions,
  sourceOptions,
  T,
  workOptions,
} from "./data";
import { IconSquare, ShortCard, SwitchRow } from "./ui";

// أزرار مقسّمة لخيارين أو ثلاثة (القاعدة 5)، بحواف منطقية تصلح للاتجاهين.
function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v)}
      className="w-full rounded-lg border bg-muted/50 p-1"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="flex-1 text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function SettingRow({
  icon,
  label,
  desc,
  children,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <IconSquare icon={icon} />
        <div className="grid flex-1 gap-1">
          <span className="font-medium text-sm">{label}</span>
          <span className="text-muted-foreground text-xs leading-snug">{desc}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export function WorkStep({
  s,
  patch,
  onBack,
  onNext,
}: {
  s: EmployeeSettings;
  patch: Patch;
  onBack: () => void;
  onNext: () => void;
}) {
  const [advanced, setAdvanced] = React.useState(false);
  const source = sourceOptions.find((o) => o.value === s.source);
  const size = sizeOptions.find((o) => o.value === s.size);
  const pickList = pickLists[s.source];
  const setWork = (key: keyof EmployeeSettings["work"], v: boolean) =>
    patch({ work: Object.assign({}, s.work, { [key]: v }) });

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <ShortCard icon={Briefcase} title={T.modeTitle} description={T.modeDesc}>
          <ToggleGroup
            type="multiple"
            spacing={1}
            aria-label={T.modeTitle}
            value={doesOptions.filter((o) => s.does[o.value]).map((o) => o.value)}
            onValueChange={(v) =>
              patch({
                does: Object.fromEntries(doesOptions.map((o) => [o.value, v.includes(o.value)])) as Record<
                  DoesKey,
                  boolean
                >,
              })
            }
            className="w-full rounded-lg border bg-muted/50 p-1"
          >
            {doesOptions.map((o) => (
              <ToggleGroupItem
                key={o.value}
                value={o.value}
                title={o.desc}
                className="flex-1 text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >
                {s.does[o.value] && <Check />}
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {doesOptions.some((o) => s.does[o.value])
              ? doesOptions
                  .filter((o) => s.does[o.value])
                  .map((o) => o.desc)
                  .join(T.listSep)
              : T.doesNone}
          </p>
          <div className="rounded-lg border">
            <SwitchRow
              icon={Zap}
              label={T.autoLabel}
              desc={T.autoDesc}
              checked={s.auto}
              onChange={(v) => patch({ auto: v })}
            />
          </div>
        </ShortCard>

        <ShortCard icon={GraduationCap} title={T.learnTitle} description={T.learnDesc}>
          <div className="divide-y rounded-lg border">
            {learningKeys.map((k) => (
              <SwitchRow
                key={k}
                icon={workOptions[k].icon}
                label={workOptions[k].label}
                desc={workOptions[k].desc}
                checked={s.work[k]}
                onChange={(v) => setWork(k, v)}
              />
            ))}
          </div>
        </ShortCard>

        <ShortCard icon={Database} title={T.sourceTitle} description={T.sourceDesc}>
          <Select value={s.source} onValueChange={(v) => patch({ source: v as SourceKey, pick: "" })}>
            <SelectTrigger className="w-full" aria-label={T.sourceTitle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {sourceOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <o.icon className="text-muted-foreground" />
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {source && <p className="text-muted-foreground text-sm">{source.desc}</p>}
          {pickList && (
            <div className="grid gap-2">
              <Label>{pickList.label}</Label>
              <Select value={s.pick} onValueChange={(v) => patch({ pick: v })}>
                <SelectTrigger className="w-full" aria-label={pickList.label}>
                  <SelectValue placeholder={T.pickPlaceholder} />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {pickList.items.map((it) => (
                      <SelectItem key={it} value={it}>
                        {it}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {!s.pick && <p className="text-muted-foreground text-xs">{T.pickMissing}</p>}
            </div>
          )}
        </ShortCard>

        <ShortCard icon={BookOpen} title={T.sizeTitle} description={T.sizeDesc}>
          <Segmented label={T.sizeTitle} value={s.size} onChange={(v) => patch({ size: v })} options={sizeOptions} />
          {size && <p className="text-muted-foreground text-sm">{size.desc}</p>}
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <Coins className="size-4 text-amber-500" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{T.costNote}</span>
              <span className="font-medium text-foreground tabular-nums">
                {`${T.costLabel}: ${size?.cost ?? 0} ${T.points}`}
              </span>
            </AlertDescription>
          </Alert>
        </ShortCard>
      </div>

      <Collapsible open={advanced} onOpenChange={setAdvanced} className="rounded-xl bg-card ring-1 ring-foreground/10">
        <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-xl p-4 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <IconSquare icon={Settings2} />
          <div className="grid flex-1 gap-1">
            <span className="font-medium text-base">{T.advancedTitle}</span>
            <span className="text-muted-foreground text-sm">{T.advancedDesc}</span>
          </div>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", advanced && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-4 border-t p-4">
          <div className="divide-y rounded-lg border">
            <SwitchRow
              icon={workOptions.review.icon}
              label={workOptions.review.label}
              desc={workOptions.review.desc}
              checked={s.work.review}
              onChange={(v) => setWork("review", v)}
            />
          </div>
          <div className="grid gap-2">
            <div className="grid gap-0.5">
              <span className="font-medium text-sm">{T.prevTitle}</span>
              <span className="text-muted-foreground text-xs">{T.prevDesc}</span>
            </div>
            <div className="divide-y rounded-lg border">
              <SettingRow icon={ArrowLeftRight} label={T.handoffLabel} desc={T.handoffDesc}>
                <Select value={s.handoff} onValueChange={(v) => patch({ handoff: v })}>
                  <SelectTrigger className="w-full sm:w-60" aria-label={T.handoffLabel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
                    <SelectGroup>
                      {handoffOptions.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </SettingRow>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          {T.back}
        </Button>
        <Button onClick={onNext}>
          {T.next}
          <ArrowRight className="rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
