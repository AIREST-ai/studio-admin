"use client";

// M129-C: a template drawn as WhatsApp shows it (header, body, footer, time, buttons). Meta components page: with more
// than three buttons the message shows two and puts the rest behind "See all options".
import type * as React from "react";

import { cn } from "cn";
import { Copy, ExternalLink, FileText, Image as ImageIcon, List, Phone, Reply, ShoppingBag, Video } from "lucide-react";

import {
  buttonLabel,
  effectiveBody,
  effectiveButtons,
  effectiveFooter,
  fillSamples,
  type TemplateDraft,
  type TemplateRecord,
} from "./template-model";

export interface BubbleButton {
  kind: "quick_reply" | "url" | "phone" | "copy_code" | "catalog" | "other";
  label: string;
}

export interface BubbleContent {
  rtl?: boolean;
  headerText?: string;
  media?: "image" | "video" | "document" | "catalog";
  mediaName?: string;
  /** Object URL of a picked image, shown as the header. */
  mediaUrl?: string;
  body: string;
  footer?: string;
  buttons: BubbleButton[];
}

const icon: Record<BubbleButton["kind"], React.ElementType> = {
  quick_reply: Reply,
  url: ExternalLink,
  phone: Phone,
  copy_code: Copy,
  catalog: ShoppingBag,
  other: Reply,
};

/** WhatsApp's *bold*, _italic_ and ~strike~ (template bodies accept them). */
function formatted(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 8)}`;
    if (/^\*[^*]+\*$/.test(part)) return <strong key={key}>{part.slice(1, -1)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
    if (/^~[^~]+~$/.test(part)) return <s key={key}>{part.slice(1, -1)}</s>;
    return <span key={key}>{part}</span>;
  });
}

export function WhatsAppBubble({ content, className }: { content: BubbleContent; className?: string }) {
  const { buttons } = content;
  const shown = buttons.length > 3 ? buttons.slice(0, 2) : buttons;
  const MediaIcon =
    content.media === "video"
      ? Video
      : content.media === "document"
        ? FileText
        : content.media === "catalog"
          ? ShoppingBag
          : ImageIcon;
  return (
    <div data-wa-preview="" className={cn("rounded-xl bg-[#e5ddd5] p-4 dark:bg-[#0b141a]", className)}>
      <div className="max-w-[88%]">
        <div
          dir={content.rtl ? "rtl" : "ltr"}
          className="rounded-lg rounded-tl-none bg-white p-2.5 text-[#111b21] text-sm shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]"
        >
          {content.media ? (
            content.mediaUrl && content.media === "image" ? (
              // biome-ignore lint/performance/noImgElement: a local object URL of the picked sample, not a page asset
              <img
                src={content.mediaUrl}
                alt={content.mediaName ?? "Header image"}
                className="mb-2 max-h-44 w-full rounded-md object-cover"
              />
            ) : (
              <div className="mb-2 grid h-28 place-items-center gap-1 rounded-md bg-black/5 text-center dark:bg-white/5">
                <MediaIcon className="size-7 text-[#667781]" />
                {content.mediaName ? (
                  <span className="max-w-full truncate px-2 text-[#667781] text-[11px]">{content.mediaName}</span>
                ) : null}
              </div>
            )
          ) : null}
          {content.headerText ? <p className="mb-1 font-semibold">{content.headerText}</p> : null}
          <p className="whitespace-pre-wrap break-words leading-relaxed">{formatted(content.body || " ")}</p>
          {content.footer ? <p className="mt-1 text-[#667781] text-xs">{content.footer}</p> : null}
          <p className="mt-1 text-right text-[#667781] text-[10px]" dir="ltr">
            10:42
          </p>
        </div>
        {shown.length ? (
          <div className="mt-1 grid gap-1">
            {shown.map((b, i) => {
              const Icon = icon[b.kind];
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: buttons can repeat a label while being edited
                  key={`${i}-${b.label}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 font-medium text-[#00a5f4] text-sm shadow-sm dark:bg-[#202c33]"
                  dir={content.rtl ? "rtl" : "ltr"}
                >
                  <Icon className="size-3.5" />
                  {b.label || "Button"}
                </div>
              );
            })}
            {buttons.length > 3 ? (
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 font-medium text-[#00a5f4] text-sm shadow-sm dark:bg-[#202c33]">
                <List className="size-3.5" /> See all options
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The builder's draft as WhatsApp would show it, with the sample values filled in. */
export function bubbleFromDraft(draft: TemplateDraft, mediaUrl?: string): BubbleContent {
  const isAuth = draft.category === "AUTHENTICATION";
  const isCatalog = draft.category === "MARKETING" && draft.kind === "catalog";
  const media = isAuth
    ? undefined
    : isCatalog
      ? "catalog"
      : draft.headerType === "none" || draft.headerType === "text"
        ? undefined
        : draft.headerType;
  return {
    rtl: draft.code === "ar" && !isAuth,
    headerText:
      !isAuth && !isCatalog && draft.headerType === "text"
        ? fillSamples(draft.headerText, [draft.headerExample])
        : undefined,
    media,
    mediaName: isCatalog ? "Product thumbnail" : draft.headerSample?.name,
    mediaUrl: media === "image" ? mediaUrl : undefined,
    body: fillSamples(effectiveBody(draft), draft.examples),
    footer: effectiveFooter(draft) || undefined,
    buttons: effectiveButtons(draft).map((b) => ({ kind: b.type, label: buttonLabel(b) })),
  };
}

/** A list row as WhatsApp would show it; `values` fills {{1}}, {{2}}… (defaults: the template's samples). */
export function bubbleFromRecord(t: TemplateRecord, values?: string[]): BubbleContent {
  if (t.draft) {
    const bubble = bubbleFromDraft(t.draft);
    return values ? { ...bubble, body: fillSamples(effectiveBody(t.draft), values) } : bubble;
  }
  const samples = values ?? ["Noura", ...(t.examples ?? [])];
  const kind = (label: string): BubbleButton["kind"] =>
    t.type === "Copy code"
      ? "copy_code"
      : t.type === "Catalog"
        ? "catalog"
        : t.type === "Call to action"
          ? "url"
          : label
            ? "quick_reply"
            : "other";
  return {
    rtl: t.language === "Arabic",
    headerText: t.header,
    media: t.type === "Catalog" ? "catalog" : t.media,
    body: fillSamples(t.body, samples),
    footer: t.footer,
    buttons: (t.buttons ?? []).map((label) => ({ kind: kind(label), label })),
  };
}
