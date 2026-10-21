"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { ArrowUpRight, MessageSquare } from "lucide-react";

import { ChannelForm, type CreatedInbox } from "@/app/(main)/dashboard/settings/inboxes/_components/channel-forms";
import {
  type ChannelKey,
  channelFor,
  channelTypeFor,
  type Inbox,
} from "@/app/(main)/dashboard/settings/inboxes/_components/data";
import { inboxesStore, whenSaved } from "@/app/(main)/dashboard/settings/inboxes/_components/inboxes-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { linkedSession } from "@/lib/chatwoot/store-adapter";
import { CHANGED_ELSEWHERE } from "@/lib/cw/store";

import emma from "./assets/emma-relaxed.png";
import { ChannelOrbit, orbitChannels } from "./channel-orbit";

const formKeys: Record<string, ChannelKey> = {
  whatsapp: "whatsapp",
  facebook: "facebook",
  instagram: "instagram",
  email: "email",
  chat: "website",
  phone: "voice",
  sms: "sms",
  api: "api",
};

type ConnectionResult = { kind: "connected" | "created" | "preview"; name: string; id: number };
const resultLabels: Record<ConnectionResult["kind"], string> = {
  connected: "تم الربط والتحقق من الصندوق في الخدمة",
  created: "أُنشئ الصندوق في الخدمة؛ أكمل إعداداته وتعيين الموظفين قبل الاستخدام",
  preview: "حُفظ الصندوق في المعاينة فقط؛ لا يوجد اتصال خارجي",
};

export function AssistantWelcome({ notice }: { notice?: string | null }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const active = orbitChannels.find((channel) => channel.id === selected);

  useEffect(() => {
    const channelId = new URLSearchParams(window.location.search).get("channel");
    if (channelId && channelId in formKeys) setSelected(channelId);
  }, []);

  function choose(channelId: string) {
    if (saving) return;
    setSelected((current) => (current === channelId ? null : channelId));
    setResult(null);
    setError(null);
    setOpen(false);
  }

  async function created(inbox: CreatedInbox) {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    let pendingId: number | null = null;
    try {
      const serviceCreated =
        inbox.channel === "facebook" || inbox.channel === "instagram" || inbox.provider === "embedded";
      if (serviceCreated) {
        const response = await fetch("/api/cw/inboxes", { cache: "no-store" });
        if (!response.ok) throw new Error(`تعذر التحقق من صندوق القناة (${response.status}).`);
        const body = (await response.json()) as { payload?: { id: number; name: string }[] };
        const savedInbox = body.payload?.find((item) => item.name === inbox.name && item.id > 0);
        if (!savedInbox) throw new Error("لم تُثبت الخدمة وجود الصندوق؛ لا نعلن نجاح الربط.");
        setResult({ kind: "connected", name: savedInbox.name, id: savedInbox.id });
      } else {
        pendingId = inboxesStore.nextId();
        const saved = whenSaved();
        inboxesStore.save({
          id: pendingId,
          slug: `inbox-${pendingId}`,
          name: inbox.name,
          channel: inbox.channel,
          channelType: channelTypeFor(inbox.channel),
          identifier: [inbox.identifier, inbox.phone, inbox.name].find((value) => value?.trim()) ?? inbox.name,
          agents: [],
          autoAssign: true,
          provider: inbox.provider === "twilio" || inbox.provider === "whatsapp_cloud" ? inbox.provider : undefined,
          ...(inbox.webhookUrl ? { config: { extras: { webhookUrl: inbox.webhookUrl } } } : {}),
          ...(inbox.channelParams ? { channelParams: { ...inbox.channelParams } } : {}),
        } as Inbox);
        await saved;
        const savedInbox = inboxesStore
          .get()
          .find((item) => item.name === inbox.name && item.channel === inbox.channel);
        if (!savedInbox) throw new Error("لم يؤكد المخزن وجود الصندوق المحفوظ.");
        const transientInbox = savedInbox as Inbox & { channelParams?: Record<string, unknown> };
        delete transientInbox.channelParams;
        setResult({ kind: linkedSession() ? "created" : "preview", name: savedInbox.name, id: savedInbox.id });
      }
      setOpen(false);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "تعذر إكمال الربط.";
      if (pendingId !== null && message !== CHANGED_ELSEWHERE) {
        const pendingInbox = inboxesStore.find(pendingId);
        if (!linkedSession() && pendingInbox?.name === inbox.name) inboxesStore.remove(pendingId);
      }
      setError(message);
    } finally {
      delete inbox.channelParams;
      setSaving(false);
    }
  }

  return (
    <section
      dir="rtl"
      aria-label="ترحيب إيما واختيار القناة"
      className="flex min-h-[calc(100svh-8rem)] flex-col items-center justify-start px-3 py-8 text-foreground sm:px-5"
    >
      {notice && (
        <p role="alert" className="mb-4 max-w-xl text-center text-muted-foreground text-sm">
          {notice}
        </p>
      )}
      <div className="flex w-full max-w-4xl flex-col items-center">
        <ChannelOrbit selected={selected} onSelect={choose}>
          <Image
            src={emma}
            alt="إيما ترحب بك وتساعدك على اختيار القناة"
            priority
            className="h-[min(54svh,440px)] w-auto max-w-full object-contain"
          />
        </ChannelOrbit>
        {active && (
          <aside data-emma-connect-card className="mt-8 w-full max-w-sm">
            <Button
              data-emma-connect
              data-glass-connect-button
              variant="outline"
              aria-haspopup="dialog"
              className="min-h-11 w-full justify-between rounded-3xl bg-background/80 px-4 shadow-sm backdrop-blur-xl"
              disabled={saving}
              onClick={() => {
                setResult(null);
                setError(null);
                setOpen(true);
              }}
            >
              ربط {active.name}
              <ArrowUpRight aria-hidden="true" />
            </Button>
            <p className="mt-2 text-center text-muted-foreground text-xs">
              يفتح معالج القناة داخل الصفحة؛ النجاح يتطلب تأكيد الحفظ.
            </p>
          </aside>
        )}
      </div>
      <p className="mt-7 text-center text-muted-foreground">
        {active ? "اختر قناة أخرى أو تابع خطوة الربط" : "اختر قناتك، ودع إيما تساعدك في ربطها"}
      </p>
      {result && (
        <div
          role="status"
          data-emma-connect-result
          className="mt-4 grid w-full max-w-md gap-3 rounded-xl border p-4 text-sm"
        >
          <p>
            {resultLabels[result.kind]}: {result.name} (#{result.id})
          </p>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/settings/inboxes/${result.id}`}>إكمال إعدادات القناة</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/chat">
              <MessageSquare aria-hidden="true" />
              فتح الصندوق
            </Link>
          </Button>
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/chat">فتح المحادثات</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/dashboard/reports/summary">فتح الملخص</Link>
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!saving) setOpen(nextOpen);
        }}
      >
        <DialogContent dir="rtl" data-emma-connect-dialog className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader className="text-start">
            <DialogTitle>ربط {active?.name ?? "القناة"}</DialogTitle>
            <DialogDescription>
              لا تُعلن القناة مرتبطة حتى تؤكد الخدمة وجود صندوقها. الصندوق الجديد يحتاج إعداد الموظفين من إعدادات القناة.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className={saving ? "pointer-events-none opacity-60" : ""}>
              <ChannelForm
                key={selected}
                channel={channelFor(formKeys[selected])}
                onCreate={(inbox) => {
                  void created(inbox);
                }}
              />
            </div>
          )}
          {saving && <p role="status">جارٍ حفظ القناة والتحقق من النتيجة…</p>}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              لم يكتمل الربط: {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
