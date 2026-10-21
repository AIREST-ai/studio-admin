"use client";
// قسم «معايير التقييم»: المجال ومشاكل العملاء (31)، أسباب الضعف (32، 33، 34)، المعايير الإيجابية (38)،
// إضافة وحذف بيدك (37). ومتقدم: كتابة السبب عند الضعف الفردي (33)، والجودة ونسبتها (41).
// وقسم «الصلاحيات والحدود»: قيمة التقييم (42، معتمدة سابقاً: حصة الذكاء 10/20/30٪ والباقي لرد العميل، لا تُرفع
// فوق 30٪)، عرض الإيجابي والسلبي أو أحدهما (45)، والحدود باليوم والأسبوع والشهر (46)، ومتقدم: صلاحيات الإدارة (43–45).
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";

import { AdminPerms } from "./group-persona";
import { type EvalSettings, useEval } from "./state";
import { Advanced, Block, EditableList, Row, Rows, Segmented, SwitchRow } from "./ui";

const T = {
  field: "المجال ومشاكل العملاء",
  fieldDesc: "ليفهم المقيّم عملك وما يشتكي منه عملاؤك.",
  fieldLabel: "نوع المجال",
  fields: [
    { value: "store", label: "متجر إلكتروني" },
    { value: "food", label: "مطعم أو مقهى" },
    { value: "clinic", label: "عيادة" },
    { value: "telecom", label: "اتصالات وإنترنت" },
    { value: "estate", label: "عقارات" },
    { value: "other", label: "أخرى" },
  ],
  problems: "مشاكل يشتكي منها العملاء",
  problemAdd: "أضف مشكلة…",
  weak: "أسباب الضعف",
  weakDesc: "ما يُحسب على الموظف. أضف ما تريد واحذف ما لا تريد.",
  weakAdd: "أضف سبباً…",
  weakReason: "كتابة السبب عند الضعف الفردي",
  weakReasonHint: "حين لا يعرف الموظف الإجابة ثم لا يرد، يكتب المقيّم السبب.",
  positive: "معايير إيجابية",
  positiveDesc: "ما يُحسب للموظف. أضف ما تريد واحذف ما لا تريد.",
  positiveAdd: "أضف معياراً…",
  talk: "أضف بالحديث مع الذكاء",
  quality: "الجودة",
  qualityDesc: "ما يقيسه المقيّم، والنسبة التي تُعد بعدها المحادثة جيدة.",
  qualityList: [
    { key: "speed", label: "سرعة الرد" },
    { key: "accuracy", label: "دقة المعلومة" },
    { key: "manners", label: "اللباقة" },
    { key: "solve", label: "حل المشكلة" },
    { key: "followup", label: "المتابعة" },
  ],
  pass: "نسبة الجودة المطلوبة",
  pct: (n: number) => `${n}٪`,
  value: "قيمة التقييم",
  valueDesc: "حصة تقييم الذكاء من درجة الموظف.",
  aiShare: "حصة الذكاء",
  ai: (n: number) => `الذكاء ${n}٪`,
  customer: (n: number) => `رد العميل ${n}٪`,
  valueNote: "المقترح 30٪. لا تُرفع فوق 30٪ لكي لا يُظلم الموظف.",
  display: "العرض والحدود",
  show: "ما يظهر من التقييم",
  both: "الاثنان",
  posOnly: "الإيجابي",
  negOnly: "السلبي",
  limits: "الحدود",
  limitsHint: "أقصى عدد تقييمات.",
  day: "باليوم",
  week: "بالأسبوع",
  month: "بالشهر",
  sumWeak: (n: number) => `أسباب الضعف: ${n}`,
  sumPositive: (n: number) => `معايير إيجابية: ${n}`,
  sumQuality: (n: number) => `الجودة ${n}٪`,
  sumShare: (n: string) => `حصة الذكاء ${n}٪`,
  sumShow: (v: string) => `يظهر: ${v}`,
  sumDay: (n: number) => `${n} تقييم باليوم`,
};

export function criteriaSummary(s: EvalSettings) {
  const field = T.fields.find((f) => f.value === s.field)?.label ?? "";
  return [field, T.sumWeak(s.weak.length), T.sumPositive(s.positive.length), T.sumQuality(s.qualityPct)].join(" · ");
}

export function limitsSummary(s: EvalSettings) {
  const show = { both: T.both, pos: T.posOnly, neg: T.negOnly }[s.show as "both" | "pos" | "neg"] ?? T.both;
  return [T.sumShare(s.aiShare), T.sumShow(show), T.sumDay(s.limitDay)].join(" · ");
}

