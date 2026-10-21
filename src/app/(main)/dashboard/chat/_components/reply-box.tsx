"use client";

// Chatwoot ReplyBox (ReplyTopPanel + WootMessageEditor + ReplyBottomPanel) on the Studio composer.
// Kept from the Studio chat: Reply / note tabs in amber (brown marker), the Send split button with
// "Send and resolve" (brown SendMenu) and the delivery ticks on sent replies.
// Editor triggers as in Editor.vue: '/' canned responses, '{{' variables, '#' macros, ':' emoji, '@' mentions (notes).
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "cn";
import {
  BookOpen,
  FilePlus,
  ImagePlus,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Music,
  Paperclip,
  Quote,
  Send,
  Signature,
  Smile,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { siWhatsapp } from "simple-icons";
import { toast } from "sonner";

import { brown, SendMenu } from "@/app/(main)/chat/_components/chat-thread-extras";
import { noteSendButtonClass } from "@/app/(main)/chat/_components/chat-thread-state";
import { SimpleIcon } from "@/components/simple-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVisibleMacros } from "@/lib/cw/macro-visibility";
import { useSectionShown } from "@/lib/owner/site-sections-context";

import { agentReplied } from "./bot-reply-sim";
import {
  aiOptions,
  type Conversation,
  type CwMessage,
  canReply,
  emojis,
  inboxOf,
  liveWhatsappTemplates,
  useLiveAgents,
  useLiveTeams,
} from "./cw-data";
import { resolveConversation } from "./cw-dialog-store";
import { openDialog, runMacro } from "./cw-dialogs";
import { searchCanned, useLiveCannedResponses } from "./live-canned";
import { noteTyping, stopTyping } from "./presence";
import {
  type AttachKind,
  AttachmentChips,
  applyFormat,
  attachAccept,
  attachError,
  attachLabel,
  attachLimits,
  CaretPicker,
  EmailHead,
  type EmailHeadValue,
  FormatBar,
  type FormatKey,
  fileFromBrowser,
  formatMenuFor,
  messageVariables,
  QuotedEmailPreview,
  type ReplyFile,
  ReplyToolRail,
  replaceVariables,
  takesAnyFile,
  validEmails,
} from "./reply-box-parts";
import { keepMessage } from "./sim-thread-persist";

const SIGNATURE = "--\nArham Khan\nCustomer Support · Weblabs Studio";

// F-5A (sim1 8.15b: "Start audio recording" added a made-up audio-recording-1.mp3 without the microphone): the button
// records from the microphone with the browser's MediaRecorder, in the first of these formats the browser can make
// (Chrome: AAC in MP4, which WhatsApp, Instagram and Messenger take as .m4a; Firefox: Ogg Opus). The browser allows
// the microphone only on a secure page (https or localhost):
// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#security
// https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
// Elsewhere, or without permission, it says nothing was recorded. The recording then follows the channel's file rules
// like any attached audio (reply-box-parts.tsx attachError); Chatwoot converts a recording for the channel
// (AudioRecorder), this preview does not.
const RECORD_FORMATS = [
  { mime: "audio/ogg;codecs=opus", type: "audio/ogg", ext: "ogg" },
  { mime: "audio/mp4;codecs=mp4a.40.2", type: "audio/mp4", ext: "m4a" },
  { mime: "audio/mp4", type: "audio/mp4", ext: "m4a" },
  { mime: "audio/webm;codecs=opus", type: "audio/webm", ext: "webm" },
];
type Recorder = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  format?: (typeof RECORD_FORMATS)[number];
};

// Chatwoot keeps an unsent draft per conversation (ReplyBox draftMessages); module state survives switching views.
const drafts = new Map<number, string>();

// Chatwoot Profile > "Hotkey to send messages" (useUISettings editor_message_key), reachable here from the key hint.
type Hotkey = "enter" | "cmd_enter";
const HOTKEY_STORAGE = "cw-editor-message-key";
function readHotkey(): Hotkey {
  try {
    return localStorage.getItem(HOTKEY_STORAGE) === "cmd_enter" ? "cmd_enter" : "enter";
  } catch {
    return "enter";
  }
}

