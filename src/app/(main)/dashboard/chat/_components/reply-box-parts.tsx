"use client";

// Pieces of the Chatwoot reply composer used by reply-box.tsx:
// - the formatting menu of WootMessageEditor (constants/editor.js FORMATTING, per channel and for private notes),
// - the caret pickers of Editor.vue: '{{' VariableList, '#' MacroList, ':' KeyboardEmojiSelector,
// - attachment preview chips (ReplyBox attachedFiles), ReplyEmailHead (TO / CC / BCC with validation),
// - QuotedEmailPreview (quoted email thread under an email reply).
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "cn";
import {
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code,
  File,
  FileAudio,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Undo2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroupButton } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { agents, type Conversation, CURRENT_AGENT_ID, type CwAttachment, inboxOf, liveAgents } from "./cw-data";

// Keep every tool in the rail; visible buttons reveal overflow without adding a toolbar row.
export function ReplyToolRail({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const previous = rail.scrollLeft > 1;
    const next = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1;
    setEdges((old) => (old.previous === previous && old.next === next ? old : { previous, next }));
  }, []);
  useEffect(() => {
    if (!enabled || !railRef.current || !contentRef.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(railRef.current);
    observer.observe(contentRef.current);
    measure();
    return () => observer.disconnect();
  }, [enabled, measure]);
  if (!enabled) return <div className="contents">{children}</div>;
  const scroll = (direction: number) => {
    const rail = railRef.current;
    if (rail)
      rail.scrollBy({
        left: direction * Math.max(40, rail.clientWidth - 40),
        behavior: "smooth",
      });
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1" dir="ltr">
      {(edges.previous || edges.next) && (
        <InputGroupButton
          type="button"
          size="icon-xs"
          variant="outline"
          aria-label="Previous reply tools"
          title="Previous reply tools"
          disabled={!edges.previous}
          onClick={() => scroll(-1)}
        >
          <ChevronLeft />
        </InputGroupButton>
      )}
      <div
        ref={railRef}
        className="scrollbar-none no-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        role="toolbar"
        aria-label="Email reply tools"
        onScroll={measure}
        onFocusCapture={(event) => {
          const target = event.target;
          requestAnimationFrame(() => target.scrollIntoView({ block: "nearest", inline: "nearest" }));
        }}
      >
        <div ref={contentRef} className="flex w-max min-w-full items-center gap-2">
          {children}
        </div>
      </div>
      {(edges.previous || edges.next) && (
        <InputGroupButton
          type="button"
          size="icon-xs"
          variant="outline"
          aria-label="More reply tools"
          title="More reply tools"
          disabled={!edges.next}
          onClick={() => scroll(1)}
        >
          <ChevronRight />
        </InputGroupButton>
      )}
    </div>
  );
}

export type FormatKey = "strong" | "em" | "code" | "link" | "strike" | "bulletList" | "orderedList" | "undo" | "redo";

// constants/editor.js FORMATTING[...].menu, without 'copilot' (AI Assist sits in the top panel) and 'imageUpload'
// (the paperclip already attaches images). Voice has no Chatwoot entry; it follows Channel::Api.
// T-282 (item 123): same buttons per channel, in the editor-toolbar order of CKEditor 5 and TinyMCE (and Google Docs /
// Gmail): Undo, Redo | Bold, Italic, Strikethrough, Code | Link | Bulleted, Numbered list.
const MENUS: Record<string, FormatKey[]> = {
  email: ["undo", "redo", "strong", "em", "code", "link", "bulletList", "orderedList"],
  chat: ["undo", "redo", "strong", "em", "strike", "code", "link", "bulletList", "orderedList"],
  whatsapp: ["undo", "redo", "strong", "em", "strike", "code", "bulletList", "orderedList"],
  instagram: ["undo", "redo", "strong", "em", "strike", "code", "bulletList", "orderedList"],
  facebook: ["undo", "redo", "strong", "em", "strike", "code", "bulletList", "orderedList"],
  phone: ["undo", "redo", "strong", "em"],
  note: ["undo", "redo", "strong", "em", "strike", "code", "link", "bulletList", "orderedList"],
};

