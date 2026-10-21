"use client";
// قسم «الرد والتوقيت»: يرد على الكل أو التحويلات فقط (17)، توقيت الرد من الساعة إلى الساعة (21)، مدة التأخير (23).
// ومتقدم: التحويل عند طلب الموظف (18) وطريقة الرد، وربطه بقائمة الأتمتة التي تديرها (22)،
// و«جارٍ الكتابة» مطفأ لأنه «لا داعي» (24)، وترجمة الرسائل الصوتية (30).
import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { ReplyMoreRows, ReplyToRow, replyToLabel } from "./group-staff";
import { type EvalSettings, useEval, workflows } from "./state";
import { Advanced, Block, Row, Rows, Segmented, SwitchRow } from "./ui";

const T = {
  hours: "توقيت الرد",
  hoursDesc: "متى يرد المقيّم على العملاء.",
  always: "طوال الوقت",
  custom: "من ساعة إلى ساعة",
  alwaysHint: "يرد في أي وقت، ليلاً ونهاراً.",
  from: "من الساعة",
  to: "إلى الساعة",
  automation: "الأتمتة",
  automationDesc: "قائمة الأتمتة التي تدير عمله.",
  linked: "القائمة المرتبطة",
  open: "فتح الأتمتة",
  delay: "مدة التأخير عن الرد",
  delayHint: "ينتظر قليلاً قبل أن يرد ليبدو طبيعياً.",
  delays: [
    { value: "0", label: "فوراً" },
    { value: "10", label: "10 ثوانٍ" },
    { value: "30", label: "30 ثانية" },
    { value: "60", label: "دقيقة" },
    { value: "120", label: "دقيقتان" },
    { value: "300", label: "5 دقائق" },
  ],
  typing: "إظهار «جارٍ الكتابة»",
  typingHint: "لا داعي له، ويبقى مطفأً.",
  voice: "ترجمة الرسائل الصوتية",
  voiceHint: "يحوّل الرسالة الصوتية إلى نص ليقرأها ويقيّمها.",
  sumReply: (v: string) => `يرد على: ${v}`,
  sumDelay: (v: string) => `التأخير: ${v}`,
  am: "ص",
  pm: "م",
};

// «09:00» تصير «9ص»، و«22:30» تصير «10:30م».
function hourLabel(time: string) {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${m ? `${h12}:${String(m).padStart(2, "0")}` : h12}${h < 12 ? T.am : T.pm}`;
}

export function timingSummary(s: EvalSettings) {
  const hours = s.hoursMode === "always" ? T.always : `${hourLabel(s.from)}–${hourLabel(s.to)}`;
  const delay = T.delays.find((d) => d.value === s.delay)?.label ?? s.delay;
  return [T.sumReply(replyToLabel(s)), hours, T.sumDelay(delay)].join(" · ");
}

function HoursRow() {
  const { s, set } = useEval();
  return (
    <Row
      title={T.hours}
      hint={T.hoursDesc}
      control={
        <Segmented
          value={s.hoursMode}
          onChange={(v) => set("hoursMode", v)}
          options={[
            { value: "always", label: T.always },
            { value: "custom", label: T.custom },
          ]}
        />
      }
    >
      {s.hoursMode === "custom" ? (
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="eval-from">{T.from}</Label>
            <Input
              id="eval-from"
              type="time"
              dir="ltr"
              className="w-36"
              value={s.from}
              onChange={(e) => set("from", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eval-to">{T.to}</Label>
            <Input
              id="eval-to"
              type="time"
              dir="ltr"
              className="w-36"
              value={s.to}
              onChange={(e) => set("to", e.target.value)}
            />
          </div>
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">{T.alwaysHint}</span>
      )}
    </Row>
  );
}

function DelayRow() {
  const { s, set } = useEval();
  return (
    <Row
      title={T.delay}
      hint={T.delayHint}
      control={
        <NativeSelect className="w-36" value={s.delay} onChange={(e) => set("delay", e.target.value)}>
          {T.delays.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </NativeSelect>
      }
    />
  );
}

function Automation() {
  const { s, set } = useEval();
  return (
    <Block
      title={T.automation}
      description={T.automationDesc}
      action={
        <Button variant="outline" asChild>
          <Link href="/dashboard/settings/automation">
            {T.open} <ArrowUpRight />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Label>{T.linked}</Label>
        <NativeSelect className="w-60" value={s.workflow} onChange={(e) => set("workflow", e.target.value)}>
          {workflows.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </NativeSelect>
      </div>
    </Block>
  );
}

export function TimingSection() {
  const { s, set } = useEval();
  return (
    <>
      <Rows>
        <ReplyToRow />
        <HoursRow />
        <DelayRow />
      </Rows>
      <Advanced>
        <ReplyMoreRows />
        <Automation />
        <Rows>
          <SwitchRow title={T.typing} hint={T.typingHint} checked={s.typing} onChange={(v) => set("typing", v)} />
          <SwitchRow title={T.voice} hint={T.voiceHint} checked={s.voice} onChange={(v) => set("voice", v)} />
        </Rows>
      </Advanced>
    </>
  );
}
