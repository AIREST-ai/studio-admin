"use client";
// قسم «المعرفة والتعلم»: بنك المعرفة (12)، التعلم الآلي (13، 35)، النسخة البشرية للتصرفات (19)،
// ومتقدم: ماذا يتعلم من موظفيك، و«ما يحفظه الذكاء» من قسم الذكاء السابق (47).
// وقسم «التدريب الآلي» في «تقييم الموظفين» (39، 40، ومن 8 تنبيه التكلفة).
import * as React from "react";

import { cn } from "cn";
import { Check, Dumbbell, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { ConfirmDialog } from "../../_components/dialogs";
import { ToneBadge } from "../../_components/shared";
import { type EvalSettings, employees, type TrainItem, useEval } from "./state";
import { Advanced, Block, ChoiceCards, Row, Rows, Segmented, SwitchRow } from "./ui";

const T = {
  bank: "بنك المعرفة",
  bankDesc: "ملفات يرجع إليها المقيّم عند التقييم والرد.",
  upload: "رفع ملف",
  uploaded: "تم رفع الملف",
  noFiles: "لا ملفات بعد. ارفع أول ملف.",
  removeFile: "حذف الملف",
  fileRemoved: "تم حذف الملف",
  learn: "التعلم الآلي",
  liveTitle: "التعلم من الصناديق الحية",
  liveHint: "يتعلم من محادثات ما بعد الربط فقط.",
  liveOn: "بدأت التعلم من الصناديق الحية",
  liveOff: "التعلم متوقف",
  status: "الحالة",
  statusList: ["جارٍ العمل", "جاهز", "يحتاج بيانات بعد، انتظر"],
  train: "التدريب الآلي",
  trainDesc: "يدرّب نفسه من محادثاتك، ثم يعرض ما تعلمه لتبقيه أو تزيله.",
  trainFrom: "يتدرب من",
  last50: "آخر 50 محادثة",
  last100: "آخر 100 محادثة",
  costNote: "كلما زاد العدد زادت التكلفة عليك.",
  start: "ابدأ التدريب",
  running: "جارٍ التدريب…",
  done: "انتهى التدريب، راجع النتائج",
  results: "النتائج",
  resultsHint: "ما تزيله لن يُستخدم في التقييم مرة ثانية.",
  pos: "إيجابي",
  neg: "سلبي",
  keep: "إبقاء",
  kept: "مُبقى",
  remove: "إزالة",
  removed: (n: number) => `المُزالة (${n})`,
  removedNote: "لن تُستخدم في التقييم مرة ثانية.",
  human: "النسخة البشرية للتصرفات",
  humanDesc: "يتعلم التصرف والحديث مثل موظفيك.",
  fromAll: "أتعلم من الجميع",
  fromAllDesc: "من كل الموظفين والصناديق والقنوات.",
  fromOne: "أتعلم من أحدهم",
  fromOneDesc: "من موظف واحد تختاره.",
  who: "الموظف",
  what: "ماذا أتعلم",
  whatList: [
    { key: "tone", label: "أسلوب الكلام" },
    { key: "solve", label: "طريقة حل المشكلة" },
    { key: "handoff", label: "متى يحوّل المحادثة" },
  ],
  memory: "ما يحفظه الذكاء",
  memoryDesc: "كل ما تحذفه تستطيع استعادته خلال 24 ساعة، ثم يُمسح نهائياً من كل أنظمتنا بعد 3 أيام.",
  memoryAdd: "أضف معلومة…",
  add: "إضافة",
  edit: "تعديل",
  save: "حفظ",
  cancel: "إلغاء",
  del: "حذف",
  delAll: "حذف الكل",
  sure: "هل أنت متأكد؟",
  sureDesc: "تستطيع استعادة بياناتك خلال 24 ساعة، وبعدها لن يكون بإمكانك الوصول لها مجدداً بالكامل.",
  delDone: "تم تفعيل الحذف",
  files: (n: number) => {
    const fixed = ["لا ملفات", "ملف واحد", "ملفان"];
    if (n < fixed.length) return fixed[n];
    return n <= 10 ? `${n} ملفات` : `${n} ملفاً`;
  },
  sumLive: (on: boolean) => `التعلم الحي: ${on ? "يعمل" : "متوقف"}`,
  sumFrom: (v: string) => `يتعلم من: ${v}`,
  everyone: "الجميع",
  sumKept: (kept: number, total: number) => `${kept} مُبقاة من ${total}`,
};

export function knowledgeSummary(s: EvalSettings) {
  const from = s.humanCopy === "one" ? s.humanCopyPerson : T.everyone;
  return [T.files(s.files.length), T.sumLive(s.liveLearning), T.sumFrom(from)].join(" · ");
}

export function trainingSummary(s: EvalSettings) {
  const count = s.trainCount === "100" ? T.last100 : T.last50;
  return [count, T.sumKept(s.trainItems.filter((i) => i.kept).length, s.trainItems.length)].join(" · ");
}

// اسم الملف وامتداده منفصلان، كي لا ينقلب الاسم في الاتجاه من اليمين («دليل المنتجات» ثم شارة pdf).
const extOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "");
const baseName = (name: string) => (name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name);