export function formatMenuFor(conversation: Conversation, isNote: boolean): FormatKey[] {
  return isNote ? MENUS.note : (MENUS[inboxOf(conversation).id] ?? MENUS.phone);
}

const FORMAT_META: Record<FormatKey, { label: string; icon: ReactNode }> = {
  strong: { label: "Bold", icon: <Bold /> },
  em: { label: "Italic", icon: <Italic /> },
  code: { label: "Code", icon: <Code /> },
  link: { label: "Link", icon: <Link2 /> },
  strike: { label: "Strikethrough", icon: <Strikethrough /> },
  bulletList: { label: "Bullet List", icon: <List /> },
  orderedList: { label: "Ordered List", icon: <ListOrdered /> },
  undo: { label: "Undo", icon: <Undo2 /> },
  redo: { label: "Redo", icon: <Redo2 /> },
};

export type FormatResult = { text: string; start: number; end: number };

// Markdown is what Chatwoot stores for every channel, so the textarea gets the same marks the editor would write.
export function applyFormat(
  text: string,
  start: number,
  end: number,
  key: Exclude<FormatKey, "undo" | "redo">,
  url?: string,
): FormatResult {
  const selected = text.slice(start, end);
  const wrap = (open: string, close = open, fallback = "text"): FormatResult => {
    const inner = selected || fallback;
    const next = `${text.slice(0, start)}${open}${inner}${close}${text.slice(end)}`;
    return { text: next, start: start + open.length, end: start + open.length + inner.length };
  };
  switch (key) {
    case "strong":
      return wrap("**", "**", "bold text");
    case "em":
      return wrap("*", "*", "italic text");
    case "strike":
      return wrap("~~", "~~", "strikethrough");
    case "code":
      return selected.includes("\n") ? wrap("```\n", "\n```", "code") : wrap("`", "`", "code");
    case "link": {
      const href = url ? url : "https://";
      return wrap("[", `](${href})`, selected ? selected : (url ?? "link"));
    }
    case "bulletList":
    case "orderedList": {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = end === start ? text.indexOf("\n", end) : end;
      const stop = lineEnd === -1 ? text.length : lineEnd;
      const lines = text.slice(lineStart, stop).split("\n");
      const block = lines
        .map((line, index) => `${key === "bulletList" ? "- " : `${index + 1}. `}${line.replace(/^(- |\d+\. )/, "")}`)
        .join("\n");
      return {
        text: `${text.slice(0, lineStart)}${block}${text.slice(stop)}`,
        start: lineStart,
        end: lineStart + block.length,
      };
    }
  }
}

export function FormatBar({
  menu,
  canUndo,
  canRedo,
  disabled,
  onFormat,
  scrollable = false,
}: {
  scrollable?: boolean;
  menu: FormatKey[];
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  onFormat: (key: FormatKey, url?: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  if (menu.length === 0) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 px-2 pt-1.5",
        scrollable ? "scrollbar-none no-scrollbar flex-nowrap overflow-x-auto overflow-y-hidden pt-0" : "flex-wrap",
      )}
      role="toolbar"
      aria-label="Formatting"
      tabIndex={scrollable ? 0 : undefined}
    >
      {menu.map((key, index) => {
        const meta = FORMAT_META[key];
        const off = Boolean(disabled) || (key === "undo" && !canUndo) || (key === "redo" && !canRedo);
        const button = (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={meta.label}
            disabled={off}
            className="size-7 text-muted-foreground [&_svg]:size-3.5"
            onMouseDown={(event) => event.preventDefault()}
            onClick={key === "link" ? undefined : () => onFormat(key)}
          >
            {meta.icon}
          </Button>
        );
        // T-282: Undo / Redo lead the bar, so the divider now follows Redo instead of preceding Undo.
        const separator = index > 0 && menu[index - 1] === "redo" && (
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        );
        if (key === "link") {
          return (
            <Popover key={key} open={linkOpen} onOpenChange={setLinkOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>{button}</PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">{meta.label}</TooltipContent>
              </Tooltip>
              <PopoverContent side="top" align="start" className="w-72 p-2">
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!/^https?:\/\/\S+\.\S+/.test(url)) return;
                    onFormat("link", url);
                    setUrl("");
                    setLinkOpen(false);
                  }}
                >
                  <Input
                    autoFocus
                    className="h-8 text-xs"
                    placeholder="https://"
                    value={url}
                    aria-invalid={url !== "" && !/^https?:\/\/\S+\.\S+/.test(url)}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                  <Button type="submit" size="sm" className="h-8">
                    Add
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <span key={key} className="flex items-center">
            {separator}
            <Tooltip>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="top">{meta.label}</TooltipContent>
            </Tooltip>
          </span>
        );
      })}
    </div>
  );
}