function HotkeyHint({
  hotkey,
  shortcutKey,
  onChange,
  scrollable = false,
}: {
  scrollable?: boolean;
  hotkey: Hotkey;
  shortcutKey: string;
  onChange: (value: Hotkey) => void;
}) {
  const options: { value: Hotkey; heading: string; content: string }[] = [
    {
      value: "enter",
      heading: "Enter (↵)",
      content: "Send messages by pressing Enter key instead of clicking the send button.",
    },
    {
      value: "cmd_enter",
      heading: "Cmd/Ctrl + Enter (⌘ + ↵)",
      content: "Send messages by pressing Cmd/Ctrl + enter key instead of clicking the send button.",
    },
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Hotkey to send messages"
          title="Hotkey to send messages"
          className={cn(
            "ms-auto items-center gap-1 rounded px-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground",
            scrollable ? "flex shrink-0" : "hidden lg:flex",
          )}
        >
          <Kbd className="h-4 text-[10px]">{hotkey === "enter" ? "↵" : shortcutKey}</Kbd>
          {!scrollable && (
            <>
              send <Kbd className="ms-1 h-4 text-[10px]">⇧ ↵</Kbd> new line
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 p-3">
        <p className="font-medium text-sm">Hotkey to send messages</p>
        <p className="mb-2 text-muted-foreground text-xs">
          You can select a hotkey (either Enter or Cmd/Ctrl+Enter) based on your preference of writing.
        </p>
        <div className="grid gap-1.5">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={hotkey === option.value}
              className={cn(
                "rounded-md border p-2 text-left",
                hotkey === option.value ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
              onClick={() => onChange(option.value)}
            >
              <span className="block font-medium text-xs">{option.heading}</span>
              <span className="block text-muted-foreground text-xs">{option.content}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Tip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const list = emojis.filter(([, name]) => name.includes(query.toLowerCase()));
  return (
    <Popover>
      <Tip label="Show emoji selector">
        <PopoverTrigger asChild>
          <InputGroupButton aria-label="Show emoji selector" type="button" size="icon-sm">
            <Smile />
          </InputGroupButton>
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="top" align="start" className="w-72 p-2">
        <Input
          className="mb-2 h-7"
          placeholder="Search emojis"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {list.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-xs">Type to search emojis</p>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {list.map(([emoji, name]) => (
              <button
                key={name}
                type="button"
                title={name}
                className="grid size-7 place-items-center rounded-md text-lg hover:bg-muted"
                onClick={() => onPick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function transform(key: string, text: string, firstName: string, subject: string): string {
  const base = text.trim();
  switch (key) {
    case "reply_suggestion":
      return `Hi ${firstName}, thanks for the details. I'm looking into this now and will update you within the hour.`;
    case "summarize":
      return `Summary: ${subject}. The customer is waiting on our next update.`;
    case "shorten":
      return base.split(/(?<=[.!?])\s/)[0] ?? base;
    case "expand":
      return `${base} Please let me know if there is anything else I can help with in the meantime.`;
    case "fix_spelling_grammar": {
      const fixed = base.charAt(0).toUpperCase() + base.slice(1);
      return /[.!?]$/.test(fixed) ? fixed : `${fixed}.`;
    }
    case "make_friendly":
    case "casual":
      return `Hey ${firstName}! ${base}`;
    case "professional":
      return `Dear ${firstName}, ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
    case "confident":
    case "straightforward":
      return base
        .replace(/\b(I think|maybe|perhaps|just)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    default:
      return base;
  }
}

// Trigger tokens at the end of the text (the caret sits there while typing).
const CANNED_RE = /(?:^|\s)\/([\w-]*)$/;
const VARIABLE_RE = /\{\{([\w.]*)$/;
const MACRO_RE = /(?:^|\s)#([\w-]*)$/;
const EMOJI_RE = /(?:^|\s):([a-z_]{2,})$/;
const MENTION_RE = /@(\w*)$/;

export function ReplyBox({
  conversation,
  replyTo,
  onClearReply,
  typingBanner,
  emailAvailableHeight,
}: {
  emailAvailableHeight?: number;
  conversation: Conversation;
  replyTo: CwMessage | null;
  onClearReply: () => void;
  // Chatwoot ReplyBoxBanner: the self-assign banner shows only while the agent types in the Reply tab.
  typingBanner?: ReactNode;
}) {
  const [pickedMode, setMode] = useState<"reply" | "note">("reply");
  const [text, setTextRaw] = useState(() => drafts.get(conversation.id) ?? "");
  const [files, setFiles] = useState<ReplyFile[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [signature, setSignature] = useState(false);
  const [quoted, setQuoted] = useState(true);
  const [quoteRemoved, setQuoteRemoved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingSend, setPendingSend] = useState<{ resolve: boolean; vars: string[] } | null>(null);
  const agents = useLiveAgents();
  const teams = useLiveTeams();
  // F-6B: the canned responses Settings saves (live), searched like Chatwoot (short code or content)
  const cannedResponses = useLiveCannedResponses();
  // F-19 (F-8's note): '#' offers the macros Settings > Macros saved (the shared list), not the sample copy.
  // F-24 (F-19's note): without other people's private macros (Chatwoot Macro.with_visibility), also under View as.
  const macros = useVisibleMacros();
  const [emailHead, setEmailHead] = useState<EmailHeadValue>({ to: conversation.contact.email, cc: "", bcc: "" });
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const lastPush = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inbox = inboxOf(conversation);
  const isEmail = inbox.id === "email";
  const composerRef = useRef<HTMLElement>(null);
  const [emailLayout, setEmailLayout] = useState({
    editor: 120,
    head: undefined as number | undefined,
    quote: undefined as number | undefined,
    extras: undefined as number | undefined,
  });
  const firstName = conversation.contact.name.split(" ")[0];
  // F159: Chatwoot can_reply = false (24 hour window closed, banner above the thread). Instagram and Facebook take
  // private notes only (Reply tab locked, ReplyBox canSendPublicReply); WhatsApp keeps the Reply tab for an approved
  // template (ReplyBox isEditorDisabled: no typing, only the WhatsApp Templates action).
  const windowClosed = !canReply(conversation);
  const notesOnly = windowClosed && inbox.id !== "whatsapp";
  const mode = notesOnly ? "note" : pickedMode;
  const isNote = mode === "note";
  const templateOnly = windowClosed && inbox.id === "whatsapp" && !isNote;
  // Q4: Chatwoot shows "Insert article from Help Center" only while the inbox has a Help Center portal
  // (v4.18.0 WootWriter/ReplyBottomPanel.vue enableInsertArticleInReply, v-if on the button); a Help Center section
  // the owner hid or turned off leaves no portal to insert from, so the button goes with it.
  const helpCenterShown = useSectionShown("help-center");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Switching mode replaces the measured editor and fields.
  useEffect(() => {
    const composer = composerRef.current;
    const textarea = textareaRef.current;
    if (!isEmail || emailAvailableHeight === undefined || !composer || !textarea) return;
    // Chatwoot ResizableEditorWrapper: 120/80 describe only the editor body.
    // Measure controls around it, then reserve a 200px thread when space allows.
    const measure = () => {
      const head = composer.querySelector<HTMLElement>('[data-slot="reply-email-head"]');
      const quote = composer.querySelector<HTMLElement>('[data-slot="quoted-email"]');
      const headHeight = head?.getBoundingClientRect().height ?? 0;
      const quoteHeight = quote?.getBoundingClientRect().height ?? 0;
      const extras = composer.querySelector<HTMLElement>("[data-reply-extra-details]");
      const extrasHeight = extras?.getBoundingClientRect().height ?? 0;
      const fixed =
        composer.getBoundingClientRect().height -
        textarea.getBoundingClientRect().height -
        headHeight -
        quoteHeight -
        extrasHeight;
      const details = Math.max(
        (head ? 45 : 0) + (quote ? 22 : 0) + (extras ? 30 : 0),
        emailAvailableHeight - 200 - 80 - fixed,
      );
      const extrasMax = extras ? Math.max(30, Math.min(64, details - (head ? 45 : 0) - (quote ? 22 : 0))) : 0;
      const extrasHeightAfter = extras ? Math.min(extras.scrollHeight, extrasMax) : 0;
      const quoteMax = quote ? Math.max(22, details - extrasHeightAfter - (head ? 45 : 0)) : 0;
      const quoteHeightAfter = quote ? Math.min(quote.scrollHeight + 2, quoteMax) : 0;
      const headMax = head ? Math.max(45, details - extrasHeightAfter - quoteHeightAfter) : 0;
      const surrounding =
        fixed + (head ? Math.min(head.scrollHeight, headMax) : 0) + quoteHeightAfter + extrasHeightAfter;
      const max = Math.max(80, Math.floor(emailAvailableHeight - 200 - surrounding));
      const defaultHeight = Math.min(120, max);
      const expandedHeight = Math.max(80, Math.min(Math.floor(emailAvailableHeight * 0.5 - surrounding / 2), max));
      const editorHeight = expanded ? (expandedHeight - defaultHeight < 100 ? max : expandedHeight) : defaultHeight;
      const next = {
        editor: editorHeight,
        head: head ? headMax : undefined,
        quote: quote ? quoteMax : undefined,
        extras: extras ? extrasMax : undefined,
      };
      setEmailLayout((previous) =>
        previous.editor === next.editor &&
        previous.head === next.head &&
        previous.quote === next.quote &&
        previous.extras === next.extras
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(composer);
    for (const element of composer.querySelectorAll(
      'textarea, [data-slot="reply-email-head"], [data-slot="quoted-email"], [data-slot="input-group-addon"], [data-slot="tabs-list"]',
    )) {
      observer.observe(element);
    }
    const mutations = new MutationObserver(measure);
    mutations.observe(composer, { childList: true, subtree: true });
    measure();
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [isEmail, emailAvailableHeight, expanded, mode]);
  const [hotkey, setHotkey] = useState<Hotkey>("enter");
  const [shortcutKey, setShortcutKey] = useState("⌘ + ↵");
  useEffect(() => {
    setHotkey(readHotkey());
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setShortcutKey("Ctrl + ↵");
  }, []);
  const saveHotkey = (value: Hotkey) => {
    setHotkey(value);
    try {
      localStorage.setItem(HOTKEY_STORAGE, value);
    } catch {
      // private mode: the choice lasts for this page only
    }
    toast.success("Your settings have been updated successfully");
  };
  let placeholder = isNote
    ? "Shift + enter for new line. This will be visible only to Agents"
    : "Shift + enter for new line. Start with '/' to select a Canned Response.";
  if (templateOnly)
    placeholder = "You can only reply using a template message due to 24-hour message window restriction";

  // Typing coalesces into one undo step per pause; toolbar actions, pickers and inserts are their own step.
  const setText = (next: string | ((prev: string) => string), step = false) => {
    const value = typeof next === "function" ? next(text) : next;
    if (value === text) return;
    const now = Date.now();
    if (step || now - lastPush.current > 800) {
      past.current = [...past.current.slice(-49), text];
      future.current = [];
    }
    lastPush.current = now;
    setTextRaw(value);
    // F-19: typing (not a toolbar action or a picked insert) tells the other agents "… is typing" (presence.tsx).
    if (!step) noteTyping(conversation.id);
  };

  const undo = () => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(text);
    setTextRaw(prev);
  };
  const redo = () => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(text);
    setTextRaw(next);
  };

  // A template picked in the closed window goes out with its variables filled: the contact's first name, then the
  // sample values approved with the template.
  const fillTemplate = (body: string) => {
    const examples = liveWhatsappTemplates().find((template) => template.body === body)?.examples ?? [];
    return body.replace(/\{\{(\d+)\}\}/g, (match, n: string) =>
      n === "1" ? firstName : (examples[Number(n) - 2] ?? match),
    );
  };

  useEffect(() => {
    if (recording === null) return;
    const timer = window.setInterval(() => setRecording((s) => (s === null ? null : s + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  // F-5A: a recording still running when the conversation changes or the box goes away is stopped and dropped.
  const dropRecording = () => {
    const current = recorder.current;
    recorder.current = null;
    if (!current) return;
    current.recorder.onstop = null;
    if (current.recorder.state !== "inactive") current.recorder.stop();
    for (const track of current.stream.getTracks()) track.stop();
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: on unmount only
  useEffect(() => dropRecording, []);

  // Draft per conversation (Chatwoot saves it on switch and restores it on return).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the open conversation changes
  useEffect(() => {
    setTextRaw(drafts.get(conversation.id) ?? "");
    setFiles([]);
    setFileErrors([]);
    dropRecording();
    setRecording(null);
    setQuoteRemoved(false);
    setEmailHead({ to: conversation.contact.email, cc: "", bcc: "" });
    past.current = [];
    future.current = [];
  }, [conversation.id]);

  useEffect(() => {
    if (text) drafts.set(conversation.id, text);
    else drafts.delete(conversation.id);
  }, [text, conversation.id]);

  const cannedMatch = !isNote && !templateOnly ? CANNED_RE.exec(text) : null;
  const variableMatch = !isNote && !templateOnly ? VARIABLE_RE.exec(text) : null;
  const macroMatch = !templateOnly ? MACRO_RE.exec(text) : null;
  const emojiMatch = !templateOnly ? EMOJI_RE.exec(text) : null;
  const mentionMatch = isNote ? MENTION_RE.exec(text) : null;

  const cannedList = cannedMatch ? searchCanned(cannedResponses, cannedMatch[1]) : [];
  const variables = messageVariables(conversation);
  const variableList = variableMatch ? variables.filter((v) => v.key.includes(variableMatch[1].toLowerCase())) : [];
  const macroList = macroMatch ? macros.filter((m) => m.name.toLowerCase().includes(macroMatch[1].toLowerCase())) : [];
  const emojiList = emojiMatch ? emojis.filter(([, name]) => name.includes(emojiMatch[1])).slice(0, 12) : [];
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null;
  const mentionAgents = mentionQuery === null ? [] : agents.filter((a) => a.name.toLowerCase().includes(mentionQuery));
  const mentionTeams = mentionQuery === null ? [] : teams.filter((t) => t.name.toLowerCase().includes(mentionQuery));

  const focusEnd = () => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const insert = (value: string) => {
    setText((prev) => (prev ? `${prev}${prev.endsWith(" ") || prev.endsWith("\n") ? "" : " "}${value}` : value), true);
    focusEnd();
  };

  // Replace the trigger token (with its leading space kept) by the picked value.
  const replaceToken = (re: RegExp, value: string) => {
    setText((prev) => {
      const match = re.exec(prev);
      if (!match) return prev;
      const lead = match[0].length - match[0].trimStart().length;
      return `${prev.slice(0, match.index + lead)}${value}`;
    }, true);
    focusEnd();
  };

  const pickCanned = (content: string) => replaceToken(CANNED_RE, replaceVariables(content, conversation).text);
  const pickVariable = (key: string) => replaceToken(VARIABLE_RE, `{{${key}}} `);
  const pickEmoji = (emoji: string) => replaceToken(EMOJI_RE, `${emoji} `);
  const pickMention = (name: string) => replaceToken(MENTION_RE, `@${name} `);
  const pickMacro = (id: number) => {
    replaceToken(MACRO_RE, "");
    runMacro(id, conversation.id);
  };

  const format = (key: FormatKey, url?: string) => {
    if (key === "undo") return undo();
    if (key === "redo") return redo();
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const result = applyFormat(text, start, end, key, url);
    setText(result.text, true);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.start, result.end);
    });
  };

  // T-119: every path in (pick, paste, drop) checks the file against the channel's limit before it is attached.
  const addFiles = (list: FileList | File[] | null | undefined) => {
    const all = Array.from(list ?? []);
    const errors = all.flatMap((file) => attachError(file, inbox.channelType, inbox.name) ?? []);
    const picked = all.filter((file) => !attachError(file, inbox.channelType, inbox.name)).map(fileFromBrowser);
    setFileErrors(errors);
    for (const error of errors) toast.error(error);
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
  };

  const onAttachmentKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (!isEmail || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    event.currentTarget.querySelector("input")?.click();
  };
  const attachButton = (kind: AttachKind, icon: ReactNode) => {
    const label = attachLabel(kind, inbox.channelType);
    return (
      <Tip key={kind} label={label}>
        <InputGroupButton aria-label={label} type="button" size="icon-sm" asChild>
          <label
            className="cursor-pointer"
            data-attach={kind}
            role={isEmail ? "button" : undefined}
            tabIndex={isEmail ? 0 : undefined}
            onKeyDown={onAttachmentKeyDown}
          >
            {icon}
            <input
              type="file"
              multiple
              accept={attachAccept(kind, inbox.channelType)}
              tabIndex={isEmail ? -1 : undefined}
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </InputGroupButton>
      </Tip>
    );
  };

  const emailInvalid =
    isEmail &&
    !isNote &&
    (emailHead.to.trim() === "" ||
      !validEmails(emailHead.to) ||
      !validEmails(emailHead.cc) ||
      !validEmails(emailHead.bcc));
  const sendDisabled = (!text.trim() && files.length === 0) || emailInvalid || recording !== null;

  const doSend = (resolve: boolean, force = false) => {
    if (sendDisabled) return;
    const { text: body, undefinedVars } = replaceVariables(text.trim(), conversation);
    // Chatwoot UNDEFINED_VARIABLES: confirm before sending a reply that still carries unknown {{variables}}.
    if (!force && !isNote && undefinedVars.length > 0) {
      setPendingSend({ resolve, vars: undefinedVars });
      return;
    }
    // F-5A (sim1 8.2b, 8.3): kept in the preview with its files, so it is there after a reload and in another browser;
    // a reply is marked "Simulated — not delivered to the customer" (sim-thread-persist.ts).
    keepMessage(conversation.id, {
      kind: isNote ? "note" : "outgoing",
      // Chatwoot sends a template without the signature (ReplyBox isEditorDisabled).
      text: signature && !isNote && !templateOnly ? `${body}\n\n${SIGNATURE}` : body,
      attachments: files,
      replyTo: replyTo?.text,
    });
    setTextRaw("");
    drafts.delete(conversation.id);
    past.current = [];
    future.current = [];
    setFiles([]);
    onClearReply();
    // F-19: sent, so no longer typing; and a reply the customer sees stops the bot (bot-reply-sim.tsx).
    stopTyping();
    if (!isNote) agentReplied(conversation.id, { resolving: resolve });
    // F-5A: the status change is kept and says so itself once saved.
    if (resolve) resolveConversation(conversation.id);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Not recorded: this page cannot use the microphone", {
        description: `Browsers allow the microphone only on secure pages (https or localhost); this preview is open at ${window.location.origin}. Nothing was recorded. Attach an audio file instead.`,
        duration: 12000,
      });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      toast.error("Not recorded", {
        description: `${name === "NotAllowedError" ? "The browser was not allowed to use the microphone" : name === "NotFoundError" ? "No microphone was found" : error instanceof Error ? error.message : String(error)}. Nothing was recorded.`,
        duration: 12000,
      });
      return;
    }
    const format = RECORD_FORMATS.find((item) => MediaRecorder.isTypeSupported(item.mime));
    const media = new MediaRecorder(stream, format ? { mimeType: format.mime } : undefined);
    const current: Recorder = { recorder: media, stream, chunks: [], format };
    media.ondataavailable = (event) => {
      if (event.data.size > 0) current.chunks.push(event.data);
    };
    media.start(250);
    recorder.current = current;
    setRecording(0);
  };

  const stopRecording = () => {
    const current = recorder.current;
    if (!current) return;
    recorder.current = null;
    const seconds = recording ?? 0;
    setRecording(null);
    current.recorder.onstop = () => {
      for (const track of current.stream.getTracks()) track.stop();
      const type = current.format?.type ?? (current.recorder.mimeType.split(";")[0] || "audio/webm");
      const ext = current.format?.ext ?? "webm";
      const blob = new Blob(current.chunks, { type });
      if (blob.size === 0) {
        toast.error("Not recorded", { description: "The microphone gave no sound data. Nothing was attached." });
        return;
      }
      const file = new File([blob], `audio-recording-${files.length + 1}.${ext}`, { type });
      const error = attachError(file, inbox.channelType, inbox.name);
      if (error) {
        setFileErrors([error]);
        toast.error(error, {
          description: `The browser recorded ${ext.toUpperCase()} audio. The engine converts a recording for the channel; this preview does not, so it was not attached.`,
        });
        return;
      }
      const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      setFiles((prev) => [...prev, { ...fileFromBrowser(file), type: "audio", duration }]);
    };
    current.recorder.stop();
  };

  const lastIncoming = [...conversation.messages].reverse().find((m) => m.align === "start");

  const toolbar = (
    <InputGroupAddon align="block-end" className={cn("flex-wrap", isEmail && "flex-nowrap py-1 pb-1")}>
      <ReplyToolRail enabled={isEmail}>
        {!templateOnly && <EmojiPicker onPick={insert} />}
        {!templateOnly && attachButton("image", <ImagePlus />)}
        {!templateOnly && attachButton("pdf", <Paperclip />)}
        {!templateOnly && attachButton("audio", <Music />)}
        {!templateOnly && takesAnyFile(inbox.channelType) && (
          <Tip label="Attach files">
            <InputGroupButton aria-label="Attach files" type="button" size="icon-sm" asChild>
              <label
                className="cursor-pointer"
                role={isEmail ? "button" : undefined}
                tabIndex={isEmail ? 0 : undefined}
                onKeyDown={onAttachmentKeyDown}
              >
                <FilePlus />
                <input
                  type="file"
                  multiple
                  tabIndex={isEmail ? -1 : undefined}
                  className="sr-only"
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </InputGroupButton>
          </Tip>
        )}
        {!isNote && !templateOnly && (
          <Tip
            label={
              recording === null
                ? `Record audio up to ${attachLimits(inbox.channelType).audio.mb} MB`
                : "Stop audio recording"
            }
          >
            <InputGroupButton
              aria-label={recording === null ? "Start audio recording" : "Stop audio recording"}
              type="button"
              size={isEmail || recording === null ? "icon-sm" : "sm"}
              className={cn(
                recording !== null && "text-destructive",
                isEmail && recording !== null && "flex-col gap-0",
              )}
              onClick={() => {
                if (recording === null) void startRecording();
                else stopRecording();
              }}
            >
              {recording === null ? <Mic /> : <MicOff />}
              {recording !== null && (
                <span className={cn("flex items-center gap-1 tabular-nums", isEmail && "text-[10px] leading-3")}>
                  {!isEmail && <span className="size-1.5 animate-pulse rounded-full bg-destructive" />}
                  {Math.floor(recording / 60)}:{String(recording % 60).padStart(2, "0")}
                </span>
              )}
            </InputGroupButton>
          </Tip>
        )}
        {!isNote && !templateOnly && (
          <Tip label={signature ? "Remove signature" : "Insert signature"}>
            <InputGroupButton
              aria-label="Message signature"
              aria-pressed={signature}
              type="button"
              size="icon-sm"
              className={cn(signature && "bg-muted text-foreground")}
              onClick={() => setSignature((v) => !v)}
            >
              <Signature />
            </InputGroupButton>
          </Tip>
        )}
        {!isNote && isEmail && (
          <Tip label={quoted ? "Don't include quoted email thread" : "Include quoted email thread"}>
            <InputGroupButton
              aria-label="Quoted email thread"
              aria-pressed={quoted}
              type="button"
              size="icon-sm"
              className={cn(quoted && "bg-muted text-foreground")}
              onClick={() => {
                setQuoted((v) => !v);
                setQuoteRemoved(false);
              }}
            >
              <Quote />
            </InputGroupButton>
          </Tip>
        )}
        {!isNote && inbox.id === "whatsapp" && (
          <Tip label="Whatsapp Templates">
            <InputGroupButton
              aria-label="Whatsapp Templates"
              type="button"
              size="icon-sm"
              className={cn("[&_svg]:size-3.5", templateOnly && "bg-muted text-foreground")}
              onClick={() =>
                openDialog({
                  type: "whatsapp-templates",
                  onInsert: (body) => setText(templateOnly ? fillTemplate(body) : body, true),
                })
              }
            >
              <SimpleIcon icon={siWhatsapp} />
            </InputGroupButton>
          </Tip>
        )}
        {!templateOnly && helpCenterShown && (
          <Tip label="Insert article from Help Center">
            <InputGroupButton
              aria-label="Insert article from Help Center"
              type="button"
              size="icon-sm"
              onClick={() => openDialog({ type: "articles", onInsert: insert })}
            >
              <BookOpen />
            </InputGroupButton>
          </Tip>
        )}
        <HotkeyHint hotkey={hotkey} shortcutKey={shortcutKey} onChange={saveHotkey} scrollable={isEmail} />
      </ReplyToolRail>
      <ButtonGroup className={cn("ms-2", isEmail && "ms-0 shrink-0")}>
        <InputGroupButton
          type="submit"
          variant="default"
          size="sm"
          disabled={sendDisabled}
          className={cn("h-8 px-3", isNote && noteSendButtonClass, brown.solid)}
        >
          <Send />
          {/* ReplyBox sendButtonText: "Send (↵)" / "Add Note (⌘ + ↵)". */}
          <span>
            {isNote ? "Add Note" : "Send"} ({hotkey === "enter" ? "↵" : shortcutKey})
          </span>
        </InputGroupButton>
        <SendMenu tone={mode} onSendAndResolve={() => doSend(true)} />
      </ButtonGroup>
    </InputGroupAddon>
  );

  const pickers = (
    <>
      {cannedMatch && (
        <CaretPicker
          heading="Canned Responses"
          items={cannedList}
          empty="No canned responses found"
          getKey={(c) => c.shortCode}
          onSelect={(c) => pickCanned(c.content)}
          renderItem={(c) => (
            <span className="flex min-w-0 flex-col">
              <code className="font-medium font-mono text-xs">/{c.shortCode}</code>
              <span dir="auto" className="line-clamp-1 text-muted-foreground text-xs">
                {c.content}
              </span>
            </span>
          )}
        />
      )}
      {variableMatch && (
        <CaretPicker
          heading="Variables"
          items={variableList}
          empty="No results found"
          getKey={(v) => v.key}
          onSelect={(v) => pickVariable(v.key)}
          renderItem={(v) => <code className="font-mono text-xs">{`{{${v.key}}}`}</code>}
          renderPreview={(v) => (
            <div className="flex flex-col gap-3 px-3 py-2.5 text-xs">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">Description</span>
                <span>{v.label}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">Value</span>
                <span className={cn("break-words", !v.value && "text-muted-foreground")}>
                  {v.value || "No value for this conversation"}
                </span>
              </div>
            </div>
          )}
        />
      )}
      {macroMatch && (
        <CaretPicker
          heading="Macros"
          items={macroList}
          empty="No macros found"
          getKey={(m) => String(m.id)}
          onSelect={(m) => pickMacro(m.id)}
          renderItem={(m) => (
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate">{m.name}</span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {m.actions.length === 1 ? "1 action" : `${m.actions.length} actions`}
              </span>
            </span>
          )}
          renderPreview={(m) => (
            <div className="px-3 py-2.5">
              {m.actions.map((action, index) => (
                <div
                  key={`${action.action}-${index}`}
                  className="group relative flex flex-col gap-0.5 ps-4 pb-2 last:pb-0"
                >
                  <span className="absolute start-[3.5px] top-1 -bottom-1 w-px bg-border group-last:hidden" />
                  <span className="absolute start-0 top-1 size-2 rounded-full border-2 bg-background" />
                  <span className="text-muted-foreground text-xs">{action.action}</span>
                  {action.value && <span className="break-words text-sm">{action.value}</span>}
                </div>
              ))}
            </div>
          )}
        />
      )}
      {emojiMatch && emojiList.length > 0 && (
        <CaretPicker
          items={emojiList}
          empty="Type to search emojis"
          getKey={([, name]) => name}
          onSelect={([emoji]) => pickEmoji(emoji)}
          renderItem={([emoji, name]) => (
            <>
              <span className="text-base">{emoji}</span>
              <span className="text-muted-foreground text-xs">:{name}:</span>
            </>
          )}
        />
      )}
      {mentionQuery !== null && mentionAgents.length + mentionTeams.length > 0 && (
        <div className="absolute inset-x-2 bottom-full z-20 mb-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {mentionAgents.length > 0 && <p className="px-2 py-1 font-medium text-muted-foreground text-xs">Agents</p>}
          {mentionAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => pickMention(agent.name)}
            >
              {agent.name}
              <span className="text-muted-foreground text-xs">{agent.email}</span>
            </button>
          ))}
          {mentionTeams.length > 0 && <p className="px-2 py-1 font-medium text-muted-foreground text-xs">Teams</p>}
          {mentionTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => pickMention(team.name)}
            >
              {team.name}
              <span className="text-muted-foreground text-xs">{team.members.length} members</span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  // Enter picks the first row of an open picker (Chatwoot interceptEnter), otherwise sends.
  const pickFirst = (): boolean => {
    if (cannedMatch && cannedList[0]) pickCanned(cannedList[0].content);
    else if (variableMatch && variableList[0]) pickVariable(variableList[0].key);
    else if (macroMatch && macroList[0]) pickMacro(macroList[0].id);
    else if (emojiMatch && emojiList[0]) pickEmoji(emojiList[0][0]);
    else if (mentionQuery !== null && mentionAgents[0]) pickMention(mentionAgents[0].name);
    else if (mentionQuery !== null && mentionTeams[0]) pickMention(mentionTeams[0].name);
    else return false;
    return true;
  };

  const editor = (
    <form
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        doSend(false);
      }}
    >
      {pickers}
      <InputGroup className="border-0 bg-transparent shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-transparent">
        {!templateOnly && (
          <InputGroupAddon align="block-start" className="p-0">
            <FormatBar
              menu={formatMenuFor(conversation, isNote)}
              scrollable={isEmail}
              canUndo={past.current.length > 0}
              canRedo={future.current.length > 0}
              onFormat={format}
            />
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          ref={textareaRef}
          // Chatwoot disables the editor in a closed WhatsApp window; the picked template shows here before Send.
          readOnly={templateOnly}
          aria-disabled={templateOnly || undefined}
          placeholder={placeholder}
          value={text}
          style={
            isEmail
              ? {
                  height: emailLayout.editor,
                  minHeight: 80,
                  maxHeight: emailLayout.editor,
                  flex: "none",
                }
              : undefined
          }
          onChange={(event) => setText(event.target.value)}
          onBlur={() => stopTyping()}
          onPaste={(event) => {
            if (templateOnly || event.clipboardData.files.length === 0) return;
            event.preventDefault();
            addFiles(event.clipboardData.files);
          }}
          onKeyDown={(event) => {
            const mod = event.metaKey || event.ctrlKey;
            if (mod && !event.shiftKey && event.key.toLowerCase() === "z") {
              event.preventDefault();
              undo();
              return;
            }
            if (mod && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
              event.preventDefault();
              redo();
              return;
            }
            if (mod && event.key.toLowerCase() === "b") {
              event.preventDefault();
              format("strong");
              return;
            }
            if (mod && event.key.toLowerCase() === "i") {
              event.preventDefault();
              format("em");
              return;
            }
            // Profile "Hotkey to send messages": Enter (↵) or Cmd/Ctrl + Enter; Shift + Enter is always a new line.
            if (event.key === "Enter" && !event.shiftKey) {
              if (!mod && pickFirst()) {
                event.preventDefault();
                return;
              }
              if (hotkey === "enter" || mod) {
                event.preventDefault();
                doSend(false);
              }
            }
            if (event.key === "Escape") {
              if (cannedMatch) replaceToken(CANNED_RE, "");
              else if (variableMatch) replaceToken(VARIABLE_RE, "");
              else if (macroMatch) replaceToken(MACRO_RE, "");
              else if (emojiMatch) setText((prev) => `${prev} `);
            }
          }}
          className={cn(
            "px-3 py-2 text-sm ring-0 focus-visible:ring-0",
            isEmail ? "field-sizing-fixed min-h-20" : expanded ? "min-h-48" : "min-h-16",
            templateOnly && "cursor-not-allowed",
          )}
        />
        {(files.length > 0 || fileErrors.length > 0 || (signature && !isNote && !templateOnly)) && (
          <InputGroupAddon
            align="block-end"
            data-reply-extra-details
            className={cn(
              "flex-col items-stretch gap-2",
              isEmail && "gap-1 overflow-y-auto overscroll-contain py-0.5 pb-0.5",
            )}
            style={isEmail ? { maxHeight: emailLayout.extras } : undefined}
          >
            {signature && !isNote && !templateOnly && (
              <pre className="whitespace-pre-wrap text-left font-sans text-muted-foreground text-xs">{SIGNATURE}</pre>
            )}
            <AttachmentChips
              files={files}
              onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
            />
            {fileErrors.length > 0 && (
              <div
                role="alert"
                data-slot="attachment-errors"
                className="flex items-start gap-1 text-destructive text-xs"
              >
                <ul className="min-w-0 flex-1">
                  {fileErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  aria-label="Dismiss attachment error"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFileErrors([])}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </InputGroupAddon>
        )}
        {toolbar}
      </InputGroup>
    </form>
  );

  return (
    <section
      aria-label="Reply box"
      ref={composerRef}
      className={cn("relative px-3 pb-3", isEmail && "shrink-0 pb-2")}
      data-slot="chat-composer"
      data-mode={mode}
      onDragEnter={(event) => {
        if (!templateOnly && event.dataTransfer.types.includes("Files")) setDragging(true);
      }}
    >
      {dragging && (
        // ReplyBottomPanel drop zone: "Drag and drop here to attach".
        <section
          aria-label="Drag and drop here to attach"
          className="absolute inset-0 z-30 m-3 mt-0 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-primary border-dashed bg-background/90 text-sm"
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          Drag and drop here to attach
        </section>
      )}
      {!isNote && text !== "" && typingBanner}
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as "reply" | "note")}
        className={cn(
          "gap-0 rounded-md border transition-colors",
          isNote && "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/15",
          isNote && brown.box,
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-b pe-2",
            isNote && "border-amber-300 dark:border-amber-500/40",
            isNote && brown.line,
          )}
        >
          <TabsList
            variant="line"
            className={cn(
              "justify-start gap-2 px-3 **:data-[slot=tabs-trigger]:border-x-0 **:data-[slot=tabs-trigger]:px-4 group-data-horizontal/tabs:h-10",
              isEmail && "group-data-horizontal/tabs:h-8",
            )}
          >
            <TabsTrigger value="reply" className="flex-none px-1" disabled={notesOnly}>
              Reply
            </TabsTrigger>
            <TabsTrigger value="note" className="flex-none px-1">
              Private Note
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            {/* ReplyTopPanel: Copilot (AI Assist) menu, then the editor size toggle. */}
            <DropdownMenu>
              <Tip label="AI Assist">
                <DropdownMenuTrigger asChild>
                  <InputGroupButton
                    aria-label="AI Assist"
                    type="button"
                    size="icon-sm"
                    disabled={templateOnly}
                    className="text-violet-600 hover:bg-violet-100 hover:text-violet-700 data-[state=open]:bg-violet-100 dark:text-violet-400 dark:data-[state=open]:bg-violet-500/20 dark:hover:bg-violet-500/20"
                  >
                    <Sparkles />
                  </InputGroupButton>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent side="top" align="end" className="w-64">
                <DropdownMenuLabel>Captain</DropdownMenuLabel>
                {aiOptions.map((option, index) => (
                  <div key={option.key}>
                    {index === 2 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      disabled={index > 1 && !text.trim()}
                      onSelect={() => {
                        if (option.key === "summarize") setMode("note");
                        setText(transform(option.key, text, firstName, conversation.subject), true);
                        focusEnd();
                      }}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tip label={expanded ? "Collapse" : "Expand"}>
              <InputGroupButton
                type="button"
                size="icon-sm"
                aria-label="Expand editor"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <Minimize2 /> : <Maximize2 />}
              </InputGroupButton>
            </Tip>
          </div>
        </div>

        {replyTo && (
          <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
            <span className="shrink-0 text-muted-foreground">Replying to:</span>
            <span className="truncate">{replyTo.text}</span>
            <button type="button" aria-label="Dismiss reply" className="ms-auto shrink-0" onClick={onClearReply}>
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {!isNote && isEmail && (
          <div className="border-b">
            <EmailHead
              value={emailHead}
              subject={conversation.subject}
              onChange={setEmailHead}
              maxHeight={emailLayout.head}
            />
          </div>
        )}

        <TabsContent value="reply" className="m-0">
          {mode === "reply" && editor}
        </TabsContent>
        <TabsContent value="note" className="m-0">
          {mode === "note" && editor}
        </TabsContent>

        {!isNote && isEmail && quoted && !quoteRemoved && lastIncoming && (
          <QuotedEmailPreview
            from={conversation.contact.name}
            maxHeight={emailLayout.quote}
            text={lastIncoming.text}
            onRemove={() => setQuoteRemoved(true)}
          />
        )}
      </Tabs>

      <AlertDialog open={pendingSend !== null} onOpenChange={(open) => !open && setPendingSend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undefined variables</AlertDialogTitle>
            <AlertDialogDescription>
              You have {pendingSend?.vars.length} undefined variables in your message: {pendingSend?.vars.join(", ")}.
              Would you like to send the message anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const resolve = pendingSend?.resolve ?? false;
                setPendingSend(null);
                doSend(resolve, true);
              }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
