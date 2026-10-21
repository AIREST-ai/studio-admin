"use client";
// قطع الواجهة المشتركة لصفحة المقيّم (تبسيط المقترح المدموج، القسم 4): كل قسم عنصر Accordion عنوانه يعرض
// القيمة الحالية في سطر رمادي، وداخله كتل قصيرة بلا بطاقات، والباقي تحت «إعدادات متقدمة» المطوية.
import * as React from "react";

import { cn } from "cn";
import { ChevronDown, type LucideIcon, Plus, X } from "lucide-react";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Rule } from "./state";

const T = {
  add: "إضافة",
  remove: "حذف",
  advanced: "إعدادات متقدمة",
};

export function IconBox({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}

// عنصر Accordion واحد: أيقونة وعنوان، وتحته القيمة الحالية في سطر رمادي صغير.
export function SettingsSection({
  value,
  icon,
  title,
  summary,
  children,
}: {
  value: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="items-center gap-3 rounded-none px-4 py-3.5 text-start hover:bg-muted/30 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <IconBox icon={icon} />
          <span className="grid min-w-0 gap-0.5">
            <span className="font-medium text-sm">{title}</span>
            <span className="truncate font-normal text-muted-foreground text-xs">{summary}</span>
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="grid h-auto gap-6 px-4 pt-2 pb-5 [&_a]:no-underline">{children}</AccordionContent>
    </AccordionItem>
  );
}

// «إعدادات متقدمة» داخل القسم: مطوية افتراضياً.
export function Advanced({ children }: { children: React.ReactNode }) {
  return (
    <Collapsible className="group/advanced grid gap-4 border-t pt-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-fit text-muted-foreground">
          <ChevronDown className="transition-transform group-data-[state=open]/advanced:rotate-180" />
          {T.advanced}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-6">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// كتلة داخل القسم: عنوان قصير ووصف اختياري وعنصر تحكم في طرفه.
export function Block({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-48 flex-1 gap-0.5">
          <span className="font-medium text-sm">{title}</span>
          {description && <span className="text-muted-foreground text-xs leading-snug">{description}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// صفوف متتالية داخل إطار واحد، كل صف عنوان قصير وعنصر تحكم في طرفه.
export function Rows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y rounded-lg border">{children}</div>;
}

export function Row({
  title,
  hint,
  control,
  children,
  muted,
}: {
  title: string;
  hint?: string;
  control?: React.ReactNode;
  children?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="grid gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-40 flex-1 gap-0.5">
          <span className={cn("font-medium text-sm", muted && "text-muted-foreground")}>{title}</span>
          {hint && <span className="text-muted-foreground text-xs leading-snug">{hint}</span>}
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}

export function SwitchRow({
  title,
  hint,
  checked,
  onChange,
  children,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <Row
      title={title}
      hint={hint}
      muted={!checked}
      control={<Switch checked={checked} onCheckedChange={onChange} aria-label={title} />}
    >
      {checked && children}
    </Row>
  );
}

// اختيار مقسّم قياسي (قائمة تبويبات صغيرة) لخيارين أو ثلاثة.
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string; icon?: LucideIcon }[];
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as V)} className={className}>
      <TabsList className="h-8 max-w-full overflow-x-auto [scrollbar-width:none]">
        {options.map((o) => (
          <TabsTrigger key={o.value} value={o.value} className="px-2.5">
            {o.icon && <o.icon />}
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function ChoiceCards<V extends string>({
  value,
  onChange,
  options,
  cols = "sm:grid-cols-3",
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string; desc?: string; icon?: LucideIcon }[];
  cols?: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as V)} className={cn("grid gap-2", cols)}>
      {options.map((o) => (
        <Label
          key={o.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/40",
            value === o.value && "border-primary bg-primary/5 hover:bg-primary/5",
          )}
        >
          <RadioGroupItem value={o.value} className="mt-0.5" />
          <div className="grid gap-1">
            <span className="flex items-center gap-1.5 font-medium text-sm">
              {o.icon && <o.icon className="size-3.5 text-muted-foreground" />}
              {o.label}
            </span>
            {o.desc && <span className="text-muted-foreground text-xs leading-snug">{o.desc}</span>}
          </div>
        </Label>
      ))}
    </RadioGroup>
  );
}

// «ضع خيارات بيدك، احذف خيارات لا تريدها» (البند 37): شرائح قابلة للحذف وحقل إضافة واحد.
export function EditableList({
  items,
  onChange,
  placeholder,
  tone = "muted",
  extra,
}: {
  items: Rule[];
  onChange: (next: Rule[]) => void;
  placeholder: string;
  tone?: "muted" | "pos" | "neg";
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const text = draft.trim();
    if (!text || items.some((i) => i.text === text)) return;
    onChange([...items, { id: Date.now(), text }]);
    setDraft("");
  };
  const chip = {
    muted: "bg-muted/50",
    pos: "border-emerald-500/25 bg-emerald-500/5",
    neg: "border-destructive/25 bg-destructive/5",
  }[tone];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span
            key={i.id}
            className={cn("inline-flex items-center gap-1 rounded-full border py-0.5 ps-3 pe-0.5 text-sm", chip)}
          >
            {i.text}
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground"
              aria-label={`${T.remove} ${i.text}`}
              onClick={() => onChange(items.filter((x) => x.id !== i.id))}
            >
              <X />
            </Button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-0 flex-1 basis-56"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <Button variant="outline" disabled={!draft.trim()} onClick={add}>
          <Plus /> {T.add}
        </Button>
        {extra}
      </div>
    </div>
  );
}
