"use client";

// Chatwoot ConversationBox: ConversationHeader (+ ResolveAction, MoreActions) and MessagesView, Studio look.
import { Fragment, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import { cn } from "cn";
import {
  AlarmClock,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Copy,
  Download,
  FileText,
  Flag,
  Image as ImageIcon,
  Languages,
  Link2,
  Lock,
  Mail,
  MessageSquarePlus,
  MoreHorizontal,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  PhoneCall,
  RefreshCcw,
  Reply,
  RotateCcw,
  RotateCw,
  Share,
  Tag,
  Trash2,
  TriangleAlert,
  UserRound,
  UsersRound,
  Volume1,
  VolumeOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { TagChips, TagPicker } from "@/app/(main)/chat/_components/chat-tags";
import { brown, DeliveryTicks, StatusMenu } from "@/app/(main)/chat/_components/chat-thread-extras";
import type { ConversationStatus } from "@/app/(main)/chat/_components/chat-thread-state";
import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  agentName,
  baseConversations,
  buildThread,
  type Conversation,
  CURRENT_AGENT_ID,
  type CwAttachment,
  type CwMessage,
  type CwStatus,
  canReply,
  contactIdOf,
  csatRatingLabels,
  inboxOf,
  isPersonOnline,
  isUnverifiedSession,
  lastPreview,
  priorities,
  snoozeOptions,
  teamName,
} from "./cw-data";
import { openDialog } from "./cw-dialogs";
import { cw, useCwStore } from "./cw-store";
import {
  AgentAvatar,
  AgentPicker,
  BotAvatar,
  ChannelIcon,
  PersonAvatar,
  PriorityIcon,
  PriorityPicker,
  SlaBadge,
  TeamPicker,
} from "./cw-ui";
import { AudioAttachment, ContactAttachment, LocationAttachment, VideoAttachment } from "./message-attachments";
import { ReplyBox } from "./reply-box";

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function changeStatus(id: number, status: CwStatus, snoozedUntil?: string) {
  cw.setStatus([id], status, snoozedUntil ?? null);
  toast.success("Conversation status changed");
}

function ResolveAction({ id, status }: { id: number; status: CwStatus }) {
  const resolved = status === "resolved" || status === "closed";
  let primary = { label: "Open", icon: CircleDot, next: "open" as CwStatus };
  if (resolved) primary = { label: "Reopen", icon: CircleDot, next: "open" };
  else if (status === "open") primary = { label: "Resolve", icon: CircleCheck, next: "resolved" };
  return (
    <ButtonGroup>
      <Button size="sm" variant={resolved ? "outline" : "default"} onClick={() => changeStatus(id, primary.next)}>
        <primary.icon />
        {primary.label}
      </Button>
      {!resolved && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="default"
              aria-label="More actions"
              className="border-primary-foreground/20 border-s"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <AlarmClock /> Snooze
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                <DropdownMenuLabel>Snooze until</DropdownMenuLabel>
                {snoozeOptions.map((option) => (
                  <DropdownMenuItem key={option.value} onSelect={() => changeStatus(id, "snoozed", option.display)}>
                    {option.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openDialog({ type: "snooze", ids: [id] })}>
                  Pick date and time
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {status !== "pending" && (
              <DropdownMenuItem onSelect={() => changeStatus(id, "pending")}>
                <AlarmClock /> Mark as pending
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </ButtonGroup>
  );
}

function ConversationHeader({
  conversation,
  showBackButton,
  onBack,
  panelOpen,
  onTogglePanel,
}: {
  conversation: Conversation;
  showBackButton?: boolean;
  onBack?: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const muted = useCwStore((s) => Boolean(s.muted[conversation.id]));
  const inbox = inboxOf(conversation);
  const convId = String(conversation.id);
  const id = conversation.id;
  const assignee = agentName(meta.assigneeId);
  const team = teamName(meta.teamId);
  const priority = priorities.find((p) => p.value === meta.priority);
  // The Studio status button (brown) shows Open/Snoozed/Resolved/Closed; "pending" shows as Open there.
  const studioStatus: ConversationStatus = meta.status === "pending" ? "open" : meta.status;

  return (
    <div className="flex flex-col gap-2 border-b px-3 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Back to conversations"
              onClick={onBack}
            >
              <ArrowLeft />
            </Button>
          )}
          <PersonAvatar name={conversation.name} online={isPersonOnline(conversation.id)} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium text-sm" title={conversation.name}>
                {conversation.name}
              </span>
              {isUnverifiedSession(conversation) && (
                // Chatwoot shows only the icon with this tooltip; the short word next to it says what it means
                // without hovering, so it does not read as an error.
                <Hint label="The identity of this user is not verified">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-px font-medium text-[11px] text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="size-3" />
                    Not verified
                  </span>
                </Hint>
              )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => {
                  void navigator.clipboard?.writeText(String(id));
                  toast.success("Conversation ID copied to clipboard");
                }}
              >
                #{id}
              </button>
              <span>•</span>
              <ChannelIcon channel={conversation.channel} className="size-3" />
              <span className="truncate">{inbox.name}</span>
              {meta.snoozedUntil && meta.status === "snoozed" && (
                <>
                  <span>•</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{meta.snoozedUntil}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {(conversation.channel === "whatsapp" || conversation.channel === "phone") && (
            <Hint label={conversation.channel === "whatsapp" ? "Start WhatsApp call" : "Start call"}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Start call"
                onClick={() => toast("Calling the contact…")}
              >
                <PhoneCall />
              </Button>
            </Hint>
          )}
          <ResolveAction id={id} status={meta.status} />
          <DropdownMenu>
            <Hint label="More actions">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => {
                  cw.toggleMute(id);
                  toast.success(
                    muted
                      ? "This contact is unblocked successfully."
                      : "This contact is blocked successfully. You will not be notified of any future conversations.",
                  );
                }}
              >
                {muted ? <Volume1 /> : <VolumeOff />}
                {muted ? "Unblock Contact" : "Block Contact"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openDialog({ type: "transcript", id })}>
                <Share /> Send Transcript
              </DropdownMenuItem>
              {/* Chatwoot MoreActions.vue has only the two above. Priority and Mark as unread come from Chatwoot's
                  card right-click menu (ConversationContextMenu), repeated here by the supervisor's order. */}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {meta.priority === "none" ? <Flag /> : <PriorityIcon priority={meta.priority} />}
                  Change Priority
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40">
                  {priorities.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => {
                        cw.setPriority([id], option.value);
                        toast.success(`Changed priority of conversation id ${id} to ${option.value}`);
                      }}
                    >
                      {option.value === "none" ? <span className="size-4" /> : <PriorityIcon priority={option.value} />}
                      {option.label}
                      {meta.priority === option.value && <Check className="ms-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onSelect={() => {
                  cw.markUnread(id);
                  toast.success("Conversation marked as unread");
                }}
              >
                <Mail /> Mark as unread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Hint label={panelOpen ? "Close details" : "More details"}>
            <Button variant="ghost" size="icon-sm" aria-label="Toggle contact panel" onClick={onTogglePanel}>
              {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
          </Hint>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusMenu status={studioStatus} onChange={(value) => changeStatus(id, value)} />
        <SlaBadge sla={meta.sla} className="h-7 px-2 text-xs" />
        <AgentPicker
          align="start"
          value={meta.assigneeId}
          onChange={(agentId) => {
            cw.assignAgent([id], agentId);
            toast.success("Conversation Assignee changed");
          }}
          trigger={
            <Button variant="outline" size="sm" className="max-w-44">
              {assignee ? <AgentAvatar id={meta.assigneeId} size="sm" className="-ms-1 size-4.5" /> : <UserRound />}
              <span className="truncate">{assignee ?? "Assign agent"}</span>
              <ChevronDown data-icon="inline-end" />
            </Button>
          }
        />
        <TeamPicker
          align="start"
          value={meta.teamId}
          onChange={(teamId) => {
            cw.assignTeam([id], teamId);
            toast.success("Conversation team changed");
          }}
          trigger={
            <Button variant="outline" size="sm">
              <UsersRound />
              <span className="truncate">{team ?? "Assign team"}</span>
              <ChevronDown data-icon="inline-end" />
            </Button>
          }
        />
        <PriorityPicker
          align="start"
          value={meta.priority}
          onChange={(value) => {
            cw.setPriority([id], value);
            toast.success(`Changed priority of conversation id ${id} to ${value}`);
          }}
          trigger={
            <Button variant="outline" size="sm">
              {meta.priority === "none" ? <Flag /> : <PriorityIcon priority={meta.priority} />}
              {meta.priority === "none" ? "Priority" : priority?.label}
              <ChevronDown data-icon="inline-end" />
            </Button>
          }
        />
      </div>
      {/* Labels keep a line of their own, so the header looks the same in every conversation. */}
      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        <TagPicker convId={convId}>
          <Button variant="outline" size="sm" className={brown.line}>
            <Tag />
            Labels
            <ChevronDown data-icon="inline-end" />
          </Button>
        </TagPicker>
        <TagChips convId={convId} />
      </div>
    </div>
  );
}

function renderText(text: string) {
  // Highlight @mentions in private notes the way Chatwoot does.
  return text.split(/(@[A-Z][a-z]+ [A-Z][a-z]+)/g).map((part, index) =>
    part.startsWith("@") ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of one message
      <span key={index} className="rounded bg-primary/10 px-1 font-medium text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// F159: the sample screenshots the customers attached, drawn at 320 x 180 and scaled (no image files in the mock).
// Each one shows what its message talks about: the failing readiness probes (#1), the export stopped at 60% with a
// gateway timeout (#6) and the bank transfer whose reference ends in 9147 (#7).
function SamplePicture({ name }: { name: string }) {
  if (name.startsWith("readiness-probe")) {
    return (
      <div className="flex size-full flex-col bg-zinc-950 p-3 font-mono text-[10px] text-zinc-300 leading-4">
        <div className="mb-2 flex items-center gap-1">
          <span className="size-2 rounded-full bg-red-500" />
          <span className="size-2 rounded-full bg-amber-400" />
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="ms-2 text-zinc-500">staging · kubectl</span>
        </div>
        <div>
          <span className="text-emerald-400">$</span> kubectl describe pod web-7d9f8c-x2kq -n staging
        </div>
        <div className="text-zinc-500">Events:</div>
        <div>
          <span className="text-amber-400">Warning</span> Unhealthy 12s kubelet
        </div>
        <div className="ps-4 text-red-400">Readiness probe failed: HTTP probe failed with statuscode: 502</div>
        <div>
          <span className="text-amber-400">Warning</span> Unhealthy 42s kubelet
        </div>
        <div className="ps-4 text-red-400">Readiness probe failed: HTTP probe failed with statuscode: 502</div>
        <div>
          <span className="text-sky-400">Normal</span> Pulled 3m kubelet Successfully pulled image web:4.18.2
        </div>
      </div>
    );
  }
  if (name.startsWith("export-timeout")) {
    return (
      <div className="flex size-full flex-col bg-white text-[10px] text-zinc-600">
        <div className="flex items-center gap-1 border-zinc-200 border-b bg-zinc-100 px-2.5 py-1.5">
          <span className="size-2 rounded-full bg-zinc-300" />
          <span className="size-2 rounded-full bg-zinc-300" />
          <span className="size-2 rounded-full bg-zinc-300" />
          <span className="ms-2 flex-1 truncate rounded bg-white px-2 py-px text-zinc-500">
            app.weblabs.studio/shipments/export
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="font-semibold text-xs text-zinc-900">Export shipment history</div>
          <div className="text-zinc-500">All shipments · Jan 2019 to Oct 2026 · CSV</div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full w-[60%] rounded-full bg-sky-500" />
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Preparing file… 60%</span>
            <span>1,284,500 rows</span>
          </div>
          <div className="mt-auto flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
            <CircleAlert className="mt-px size-3 shrink-0" />
            <div>
              <div className="font-semibold">504 Gateway Timeout</div>
              <div>The export took too long and was stopped.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (name.startsWith("transfer-confirmation")) {
    return (
      <div className="flex size-full items-center justify-center bg-linear-to-br from-emerald-50 to-teal-100 p-3">
        <div className="w-52 rounded-xl bg-white p-3 text-center text-[9px] text-zinc-500 shadow-md">
          <div className="mx-auto mb-1.5 grid size-6 place-items-center rounded-full bg-emerald-500 text-white">
            <Check className="size-3.5" />
          </div>
          <div className="font-semibold text-[11px] text-zinc-900">Transfer successful</div>
          <div className="my-1 font-bold text-base text-zinc-900">QAR 4,820.00</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-zinc-100 border-t pt-1.5 text-start">
            <span>To</span>
            <span className="text-end text-zinc-800">Weblabs Studio LLC</span>
            <span>Date</span>
            <span className="text-end text-zinc-800">Oct 9, 2026</span>
            <span>Reference</span>
            <span className="text-end text-zinc-800">TRF-2026-1009-9147</span>
            <span>Note</span>
            <span className="text-end text-zinc-800">INV-4821</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex size-full items-center justify-center bg-linear-to-br from-sky-100 to-indigo-100 text-indigo-500">
      <ImageIcon className="size-10" />
    </div>
  );
}

// Chatwoot GalleryView: sender and time, the file name, zoom, rotate, download and close.
function GalleryView({
  file,
  sender,
  time,
  open,
  onOpenChange,
}: {
  file: CwAttachment;
  sender: string;
  time: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setZoom(1);
          setTurn(0);
        }
      }}
    >
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex items-center gap-3 border-b px-3 py-2">
          <PersonAvatar name={sender} />
          <div className="min-w-0">
            <DialogTitle className="truncate font-medium text-sm">{sender}</DialogTitle>
            <DialogDescription className="text-xs">{time}</DialogDescription>
          </div>
          <span className="min-w-0 flex-1 truncate text-center font-medium text-sm">{file.name}</span>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(z + 0.1, 1.5))}
            >
              <ZoomIn />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
            >
              <ZoomOut />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Rotate left" onClick={() => setTurn((t) => t - 90)}>
              <RotateCcw />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Rotate right" onClick={() => setTurn((t) => t + 90)}>
              <RotateCw />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Download" onClick={() => toast("Download started")}>
              <Download />
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogClose>
          </div>
        </div>
        <div className="flex h-[26rem] items-center justify-center overflow-hidden bg-muted/40">
          <div
            className="h-[180px] w-[320px] shrink-0 overflow-hidden rounded-md shadow-lg transition-transform"
            style={{ transform: `scale(${1.9 * zoom}) rotate(${turn}deg)` }}
          >
            <SamplePicture name={file.name} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentView({ file, sender, time }: { file: CwAttachment; sender?: string; time?: string }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  if (file.type === "image") {
    return (
      <div className="w-56 overflow-hidden rounded-lg border bg-background">
        <button
          type="button"
          aria-label={`Open ${file.name}`}
          onClick={() => setGalleryOpen(true)}
          className="block aspect-video w-full overflow-hidden"
        >
          <span className="block h-[180px] w-[320px] origin-top-left scale-[0.7]">
            <SamplePicture name={file.name} />
          </span>
        </button>
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5 text-xs">
          <span className="truncate">{file.name}</span>
          <span className="ms-auto shrink-0 text-muted-foreground">{file.size}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Download" onClick={() => toast("Download started")}>
            <Download />
          </Button>
        </div>
        <GalleryView
          file={file}
          sender={sender ?? ""}
          time={time ?? ""}
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
        />
      </div>
    );
  }
  if (file.type === "audio") return <AudioAttachment file={file} />;
  if (file.type === "video") return <VideoAttachment file={file} />;
  if (file.type === "location") return <LocationAttachment file={file} sender={sender} />;
  if (file.type === "contact") return <ContactAttachment file={file} sender={sender} />;
  return (
    <div className="flex w-64 items-center gap-2 rounded-lg border bg-background p-2">
      <div className="grid size-9 place-items-center rounded-md bg-muted">
        <FileText className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-xs">{file.name}</div>
        <div className="text-[11px] text-muted-foreground">{file.size}</div>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label="Download" onClick={() => toast("Download started")}>
        <Download />
      </Button>
    </div>
  );
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
  toast.success("Copied to clipboard successfully");
}

// Chatwoot Message.vue contextMenuEnabledOptions: copy needs text; reply-to not on notes or failed messages;
// translate not on failed ones; canned responses only from the agent's own replies; delete not while failed.
function messageActions(message: CwMessage, failed: boolean) {
  const hasText = message.text.trim().length > 0;
  return {
    copy: hasText,
    replyTo: message.kind !== "note" && !failed,
    translate: hasText && !failed,
    canned: message.kind === "outgoing" && hasText && !message.csat,
    copyLink: !failed,
    delete: !failed,
  };
}

// Hover bar (Reply, Copy, Translate, more) next to the bubble; right-click on the bubble opens the same menu
// (Chatwoot MessageContextMenu opens on contextmenu).
function MessageMenu({
  message,
  failed,
  onReply,
  open,
  onOpenChange,
}: {
  message: CwMessage;
  failed: boolean;
  onReply: (message: CwMessage) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const can = messageActions(message, failed);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-md border bg-background p-0.5 opacity-0 shadow-xs transition-opacity focus-within:opacity-100 group-hover/row:opacity-100",
        open && "opacity-100",
      )}
    >
      {can.replyTo && (
        <Hint label="Reply to this message">
          <Button variant="ghost" size="icon-xs" aria-label="Reply to this message" onClick={() => onReply(message)}>
            <Reply />
          </Button>
        </Hint>
      )}
      {can.copy && (
        <Hint label="Copy">
          <Button variant="ghost" size="icon-xs" aria-label="Copy" onClick={() => copyText(message.text)}>
            <Copy />
          </Button>
        </Hint>
      )}
      {can.translate && (
        <Hint label="Translate">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Translate"
            onClick={() => openDialog({ type: "translate", text: message.text })}
          >
            <Languages />
          </Button>
        </Hint>
      )}
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Message actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {can.copy && (
            <DropdownMenuItem onSelect={() => copyText(message.text)}>
              <Copy /> Copy
            </DropdownMenuItem>
          )}
          {can.replyTo && (
            <DropdownMenuItem onSelect={() => onReply(message)}>
              <Reply /> Reply to this message
            </DropdownMenuItem>
          )}
          {can.translate && (
            <DropdownMenuItem onSelect={() => openDialog({ type: "translate", text: message.text })}>
              <Languages /> Translate
            </DropdownMenuItem>
          )}
          {can.canned && (
            <DropdownMenuItem onSelect={() => openDialog({ type: "add-canned", text: message.text })}>
              <MessageSquarePlus /> Add to canned responses
            </DropdownMenuItem>
          )}
          {can.copyLink && (
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard?.writeText(`${window.location.href.split("#")[0]}#message-${message.id}`);
                toast.success("Message URL copied to the clipboard");
              }}
            >
              <Link2 /> Copy link to the message
            </DropdownMenuItem>
          )}
          {can.delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => openDialog({ type: "delete-message", messageId: message.id })}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Chatwoot bubbles/CSAT.vue: the survey line, then the customer's rating and feedback.
function CsatContent({ csat }: { csat: NonNullable<CwMessage["csat"]> }) {
  return (
    <>
      <h4 className="font-medium">Please rate the conversation</h4>
      <dl className="mt-3">
        <dt className="text-xs italic opacity-80">Rating</dt>
        <dd>{csatRatingLabels[csat.rating]}</dd>
        {csat.feedback && (
          <>
            <dt className="mt-2 text-xs italic opacity-80">Feedback</dt>
            <dd>{csat.feedback}</dd>
          </>
        )}
      </dl>
    </>
  );
}

// Chatwoot bubbles/Form.vue: the bot's question, then each submitted field (label in italics, value below).
function FormContent({ text, values }: { text: string; values: { label: string; value: string }[] }) {
  return (
    <>
      <span>{text}</span>
      <dl className="mt-3">
        {values.map((item) => (
          <Fragment key={item.label}>
            <dt className="mt-2 text-xs italic opacity-80">{item.label || "Response"}</dt>
            <dd>{item.value}</dd>
          </Fragment>
        ))}
      </dl>
    </>
  );
}

// Chatwoot MessageError.vue: "Failed to send", the provider's error on the alert icon, and a retry button.
function MessageError({ error, messageId }: { error?: string; messageId: string }) {
  return (
    <div className="flex items-center justify-end gap-1.5 px-3 text-destructive text-xs">
      <span>Failed to send</span>
      {error && (
        <Hint label={error}>
          <span
            role="img"
            aria-label={error}
            className="grid size-5 place-content-center rounded-md bg-destructive/10 dark:bg-destructive/20"
          >
            <TriangleAlert className="size-3.5" />
          </span>
        </Hint>
      )}
      <Button
        size="xs"
        variant="ghost"
        className="h-5 gap-1 bg-destructive/10 px-1.5 text-destructive hover:bg-destructive/20 hover:text-destructive dark:bg-destructive/20"
        onClick={() => {
          cw.retryMessage(messageId);
          toast.success("Message sent");
        }}
      >
        <RefreshCcw className="size-3" />
        Retry
      </Button>
    </div>
  );
}

function MessageRow({
  message,
  contactName,
  read,
  onReply,
}: {
  message: CwMessage;
  contactName: string;
  read: boolean;
  onReply: (message: CwMessage) => void;
}) {
  const delivery = useCwStore((s) => s.delivery[message.id]);
  // Chatwoot MESSAGE_STATUS.FAILED until "Retry" sends it again (cw-store retryMessage).
  const failed = message.status === "failed" && !delivery;
  const [menuOpen, setMenuOpen] = useState(false);
  let bubbleVariant: "default" | "muted" | "destructive" = message.kind === "incoming" ? "muted" : "default";
  if (failed) bubbleVariant = "destructive";

  if (message.kind === "activity") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full border bg-muted/40 px-3 py-1 text-center text-muted-foreground text-xs">
          {message.text}
          <span className="ms-1.5 opacity-70">{message.time}</span>
        </span>
      </div>
    );
  }

  const outbound = message.kind !== "incoming";
  const sender = message.sender ?? (outbound ? "Arham Khan" : contactName);

  return (
    <div id={`message-${message.id}`} className="group/row">
      <Message align={outbound ? "end" : "start"} data-note={message.kind === "note" ? "true" : undefined}>
        <MessageAvatar>
          {sender === "Bot" ? (
            // Colored like every other avatar (cw-ui BotAvatar, shared with the panel), bot glyph instead of initials.
            <BotAvatar />
          ) : (
            <PersonAvatar name={sender} />
          )}
        </MessageAvatar>
        <MessageContent>
          <div
            className={cn("flex items-start gap-1", outbound ? "flex-row-reverse" : "flex-row")}
            onContextMenu={(event) => {
              if (window.getSelection()?.toString()) return;
              event.preventDefault();
              setMenuOpen(true);
            }}
          >
            {message.kind === "note" ? (
              <div
                data-slot="note-bubble"
                className={cn(
                  "w-fit max-w-[80%] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 text-sm leading-relaxed dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
                  brown.box,
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex items-center gap-1.5 font-medium text-amber-700 text-xs dark:text-amber-300",
                    brown.label,
                  )}
                >
                  <Lock className="size-3" aria-hidden="true" />
                  Private Note · {sender}
                </div>
                {renderText(message.text)}
                {message.attachments && (
                  <div className="mt-2 flex flex-col gap-2">
                    {message.attachments.map((file) => (
                      <AttachmentView key={file.name} file={file} sender={sender} time={message.time} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <BubbleGroup className="max-w-[80%]">
                <Bubble
                  variant={bubbleVariant}
                  align={outbound ? "end" : "start"}
                  className={cn(
                    "max-w-full",
                    // Chatwoot Base.vue ERROR variant: light ruby fill with dark ruby text (readable in dark mode too).
                    failed &&
                      "*:data-[slot=bubble-content]:bg-red-50 *:data-[slot=bubble-content]:text-red-950 *:data-[slot=bubble-content]:ring-1 *:data-[slot=bubble-content]:ring-red-300 dark:*:data-[slot=bubble-content]:bg-red-950 dark:*:data-[slot=bubble-content]:text-red-50 dark:*:data-[slot=bubble-content]:ring-red-500/50",
                  )}
                >
                  {message.csat ? (
                    <BubbleContent data-bubble-name="csat" className="px-4 py-3">
                      <CsatContent csat={message.csat} />
                    </BubbleContent>
                  ) : message.form ? (
                    <BubbleContent data-bubble-name="form" className="px-4 py-3">
                      <FormContent text={message.text} values={message.form} />
                    </BubbleContent>
                  ) : (
                    <BubbleContent>
                      {message.emailHead && (
                        <div className="mb-2 grid gap-0.5 border-b pb-2 text-xs opacity-80">
                          <span>
                            <strong>From</strong> {message.emailHead.from}
                          </span>
                          <span>
                            <strong>To</strong> {message.emailHead.to}
                          </span>
                          <span>
                            <strong>Subject</strong> {message.emailHead.subject}
                          </span>
                        </div>
                      )}
                      {message.replyTo && (
                        <div className="mb-1.5 border-current/40 border-s-2 ps-2 text-xs opacity-80">
                          {message.replyTo}
                        </div>
                      )}
                      {message.text}
                    </BubbleContent>
                  )}
                  {message.reaction ? (
                    <BubbleReactions aria-label={`Reaction: ${message.reaction}`} align={outbound ? "start" : "end"}>
                      <span>{message.reaction}</span>
                    </BubbleReactions>
                  ) : null}
                </Bubble>
                {message.attachments && (
                  <div className={cn("flex flex-col gap-2", outbound && "items-end")}>
                    {message.attachments.map((file) => (
                      <AttachmentView key={file.name} file={file} sender={sender} time={message.time} />
                    ))}
                  </div>
                )}
              </BubbleGroup>
            )}
            <MessageMenu
              message={message}
              failed={failed}
              onReply={onReply}
              open={menuOpen}
              onOpenChange={setMenuOpen}
            />
          </div>
          <MessageFooter>
            {outbound && message.kind === "outgoing" && <span className="me-1">{sender} ·</span>}
            {message.time}
            {message.kind === "outgoing" && !failed && (
              <DeliveryTicks state={delivery ?? (read ? "read" : "delivered")} />
            )}
          </MessageFooter>
          {failed && <MessageError error={message.error} messageId={message.id} />}
        </MessageContent>
      </Message>
    </div>
  );
}

// F159: the browser's own scrollbar is hidden in the thread (Chrome drew a grey bar with arrow buttons there). This
// thin rounded thumb, drawn like the Studio ScrollArea thumb of the conversation list, shows the position and can
// be dragged. Where the thread opens is left to the scroller: on the newest message, like Chatwoot, so the same
// conversation shows the same messages on every route.
function ThreadScrollChrome({
  viewportRef,
  contentRef,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    const thumb = thumbRef.current;
    if (!viewport || !content || !thumb) return;

    const paint = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const range = scrollHeight - clientHeight;
      // Nothing to scroll: the thumb stays hidden and clicks pass through where it was. When there is, it still
      // shows only while the pointer is over the thread or a drag is on (classes below), like the list's
      // ScrollArea type="hover", so a resting thread has no bar at its edge.
      if (range <= 1) {
        thumb.dataset.scrollable = "false";
        return;
      }
      const height = Math.max(28, (clientHeight * clientHeight) / scrollHeight);
      thumb.dataset.scrollable = "true";
      thumb.style.height = `${height}px`;
      thumb.style.transform = `translateY(${(scrollTop / range) * (clientHeight - height)}px)`;
    };

    let frame = 0;
    const repaint = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };
    const resizeObserver = new ResizeObserver(repaint);
    resizeObserver.observe(viewport);
    resizeObserver.observe(content);
    viewport.addEventListener("scroll", paint, { passive: true });
    repaint();

    let drag: { y: number; scrollTop: number } | null = null;
    const onDown = (event: PointerEvent) => {
      event.preventDefault();
      thumb.setPointerCapture(event.pointerId);
      drag = { y: event.clientY, scrollTop: viewport.scrollTop };
      thumb.dataset.dragging = "true";
      // Tell the scroller the reader is scrolling, so it stops following the newest message.
      viewport.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    };
    const onMove = (event: PointerEvent) => {
      if (!drag) return;
      const range = viewport.scrollHeight - viewport.clientHeight;
      const track = Math.max(viewport.clientHeight - thumb.offsetHeight, 1);
      viewport.scrollTop = drag.scrollTop + ((event.clientY - drag.y) * range) / track;
    };
    const onUp = () => {
      drag = null;
      thumb.dataset.dragging = "false";
    };
    thumb.addEventListener("pointerdown", onDown);
    thumb.addEventListener("pointermove", onMove);
    thumb.addEventListener("pointerup", onUp);
    thumb.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", paint);
      thumb.removeEventListener("pointerdown", onDown);
      thumb.removeEventListener("pointermove", onMove);
      thumb.removeEventListener("pointerup", onUp);
      thumb.removeEventListener("pointercancel", onUp);
    };
  }, [viewportRef, contentRef]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-0.5 z-20 w-1.5 py-0.5">
      <div
        ref={thumbRef}
        data-scrollable="false"
        className="pointer-events-none w-full touch-none rounded-full bg-border opacity-0 transition-[opacity,background-color] hover:bg-muted-foreground/40 data-[dragging=true]:pointer-events-auto data-[dragging=true]:opacity-100 group-hover/message-scroller:data-[scrollable=true]:pointer-events-auto group-hover/message-scroller:data-[scrollable=true]:opacity-100"
      />
    </div>
  );
}

// The same person's conversations, newest first (list order = last activity).
function contactHistory(conversation: Conversation) {
  const contactId = contactIdOf(conversation.id);
  const own = contactId === null ? [] : baseConversations.filter((item) => contactIdOf(item.id) === contactId);
  const index = own.findIndex((item) => item.id === conversation.id);
  return { older: index >= 0 ? own[index + 1] : undefined, newer: index > 0 ? own[index - 1] : undefined };
}

function ContactConversationLink({ target, direction }: { target: Conversation; direction: "older" | "newer" }) {
  const [, setChat] = useChat();
  const meta = useCwStore((s) => s.meta[target.id]);
  const sent = useCwStore((s) => s.sent[target.id]);
  const Icon = direction === "older" ? ArrowUp : ArrowDown;
  return (
    <div className="flex justify-center">
      <button
        type="button"
        title={`#${target.id} · ${target.subject}`}
        onClick={() => {
          cw.focus(target.id);
          setChat({ selected: target.id });
        }}
        className="group inline-flex h-8 min-w-0 max-w-[min(32rem,100%)] items-center gap-2 rounded-full border bg-background px-3 shadow-xs transition-colors hover:border-primary"
      >
        <Icon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-primary",
            direction === "older" ? "group-hover:-translate-y-0.5" : "group-hover:translate-y-0.5",
          )}
        />
        <span className="truncate font-medium text-sm">
          {direction === "older" ? "Previous chat with this customer" : "Next chat with this customer"}
        </span>
        <span className="flex min-w-0 max-w-36 shrink-[999] items-center gap-2 overflow-hidden">
          <span className="h-3.5 w-px shrink-0 bg-border" />
          <span className="truncate text-muted-foreground text-xs">{lastPreview(target, meta, sent).text}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-muted-foreground text-xs">{target.time}</span>
      </button>
    </div>
  );
}

// Unread count when a conversation opens: still unread, or what its card had when the click marked it read.
function unreadOnOpen(id: number): number {
  const { unread, readCounts } = useCwStore.getState();
  return unread[id] || readCounts[id] || 0;
}

// Chatwoot MessagesView #unreadBadge: "{n} Unread Messages" (9+ above nine) above the first unread customer message.
function UnreadDivider({ count }: { count: number }) {
  const label = `${count > 9 ? "9+" : count} ${count > 1 ? "Unread Messages" : "Unread Message"}`;
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-primary px-2.5 py-1.5 font-medium text-primary-foreground text-xs shadow-lg">
        {label}
      </span>
    </div>
  );
}

// Date dividers (Chatwoot groups the thread by day). The sample threads carry relative times, so a message's day is
// read from its time ("Yesterday", "… min ago", "Just now", "Today"), else from the conversation's list group; replies
// sent from the reply box are today. Days only move forward, so a late "Yesterday" activity stays under Today.
function threadDays(thread: CwMessage[], conversation: Conversation, sent?: CwMessage[]): string[] {
  const sentIds = new Set((sent ?? []).map((m) => m.id));
  const base = conversation.group === "Yesterday" ? "Yesterday" : "Today";
  let current = base;
  return thread.map((message) => {
    let day = base;
    if (sentIds.has(message.id) || /min ago|Just now|^Today$/.test(message.time)) day = "Today";
    else if (message.time === "Yesterday") day = "Yesterday";
    if (current === "Yesterday" && day === "Today") current = "Today";
    return current;
  });
}

// Chatwoot MessagesView reply-window Banner (color-scheme alert), shown when the conversation cannot be replied to.
const REPLY_POLICY_LINK = {
  whatsapp: "https://developers.facebook.com/docs/whatsapp/conversation-types",
  meta: "https://developers.facebook.com/docs/messenger-platform/policy/policy-overview/",
};

function ReplyWindowBanner({ channel }: { channel: string }) {
  const whatsapp = channel === "whatsapp";
  return (
    <div
      role="alert"
      className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-xs dark:bg-destructive/20"
    >
      <CircleAlert className="mt-px size-3.5 shrink-0" />
      <span>
        {whatsapp
          ? "You can only reply to this conversation using a template message due to"
          : "You cannot reply due to"}{" "}
        <a
          href={whatsapp ? REPLY_POLICY_LINK.whatsapp : REPLY_POLICY_LINK.meta}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-2"
        >
          24 hour message window restriction
        </a>
      </span>
    </div>
  );
}

export function ConversationPane({
  conversation,
  showBackButton,
  onBack,
  panelOpen,
  onTogglePanel,
  className,
}: {
  conversation: Conversation;
  showBackButton?: boolean;
  onBack?: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  className?: string;
}) {
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const sent = useCwStore((s) => s.sent[conversation.id]);
  const deletedMessages = useCwStore((s) => s.deletedMessages);
  const [replyTo, setReplyTo] = useState<CwMessage | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const thread = [...buildThread(conversation, meta), ...(sent ?? [])].filter((m) => !deletedMessages.includes(m.id));
  // The unread count is taken when the conversation opens and kept while it stays open, like Chatwoot's badge.
  const [opened, setOpened] = useState(() => ({ id: conversation.id, count: unreadOnOpen(conversation.id) }));
  if (opened.id !== conversation.id) setOpened({ id: conversation.id, count: unreadOnOpen(conversation.id) });
  // Then the count kept by the click is dropped, so a later visit starts from the card's unread count again.
  const pendingReadCount = useCwStore((s) => s.readCounts[conversation.id]);
  useEffect(() => {
    if (pendingReadCount !== undefined) cw.clearReadCount(conversation.id);
  }, [conversation.id, pendingReadCount]);
  const unreadCount = opened.id === conversation.id ? opened.count : 0;
  const days = threadDays(thread, conversation, sent);
  const incoming = thread.filter((m) => m.kind === "incoming");
  const firstUnreadId = unreadCount > 0 ? incoming[Math.max(0, incoming.length - unreadCount)]?.id : undefined;
  // Chatwoot ReplyBoxBanner: a pending conversation is still with the bot (hand-off banner); otherwise offer
  // "Assign to me" when it belongs to someone else, only while the agent types a reply (not a private note).
  const botOwned = meta.status === "pending" && meta.assigneeId === null;
  const notMine = !botOwned && meta.assigneeId !== CURRENT_AGENT_ID && meta.status !== "resolved";
  const history = contactHistory(conversation);
  const selfAssignBanner = (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
      <span>This conversation is not assigned to you. Would you like to assign this conversation to yourself?</span>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => {
          cw.assignAgent([conversation.id], CURRENT_AGENT_ID);
          toast.success("Conversation Assignee changed");
        }}
      >
        Assign to me
      </Button>
    </div>
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <ConversationHeader
        conversation={conversation}
        showBackButton={showBackButton}
        onBack={onBack}
        panelOpen={panelOpen}
        onTogglePanel={onTogglePanel}
      />

      {!canReply(conversation) && <ReplyWindowBanner channel={conversation.channel} />}

      <MessageScrollerProvider key={conversation.id} autoScroll>
        {/* F159 final pass: a fixed fade at the top edge (1rem hidden, then 2.5rem fade) (mask on the non-scrolling root), so the bubble the
            edge cuts under the header or the 24h banner fades out instead of showing half cut; the content padding
            keeps the first item clear of the fade when the thread is at its top (pt-14). */}
        <MessageScroller className="min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,transparent,transparent_1rem,#000_3.5rem)]">
          {/* The thread opens at the newest message, as in Chatwoot. A fade at the top, only while there is more
              above, says "scroll up for more" and softens whatever the top edge cuts (a bubble, a divider, a meta line). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-linear-to-b from-card from-25% to-transparent opacity-0 transition-opacity group-data-[scrollable~=start]/message-scroller:opacity-100"
          />
          {/* scrollbar-none replaces the viewport's own scrollbar-thin (cn drops it). With "no-scrollbar" alone,
              scrollbar-thin stayed and won in the stylesheet, so Chrome drew its thin bar beside the custom thumb. */}
          <MessageScrollerViewport ref={viewportRef} className="scrollbar-none no-scrollbar">
            <MessageScrollerContent ref={contentRef} className="gap-5 px-3 pt-14 pb-6">
              {history.older && <ContactConversationLink target={history.older} direction="older" />}
              {thread.map((message, index) => (
                <Fragment key={message.id}>
                  {days[index] !== days[index - 1] && (
                    <Marker variant="separator">
                      <MarkerContent>{days[index]}</MarkerContent>
                    </Marker>
                  )}
                  {message.id === firstUnreadId && <UnreadDivider count={unreadCount} />}
                  <MessageScrollerItem messageId={message.id}>
                    <MessageRow
                      message={message}
                      contactName={conversation.name}
                      read={thread.slice(index + 1).some((m) => m.kind === "incoming")}
                      onReply={setReplyTo}
                    />
                  </MessageScrollerItem>
                </Fragment>
              ))}
              {conversation.id === 1 && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <span className="flex gap-0.5">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </span>
                  {conversation.name} is typing
                </div>
              )}
              {history.newer && <ContactConversationLink target={history.newer} direction="newer" />}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <ThreadScrollChrome viewportRef={viewportRef} contentRef={contentRef} />
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {botOwned && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5">
            <Bot className="size-3.5 shrink-0 text-muted-foreground" />
            This conversation is currently handled by a bot.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => {
              cw.setStatus([conversation.id], "open");
              cw.assignAgent([conversation.id], CURRENT_AGENT_ID);
              toast.success("Conversation has been handed over to you");
            }}
          >
            Take over
          </Button>
        </div>
      )}

      <Separator className="mb-2" />
      <ReplyBox
        conversation={conversation}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        typingBanner={notMine && selfAssignBanner}
      />
    </div>
  );
}
