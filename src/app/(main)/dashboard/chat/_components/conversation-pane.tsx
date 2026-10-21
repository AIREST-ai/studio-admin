"use client";

// Chatwoot ConversationBox: ConversationHeader (+ ResolveAction, MoreActions) and MessagesView, Studio look.
import { Fragment, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import { cn } from "cn";
import {
  AlarmClock,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
  ListTodo,
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
  Volume1,
  VolumeOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { TagChips, TagPicker } from "@/app/(main)/chat/_components/chat-tags";
import { brown, DeliveryTicks, StatusMenu } from "@/app/(main)/chat/_components/chat-thread-extras";
import type { ConversationStatus, DeliveryState } from "@/app/(main)/chat/_components/chat-thread-state";
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
import { linkedSession, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
import { SIMULATED } from "@/lib/cw/preview-sim";
import { downloadSample } from "@/lib/cw/preview-sim-ui";
import { useViewer } from "@/lib/cw/view-as";

import { BotReplySim } from "./bot-reply-sim";
import channelHistory from "./channel-history.module.css";
import { channelIdentity } from "./channel-identity";
import { CreateTaskDialog, openCreateTask } from "./create-task-dialog";
import { CustomerPathOption } from "./customer-path";
import {
  baseConversations,
  buildThread,
  type Conversation,
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
  withDeletions,
} from "./cw-data";
import { missingResolveAttributes } from "./cw-dialog-store";
import { openDialog } from "./cw-dialogs";
import { cw, useContactOf, useCwStore } from "./cw-store";
import { BotAvatar, ChannelIcon, PersonAvatar, PriorityIcon, SlaBadge } from "./cw-ui";
import { AudioAttachment, ContactAttachment, LocationAttachment, VideoAttachment } from "./message-attachments";
import { PresenceBar } from "./presence";
import { ReplyBox } from "./reply-box";
import { SharedPostCard } from "./shared-post-card";
import { sharedPostsByMessage } from "./shared-post-samples";
import { getCallChannelInfo, SimCallScreen, startSimCall } from "./sim-call";
import {
  changeStatus as keepStatus,
  NOT_DELIVERED,
  type SnoozeKind,
  toggleBlock,
  useKeepState,
} from "./sim-thread-persist";
import { openProfileTab } from "./studio-profile";

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// M129-A (Fahad 129.2, replaces T-281's disabled "after linking" buttons): Download hands over the attachment's
// sample file kept with the preview (lib/cw/preview-sim-ui.tsx downloadSample), and says so.
function SampleDownload({
  name,
  size = "icon-xs",
  className,
}: {
  name: string;
  size?: "icon-xs" | "icon-sm";
  className?: string;
}) {
  return (
    <Hint label={`Download sample file — ${SIMULATED}`}>
      <Button
        variant="ghost"
        size={size}
        aria-label={`Download ${name}`}
        className={className}
        onClick={() => downloadSample(name)}
      >
        <Download />
      </Button>
    </Hint>
  );
}

function changeStatus(id: number, status: CwStatus, snooze?: SnoozeKind) {
  // F161: Resolve asks for the required attributes first (Chatwoot ResolveAction.vue
  // checkMissingAttributes); the dialog resolves the conversation once they are filled.
  const missing = status === "resolved" || status === "closed" ? missingResolveAttributes(id) : [];
  if (missing.length > 0) {
    openDialog({ type: "resolve-attributes", convId: id, missing });
    return;
  }
  // F-5A: kept in the preview (sim-thread-persist.ts), with a toast that says it is simulated once it is saved.
  void keepStatus([id], status, { snooze });
}

function ResolveAction({ id, status }: { id: number; status: CwStatus }) {
  const resolved = status === "resolved" || status === "closed";
  let primary = { label: "Open", icon: CircleDot, next: "open" as CwStatus };
  if (resolved) primary = { label: "Reopen", icon: CircleDot, next: "open" };
  else if (status === "open") primary = { label: "Resolve", icon: CircleCheck, next: "resolved" };
  return (
    <ButtonGroup>
      {/* T-118 row 11: the word shows only when the header is 24rem or wider (@sm of the header's @container); in a
          narrower header (1024 px with the panel open, phones) it cut the contact's name to one letter. */}
      <Hint label={primary.label}>
        <Button
          size="sm"
          variant={resolved ? "outline" : "default"}
          aria-label={primary.label}
          onClick={() => changeStatus(id, primary.next)}
        >
          <primary.icon />
          <span className="hidden @sm:inline">{primary.label}</span>
        </Button>
      </Hint>
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
                  <DropdownMenuItem key={option.value} onSelect={() => changeStatus(id, "snoozed", option.value)}>
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
  const contact = useContactOf(conversation);
  const inbox = inboxOf(conversation);
  const convId = String(conversation.id);
  const id = conversation.id;
  const linkedActive = useLinkedAdapterStatus((s) => s.active);
  const isLinked = linkedActive || linkedSession();
  const callInfo = getCallChannelInfo(conversation, isLinked);
  // T-130: the Studio status button (brown) shows Chatwoot's four statuses; a pending conversation reads Pending.
  // Nothing sets "closed" any more; an old one reads Resolved, as everywhere else in the list.
  const studioStatus: ConversationStatus = meta.status === "closed" ? "resolved" : meta.status;

  return (
    <div className="@container flex flex-col gap-2 border-b px-3 pt-3 pb-2">
      {/* T-281: on a narrow pane the actions wrap under the name instead of sliding over it (basis-36 keeps the wrap
          off for conversations without the call button). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 basis-36 items-center gap-2.5">
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
            {/* Studio /chat: the contact's role under the name. */}
            {contact.role && <div className="truncate text-muted-foreground text-xs leading-4">{contact.role}</div>}
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

        <div className="ms-auto flex shrink-0 items-center gap-0.5">
          {callInfo.canCall && (
            <Hint label={callInfo.tooltip}>
              <Button
                variant="ghost"
                size="icon-sm"
                data-call-button={callInfo.kind}
                aria-label={callInfo.label}
                onClick={() => startSimCall(id)}
              >
                <PhoneCall />
              </Button>
            </Hint>
          )}
          {callInfo.isInstagram && (
            <Hint label={callInfo.tooltip}>
              <span className="inline-flex" title={callInfo.tooltip}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled
                  data-call-button="instagram-disabled"
                  aria-label={callInfo.label}
                  className="opacity-50"
                >
                  <PhoneCall />
                </Button>
              </span>
            </Hint>
          )}
          {/* Studio /chat header icon: Snooze opens Chatwoot's snooze list for this conversation. */}
          <Hint label="Snooze">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Snooze"
              onClick={() => openDialog({ type: "command", convId: id, page: "snooze" })}
            >
              <AlarmClock />
            </Button>
          </Hint>
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
              {/* Studio /chat More menu: View profile opens the Profile tab of the panel, Copy email copies it. */}
              <DropdownMenuItem
                onSelect={() => {
                  openProfileTab();
                  if (!panelOpen) onTogglePanel();
                }}
              >
                <UserRound /> View profile
              </DropdownMenuItem>
              {/* M129-A (after the T-285 judge): a contact without an email (James writes only on WhatsApp) gets no
                  Copy email, and "Copied" shows only when the browser really copied the text (plain http has no
                  clipboard). */}
              {contact.email && (
                <DropdownMenuItem
                  onSelect={() => {
                    if (!navigator.clipboard) {
                      toast.error("Not copied: the browser allows copying only on a secure (https) page");
                      return;
                    }
                    navigator.clipboard.writeText(contact.email).then(
                      () => toast.success("Copied to clipboard successfully"),
                      () => toast.error("Not copied: the browser refused access to the clipboard"),
                    );
                  }}
                >
                  <Copy /> Copy email
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  // F-5A (sim1 8.13e): kept as the contact's block in the preview; the toast comes once it is saved.
                  toggleBlock(id);
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

      {/* F161: one row under the name: Studio status (brown), SLA, Labels. The agent / team / priority pickers that
          were repeated here (invented, F159 T2) are in the panel's Conversation Actions, as in Chatwoot. */}
      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        <StatusMenu status={studioStatus} onChange={(value) => changeStatus(id, value)} />
        <SlaBadge sla={meta.sla} className="h-7 px-2 text-xs" />
        <TagPicker convId={convId}>
          <Button variant="outline" size="sm" className={brown.line}>
            <Tag />
            Labels
            <ChevronDown data-icon="inline-end" />
          </Button>
        </TagPicker>
        <TagChips convId={convId} />
        <CustomerPathOption conversation={conversation} />
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

// Chatwoot GalleryView: sender and time, the file name, zoom, rotate, download and close. M129-A: also opened from the
// contact panel's Media (contact-panel.tsx), where a video shows the video bubble's player.
export function GalleryView({
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
            <SampleDownload name={file.name} size="icon-sm" />
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogClose>
          </div>
        </div>
        <div className="flex h-[26rem] items-center justify-center overflow-hidden bg-muted/40">
          {file.type === "video" ? (
            <div className="transition-transform" style={{ transform: `scale(${1.5 * zoom}) rotate(${turn}deg)` }}>
              <VideoAttachment file={file} />
            </div>
          ) : (
            <div
              className="h-[180px] w-[320px] shrink-0 overflow-hidden rounded-md shadow-lg transition-transform"
              style={{ transform: `scale(${1.9 * zoom}) rotate(${turn}deg)` }}
            >
              <SamplePicture name={file.name} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// F-5A: a file attached to a reply or note in the preview is the real file, kept by api/preview-sim/upload: its picture,
// a player for a recording, and a download of the same bytes. When it could not be kept, the reason shows.
function KeptAttachment({ file }: { file: CwAttachment }) {
  const url = file.uploadId ? `/api/preview-sim/upload?id=${encodeURIComponent(file.uploadId)}` : undefined;
  const picture = file.type === "image" ? (url ?? file.previewUrl) : undefined;
  return (
    <div
      data-kept-attachment={file.uploadId ?? "not-kept"}
      className="w-64 overflow-hidden rounded-lg border bg-background"
    >
      {picture && (
        // biome-ignore lint/performance/noImgElement: the preview's own saved file, not an optimisable site image.
        <img src={picture} alt={file.name} className="block max-h-48 w-full bg-muted object-contain" />
      )}
      {url && file.type === "audio" && (
        // biome-ignore lint/a11y/useMediaCaption: a recording made in the browser has no captions.
        <audio controls preload="metadata" src={url} className="w-full px-2 pt-2" aria-label={file.name} />
      )}
      <div className="flex items-center gap-2 p-2">
        {!picture && file.type !== "audio" && (
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
            <FileText className="size-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-xs">{file.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {[file.duration, file.size].filter(Boolean).join(" · ")}
            {url ? ` · kept in the preview` : ""}
          </div>
        </div>
        {url && (
          <Hint label={`Download ${file.name} (the file kept in the preview)`}>
            <Button variant="ghost" size="icon-xs" aria-label={`Download ${file.name}`} asChild>
              <a href={url} download={file.name}>
                <Download />
              </a>
            </Button>
          </Hint>
        )}
      </div>
      {file.notKept && <div className="border-t px-2 py-1 text-[11px] text-destructive">{file.notKept}</div>}
    </div>
  );
}

function AttachmentView({ file, sender, time }: { file: CwAttachment; sender?: string; time?: string }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  if (file.uploadId || file.notKept || file.previewUrl || file.mime) return <KeptAttachment file={file} />;
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
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-t px-2 py-1.5 text-xs">
          <span className="truncate">{file.name}</span>
          <span className="ms-auto shrink-0 text-muted-foreground">{file.size}</span>
          <SampleDownload name={file.name} />
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
    <div className="flex w-64 flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
      <div className="grid size-9 place-items-center rounded-md bg-muted">
        <FileText className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-xs">{file.name}</div>
        <div className="text-[11px] text-muted-foreground">{file.size}</div>
      </div>
      <SampleDownload name={file.name} className="ms-auto" />
    </div>
  );
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
  toast.success("Copied to clipboard successfully");
}

// Chatwoot Message.vue contextMenuEnabledOptions: copy needs text; reply-to not on notes or failed messages;
// translate not on failed ones; canned responses only from the agent's own replies; delete not while failed.
// F-8: and, as there, no translate, canned response or delete on a deleted message (isMessageDeleted); no task from it.
function messageActions(message: CwMessage, failed: boolean) {
  const hasText = message.text.trim().length > 0;
  const deleted = Boolean(message.deleted);
  return {
    copy: hasText,
    replyTo: message.kind !== "note" && !failed,
    translate: hasText && !failed && !deleted,
    canned: message.kind === "outgoing" && hasText && !message.csat && !deleted,
    task: hasText && !deleted,
    copyLink: !failed,
    delete: !failed && !deleted,
  };
}

// Hover bar (Reply, Copy, Translate, more) next to the bubble; right-click on the bubble opens the same menu
// (Chatwoot MessageContextMenu opens on contextmenu).
function MessageMenu({
  convId,
  message,
  failed,
  onReply,
  onCreateTask,
  open,
  onOpenChange,
}: {
  convId: number;
  message: CwMessage;
  failed: boolean;
  onReply: (message: CwMessage) => void;
  // M129-F: "Create task" (a Twenty task with this message, the conversation link and the contact).
  onCreateTask?: (message: CwMessage) => void;
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
          {can.task && onCreateTask && (
            <DropdownMenuItem onSelect={() => onCreateTask(message)}>
              <ListTodo /> Create task
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
                onSelect={() => openDialog({ type: "delete-message", convId, messageId: message.id })}
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
          if (cw.retryMessage(messageId)) toast.success("Message sent");
          else toast.error(`Message not sent. ${error ?? "The channel did not accept it."}`);
        }}
      >
        <RefreshCcw className="size-3" />
        Retry
      </Button>
    </div>
  );
}

// F-8: a deleted message keeps its place in the thread with Chatwoot's text "This message was deleted".
function DeletedText({ text }: { text: string }) {
  return (
    <span data-message-deleted="" className="italic opacity-75">
      {text}
    </span>
  );
}

// F-5A (sim1 8.2: a reply showed one "Sent" tick though nothing was sent): a reply written in the preview says it was
// not delivered, and whether the preview kept it.
function SimulatedDelivery({ messageId }: { messageId: string }) {
  const keep = useKeepState((state) => state[messageId]);
  let label = NOT_DELIVERED;
  if (keep === "saving") label = `${NOT_DELIVERED} · saving in the preview…`;
  if (keep === "failed") label = `${NOT_DELIVERED} · not saved in the preview`;
  return (
    <span
      data-slot="delivery-status"
      data-delivery="simulated"
      className={cn("ms-1 text-[11px] italic", keep === "failed" ? "text-destructive" : "text-muted-foreground")}
    >
      · {label}
    </span>
  );
}

function MessageRow({
  convId,
  message,
  contactName,
  read,
  onReply,
  onCreateTask,
}: {
  convId: number;
  message: CwMessage;
  contactName: string;
  read: boolean;
  onReply: (message: CwMessage) => void;
  onCreateTask?: (message: CwMessage) => void;
}) {
  const storeDelivery = useCwStore((s) => s.delivery[message.id]);
  // V-17 r2: use Chatwoot's real message.status when available (sent, delivered, read, failed);
  // fall back to the store-based delivery/client "read" flag when status is absent.
  const cwDelivery: DeliveryState | undefined =
    message.status === "failed" ? undefined : (message.status as DeliveryState | undefined);
  const delivery: DeliveryState | undefined = cwDelivery ?? storeDelivery;
  const failed = message.status === "failed";
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
          {/* biome-ignore lint/a11y/noStaticElementInteractions: right-click shortcut; the same menu opens from the message's menu button */}
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
                {message.deleted ? <DeletedText text={message.text} /> : renderText(message.text)}
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
                  data-channel-outgoing={message.kind === "outgoing" && !failed ? "" : undefined}
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
                      {message.deleted ? <DeletedText text={message.text} /> : message.text}
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
                {/* T-264: a shared Instagram/Facebook post, its media loaded by the browser straight from Meta. */}
                {(message.deleted ? undefined : sharedPostsByMessage[Number(message.id)])?.map((post, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a message's shared posts never reorder
                  <SharedPostCard key={index} post={post} />
                ))}
              </BubbleGroup>
            )}
            <MessageMenu
              convId={convId}
              message={message}
              failed={failed}
              onReply={onReply}
              onCreateTask={onCreateTask}
              open={menuOpen}
              onOpenChange={setMenuOpen}
            />
          </div>
          <MessageFooter>
            {outbound && message.kind === "outgoing" && <span className="me-1">{sender} ·</span>}
            {message.time}
            {message.kind === "outgoing" && !failed && message.simulated && (
              <SimulatedDelivery messageId={message.id} />
            )}
            {message.kind === "outgoing" && !failed && !message.simulated && (
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
  const deletedMessages = useCwStore((s) => s.deletedMessages); // F-8: cw-data.ts withDeletions
  const taskContact = useContactOf(conversation);
  const [replyTo, setReplyTo] = useState<CwMessage | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [emailAvailableHeight, setEmailAvailableHeight] = useState<number>();
  const isEmail = inboxOf(conversation).id === "email";
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // F-8: a deleted message stays in the thread as "This message was deleted" (Chatwoot), not taken out.
  const thread = withDeletions(
    conversation.id,
    [...buildThread(conversation, meta, deletedMessages), ...(sent ?? [])],
    deletedMessages,
  );
  const conversationAttrs = useCwStore((s) => s.conversationAttrs[conversation.id]);
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
  // F-5A: "you" is the person the page is viewed as.
  const me = useViewer().id;
  const notMine = !botOwned && meta.assigneeId !== me && meta.status !== "resolved";
  const history = contactHistory(conversation);
  useEffect(() => {
    const pane = paneRef.current;
    if (!isEmail || !pane) return;
    // Like Chatwoot's ResizableEditorWrapper, subtract the fixed panels first.
    // The reply box budgets the editor itself after measuring its surrounding controls.
    const fixed = Array.from(pane.children).filter(
      (child) => !child.matches('[data-slot="message-scroller"], [data-slot="chat-composer"]'),
    );
    const measure = () => {
      const occupied = fixed.reduce((height, child) => {
        const style = getComputedStyle(child);
        return (
          height + child.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
        );
      }, 0);
      setEmailAvailableHeight(Math.max(0, pane.clientHeight - occupied));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    for (const child of fixed) observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [isEmail, conversation.id, botOwned]);
  const selfAssignBanner = (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
      <span>This conversation is not assigned to you. Would you like to assign this conversation to yourself?</span>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => {
          cw.assignAgent([conversation.id], me);
          toast.success("Conversation Assignee changed");
        }}
      >
        Assign to me
      </Button>
    </div>
  );

  return (
    <div ref={paneRef} data-conversation-id={conversation.id} className={cn("flex h-full min-h-0 flex-col", className)}>
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
        <MessageScroller
          data-channel={channelIdentity(conversation.channel)}
          className={cn(
            "min-h-0 flex-1",
            channelHistory.history,
            !isEmail && "[mask-image:linear-gradient(to_bottom,transparent,transparent_1rem,#000_3.5rem)]",
          )}
        >
          {/* The thread opens at the newest message, as in Chatwoot. A fade at the top, only while there is more
              above, says "scroll up for more" and softens whatever the top edge cuts (a bubble, a divider, a meta line). */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-card from-25% to-transparent opacity-0 transition-opacity group-data-[scrollable~=start]/message-scroller:opacity-100",
              isEmail ? "h-4" : "h-12",
            )}
          />
          {/* scrollbar-none replaces the viewport's own scrollbar-thin (cn drops it). With "no-scrollbar" alone,
              scrollbar-thin stayed and won in the stylesheet, so Chrome drew its thin bar beside the custom thumb. */}
          <MessageScrollerViewport ref={viewportRef} className="scrollbar-none no-scrollbar">
            <MessageScrollerContent ref={contentRef} className={cn("gap-5 px-3", isEmail ? "pt-6 pb-4" : "pt-14 pb-6")}>
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
                      convId={conversation.id}
                      message={message}
                      contactName={conversation.name}
                      read={thread.slice(index + 1).some((m) => m.kind === "incoming")}
                      onReply={setReplyTo}
                      onCreateTask={(m) =>
                        openCreateTask({
                          conversationId: conversation.id,
                          channel: inboxOf(conversation).id,
                          // F-8 (sim3 8.12b): the task's Channel and Order number come from the conversation.
                          channelType: inboxOf(conversation).channelType,
                          inboxName: inboxOf(conversation).name,
                          orderNumber: (conversationAttrs?.order_number || conversationAttrs?.order_id || "").trim(),
                          contact: {
                            name: taskContact.name,
                            email: taskContact.email,
                            phone: taskContact.phone,
                            company: taskContact.company,
                          },
                          message: {
                            id: m.id,
                            text: m.text,
                            sender: m.sender ?? (m.kind === "incoming" ? conversation.name : "Arham Khan"),
                            time: m.time,
                          },
                        })
                      }
                    />
                  </MessageScrollerItem>
                </Fragment>
              ))}
              {/* F161: no sample typing indicator (it was shown on #1 forever). F-19: another agent typing in this
                  conversation shows in the presence bar above the reply box (presence.tsx). */}
              {history.newer && <ContactConversationLink target={history.newer} direction="newer" />}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <ThreadScrollChrome viewportRef={viewportRef} contentRef={contentRef} />
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* F-25 (F-19's note): the notices above the reply box are one line each, in one wrapper (22 and 26 px, 4 px
          apart), so a conversation the bot holds, with someone else viewing it, still leaves the messages 200 px or
          more on a 768 px tall window at 1024 wide. F-19 (Fahad 82b): who else has this conversation open, and who is
          typing; a notice, nothing is locked. F-19 (Fahad 82, 87): Chatwoot's hand-off banner with "Take over" and a
          simulated bot reply that an agent's reply stops (bot-reply-sim.tsx). */}
      <div data-chat-notices="" className="mx-3 mb-1 flex flex-col gap-1 empty:hidden">
        <PresenceBar conversationId={conversation.id} />
        <BotReplySim
          convId={conversation.id}
          botOwned={botOwned}
          onTakeOver={() => {
            cw.assignAgent([conversation.id], me);
            // F-5A: the status change is kept in the preview like any other (sim-thread-persist.ts).
            void keepStatus([conversation.id], "open", { quiet: true });
            toast.success("Conversation has been handed over to you");
          }}
        />
      </div>

      <Separator className="mb-1" />
      <ReplyBox
        conversation={conversation}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        typingBanner={notMine && selfAssignBanner}
        emailAvailableHeight={isEmail ? emailAvailableHeight : undefined}
      />
      {/* M129-A: the simulated call screen for the header's and the contact panel's call buttons (portal). */}
      <SimCallScreen />
      {/* M129-F: the "Create task" dialog of the message menu (task saved in Twenty). */}
      <CreateTaskDialog />
    </div>
  );
}