// Chatwoot @chatwoot/utils getMessageVariables: the variables a reply or canned response can carry.
export function messageVariables(conversation: Conversation): { key: string; label: string; value: string }[] {
  const [first, ...rest] = conversation.contact.name.split(" ");
  const agent = liveAgents().find((a) => a.id === CURRENT_AGENT_ID) ?? agents[0];
  const [agentFirst, ...agentRest] = agent.name.split(" ");
  const inbox = inboxOf(conversation);
  return [
    { key: "contact.name", label: "Contact name", value: conversation.contact.name },
    { key: "contact.first_name", label: "Contact first name", value: first ?? "" },
    { key: "contact.last_name", label: "Contact last name", value: rest.join(" ") },
    { key: "contact.email", label: "Contact email", value: conversation.contact.email },
    { key: "contact.phone", label: "Contact phone", value: conversation.contact.phone },
    { key: "contact.id", label: "Contact ID", value: String(conversation.id + 1000) },
    { key: "conversation.id", label: "Conversation ID", value: String(conversation.id) },
    { key: "agent.name", label: "Agent name", value: agent.name },
    { key: "agent.first_name", label: "Agent first name", value: agentFirst ?? "" },
    { key: "agent.last_name", label: "Agent last name", value: agentRest.join(" ") },
    { key: "agent.email", label: "Agent email", value: agent.email },
    { key: "inbox.name", label: "Inbox name", value: inbox.name },
    { key: "inbox.id", label: "Inbox ID", value: inbox.id },
  ];
}

export function replaceVariables(text: string, conversation: Conversation): { text: string; undefinedVars: string[] } {
  const vars = messageVariables(conversation);
  const undefinedVars: string[] = [];
  const out = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const found = vars.find((v) => v.key === key);
    if (found?.value) return found.value;
    undefinedVars.push(`{{${key}}}`);
    return match;
  });
  return { text: out, undefinedVars };
}

// CaretAnchoredPicker look: list on the left, optional preview of the hovered row on the right.
export function CaretPicker<T>({
  heading,
  items,
  empty,
  getKey,
  renderItem,
  renderPreview,
  onSelect,
}: {
  heading?: string;
  items: T[];
  empty: string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  renderPreview?: (item: T) => ReactNode;
  onSelect: (item: T) => void;
}) {
  const [hover, setHover] = useState(0);
  const active = items[Math.min(hover, items.length - 1)];
  return (
    <div className="absolute inset-x-2 bottom-full z-20 mb-1 flex max-h-64 overflow-hidden rounded-md border bg-popover shadow-md">
      <div className="min-w-0 flex-1 overflow-y-auto p-1">
        {heading && <p className="px-2 py-1 font-medium text-muted-foreground text-xs">{heading}</p>}
        {items.length === 0 ? (
          <p className="px-2 py-3 text-center text-muted-foreground text-xs">{empty}</p>
        ) : (
          items.map((item, index) => (
            <button
              key={getKey(item)}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                index === hover ? "bg-muted" : "hover:bg-muted",
              )}
              onMouseEnter={() => setHover(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(item)}
            >
              {renderItem(item)}
            </button>
          ))
        )}
      </div>
      {renderPreview && active && (
        <div className="hidden w-56 shrink-0 overflow-y-auto border-l bg-muted/30 sm:block">
          {renderPreview(active)}
        </div>
      )}
    </div>
  );
}

// F-5A: the browser's own file goes along, so its bytes are kept with the reply (sim-thread-persist.ts keepMessage).
export type ReplyFile = CwAttachment & { previewUrl?: string; file?: globalThis.File };

