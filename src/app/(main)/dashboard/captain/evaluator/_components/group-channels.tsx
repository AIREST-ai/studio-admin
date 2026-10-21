"use client";
// قسم «القنوات والوصول»: القنوات بأيقوناتها (15)، الوصول للرسائل ومستواه (14)، التعيين (36).
// ومتقدم: ما يراه أيضاً من الرسائل (14) وتفعيل الموظفين الجميع أو بعضهم (16).
import { cn } from "cn";
import { Globe, Inbox, type LucideIcon, Mail, Tag } from "lucide-react";
import {
  type SimpleIcon as SimpleIconData,
  siFacebook,
  siInstagram,
  siTelegram,
  siTiktok,
  siWhatsapp,
  siYoutube,
} from "simple-icons";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

import { StaffBlock } from "./group-staff";
import { type EvalSettings, inboxes, labels, useEval } from "./state";
import { Advanced, Block, ChoiceCards, Row, Rows, Segmented, SwitchRow } from "./ui";

const T = {
  access: "الوصول للرسائل",
  accessTitle: "يصل إلى الرسائل",
  accessHint: "بدونه لا يقرأ ولا يقيّم شيئاً.",
  level: "مستوى الوصول",
  read: "قراءة فقط",
  reply: "قراءة ورد",
  perms: "يرى أيضاً",
  permList: [
    { key: "files", label: "المرفقات" },
    { key: "notes", label: "الملاحظات الداخلية" },
    { key: "contact", label: "بيانات العميل" },
  ],
  channels: "القنوات",
  channelsDesc: "القنوات التي يعمل عليها.",
  on: (n: number) => `${n} مفعّلة`,
  assign: "التعيين",
  assignDesc: "أين يعمل المقيّم.",
  all: "كل الصناديق",
  allDesc: "يعمل على كل الصناديق.",
  inbox: "صندوق معين",
  inboxDesc: "صندوق واحد تختاره.",
  label: "إشارة معينة",
  labelDesc: "فقط المحادثات التي عليها إشارة.",
  pickInbox: "الصندوق",
  pickLabel: "الإشارة",
  noAccess: "بلا وصول للرسائل",
  sumChannels: (n: number) => `القنوات: ${n}`,
  sumLabel: (v: string) => `إشارة: ${v}`,
};

export function channelsSummary(s: EvalSettings) {
  const places: Record<string, string> = { all: T.all, inbox: s.assignInbox, label: T.sumLabel(s.assignLabel) };
  const where = places[s.assign] ?? T.all;
  const level = s.msgLevel === "read" ? T.read : T.reply;
  const access = s.msgAccess ? level : T.noAccess;
  return [T.sumChannels(s.channels.length), where, access].join(" · ");
}

const channelList: { key: string; label: string; brand?: SimpleIconData; icon?: LucideIcon }[] = [
  { key: "whatsapp", label: "واتساب", brand: siWhatsapp },
  { key: "facebook", label: "فيسبوك", brand: siFacebook },
  { key: "instagram", label: "إنستغرام", brand: siInstagram },
  { key: "youtube", label: "يوتيوب", brand: siYoutube },
  { key: "tiktok", label: "تيك توك", brand: siTiktok },
  { key: "telegram", label: "تيليجرام", brand: siTelegram },
  { key: "email", label: "البريد", icon: Mail },
  { key: "web", label: "دردشة الموقع", icon: Globe },
];

function MessageAccess() {
  const { s, set } = useEval();
  return (
    <Block title={T.access}>
      <Rows>
        <SwitchRow
          title={T.accessTitle}
          hint={T.accessHint}
          checked={s.msgAccess}
          onChange={(v) => set("msgAccess", v)}
        />
        {s.msgAccess && (
          <Row
            title={T.level}
            control={
              <Segmented
                value={s.msgLevel}
                onChange={(v) => set("msgLevel", v)}
                options={[
                  { value: "read", label: T.read },
                  { value: "reply", label: T.reply },
                ]}
              />
            }
          />
        )}
      </Rows>
    </Block>
  );
}

function MessagePerms() {
  const { s, set } = useEval();
  if (!s.msgAccess) return null;
  return (
    <Rows>
      <Row title={T.perms}>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {T.permList.map((p) => (
            <Label key={p.key} className="font-normal">
              <Checkbox
                checked={s.msgPerms.includes(p.key)}
                onCheckedChange={(c) =>
                  set("msgPerms", (prev) => (c ? [...prev, p.key] : prev.filter((x) => x !== p.key)))
                }
              />
              {p.label}
            </Label>
          ))}
        </div>
      </Row>
    </Rows>
  );
}

function Channels() {
  const { s, set } = useEval();
  return (
    <Block
      title={T.channels}
      description={T.channelsDesc}
      action={<span className="text-muted-foreground text-xs tabular-nums">{T.on(s.channels.length)}</span>}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {channelList.map((c) => {
          const on = s.channels.includes(c.key);
          return (
            <Label
              key={c.key}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/40",
                on && "border-primary/40 bg-primary/5 hover:bg-primary/5",
              )}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                {c.brand ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-foreground">
                    <path d={c.brand.path} />
                  </svg>
                ) : (
                  c.icon && <c.icon className="size-4" />
                )}
              </div>
              <span className="flex-1 font-medium text-sm">{c.label}</span>
              <Switch
                checked={on}
                onCheckedChange={(v) => set("channels", (p) => (v ? [...p, c.key] : p.filter((x) => x !== c.key)))}
              />
            </Label>
          );
        })}
      </div>
    </Block>
  );
}

function Assignment() {
  const { s, set } = useEval();
  return (
    <Block title={T.assign} description={T.assignDesc}>
      <ChoiceCards
        value={s.assign}
        onChange={(v) => set("assign", v)}
        options={[
          { value: "all", label: T.all, desc: T.allDesc, icon: Inbox },
          { value: "inbox", label: T.inbox, desc: T.inboxDesc, icon: Inbox },
          { value: "label", label: T.label, desc: T.labelDesc, icon: Tag },
        ]}
      />
      {s.assign === "inbox" && (
        <div className="flex items-center gap-3">
          <Label className="w-20">{T.pickInbox}</Label>
          <NativeSelect className="w-56" value={s.assignInbox} onChange={(e) => set("assignInbox", e.target.value)}>
            {inboxes.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {s.assign === "label" && (
        <div className="flex items-center gap-3">
          <Label className="w-20">{T.pickLabel}</Label>
          <NativeSelect className="w-56" value={s.assignLabel} onChange={(e) => set("assignLabel", e.target.value)}>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </Block>
  );
}

export function ChannelsSection() {
  return (
    <>
      <Channels />
      <MessageAccess />
      <Assignment />
      <Advanced>
        <MessagePerms />
        <StaffBlock />
      </Advanced>
    </>
  );
}
