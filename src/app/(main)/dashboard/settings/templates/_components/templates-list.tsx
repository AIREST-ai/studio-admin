"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Templates (templates/Index.vue, TemplateCard.vue,
// TemplatePreviewDrawer.vue, templateUtils.js; whatsappTemplateMgmt.json) in the Studio pattern.
import * as React from "react";

import { Copy, ExternalLink, Eye, FileText, Image as ImageIcon, MessageCircle, Phone, RefreshCw, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, type Tone, ToneBadge } from "../../labels/_shared/settings-ui";

type Status = "APPROVED" | "PENDING" | "REJECTED" | "UNSUBMITTED";
type TemplateType =
  | "Text"
  | "Image"
  | "Video"
  | "Document"
  | "Media"
  | "Quick reply"
  | "Call to action"
  | "Catalog"
  | "Copy code";

interface Template {
  name: string;
  status: Status;
  type: TemplateType;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: "English" | "Arabic";
  inboxes: string[];
  provider: "Meta" | "Twilio";
  header?: string;
  media?: "image" | "video" | "document";
  body: string;
  footer?: string;
  buttons?: string[];
}

const templates: Template[] = [
  { name: "order_confirmation", status: "APPROVED", type: "Call to action", category: "UTILITY", language: "English", inboxes: ["WhatsApp Doha"], provider: "Meta", header: "Order confirmed", body: "Hi {{1}}, thank you for your order {{2}}. We will deliver it to {{3}} within 24 hours.", footer: "Reply STOP to unsubscribe", buttons: ["Track order"] },
  { name: "order_confirmation_ar", status: "APPROVED", type: "Call to action", category: "UTILITY", language: "Arabic", inboxes: ["WhatsApp Doha"], provider: "Meta", header: "تم تأكيد طلبك", body: "مرحباً {{1}}، شكراً لطلبك رقم {{2}}. سنوصله إلى {{3}} خلال ٢٤ ساعة.", buttons: ["تتبع الطلب"] },
  { name: "delivery_out_today", status: "APPROVED", type: "Quick reply", category: "UTILITY", language: "English", inboxes: ["WhatsApp Doha", "WhatsApp Dubai"], provider: "Meta", body: "Good news {{1}}! Your order is out for delivery today between {{2}}. Will someone be home?", buttons: ["Yes", "Reschedule"] },
  { name: "ramadan_offer_2026", status: "PENDING", type: "Image", category: "MARKETING", language: "Arabic", inboxes: ["WhatsApp Doha", "WhatsApp Riyadh"], provider: "Meta", media: "image", body: "رمضان كريم 🌙 خصم ٢٠٪ على جميع الأجهزة المنزلية حتى نهاية الشهر. استخدم الرمز {{1}}." },
  { name: "product_demo_video", status: "APPROVED", type: "Video", category: "MARKETING", language: "English", inboxes: ["WhatsApp Dubai"], provider: "Meta", media: "video", body: "See the new Smart Air Fryer in 30 seconds, {{1}}. Reply YES to book a home demo." },
  { name: "invoice_ready", status: "APPROVED", type: "Document", category: "UTILITY", language: "English", inboxes: ["WhatsApp Dubai"], provider: "Meta", media: "document", body: "Hello {{1}}, your invoice {{2}} for AED {{3}} is attached." },
  { name: "login_code", status: "APPROVED", type: "Copy code", category: "AUTHENTICATION", language: "English", inboxes: ["WhatsApp Doha", "WhatsApp Dubai", "WhatsApp Riyadh"], provider: "Meta", body: "{{1}} is your verification code. For your security, do not share this code.", buttons: ["Copy code"] },
  { name: "new_arrivals_catalog", status: "APPROVED", type: "Catalog", category: "MARKETING", language: "English", inboxes: ["WhatsApp Doha"], provider: "Meta", body: "New arrivals are here, {{1}}! Browse the autumn collection right inside WhatsApp.", buttons: ["View catalog"] },
  { name: "feedback_request", status: "REJECTED", type: "Quick reply", category: "MARKETING", language: "English", inboxes: ["WhatsApp Riyadh"], provider: "Meta", body: "How was your visit to our Riyadh showroom today, {{1}}?", buttons: ["Great", "Okay", "Not good"] },
  { name: "appointment_reminder", status: "UNSUBMITTED", type: "Text", category: "UTILITY", language: "English", inboxes: ["Twilio WhatsApp"], provider: "Twilio", body: "Reminder: your service visit is booked for {{1}} at {{2}}. Reply 1 to confirm or 2 to change." },
  { name: "branch_photos", status: "APPROVED", type: "Media", category: "MARKETING", language: "Arabic", inboxes: ["Twilio WhatsApp"], provider: "Twilio", media: "image", body: "افتتحنا فرعنا الجديد في لوسيل 🎉 تفضل بزيارتنا واحصل على هدية ترحيبية." },
];