export function fileFromBrowser(file: globalThis.File): ReplyFile {
  const isImage = file.type.startsWith("image/");
  return {
    type: isImage ? "image" : file.type.startsWith("audio/") ? "audio" : "file",
    name: file.name,
    size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
    previewUrl: isImage ? URL.createObjectURL(file) : undefined,
    file,
  };
}

// T-119: attachment limits by the conversation's channel, from each channel's own docs (Meta, updated Jun-Jul 2026):
// Instagram "Send a message" Limitations table (image png/jpeg 8MB, file pdf 25MB, audio aac/m4a/wav/mp4 25MB);
// Messenger "Saving assets" (image 8 MB, other types 25 MB); WhatsApp Cloud API "Media" supported types (image
// jpeg/png 5 MB, audio aac/amr/mp3/m4a/ogg 16 MB, pdf 100 MB). 1 MB = 1024 × 1024 bytes, as Chatwoot checkFileSizeLimit.
// F-11 (Fahad item 34, «كما استفادوا من هذه الحدود عندنا كذالك» -> «نعم موافق»: a limit per channel from its own docs).
// Email, Website chat and Phone had Chatwoot's general 40 MB with no source; each now has its own (read 15 Oct 2026):
// - Phone (and SMS): a Twilio number (lib/cw/data.ts provider "twilio"). Twilio's official page "Accepted content
//   types for media": MMS 5 MB for the message and its media together
//   (https://www.twilio.com/docs/messaging/guides/accepted-mime-types). Chatwoot's own reply box gives Twilio SMS
//   5 MB a file, images JPEG and PNG only, any audio (chatwoot/utils fileUploadRules.ts lines 198-208,
//   https://github.com/chatwoot/utils/blob/59fcb7a725decb71bcfa2524fb20ddaa16698485/src/fileUploadRules.ts). In
//   Chatwoot v4.18.0 a phone (voice) inbox is a Twilio SMS channel with voice turned on (migration
//   20260326120001_drop_channel_voice.rb), so the same rule applies. Like Chatwoot, each file is checked.
// - Website chat: the channel is Chatwoot's own widget, so Chatwoot is its official source: 40 MB a file, any image
//   and audio type (fileUploadRules.ts default, lines 112-121); its server refuses more for the widget
//   (app/models/attachment.rb lines 186-213, MAXIMUM_FILE_UPLOAD_SIZE 40 in config/installation_config.yml 92-95,
//   https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/models/attachment.rb).
// - Email: no official limit exists for "email" as such (each mail server sets its own), so this is Chatwoot's
//   limit from its code, said as such: 40 MB a file (the same default, installation_config.yml 92-95), and Chatwoot
//   attaches up to 20 MB in total to the email and sends anything more as download links
//   (app/mailers/conversation_reply_mailer_attachment_helper.rb lines 9-10 and 38,
//   https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/mailers/conversation_reply_mailer_attachment_helper.rb).
// The API channel keeps Chatwoot's default 40 MB (fileUploadRules.ts has no rule for it).
export type AttachKind = "image" | "pdf" | "audio";
type KindRule = { mb: number; types: string[]; formats: string };

