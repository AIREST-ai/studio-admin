"use client";
import * as React from "react";

import { ChevronDown, ExternalLink, Eye, Inbox, Languages, LayoutGrid, MessageCircle, RefreshCw } from "lucide-react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";

type Status = "APPROVED" | "PENDING" | "REJECTED";

interface Template {
  name: string;
  status: Status;
  type: "Text" | "Image" | "Document" | "Call to action" | "Quick reply";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: "English" | "Arabic";
  inboxes: string[];
  header?: string;
  body: string;
  footer?: string;
  buttons?: string[];
}

const templates: Template[] = [
  {
    name: "order_confirmation",
    status: "APPROVED",
    type: "Call to action",
    category: "UTILITY",
    language: "English",
    inboxes: ["WhatsApp Doha"],
    header: "Order confirmed",
    body: "Hi {{1}}, thank you for your order {{2}}. We will deliver it to {{3}} within 24 hours.",
    footer: "Reply STOP to unsubscribe",
    buttons: ["Track order"],
  },
  {
    name: "order_confirmation_ar",
    status: "APPROVED",
    type: "Call to action",
    category: "UTILITY",
    language: "Arabic",
    inboxes: ["WhatsApp Doha"],
    header: "تم تأكيد طلبك",
    body: "مرحباً {{1}}، شكراً لطلبك رقم {{2}}. سنوصله إلى {{3}} خلال ٢٤ ساعة.",
    buttons: ["تتبع الطلب"],
  },
  {
    name: "delivery_out_today",
    status: "APPROVED",
    type: "Quick reply",
    category: "UTILITY",
    language: "English",
    inboxes: ["WhatsApp Doha", "WhatsApp Dubai"],
    body: "Good news {{1}}! Your order is out for delivery today between {{2}}. Will someone be home?",
    buttons: ["Yes", "Reschedule"],
  },
  {
    name: "ramadan_offer_2026",
    status: "PENDING",
    type: "Image",
    category: "MARKETING",
    language: "Arabic",
    inboxes: ["WhatsApp Doha", "WhatsApp Riyadh"],
    header: "[Image]",
    body: "رمضان كريم 🌙 خصم ٢٠٪ على جميع الأجهزة المنزلية حتى نهاية الشهر. استخدم الرمز {{1}}.",
  },
  {
    name: "invoice_ready",
    status: "APPROVED",
    type: "Document",
    category: "UTILITY",
    language: "English",
    inboxes: ["WhatsApp Dubai"],
    header: "[Document]",
    body: "Hello {{1}}, your invoice {{2}} for AED {{3}} is attached.",
  },
  {
    name: "login_code",
    status: "APPROVED",
    type: "Text",
    category: "AUTHENTICATION",
    language: "English",
    inboxes: ["WhatsApp Doha", "WhatsApp Dubai", "WhatsApp Riyadh"],
    body: "{{1}} is your verification code. For your security, do not share this code.",
  },
  {
    name: "feedback_request",
    status: "REJECTED",
    type: "Quick reply",
    category: "MARKETING",
    language: "English",
    inboxes: ["WhatsApp Riyadh"],
    body: "How was your visit to our Riyadh showroom today, {{1}}?",
    buttons: ["Great", "Okay", "Not good"],
  },
];

const statusClass: Record<Status, string> = {
  APPROVED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  REJECTED: "bg-destructive/10 text-destructive",
};

