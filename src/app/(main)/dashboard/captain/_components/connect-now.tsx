"use client";
// FAH-14: زر «اربط الآن» الموحد العائم أعلى الصفحة، يفتح نافذة زجاجية فوق خلفية ضبابية فيها بطاقات القنوات الخمس
// وحالة ربط كل منها، مأخوذة حية من صناديق الوارد في الإعدادات (useCwShared). سناب شات ليست قناة في شات ووت بعد،
// فتظهر «غير مربوطة» دائماً حتى تُضاف.
import Link from "next/link";

import { cn } from "cn";
import { ArrowLeft, Link2, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type SimpleIcon, siInstagram, siSnapchat, siTelegram, siTiktok, siWhatsapp } from "simple-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCwShared } from "@/lib/cw/store";

const T = {
  button: "اربط الآن",
  title: "اربط قنواتك",
  desc: "اختر القناة وأكمل الربط في نفس المكان. الحالة هنا حية من صناديق الوارد لديك.",
  linked: "مربوطة",
  notLinked: "غير مربوطة",
  inboxes: (n: number) => (n === 1 ? "صندوق واحد" : `${n} صناديق`),
  link: "اربط",
  manage: "إدارة",
};

export interface ChannelMark {
  key: "whatsapp" | "instagram" | "telegram" | "tiktok" | "snapchat";
  label: string;
  brand: SimpleIcon;
  /** لون العلامة بصيغة RGB لتلوين الخلفية بشفافية خفيفة. */
  rgb: string;
}

export const CHANNEL_MARKS: ChannelMark[] = [
  { key: "whatsapp", label: "واتساب", brand: siWhatsapp, rgb: "37 211 102" },
  { key: "instagram", label: "إنستغرام", brand: siInstagram, rgb: "225 48 108" },
  { key: "telegram", label: "تيليجرام", brand: siTelegram, rgb: "38 165 228" },
  { key: "tiktok", label: "تيك توك", brand: siTiktok, rgb: "254 44 85" },
  { key: "snapchat", label: "سناب شات", brand: siSnapchat, rgb: "255 214 0" },
];

export function BrandGlyph({ brand, className }: { brand: SimpleIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("fill-current", className)}>
      <path d={brand.path} />
    </svg>
  );
}

export function ConnectNow({ className }: { className?: string }) {
  const inboxes = useCwShared((s) => s.inboxes);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className={cn(
            "sticky top-3 z-30 gap-2 rounded-full border border-white/25 bg-primary/15 px-5 text-primary shadow-lg backdrop-blur-xl hover:bg-primary/25",
            className,
          )}
          variant="ghost"
        >
          <Link2 className="size-4" />
          {T.button}
        </Button>
      </DialogTrigger>
      <DialogPortal>
        {/* خلفية ضبابية أقوى من نوافذ المنصة العادية، ولهذه النافذة وحدها */}
        <DialogOverlay className="bg-black/30 backdrop-blur-md" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl border border-white/20 bg-background/70 p-5 text-sm shadow-2xl outline-none backdrop-blur-2xl duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            {T.title}
          </DialogTitle>
          <DialogDescription>{T.desc}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {CHANNEL_MARKS.map((ch) => {
            const count = inboxes.filter((i) => i.channel === ch.key).length;
            const linked = count > 0;
            return (
              <Link
                key={ch.key}
                href="/dashboard/settings/inboxes/new"
                className="group flex items-center gap-3 rounded-2xl border border-white/15 bg-background/60 p-3 transition hover:-translate-y-0.5 hover:border-primary/40"
                style={{ backgroundImage: `linear-gradient(135deg, rgb(${ch.rgb} / 0.10), transparent 70%)` }}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `rgb(${ch.rgb} / 0.15)`, color: `rgb(${ch.rgb})` }}
                >
                  <BrandGlyph brand={ch.brand} className="size-5" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-semibold text-sm">{ch.label}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <span className={cn("size-1.5 rounded-full", linked ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                    {linked ? `${T.linked} · ${T.inboxes(count)}` : T.notLinked}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-primary text-xs">
                  {linked ? T.manage : T.link}
                  <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon-sm" className="absolute top-3 left-3" aria-label="إغلاق">
            <XIcon />
          </Button>
        </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