function Field() {
  const { s, set } = useEval();
  return (
    <Block title={T.field} description={T.fieldDesc}>
      <div className="flex flex-wrap items-center gap-3">
        <Label>{T.fieldLabel}</Label>
        <NativeSelect className="w-52" value={s.field} onChange={(e) => set("field", e.target.value)}>
          {T.fields.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label>{T.problems}</Label>
        <EditableList items={s.problems} onChange={(v) => set("problems", v)} placeholder={T.problemAdd} />
      </div>
    </Block>
  );
}

function Weakness() {
  const { s, set } = useEval();
  return (
    <Block title={T.weak} description={T.weakDesc}>
      <EditableList items={s.weak} onChange={(v) => set("weak", v)} placeholder={T.weakAdd} tone="neg" />
    </Block>
  );
}

function WeakReason() {
  const { s, set } = useEval();
  return (
    <Rows>
      <SwitchRow
        title={T.weakReason}
        hint={T.weakReasonHint}
        checked={s.weakReason}
        onChange={(v) => set("weakReason", v)}
      />
    </Rows>
  );
}

function Positive({ onTalk }: { onTalk: () => void }) {
  const { s, set } = useEval();
  return (
    <Block title={T.positive} description={T.positiveDesc}>
      <EditableList
        items={s.positive}
        onChange={(v) => set("positive", v)}
        placeholder={T.positiveAdd}
        tone="pos"
        extra={
          <Button variant="ghost" onClick={onTalk}>
            <MessageSquarePlus /> {T.talk}
          </Button>
        }
      />
    </Block>
  );
}

function Quality() {
  const { s, set } = useEval();
  return (
    <Block title={T.quality} description={T.qualityDesc}>
      <div className="flex flex-wrap gap-2">
        {T.qualityList.map((q) => (
          <Label
            key={q.key}
            className="rounded-lg border px-3 py-2 font-normal has-data-[state=checked]:border-primary/40 has-data-[state=checked]:bg-primary/5"
          >
            <Checkbox
              checked={s.quality.includes(q.key)}
              onCheckedChange={(c) => set("quality", (p) => (c ? [...p, q.key] : p.filter((x) => x !== q.key)))}
            />
            {q.label}
          </Label>
        ))}
      </div>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label>{T.pass}</Label>
          <span className="font-semibold text-sm tabular-nums">{T.pct(s.qualityPct)}</span>
        </div>
        <Slider
          value={[s.qualityPct]}
          min={50}
          max={100}
          step={5}
          onValueChange={([v]) => set("qualityPct", v)}
          aria-label={T.pass}
        />
      </div>
    </Block>
  );
}

function Value() {
  const { s, set } = useEval();
  const ai = Number(s.aiShare);
  return (
    <Block
      title={T.value}
      description={T.valueDesc}
      action={
        <Segmented
          value={s.aiShare}
          onChange={(v) => set("aiShare", v)}
          options={[
            { value: "10", label: T.pct(10) },
            { value: "20", label: T.pct(20) },
            { value: "30", label: T.pct(30) },
          ]}
        />
      }
    >
      <div className="grid gap-2">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-primary transition-all" style={{ width: `${ai}%` }} />
          <div className="flex-1 bg-emerald-500/60" />
        </div>
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-primary" />
            {T.ai(ai)}
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-emerald-500/60" />
            {T.customer(100 - ai)}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">{T.valueNote}</span>
      </div>
    </Block>
  );
}

function Display() {
  const { s, set } = useEval();
  const limit = (key: "limitDay" | "limitWeek" | "limitMonth", label: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={key} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Input
        id={key}
        type="number"
        min={0}
        className="w-20 tabular-nums"
        value={s[key]}
        onChange={(e) => set(key, Math.max(0, Number(e.target.value) || 0))}
      />
    </div>
  );
  return (
    <Block title={T.display}>
      <Rows>
        <Row
          title={T.show}
          control={
            <Segmented
              value={s.show}
              onChange={(v) => set("show", v)}
              options={[
                { value: "both", label: T.both },
                { value: "pos", label: T.posOnly },
                { value: "neg", label: T.negOnly },
              ]}
            />
          }
        />
        <Row title={T.limits} hint={T.limitsHint}>
          <div className="flex flex-wrap gap-3">
            {limit("limitDay", T.day)}
            {limit("limitWeek", T.week)}
            {limit("limitMonth", T.month)}
          </div>
        </Row>
      </Rows>
    </Block>
  );
}

export function CriteriaSection({ onTalk }: { onTalk: () => void }) {
  return (
    <>
      <Field />
      <Weakness />
      <Positive onTalk={onTalk} />
      <Advanced>
        <WeakReason />
        <Quality />
      </Advanced>
    </>
  );
}

export function LimitsSection() {
  return (
    <>
      <Value />
      <Display />
      <Advanced>
        <AdminPerms />
      </Advanced>
    </>
  );
}