const statusMeta: Record<Status, { label: string; tone: Tone }> = {
  APPROVED: { label: "approved", tone: "green" },
  PENDING: { label: "pending", tone: "amber" },
  REJECTED: { label: "rejected", tone: "red" },
  UNSUBMITTED: { label: "Not submitted for WhatsApp approval", tone: "gray" },
};

const typeIcon: Record<TemplateType, React.ElementType> = {
  Text: MessageCircle,
  Image: ImageIcon,
  Video,
  Document: FileText,
  Media: ImageIcon,
  "Quick reply": MessageCircle,
  "Call to action": Phone,
  Catalog: MessageCircle,
  "Copy code": Copy,
};

const allTypes: TemplateType[] = ["Text", "Image", "Video", "Document", "Media", "Quick reply", "Call to action", "Catalog", "Copy code"];
const allInboxes = Array.from(new Set(templates.flatMap((t) => t.inboxes)));

function syncStamp(date: Date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function WhatsAppPreview({ t }: { t: Template }) {
  const rtl = t.language === "Arabic";
  const MediaIcon = t.media === "video" ? Video : t.media === "document" ? FileText : ImageIcon;
  return (
    <div className="rounded-xl bg-[#e5ddd5] p-4 dark:bg-[#0b141a]">
      <div
        dir={rtl ? "rtl" : "ltr"}
        className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-2.5 text-[#111b21] text-sm shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]"
      >
        {t.media ? (
          <div className="mb-2 grid h-32 place-items-center rounded-md bg-black/5 dark:bg-white/5">
            <MediaIcon className="size-8 text-[#667781]" />
          </div>
        ) : null}
        {t.header ? <p className="mb-1 font-semibold">{t.header}</p> : null}
        <p className="leading-relaxed">{t.body}</p>
        {t.footer ? <p className="mt-1 text-[#667781] text-xs">{t.footer}</p> : null}
        <p className="mt-1 text-right text-[#667781] text-[10px]">10:42</p>
        {t.buttons?.length ? (
          <div className="-mx-2.5 -mb-2.5 mt-2 divide-y border-black/10 border-t dark:border-white/10">
            {t.buttons.map((b) => (
              <div key={b} className="py-2 text-center font-medium text-[#00a5f4] text-sm">
                {b}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TemplatesList() {
  const [query, setQuery] = React.useState("");
  const [inbox, setInbox] = React.useState("All inboxes");
  const [language, setLanguage] = React.useState("All languages");
  const [type, setType] = React.useState("All types");
  const [preview, setPreview] = React.useState<Template | undefined>();
  const [syncing, setSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState("Oct 12, 2026, 9:14 AM");

  const q = query.trim().toLowerCase();
  const rows = templates.filter(
    (t) =>
      (inbox === "All inboxes" || t.inboxes.includes(inbox)) &&
      (language === "All languages" || t.language === language) &&
      (type === "All types" || t.type === type) &&
      `${t.name} ${t.body}`.toLowerCase().includes(q),
  );

  function sync() {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setLastSync(syncStamp(new Date()));
      toast.success("Template sync started for all WhatsApp inboxes. Updates may take a couple of minutes.");
    }, 1200);
  }

  return (
    <>
      <SettingsShell
        title="Templates"
        description="View the message templates synced from your WhatsApp inboxes. To create or edit a template, manage it with your provider."
        learnMore="Learn more about WhatsApp templates"
        count={plural(rows.length, "template", "templates")}
        search={{ placeholder: "Search by content or name...", value: query, onChange: setQuery }}
        cardTitle="WhatsApp templates"
        cardDescription={`Last sync attempt on ${lastSync}`}
        actions={
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
            <RefreshCw className={syncing ? "animate-spin" : undefined} /> Sync templates
          </Button>
        }
      >
        <ChipBar>
          <ChipSelect label="Inbox" value={inbox} options={["All inboxes", ...allInboxes]} onChange={setInbox} />
          <ChipSelect
            label="Language"
            value={language}
            options={["All languages", "English", "Arabic"]}
            onChange={setLanguage}
          />
          <ChipSelect label="Type" value={type} options={["All types", ...allTypes]} onChange={setType} />
        </ChipBar>
        {rows.length ? (
          <div className="divide-y">
            {rows.map((t) => {
              const Icon = typeIcon[t.type];
              const meta = statusMeta[t.status];
              return (
                // biome-ignore lint/a11y/useSemanticElements: row holds a nested preview button, as TemplateCard.vue.
                <div
                  key={t.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreview(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPreview(t);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-muted/40 shadow-xs">
                      <Icon className="size-5 text-muted-foreground" />
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{t.name}</span>
                        <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                        <span>{t.type}</span>
                        <span className="h-3 w-px bg-border" />
                        <span>{t.category.toLowerCase()}</span>
                        <span className="h-3 w-px bg-border" />
                        <span>{t.language}</span>
                        <span className="h-3 w-px bg-border" />
                        <span className="truncate">
                          {t.inboxes[0]}
                          {t.inboxes.length > 1 ? ` +${t.inboxes.length - 1}` : ""}
                        </span>
                      </div>
                      <p className="line-clamp-1 max-w-2xl text-muted-foreground text-xs" dir="auto">
                        {t.body}
                      </p>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Preview ${t.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreview(t);
                        }}
                      >
                        <Eye />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Template preview</TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        ) : (
          <NoResults>{templates.length ? "No templates match your filters." : "No WhatsApp templates found."}</NoResults>
        )}
      </SettingsShell>

      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(undefined)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Template preview</SheetTitle>
            <SheetDescription>Preview how this template appears in WhatsApp.</SheetDescription>
          </SheetHeader>
          {preview ? (
            <div className="grid gap-5 overflow-y-auto p-4">
              <div className="font-medium">{preview.name}</div>
              <WhatsAppPreview t={preview} />
              <div className="grid gap-3">
                <span className="font-medium text-sm">Template details</span>
                <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <ToneBadge tone={statusMeta[preview.status].tone}>{statusMeta[preview.status].label}</ToneBadge>
                  </dd>
                  <dt className="text-muted-foreground">Content type</dt>
                  <dd>{preview.type}</dd>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{preview.category.toLowerCase()}</dd>
                  <dt className="text-muted-foreground">Language</dt>
                  <dd>{preview.language}</dd>
                  <dt className="text-muted-foreground">Inboxes</dt>
                  <dd className="flex flex-wrap gap-1">
                    {preview.inboxes.map((i) => (
                      <ToneBadge key={i} tone="gray" dot={false}>
                        {i}
                      </ToneBadge>
                    ))}
                  </dd>
                </dl>
              </div>
              <Button variant="outline" className="w-fit" asChild>
                <a
                  href={
                    preview.provider === "Twilio"
                      ? "https://console.twilio.com/us1/develop/sms/content-template-builder"
                      : "https://business.facebook.com/wa/manage/message-templates/"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {preview.provider === "Twilio" ? "Manage in Twilio" : "Manage in Meta"} <ExternalLink />
                </a>
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