function FilterMenu({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon /> {selected.label} <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WhatsAppPreview({ t }: { t: Template }) {
  const rtl = t.language === "Arabic";
  return (
    <div className="rounded-xl bg-[#e5ddd5] p-4 dark:bg-[#0b141a]">
      <div
        dir={rtl ? "rtl" : "ltr"}
        className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-2.5 text-[#111b21] text-sm shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]"
      >
        {t.header ? <p className="mb-1 font-semibold">{t.header}</p> : null}
        <p className="leading-relaxed">{t.body}</p>
        {t.footer ? <p className="mt-1 text-[#667781] text-xs">{t.footer}</p> : null}
        <p className="mt-1 text-right text-[#667781] text-[10px]">10:42</p>
        {t.buttons?.length ? (
          <div className="-mx-2.5 -mb-2.5 mt-2 divide-y border-t border-black/10 dark:border-white/10">
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

export function TemplatesSettings() {
  const [query, setQuery] = React.useState("");
  const [inbox, setInbox] = React.useState("all");
  const [language, setLanguage] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [preview, setPreview] = React.useState<Template | undefined>();

  const q = query.trim().toLowerCase();
  const rows = templates.filter(
    (t) =>
      (inbox === "all" || t.inboxes.includes(inbox)) &&
      (language === "all" || t.language === language) &&
      (type === "all" || t.type === type) &&
      `${t.name} ${t.body} ${t.category}`.toLowerCase().includes(q),
  );

  return (
    <>
      <SettingsShell
        title="Templates"
        description="View the message templates synced from your WhatsApp inboxes. To create or edit a template, manage it with your provider."
        learnMore="Learn more about WhatsApp templates"
        count={plural(rows.length, "template", "templates")}
        search={{ placeholder: "Search by content or name...", value: query, onChange: setQuery }}
        actions={
          <Button variant="outline" size="sm">
            <RefreshCw /> Sync templates
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 px-6 pt-4 pb-3">
          <FilterMenu
            icon={Inbox}
            value={inbox}
            onChange={setInbox}
            options={[
              { value: "all", label: "All inboxes" },
              { value: "WhatsApp Doha", label: "WhatsApp Doha" },
              { value: "WhatsApp Dubai", label: "WhatsApp Dubai" },
              { value: "WhatsApp Riyadh", label: "WhatsApp Riyadh" },
            ]}
          />
          <FilterMenu
            icon={Languages}
            value={language}
            onChange={setLanguage}
            options={[
              { value: "all", label: "All languages" },
              { value: "English", label: "English" },
              { value: "Arabic", label: "Arabic" },
            ]}
          />
          <FilterMenu
            icon={LayoutGrid}
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "All types" },
              { value: "Text", label: "Text" },
              { value: "Image", label: "Image" },
              { value: "Document", label: "Document" },
              { value: "Quick reply", label: "Quick reply" },
              { value: "Call to action", label: "Call to action" },
            ]}
          />
          <span className="ml-auto text-muted-foreground text-xs">Last sync attempt on Oct 12, 2026, 9:14 AM</span>
        </div>
        <Separator />
        {rows.length ? (
          <div className="divide-y">
            {rows.map((t) => (
              <button
                type="button"
                key={t.name}
                onClick={() => setPreview(t)}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-muted/40 shadow-xs">
                    <MessageCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <div className="grid min-w-0 gap-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{t.name}</span>
                      <span className={cn("rounded-md px-2 py-0.5 font-medium text-xs", statusClass[t.status])}>
                        {t.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                      <span>{t.type}</span>
                      <span className="h-3 w-px bg-border" />
                      <span>{t.language}</span>
                      <span className="h-3 w-px bg-border" />
                      <span className="truncate">
                        {t.inboxes[0]}
                        {t.inboxes.length > 1 ? ` +${t.inboxes.length - 1}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="grid size-7 shrink-0 place-items-center rounded-md border">
                      <Eye className="size-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Template preview</TooltipContent>
                </Tooltip>
              </button>
            ))}
          </div>
        ) : (
          <NoResults>No templates match your filters.</NoResults>
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
              <WhatsAppPreview t={preview} />
              <div className="grid gap-3">
                <span className="font-medium text-sm">Template details</span>
                <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <span className={cn("rounded-md px-2 py-0.5 font-medium text-xs", statusClass[preview.status])}>
                      {preview.status}
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Content type</dt>
                  <dd>{preview.type}</dd>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{preview.category}</dd>
                  <dt className="text-muted-foreground">Language</dt>
                  <dd>{preview.language}</dd>
                  <dt className="text-muted-foreground">Inboxes</dt>
                  <dd>{preview.inboxes.join(", ")}</dd>
                </dl>
              </div>
              <Button variant="outline" className="w-fit">
                Manage in Meta <ExternalLink />
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
