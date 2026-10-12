"use client";

// Pieces of the Chatwoot reply composer used by reply-box.tsx:
// - the formatting menu of WootMessageEditor (constants/editor.js FORMATTING, per channel and for private notes),
// - the caret pickers of Editor.vue: '{{' VariableList, '#' MacroList, ':' KeyboardEmojiSelector,
// - attachment preview chips (ReplyBox attachedFiles), ReplyEmailHead (TO / CC / BCC with validation),
// - QuotedEmailPreview (quoted email thread under an email reply).
import { type ReactNode, useState } from "react";

import { cn } from "cn";
import {
  Bold,
  ChevronDown,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { agents, type Conversation, CURRENT_AGENT_ID, type CwAttachment, inboxOf } from "./cw-data";

export type FormatKey = "strong" | "em" | "code" | "link" | "strike" | "bulletList" | "orderedList" | "undo" | "redo";

// constants/editor.js FORMATTING[...].menu, without 'copilot' (AI Assist sits in the top panel) and 'imageUpload'
// (the paperclip already attaches images). Voice has no Chatwoot entry; it follows Channel::Api.
const MENUS: Record<string, FormatKey[]> = {
  email: ["strong", "em", "code", "link", "bulletList", "orderedList", "undo", "redo"],
  chat: ["strong", "em", "code", "link", "strike", "bulletList", "orderedList", "undo", "redo"],
  whatsapp: ["strong", "em", "code", "strike", "bulletList", "orderedList", "undo", "redo"],
  instagram: ["strong", "em", "code", "bulletList", "orderedList", "strike", "undo", "redo"],
  facebook: ["strong", "em", "code", "strike", "bulletList", "orderedList", "undo", "redo"],
  phone: ["strong", "em", "undo", "redo"],
  note: ["strong", "em", "code", "link", "strike", "bulletList", "orderedList", "undo", "redo"],
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
}: {
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
    <div className="flex flex-wrap items-center gap-0.5 px-2 pt-1.5" role="toolbar" aria-label="Formatting">
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
        const separator = key === "undo" && index > 0 && <span className="mx-1 h-4 w-px bg-border" aria-hidden />;
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
  const agent = agents.find((a) => a.id === CURRENT_AGENT_ID) ?? agents[0];
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

export type ReplyFile = CwAttachment & { previewUrl?: string };

export function fileFromBrowser(file: globalThis.File): ReplyFile {
  const isImage = file.type.startsWith("image/");
  return {
    type: isImage ? "image" : file.type.startsWith("audio/") ? "audio" : "file",
    name: file.name,
    size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
    previewUrl: isImage ? URL.createObjectURL(file) : undefined,
  };
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
}: {
  value: EmailHeadValue;
  subject: string;
  onChange: (value: EmailHeadValue) => void;
}) {
  const [showBcc, setShowBcc] = useState(value.bcc !== "");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const row = (key: keyof EmailHeadValue, label: string, extra?: ReactNode) => {
    const bad = touched[key] && (!validEmails(value[key]) || (key === "to" && value.to.trim() === ""));
    return (
      <div>
        <div className={cn("flex items-center gap-2 border-b py-0.5", bad && "border-destructive")}>
          <label htmlFor={`reply-${key}`} className="w-14 shrink-0 font-medium text-muted-foreground">
            {label}
          </label>
          <Input
            id={`reply-${key}`}
            className="h-7 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
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
    <div className="grid gap-0.5 px-3 pt-1 pb-1.5 text-xs" data-slot="reply-email-head">
      {row("to", "TO")}
      {row(
        "cc",
        "CC",
        !showBcc && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-primary text-xs"
            onClick={() => setShowBcc(true)}
          >
            Add bcc
          </Button>
        ),
      )}
      {showBcc && row("bcc", "BCC")}
      <div className="flex items-center gap-2 py-1">
        <span className="w-14 shrink-0 font-medium text-muted-foreground">Subject</span>
        <span className="truncate ps-1">Re: {subject}</span>
      </div>
    </div>
  );
}

// QuotedEmailPreview.vue: the previous email quoted under the reply, collapsible and removable.
export function QuotedEmailPreview({ from, text, onRemove }: { from: string; text: string; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-3 mb-1 rounded-md border bg-muted/40 px-2 py-1.5 text-xs" data-slot="quoted-email">
      <div className="flex items-center gap-2">
        <span className="truncate text-muted-foreground">On a previous email, {from} wrote:</span>
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
      <p
        dir="auto"
        className={cn("mt-1 whitespace-pre-wrap border-s-2 ps-2 text-muted-foreground", !open && "line-clamp-1")}
      >
        {text}
      </p>
    </div>
  );
}
