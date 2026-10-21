"use client";
// FAH-14: صناديق «موظف الذكاء البشري» فوق خطوات التعيين: زر علوي نابض بتنبيهات هادئة، وثلاثة صناديق
// (محادثات الذكاء، محادثات الموظفين، محادثات مشتركة) بمبدّل سلس، وخلفية المحادثة ملونة بلون قناتها بشفافية 5–10٪
// مع شعارها علامة مائية، وتحت كل رد من إيمه زرا التعلم المستمر (اعتمد الأسلوب، صحّح الرد). بيانات تجريبية.
import * as React from "react";

import { cn } from "cn";
import { Bell, Check, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import { BrandGlyph, CHANNEL_MARKS, type ChannelMark } from "../../_components/connect-now";

type Box = "ai" | "staff" | "shared";
type Who = "customer" | "ai" | "staff";

interface Line {
  id: string;
  who: Who;
  text: string;
  /** الرد اعتُمد أسلوباً أو صُحّح، فتعلّمت منه إيمه. */
  learned?: "approved" | "corrected";
}

interface Conv {
  id: string;
  box: Box;
  channel: ChannelMark["key"];
  customer: string;
  lines: Line[];
}

const T = {
  pulse: "إيمه تنبهك",
  alertsTitle: "تنبيهات هادئة",
  boxes: { ai: "محادثات الذكاء", staff: "محادثات الموظفين", shared: "محادثات مشتركة" } satisfies Record<Box, string>,
  approve: "صح · اعتمد هذا الأسلوب",
  correct: "تعديل · تصحيح الرد",
  save: "احفظ التصحيح",
  cancel: "إلغاء",
  approved: "اعتمدته إيمه أسلوباً",
  corrected: "صحّحته وتعلّمت منه إيمه",
  learnedToast: "تعلّمت إيمه هذا الأسلوب وستعيده في المحادثات المشابهة",
  correctedToast: "حُفظ التصحيح، وإيمه ستعتمده بدل ردها",
  staffName: "مريم",
};

const ALERTS = [
  "عميل على واتساب ينتظر رداً منذ 6 دقائق، وإيمه تتولاه الآن.",
  "ثلاثة عملاء سألوا اليوم عن موعد التوصيل نفسه، أضف الجواب لمعرفة إيمه.",
  "مريم أنهت محادثة صعبة بأسلوب ممتاز، اعتمده لإيمه.",
];

const CONVS: Conv[] = [
  {
    id: "c1",
    box: "ai",
    channel: "whatsapp",
    customer: "سارة المهندي",
    lines: [
      { id: "c1-1", who: "customer", text: "السلام عليكم، طلبي ما وصل لليوم" },
      { id: "c1-2", who: "ai", text: "وعليكم السلام سارة، آسفة على التأخير. طلبك خرج اليوم الصبح ويوصلك قبل الخامسة إن شاء الله." },
    ],
  },
  {
    id: "c2",
    box: "ai",
    channel: "instagram",
    customer: "noor.qa",
    lines: [
      { id: "c2-1", who: "customer", text: "عندكم المقاس الكبير من الفستان الأسود؟" },
      { id: "c2-2", who: "ai", text: "متوفر يا نور، باقي منه قطعتان. أحجزه لك الآن؟" },
    ],
  },
  {
    id: "c3",
    box: "staff",
    channel: "telegram",
    customer: "خالد العلي",
    lines: [
      { id: "c3-1", who: "customer", text: "أبي أغير عنوان التوصيل" },
      { id: "c3-2", who: "staff", text: "أكيد خالد، أرسل لي العنوان الجديد وأعدله لك فوراً." },
    ],
  },
  {
    id: "c4",
    box: "staff",
    channel: "snapchat",
    customer: "hamad_22",
    lines: [
      { id: "c4-1", who: "customer", text: "الكود ما يشتغل معي" },
      { id: "c4-2", who: "staff", text: "جرّب تكتبه بالأحرف الكبيرة، وإن ما ضبط أفعله لك من عندي." },
    ],
  },
  {
    id: "c5",
    box: "shared",
    channel: "tiktok",
    customer: "lulu.style",
    lines: [
      { id: "c5-1", who: "customer", text: "شفت الفيديو، كم سعر العطر؟" },
      { id: "c5-2", who: "ai", text: "سعره 180 ريال يا لولو، ومعه عينة هدية هذا الأسبوع." },
      { id: "c5-3", who: "staff", text: "وأضفت لك خصم 10٪ لأنك أول مرة تطلبين منا." },
    ],
  },
  {
    id: "c6",
    box: "shared",
    channel: "whatsapp",
    customer: "أم عبدالله",
    lines: [
      { id: "c6-1", who: "customer", text: "المنتج وصلني مكسور" },
      { id: "c6-2", who: "ai", text: "حقك علينا. أرسلي صورة له، وأحولك لمريم تبدله لك اليوم." },
      { id: "c6-3", who: "staff", text: "وصلت الصورة، البديل يطلع لك العصر." },
    ],
  },
];

const mark = (key: ChannelMark["key"]) => CHANNEL_MARKS.find((c) => c.key === key) ?? CHANNEL_MARKS[0];

function PulseAlerts() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative gap-2 rounded-full">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <Bell className="size-4" />
          {T.pulse}
          <span className="rounded-full bg-primary/15 px-1.5 text-primary text-xs tabular-nums">{ALERTS.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-white/15 bg-background/80 backdrop-blur-xl">
        <p className="mb-2 font-semibold text-sm">{T.alertsTitle}</p>
        <ul className="grid gap-2">
          {ALERTS.map((a) => (
            <li key={a} className="rounded-xl border bg-muted/40 p-2.5 text-muted-foreground text-xs leading-relaxed">
              {a}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function BoxSwitch({ value, onChange, counts }: { value: Box; onChange: (b: Box) => void; counts: Record<Box, number> }) {
  const order: Box[] = ["ai", "staff", "shared"];
  const index = order.indexOf(value);
  return (
    <div role="tablist" className="relative grid grid-cols-3 rounded-full border bg-muted/40 p-1">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 rounded-full bg-background shadow-sm transition-[inset-inline-start] duration-300 ease-out"
        style={{ width: "calc((100% - 0.5rem) / 3)", insetInlineStart: `calc(0.25rem + ${index} * (100% - 0.5rem) / 3)` }}
      />
      {order.map((b) => (
        <button
          key={b}
          type="button"
          role="tab"
          aria-selected={value === b}
          onClick={() => onChange(b)}
          className={cn(
            "relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-sm transition-colors",
            value === b ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {T.boxes[b]}
          <span className="text-muted-foreground text-xs tabular-nums">{counts[b]}</span>
        </button>
      ))}
    </div>
  );
}

function AiReply({ line, onLearn }: { line: Line; onLearn: (l: Line) => Promise<boolean> }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(line.text);
  const [saving, setSaving] = React.useState(false);

  if (editing) {
    return (
      <div className="grid gap-2">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-20 bg-background/80" />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={saving || !draft.trim()}
            onClick={async () => {
              setSaving(true);
              const ok = await onLearn({ ...line, text: draft.trim(), learned: "corrected" });
              setSaving(false);
              if (ok) {
                setEditing(false);
                toast.success(T.correctedToast);
              } else {
                toast.error("تعذر حفظ التصحيح في الخادم");
              }
            }}
          >
            {saving ? "جارٍ الحفظ..." : T.save}
          </Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
            {T.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <p className="rounded-2xl rounded-ss-sm border bg-background/85 px-3 py-2 text-sm leading-relaxed">{line.text}</p>
      {line.learned ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs dark:text-emerald-400">
          <Check className="size-3.5" />
          {line.learned === "approved" ? T.approved : T.corrected}
        </span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            className="h-7 gap-1 rounded-full border-emerald-500/30 text-emerald-700 text-xs dark:text-emerald-300"
            onClick={async () => {
              setSaving(true);
              const ok = await onLearn({ ...line, learned: "approved" });
              setSaving(false);
              if (ok) {
                toast.success(T.learnedToast);
              } else {
                toast.error("تعذر حفظ الاعتماد في الخادم");
              }
            }}
          >
            <Check className="size-3.5" />
            {T.approve}
          </Button>
          <Button size="sm" variant="outline" disabled={saving} className="h-7 gap-1 rounded-full text-xs" onClick={() => setEditing(true)}>
            <PencilLine className="size-3.5" />
            {T.correct}
          </Button>
        </div>
      )}
    </div>
  );
}

export function HumanInbox() {
  const [convs, setConvs] = React.useState(CONVS);
  const [box, setBox] = React.useState<Box>("ai");
  const shown = convs.filter((c) => c.box === box);
  const [openId, setOpenId] = React.useState(CONVS[0].id);
  const open = shown.find((c) => c.id === openId) ?? shown[0];
  const counts = { ai: 0, staff: 0, shared: 0 } satisfies Record<Box, number>;
  for (const c of convs) counts[c.box] += 1;

  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const savedMap = res?.state?.humanInbox as
          | Record<string, { text?: string; learned?: "approved" | "corrected" }>
          | undefined;
        if (savedMap && typeof savedMap === "object") {
          setConvs((all) =>
            all.map((c) => ({
              ...c,
              lines: c.lines.map((l) => {
                const entry = savedMap[`${c.id}:${l.id}`];
                if (!entry) return l;
                return {
                  ...l,
                  text: entry.text || l.text,
                  learned: entry.learned || l.learned,
                };
              }),
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const learn = async (convId: string, next: Line): Promise<boolean> => {
    const conv = convs.find((c) => c.id === convId);
    const customerLine = conv?.lines.find((l) => l.who === "customer")?.text ?? "";
    try {
      const res = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "inbox.learn",
          convId,
          lineId: next.id,
          text: next.text,
          learned: next.learned ?? "approved",
          customerText: customerLine,
        }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { ok?: boolean };
      if (!data?.ok) return false;
      setConvs((all) =>
        all.map((c) => (c.id === convId ? { ...c, lines: c.lines.map((l) => (l.id === next.id ? next : l)) } : c)),
      );
      return true;
    } catch {
      return false;
    }
  };

  const ch = mark(open.channel);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BoxSwitch value={box} onChange={setBox} counts={counts} />
        <PulseAlerts />
      </div>

      <div className="grid gap-3 md:grid-cols-[16rem_minmax(0,1fr)]">
        <ul className="grid content-start gap-1.5">
          {shown.map((c) => {
            const m = mark(c.channel);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-start transition",
                    c.id === open.id ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `rgb(${m.rgb} / 0.12)`, color: `rgb(${m.rgb})` }}
                  >
                    <BrandGlyph brand={m.brand} className="size-4" />
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium text-sm">{c.customer}</span>
                    <span className="truncate text-muted-foreground text-xs">{c.lines.at(-1)?.text}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* خلفية القناة بشفافية 8٪ وشعارها علامة مائية 6٪، ليعرف الموظف مصدر المحادثة دون أن تتعب عينه */}
        <div
          key={open.id}
          className="relative isolate min-h-80 overflow-hidden rounded-2xl border p-4 duration-300 animate-in fade-in-0"
          style={{ background: `rgb(${ch.rgb} / 0.08)` }}
        >
          <BrandGlyph
            brand={ch.brand}
            className="pointer-events-none absolute -bottom-8 -left-8 -z-10 size-64 opacity-[0.06]"
          />
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span style={{ color: `rgb(${ch.rgb})` }}>
              <BrandGlyph brand={ch.brand} className="size-4" />
            </span>
            <span className="font-semibold">{open.customer}</span>
            <span className="text-muted-foreground text-xs">{`· ${ch.label}`}</span>
          </div>
          <div className="grid gap-3">
            {open.lines.map((l) => (
              <div key={l.id} className={cn("grid max-w-[85%] gap-1", l.who === "customer" ? "justify-self-end" : "")}>
                <span className="text-muted-foreground text-xs">
                  {l.who === "customer" ? open.customer : l.who === "ai" ? "إيمه" : T.staffName}
                </span>
                {l.who === "ai" ? (
                  <AiReply line={l} onLearn={(next) => learn(open.id, next)} />
                ) : (
                  <p
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      l.who === "customer" ? "rounded-se-sm bg-background/60" : "rounded-ss-sm border bg-background/85",
                    )}
                  >
                    {l.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
