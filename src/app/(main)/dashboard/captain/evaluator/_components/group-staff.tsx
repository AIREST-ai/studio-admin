"use client";
// الموظفون والرد، قطعاً تُركّب في الأقسام: تفعيل الموظفين (16) في «القنوات والوصول»، والرد على الكل أو التحويلات
// فقط (17) والتحويل عند طلب الموظف (18) وطريقة الرد (يرسل مباشرة / يقترح على الموظف) في «الرد والتوقيت»،
// وإتمام المحادثة ولمن تُحوَّل (28) ولمن يُحوَّل حسب نوع الطلب (29) مع «إضافة تلقائية للموظفين» في «الشخصية والصلاحيات».
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup } from "@/components/ui/native-select";

import { type EvalSettings, employees, teams, useEval } from "./state";
import { Block, Row, Rows, Segmented, SwitchRow } from "./ui";

const T = {
  staff: "تفعيل الموظفين",
  staffDesc: "مع من يعمل المقيّم ومن يقيّم.",
  all: "الجميع",
  some: "بعضهم",
  replyTo: "يرد على",
  replyAll: "الكل",
  replyTransfers: "التحويلات فقط",
  takeOnRequest: "التحويل عند طلب الموظف",
  takeOnRequestHint: "يتسلّم المحادثة حين يحوّلها إليه موظف.",
  mode: "طريقة الرد",
  direct: "يرسل الرد مباشرة",
  suggest: "يقترح الرد على الموظف",
  complete: "إتمام المحادثة",
  completeTitle: "يُتم المحادثة بنفسه",
  completeHint: "يغلقها حين تنتهي حاجة العميل.",
  completeTo: "لمن تُحوَّل عند الإكمال",
  completeOptions: [
    { value: "none", label: "لا أحد، تُغلق" },
    { value: "last", label: "آخر موظف ردّ" },
  ],
  groupTeams: "الفرق",
  groupStaff: "الموظفون",
  routes: "لمن يُحوَّل",
  routesDesc: "حسب نوع الطلب: تقني أو غيره، إلى فريق أو شخص.",
  type: "نوع الطلب",
  addRoute: "أضف قاعدة",
  removeRoute: "حذف القاعدة",
  newType: "نوع جديد",
  fallback: "إن لم تطابق أي قاعدة",
  fallbackHint: "لمن يُحال ما يحتاج تدخلاً بشرياً.",
  auto: "إضافة تلقائية للموظفين",
};

export const replyToLabel = (s: EvalSettings) => (s.replyTo === "all" ? T.replyAll : T.replyTransfers);

function TargetOptions() {
  return (
    <>
      <NativeSelectOptGroup label={T.groupTeams}>
        {teams.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label={T.groupStaff}>
        {employees.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </NativeSelectOptGroup>
    </>
  );
}

export function StaffBlock() {
  const { s, set } = useEval();
  return (
    <Block
      title={T.staff}
      description={T.staffDesc}
      action={
        <Segmented
          value={s.staffScope}
          onChange={(v) => set("staffScope", v)}
          options={[
            { value: "all", label: T.all },
            { value: "some", label: T.some },
          ]}
        />
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {employees.map((e) => {
          const on = s.staffScope === "all" || s.staff.includes(e);
          return (
            <Label
              key={e}
              className="flex items-center gap-2.5 rounded-lg border p-2.5 font-normal has-disabled:opacity-100"
            >
              <Checkbox
                checked={on}
                disabled={s.staffScope === "all"}
                onCheckedChange={(c) => set("staff", (p) => (c ? [...p, e] : p.filter((x) => x !== e)))}
              />
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
                {e.slice(0, 1)}
              </span>
              {e}
            </Label>
          );
        })}
      </div>
    </Block>
  );
}

export function ReplyToRow() {
  const { s, set } = useEval();
  return (
    <Row
      title={T.replyTo}
      control={
        <Segmented
          value={s.replyTo}
          onChange={(v) => set("replyTo", v)}
          options={[
            { value: "all", label: T.replyAll },
            { value: "transfers", label: T.replyTransfers },
          ]}
        />
      }
    />
  );
}

export function ReplyMoreRows() {
  const { s, set } = useEval();
  return (
    <Rows>
      <SwitchRow
        title={T.takeOnRequest}
        hint={T.takeOnRequestHint}
        checked={s.takeOnRequest}
        onChange={(v) => set("takeOnRequest", v)}
      />
      <Row
        title={T.mode}
        control={
          <Segmented
            value={s.replyMode}
            onChange={(v) => set("replyMode", v)}
            options={[
              { value: "direct", label: T.direct },
              { value: "suggest", label: T.suggest },
            ]}
          />
        }
      />
    </Rows>
  );
}

export function CompletionBlock() {
  const { s, set } = useEval();
  return (
    <Block title={T.complete}>
      <Rows>
        <SwitchRow
          title={T.completeTitle}
          hint={T.completeHint}
          checked={s.complete}
          onChange={(v) => set("complete", v)}
        />
        {s.complete && (
          <Row
            title={T.completeTo}
            control={
              <NativeSelect className="w-52" value={s.completeTo} onChange={(e) => set("completeTo", e.target.value)}>
                {T.completeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <TargetOptions />
              </NativeSelect>
            }
          />
        )}
      </Rows>
    </Block>
  );
}

export function RoutingBlock() {
  const { s, set } = useEval();
  return (
    <Block
      title={T.routes}
      description={T.routesDesc}
      action={
        <Button
          variant="outline"
          onClick={() => set("routes", (p) => [...p, { id: Date.now(), type: T.newType, to: teams[0] }])}
        >
          <Plus /> {T.addRoute}
        </Button>
      }
    >
      <Rows>
        {s.routes.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <Input
              className="min-w-0 flex-1 basis-40"
              aria-label={T.type}
              value={r.type}
              onChange={(e) => set("routes", (p) => p.map((x) => (x.id === r.id ? { ...x, type: e.target.value } : x)))}
            />
            <ArrowLeft className="hidden size-4 shrink-0 text-muted-foreground sm:block ltr:rotate-180" />
            <NativeSelect
              className="w-48"
              value={r.to}
              onChange={(e) => set("routes", (p) => p.map((x) => (x.id === r.id ? { ...x, to: e.target.value } : x)))}
            >
              <TargetOptions />
            </NativeSelect>
            <Button
              variant="ghost"
              size="icon"
              aria-label={T.removeRoute}
              onClick={() => set("routes", (p) => p.filter((x) => x.id !== r.id))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Row
          title={T.fallback}
          hint={T.fallbackHint}
          control={
            <NativeSelect className="w-52" value={s.fallback} onChange={(e) => set("fallback", e.target.value)}>
              <option value="auto">{T.auto}</option>
              <TargetOptions />
            </NativeSelect>
          }
        />
      </Rows>
    </Block>
  );
}
