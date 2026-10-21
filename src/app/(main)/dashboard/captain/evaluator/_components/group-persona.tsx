"use client";
// قسم «الشخصية والصلاحيات»: شخصية الموظف المستقل (25، 10)، وضع الإشارات (26)، النقل (27).
// ومتقدم: إتمام المحادثة ولمن تُحوَّل (28)، ولمن يُحوَّل حسب نوع الطلب (29).
// وصلاحيات الإدارة (43، 44، 45) تُصدَّر من هنا إلى قسم «الصلاحيات والحدود» في «تقييم الموظفين».
import { cn } from "cn";
import { Briefcase, GraduationCap, LayoutTemplate, PenLine, Smile, Sparkles, Zap } from "lucide-react";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

import { CompletionBlock, RoutingBlock } from "./group-staff";
import { type EvalSettings, employees, useEval } from "./state";
import { Advanced, Block, ChoiceCards, Row, Rows, Segmented, SwitchRow } from "./ui";

const T = {
  persona: "شخصية الموظف المستقل",
  personaDesc: "كيف يتكلم ويتصرف حين يعمل وحده.",
  write: "أنت تكتبها",
  writeDesc: "تصف شخصيته بكلماتك.",
  learn: "تتعلمها هي",
  learnDesc: "يتعلمها من ردود موظفيك.",
  pick: "أنت تختار",
  pickDesc: "من قوالب جاهزة.",
  placeholder: "مثال: ودود ومختصر، يخاطب العميل باسمه، ولا يعد بشيء قبل التأكد.",
  learning: "يتعلم الشخصية من ردود موظفيك ويحدّثها تلقائياً.",
  templates: [
    { value: "friendly", label: "ودود", desc: "دافئ وقريب من العميل.", icon: Smile },
    { value: "formal", label: "رسمي", desc: "مهذب ودقيق.", icon: Briefcase },
    { value: "short", label: "مختصر", desc: "جمل قصيرة ومباشرة.", icon: Zap },
    { value: "expert", label: "خبير تقني", desc: "يشرح الحلول خطوة بخطوة.", icon: Sparkles },
  ],
  perms: "الصلاحيات",
  label: "وضع الإشارات",
  labelHint: "يضع الإشارات على المحادثات.",
  move: "نقل المحادثات",
  moveHint: "ينقل المحادثة إلى صندوق أو فريق آخر.",
  showInbox: "عرض صندوقه لجميع الموظفين",
  showInboxHint: "يرى كل الموظفين محادثاته وتقييماته.",
  prefs: "من يعدّل تفضيلاته",
  everyone: "الجميع",
  person: "شخص معين",
  full: "صلاحيات كاملة للتدبير",
  fullHint: "يدير إعداداته الخاصة بنفسه.",
  sumPersona: (v: string) => `الشخصية: ${v}`,
  noPerms: "بلا صلاحيات",
};

export function personaSummary(s: EvalSettings) {
  const ways: Record<string, string> = { write: T.write, learn: T.learn };
  const persona = ways[s.persona] ?? T.templates.find((t) => t.value === s.template)?.label ?? T.pick;
  const perms = [s.canLabel && T.label, s.canMove && T.move].filter(Boolean).join("، ") || T.noPerms;
  return [T.sumPersona(persona), perms].join(" · ");
}

function Persona() {
  const { s, set } = useEval();
  return (
    <Block title={T.persona} description={T.personaDesc}>
      <ChoiceCards
        value={s.persona}
        onChange={(v) => set("persona", v)}
        options={[
          { value: "write", label: T.write, desc: T.writeDesc, icon: PenLine },
          { value: "learn", label: T.learn, desc: T.learnDesc, icon: GraduationCap },
          { value: "template", label: T.pick, desc: T.pickDesc, icon: LayoutTemplate },
        ]}
      />
      {s.persona === "write" && (
        <Textarea
          className="min-h-24"
          placeholder={T.placeholder}
          value={s.personaText}
          onChange={(e) => set("personaText", e.target.value)}
        />
      )}
      {s.persona === "learn" && (
        <span className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground text-sm">
          <GraduationCap className="size-4" />
          {T.learning}
        </span>
      )}
      {s.persona === "template" && (
        <RadioGroup
          value={s.template}
          onValueChange={(v) => set("template", v)}
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
        >
          {T.templates.map((t) => (
            <Label
              key={t.value}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/40",
                s.template === t.value && "border-primary bg-primary/5 hover:bg-primary/5",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <t.icon className="size-4 text-muted-foreground" />
                <RadioGroupItem value={t.value} />
              </div>
              <span className="font-medium text-sm">{t.label}</span>
              <span className="text-muted-foreground text-xs leading-snug">{t.desc}</span>
            </Label>
          ))}
        </RadioGroup>
      )}
    </Block>
  );
}

function Permissions() {
  const { s, set } = useEval();
  return (
    <Block title={T.perms}>
      <Rows>
        <SwitchRow title={T.label} hint={T.labelHint} checked={s.canLabel} onChange={(v) => set("canLabel", v)} />
        <SwitchRow title={T.move} hint={T.moveHint} checked={s.canMove} onChange={(v) => set("canMove", v)} />
      </Rows>
    </Block>
  );
}

// عرض صندوقه (43)، من يعدّل تفضيلاته (44)، صلاحيات كاملة للتدبير (45).
export function AdminPerms() {
  const { s, set } = useEval();
  return (
    <Rows>
      <SwitchRow
        title={T.showInbox}
        hint={T.showInboxHint}
        checked={s.showInbox}
        onChange={(v) => set("showInbox", v)}
      />
      <Row
        title={T.prefs}
        control={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={s.prefsBy}
              onChange={(v) => set("prefsBy", v)}
              options={[
                { value: "all", label: T.everyone },
                { value: "person", label: T.person },
              ]}
            />
            {s.prefsBy === "person" && (
              <NativeSelect
                className="w-28"
                aria-label={T.person}
                value={s.prefsPerson}
                onChange={(e) => set("prefsPerson", e.target.value)}
              >
                {employees.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
        }
      />
      <SwitchRow title={T.full} hint={T.fullHint} checked={s.fullManage} onChange={(v) => set("fullManage", v)} />
    </Rows>
  );
}

export function PersonaSection() {
  return (
    <>
      <Persona />
      <Permissions />
      <Advanced>
        <CompletionBlock />
        <RoutingBlock />
      </Advanced>
    </>
  );
}