const MB = 1024 * 1024;
const PDF: KindRule = { mb: 25, types: ["application/pdf", ".pdf"], formats: "PDF" };
const META_IMAGE: KindRule = {
  mb: 8,
  types: ["image/png", "image/jpeg", ".png", ".jpg", ".jpeg"],
  formats: "PNG, JPEG",
};
const META_AUDIO: KindRule = {
  mb: 25,
  types: [
    "audio/aac",
    "audio/x-aac",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
    ".aac",
    ".m4a",
    ".wav",
    ".mp4",
  ],
  formats: "AAC, M4A, WAV, MP4",
};
// F-11: Chatwoot's own limit (fileUploadRules.ts default node, max 40), for Website chat and Email (see above).
const CHATWOOT_LIMITS: Record<AttachKind, KindRule> = {
  image: { mb: 40, types: ["image/*"], formats: "images" },
  pdf: { ...PDF, mb: 40 },
  audio: { mb: 40, types: ["audio/*"], formats: "audio" },
};
// F-11: a Twilio number (Phone, SMS): 5 MB (Twilio MMS); images JPEG or PNG, any audio (Chatwoot's Twilio SMS rule).
const TWILIO_LIMITS: Record<AttachKind, KindRule> = {
  image: { mb: 5, types: ["image/jpeg", "image/png", ".jpg", ".jpeg", ".png"], formats: "JPEG, PNG" },
  pdf: { ...PDF, mb: 5 },
  audio: { mb: 5, types: ["audio/*"], formats: "audio" },
};
const CHANNEL_LIMITS: Record<string, Record<AttachKind, KindRule>> = {
  Email: CHATWOOT_LIMITS,
  Website: CHATWOOT_LIMITS,
  Voice: TWILIO_LIMITS,
  SMS: TWILIO_LIMITS,
  Instagram: { image: META_IMAGE, pdf: PDF, audio: META_AUDIO },
  Messenger: { image: META_IMAGE, pdf: PDF, audio: META_AUDIO },
  WhatsApp: {
    image: { ...META_IMAGE, mb: 5 },
    pdf: { ...PDF, mb: 100 },
    audio: {
      mb: 16,
      types: [
        "audio/aac",
        "audio/amr",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/x-m4a",
        "audio/ogg",
        ".aac",
        ".amr",
        ".mp3",
        ".m4a",
        ".ogg",
      ],
      formats: "AAC, AMR, MP3, M4A, OGG",
    },
  },
};
const DEFAULT_LIMITS: Record<AttachKind, KindRule> = CHATWOOT_LIMITS;

/** F-11: Email's "Attach files" (Word, Excel, any file): Chatwoot's 40 MB a file (installation_config.yml 92-95). */
export const ANY_FILE_MB = 40;

export const attachLimits = (channelType: string) => CHANNEL_LIMITS[channelType] ?? DEFAULT_LIMITS;

// Email keeps the general "Attach files" of before T-119 (Word, Excel and any other file, no new limit);
// images, PDF and audio there still follow the limits above.
export const takesAnyFile = (channelType: string) => channelType === "Email";

// ManyChat composer wording: "Insert an image up to 8 MB", "Attach a PDF up to 25 MB", "Send an audio up to 25 MB".
export function attachLabel(kind: AttachKind, channelType: string): string {
  const { mb } = attachLimits(channelType)[kind];
  if (kind === "image") return `Insert an image up to ${mb} MB`;
  if (kind === "pdf") return `Attach a PDF up to ${mb} MB`;
  return `Send an audio up to ${mb} MB`;
}

export const attachAccept = (kind: AttachKind, channelType: string) => attachLimits(channelType)[kind].types.join(",");

const extOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};
const matches = (file: globalThis.File, types: string[]) =>
  types.some((type) => {
    if (type.startsWith(".")) return extOf(file.name) === type;
    if (type.endsWith("/*")) return file.type.startsWith(type.slice(0, -1));
    return file.type === type;
  });
const KIND_NAMES: Record<AttachKind, string> = { image: "Images", pdf: "PDFs", audio: "Audio files" };