function KnowledgeBank() {
  const { s, set } = useEval();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <Block
      title={T.bank}
      description={T.bankDesc}
      action={
        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload /> {T.upload}
        </Button>
      }
    >
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (!picked.length) return;
          set("files", (p) => [
            ...p,
            ...picked.map((f, i) => ({
              id: Date.now() + i,
              name: f.name,
              size: `${Math.max(1, Math.round(f.size / 1024))} ك.ب`,
            })),
          ]);
          toast.success(T.uploaded);
          e.target.value = "";
        }}
      />
      {s.files.length ? (
        <Rows>
          {s.files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <bdi className="truncate">{baseName(f.name)}</bdi>
                {extOf(f.name) && (
                  <Badge variant="outline" className="h-5 px-1.5 font-normal text-muted-foreground uppercase">
                    {extOf(f.name)}
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">{f.size}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={T.removeFile}
                onClick={() => {
                  set("files", (p) => p.filter((x) => x.id !== f.id));
                  toast.success(T.fileRemoved);
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </Rows>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-muted-foreground text-sm hover:bg-muted/40"
        >
          <Upload className="size-5" />
          {T.noFiles}
        </button>
      )}
    </Block>
  );
}

function MachineLearning() {
  const { s, set, saveEvaluatorSettings } = useEval();
  // الحالات الثلاث من «عقل المقيّم» السابق: جارٍ العمل، جاهز، يحتاج بيانات بعد.
  const [warming, setWarming] = React.useState(false);
  let status: { tone: "muted" | "amber" | "green"; text: string } = { tone: "green", text: T.statusList[1] };
  if (!s.liveLearning) status = { tone: "muted", text: T.liveOff };
  else if (warming) status = { tone: "amber", text: T.statusList[0] };
  return (
    <Block title={T.learn}>
      <Rows>
        <SwitchRow
          title={T.liveTitle}
          hint={T.liveHint}
          checked={s.liveLearning}
          onChange={async (v) => {
            set("liveLearning", v);
            setWarming(true);
            const ok = await saveEvaluatorSettings({ liveLearning: v });
            setWarming(false);
            if (!ok) {
              set("liveLearning", !v);
              toast.error("تعذر حفظ حالة التعلّم الحي في الخادم");
              return;
            }
            if (v) toast.success(T.liveOn);
          }}
        />
        <Row
          title={T.status}
          hint={s.liveLearning ? T.liveOn : undefined}
          control={<ToneBadge tone={status.tone}>{status.text}</ToneBadge>}
        />
      </Rows>
    </Block>
  );
}

function TrainRow({ item, onKeep, onRemove }: { item: TrainItem; onKeep: () => void; onRemove: () => void }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5", item.kept && "bg-muted/30")}>
      <ToneBadge tone={item.tone === "pos" ? "green" : "red"}>{item.tone === "pos" ? T.pos : T.neg}</ToneBadge>
      <span className="min-w-48 flex-1 text-sm">{item.text}</span>
      <div className="flex items-center gap-1.5">
        <Button variant={item.kept ? "secondary" : "outline"} onClick={onKeep} disabled={item.kept}>
          <Check /> {item.kept ? T.kept : T.keep}
        </Button>
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove}>
          <X /> {T.remove}
        </Button>
      </div>
    </div>
  );
}

export function TrainingSection() {
  const { s, set, saveEvaluatorSettings } = useEval();
  const [running, setRunning] = React.useState(false);
  const start = async () => {
    setRunning(true);
    const ok = await saveEvaluatorSettings({ trainCount: s.trainCount, trainItems: s.trainItems });
    setRunning(false);
    if (!ok) {
      toast.error("تعذر تنفيذ التدريب في الخادم");
      return;
    }
    toast.success(T.done);
  };
  return (
    <Block title={T.train} description={T.trainDesc}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm">{T.trainFrom}</span>
          <Segmented
            value={s.trainCount}
            onChange={(v) => set("trainCount", v)}
            options={[
              { value: "50", label: T.last50 },
              { value: "100", label: T.last100 },
            ]}
          />
        </div>
        <Button variant="outline" onClick={start} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <Dumbbell />}
          {running ? T.running : T.start}
        </Button>
      </div>
      <span className="-mt-1 text-muted-foreground text-xs">{T.costNote}</span>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-sm">{T.results}</span>
          <span className="text-muted-foreground text-xs">{T.resultsHint}</span>
        </div>
        <Rows>
          {s.trainItems.map((item) => (
            <TrainRow
              key={item.id}
              item={item}
              onKeep={() => set("trainItems", (p) => p.map((x) => (x.id === item.id ? { ...x, kept: true } : x)))}
              onRemove={() => {
                set("trainItems", (p) => p.filter((x) => x.id !== item.id));
                set("trainRemoved", (p) => [...p, item]);
              }}
            />
          ))}
        </Rows>
        {s.trainRemoved.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-fit text-muted-foreground">
                {T.removed(s.trainRemoved.length)}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-1.5 pt-1">
              <span className="text-muted-foreground text-xs">{T.removedNote}</span>
              {s.trainRemoved.map((r) => (
                <span key={r.id} className="text-muted-foreground text-sm line-through">
                  {r.text}
                </span>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </Block>
  );
}

function HumanCopy() {
  const { s, set } = useEval();
  return (
    <Block title={T.human} description={T.humanDesc}>
      <ChoiceCards
        value={s.humanCopy}
        onChange={(v) => set("humanCopy", v)}
        cols="sm:grid-cols-2"
        options={[
          { value: "all", label: T.fromAll, desc: T.fromAllDesc },
          { value: "one", label: T.fromOne, desc: T.fromOneDesc },
        ]}
      />
      {s.humanCopy === "one" && (
        <div className="flex flex-wrap items-center gap-3">
          <Label>{T.who}</Label>
          <NativeSelect
            className="w-44"
            value={s.humanCopyPerson}
            onChange={(e) => set("humanCopyPerson", e.target.value)}
          >
            {employees.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </Block>
  );
}

function HumanCopyWhat() {
  const { s, set } = useEval();
  return (
    <Block title={T.what}>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {T.whatList.map((w) => (
          <Label key={w.key} className="font-normal">
            <Checkbox
              checked={s.humanCopyWhat.includes(w.key)}
              onCheckedChange={(c) => set("humanCopyWhat", (p) => (c ? [...p, w.key] : p.filter((x) => x !== w.key)))}
            />
            {w.label}
          </Label>
        ))}
      </div>
    </Block>
  );
}

function Memory() {
  const { s, set } = useEval();
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<number | null>(null);
  const [text, setText] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  return (
    <Block
      title={T.memory}
      description={T.memoryDesc}
      action={
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={!s.memory.length}
          onClick={() => setConfirm(true)}
        >
          <Trash2 /> {T.delAll}
        </Button>
      }
    >
      {s.memory.length > 0 && (
        <Rows>
          {s.memory.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-4 py-2">
              {editing === m.id ? (
                <>
                  <Input className="flex-1" value={text} onChange={(e) => setText(e.target.value)} />
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    {T.cancel}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!text.trim()}
                    onClick={() => {
                      set("memory", (p) => p.map((x) => (x.id === m.id ? { ...x, text: text.trim() } : x)));
                      setEditing(null);
                    }}
                  >
                    {T.save}
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{m.text}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={T.edit}
                    onClick={() => {
                      setEditing(m.id);
                      setText(m.text);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={T.del}
                    onClick={() => set("memory", (p) => p.filter((x) => x.id !== m.id))}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </div>
          ))}
        </Rows>
      )}
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder={T.memoryAdd}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              set("memory", (p) => [...p, { id: Date.now(), text: draft.trim() }]);
              setDraft("");
            }
          }}
        />
        <Button
          variant="outline"
          disabled={!draft.trim()}
          onClick={() => {
            set("memory", (p) => [...p, { id: Date.now(), text: draft.trim() }]);
            setDraft("");
          }}
        >
          <Plus /> {T.add}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={T.sure}
        description={T.sureDesc}
        confirm={T.delAll}
        success={T.delDone}
        onConfirm={() => set("memory", [])}
      />
    </Block>
  );
}

export function KnowledgeSection() {
  return (
    <>
      <KnowledgeBank />
      <MachineLearning />
      <HumanCopy />
      <Advanced>
        <HumanCopyWhat />
        <Memory />
      </Advanced>
    </>
  );
}