function kindOf(file: globalThis.File): AttachKind | null {
  const ext = extOf(file.name);
  if (file.type === "application/pdf" || ext === ".pdf") return "pdf";
  if (file.type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "image";
  if (file.type.startsWith("audio/") || [".aac", ".amr", ".mp3", ".m4a", ".ogg", ".wav", ".opus"].includes(ext))
    return "audio";
  return null;
}

/** null when the file can go on this channel, otherwise the error to show (checked before it is attached). */
export function attachError(file: globalThis.File, channelType: string, channelName: string): string | null {
  const kind = kindOf(file);
  if (!kind) {
    if (!takesAnyFile(channelType)) return `${file.name}: only images, PDF and audio can be attached on ${channelName}`;
    // F-11: any other file on Email had no size check; Chatwoot's limit applies to it too
    return file.size > ANY_FILE_MB * MB
      ? `${file.name} is too large. Files on ${channelName} can be up to ${ANY_FILE_MB} MB`
      : null;
  }
  const rule = attachLimits(channelType)[kind];
  const what = KIND_NAMES[kind];
  if (!matches(file, rule.types)) return `${file.name}: ${what} on ${channelName} must be ${rule.formats}`;
  if (file.size > rule.mb * MB)
    return `${file.name} is too large. ${what} on ${channelName} can be up to ${rule.mb} MB`;
  return null;
}

// ReplyBox attachment preview: image thumbnails, file and audio chips, each with a remove button.
export function AttachmentChips({ files, onRemove }: { files: ReplyFile[]; onRemove: (index: number) => void }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-slot="reply-attachments">
      {files.map((file, index) => (
        <span
          key={`${file.name}-${index}`}
          className="group/chip flex items-center gap-1.5 rounded-md border bg-background py-1 ps-1 pe-2 text-xs"
        >
          {file.previewUrl ? (
            // biome-ignore lint/performance/noImgElement: local blob preview of a picked file
            <img src={file.previewUrl} alt="" className="size-8 rounded object-cover" />
          ) : (
            <span className="grid size-8 place-items-center rounded bg-muted text-muted-foreground">
              {file.type === "audio" ? <FileAudio className="size-4" /> : <File className="size-4" />}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="max-w-40 truncate font-medium">{file.name}</span>
            <span className="text-muted-foreground">{file.size ?? file.duration}</span>
          </span>
          <button
            type="button"
            aria-label="Remove attachment"
            className="ms-1 text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(index)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

const EMAIL_LIST = /^\s*([^\s@,]+@[^\s@,]+\.[^\s@,]+\s*)(,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+\s*)*,?\s*$/;
export const validEmails = (value: string) => value.trim() === "" || EMAIL_LIST.test(value);

export type EmailHeadValue = { to: string; cc: string; bcc: string };

// ReplyEmailHead.vue: TO, CC (with "Add bcc") and BCC, validated on blur with "Please enter valid email addresses".
export function EmailHead({
  value,
  subject,
  onChange,
  maxHeight,
}: {
  maxHeight?: number;
  value: EmailHeadValue;
  subject: string;
  onChange: (value: EmailHeadValue) => void;
}) {
  const [showCc, setShowCc] = useState(value.cc !== "");
  const [showBcc, setShowBcc] = useState(value.bcc !== "");
  const ccVisible = showCc || value.cc !== "";
  const bccVisible = showBcc || value.bcc !== "";
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const recipientsRef = useRef<HTMLElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const newlyShownRecipient = useRef<"cc" | "bcc" | null>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const measure = useCallback(() => {
    const recipients = recipientsRef.current;
    if (!recipients) return;
    const previous = recipients.scrollTop > 1;
    const next = recipients.scrollTop + recipients.clientHeight < recipients.scrollHeight - 1;
    setEdges((old) => (old.previous === previous && old.next === next ? old : { previous, next }));
  }, []);
  useEffect(() => {
    if (!recipientsRef.current || !rowsRef.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(recipientsRef.current);
    observer.observe(rowsRef.current);
    measure();
    return () => observer.disconnect();
  }, [measure]);
  // Reveal an added field before paint, then keep the focused field visible if its budget shrinks.
  useLayoutEffect(() => {
    const requested = newlyShownRecipient.current;
    if ((requested === "cc" && !ccVisible) || (requested === "bcc" && !bccVisible)) return;
    const input = requested
      ? rowsRef.current?.querySelector<HTMLInputElement>(`#reply-${requested}`)
      : rowsRef.current?.querySelector<HTMLInputElement>("input:focus");
    if (!input) return;
    if (requested) {
      newlyShownRecipient.current = null;
      input.focus({ preventScroll: true });
    }
    if (requested || maxHeight !== undefined) input.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [ccVisible, bccVisible, maxHeight]);
  const scrollRecipients = (direction: number) => {
    const recipients = recipientsRef.current;
    if (!recipients || !rowsRef.current) return;
    const viewport = recipients.getBoundingClientRect();
    const rows = Array.from(rowsRef.current.children);
    const target =
      direction > 0
        ? rows.find((row) => row.getBoundingClientRect().bottom > viewport.bottom + 1)
        : rows.reverse().find((row) => row.getBoundingClientRect().top < viewport.top - 1);
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const row = (key: keyof EmailHeadValue, label: string, extra?: ReactNode) => {
    const bad = touched[key] && (!validEmails(value[key]) || (key === "to" && value.to.trim() === ""));
    return (
      <div data-recipient-row>
        <div className={cn("flex items-center gap-1 border-b", bad && "border-destructive")}>
          <label htmlFor={`reply-${key}`} className="w-8 shrink-0 font-medium text-muted-foreground">
            {label}
          </label>
          <Input
            id={`reply-${key}`}
            className="h-6 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
            placeholder="Emails separated by commas"
            value={value[key]}
            aria-invalid={bad || undefined}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
          />
          {extra}
        </div>
        {bad && <p className="pt-0.5 text-destructive">Please enter valid email addresses</p>}
      </div>
    );
  };
  return (
    <div className="flex min-h-[45px] flex-col px-3 py-0.5 text-xs" data-slot="reply-email-head" style={{ maxHeight }}>
      <div className="flex min-h-[25px] flex-1 gap-1">
        <section
          ref={recipientsRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
          aria-label="Email recipients: TO, CC, BCC"
          onScroll={measure}
          onFocusCapture={(event) => {
            if (event.target instanceof HTMLInputElement) {
              event.target.closest("[data-recipient-row]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
          }}
        >
          <div ref={rowsRef} className="grid gap-0.5">
            {row(
              "to",
              "TO",
              <>
                {!ccVisible && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1"
                    aria-label="Show CC"
                    onClick={() => {
                      newlyShownRecipient.current = "cc";
                      setShowCc(true);
                    }}
                  >
                    CC
                  </Button>
                )}
                {!bccVisible && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1"
                    aria-label="Show BCC"
                    onClick={() => {
                      newlyShownRecipient.current = "bcc";
                      setShowBcc(true);
                    }}
                  >
                    Add bcc
                  </Button>
                )}
              </>,
            )}
            {ccVisible && row("cc", "CC")}
            {bccVisible && row("bcc", "BCC")}
          </div>
        </section>
        {(edges.previous || edges.next) && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-6 w-7"
              aria-label="Previous recipient fields (TO, CC, BCC)"
              title="Previous recipients: TO, CC, BCC"
              disabled={!edges.previous}
              onClick={() => scrollRecipients(-1)}
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-6 w-7"
              aria-label="More recipient fields (TO, CC, BCC)"
              title="More recipients: TO, CC, BCC"
              disabled={!edges.next}
              onClick={() => scrollRecipients(1)}
            >
              <ChevronDown />
            </Button>
          </div>
        )}
      </div>
      <div className="flex h-4 shrink-0 items-center gap-1" data-slot="reply-email-subject">
        <label htmlFor="reply-subject" className="shrink-0 font-medium text-muted-foreground">
          Subject
        </label>
        <Input
          id="reply-subject"
          readOnly
          className="h-4 min-w-0 border-0 bg-transparent px-1 text-xs shadow-none dark:bg-transparent"
          title={`Reply subject (read-only): Re: ${subject}`}
          aria-label={`Reply subject (read-only): Re: ${subject}`}
          value={`Re: ${subject}`}
        />
      </div>
    </div>
  );
}

// QuotedEmailPreview.vue: the previous email quoted under the reply, collapsible and removable.
export function QuotedEmailPreview({
  from,
  text,
  onRemove,
  maxHeight,
}: {
  from: string;
  text: string;
  onRemove: () => void;
  maxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="mx-3 mb-1 overflow-y-auto overscroll-contain rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
      data-slot="quoted-email"
      style={{ maxHeight }}
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-muted-foreground" title={`On a previous email, ${from} wrote:`}>
          On a previous email, {from} wrote:
        </span>
        <button
          type="button"
          aria-label={open ? "Collapse preview" : "Expand preview"}
          className="ms-auto text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <button
          type="button"
          aria-label="Remove quoted email thread"
          className="text-muted-foreground hover:text-foreground"
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {open && (
        <p dir="auto" className="mt-1 whitespace-pre-wrap border-s-2 ps-2 text-muted-foreground">
          {text}
        </p>
      )}
    </div>
  );
}
