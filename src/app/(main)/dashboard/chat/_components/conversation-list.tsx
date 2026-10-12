"use client";

// Chatwoot ChatList + ChatListHeader + ConversationCard + conversationBulkActions, in the Studio look.
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  AlarmClock,
  ArrowDownUp,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleCheck,
  CircleDot,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  Image as ImageIcon,
  ListFilter,
  Mail,
  MailOpen,
  Mic,
  MoreHorizontal,
  PenLine,
  Rows2,
  Rows3,
  Save,
  Search,
  Tag,
  TextSearch,
  Trash2,
  Undo2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ChatChannelStrip, TagChannelTitle } from "@/app/(main)/chat/_components/chat-channel-strip";
import { TagChips } from "@/app/(main)/chat/_components/chat-tags";
import { toggleTag, useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  agentName,
  agents,
  assigneeTabs,
  type Conversation,
  type CwStatus,
  filterAttributes,
  filterOperators,
  inboxes,
  inboxOf,
  isPersonOnline,
  lastPreview,
  priorities,
  snoozeOptions,
  sortItems,
  statusFilterItems,
  teams,
} from "./cw-data";
import { bulkLabels, openDialog } from "./cw-dialogs";
import { useConversationList, type ViewSpec, valueLabel, viewTitle } from "./cw-filter";
import { cw, useCwStore } from "./cw-store";
import { ChannelIcon, PersonAvatar, PriorityIcon, SlaBadge, StatusPill } from "./cw-ui";

// One menu definition rendered both as the card "…" dropdown (Studio pattern) and the right-click menu (Chatwoot).
type Kit = {
  Item: ComponentType<{
    onSelect?: (event: Event) => void;
    variant?: "default" | "destructive";
    children: ReactNode;
  }>;
  Sub: ComponentType<{ children: ReactNode }>;
  SubTrigger: ComponentType<{ children: ReactNode }>;
  SubContent: ComponentType<{ children: ReactNode; className?: string }>;
  Separator: ComponentType;
  CheckboxItem: ComponentType<{
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    onSelect?: (event: Event) => void;
    children: ReactNode;
  }>;
  Label: ComponentType<{ children: ReactNode }>;
};

const dropdownKit = {
  Item: DropdownMenuItem,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Separator: DropdownMenuSeparator,
  CheckboxItem: DropdownMenuCheckboxItem,
  Label: DropdownMenuLabel,
} as unknown as Kit;

const contextKit = {
  Item: ContextMenuItem,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Separator: ContextMenuSeparator,
  CheckboxItem: ContextMenuCheckboxItem,
  Label: ContextMenuLabel,
} as unknown as Kit;

// Chatwoot card menu snooze texts.
const snoozeMenuLabels: Record<(typeof snoozeOptions)[number]["value"], string> = {
  next_reply: "Until next reply",
  tomorrow: "Until tomorrow",
  next_week: "Until next week",
};

// Chatwoot card menu priority order: "None" first, then urgent down to low.
function byPriorityMenuOrder(a: { value: string; rank: number }, b: { value: string; rank: number }) {
  if (a.value === "none") return -1;
  if (b.value === "none") return 1;
  return b.rank - a.rank;
}

function setStatusWithToast(ids: number[], status: CwStatus, snoozedUntil?: string) {
  cw.setStatus(ids, status, snoozedUntil ?? null);
  toast.success("Conversation status changed");
}

// Chatwoot card menu "Assign label": a "Search labels" box above the label list.
function LabelMenuItems({ kit: K, conversationId }: { kit: Kit; conversationId: number }) {
  const { tags, byConv } = useChatTags();
  const [query, setQuery] = useState("");
  const selectedTags = byConv[String(conversationId)] ?? [];
  const shown = tags.filter((tag) => tag.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <div className="relative p-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          placeholder="Search labels"
          aria-label="Search labels"
          className="h-7 ps-7 text-xs"
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {shown.length === 0 && <p className="px-2 py-2 text-center text-muted-foreground text-xs">No labels found</p>}
        {shown.map((tag) => (
          <K.CheckboxItem
            key={tag.id}
            checked={selectedTags.includes(tag.id)}
            onCheckedChange={() => {
              const had = selectedTags.includes(tag.id);
              toggleTag(String(conversationId), tag.id);
              // Chatwoot CARD_CONTEXT_MENU.API.LABEL_ASSIGNMENT / LABEL_REMOVAL toasts.
              toast.success(
                had
                  ? `Removed label #${tag.label} from conversation id ${conversationId}`
                  : `Assigned label #${tag.label} to conversation id ${conversationId}`,
              );
            }}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
            <span dir="auto">{tag.label}</span>
          </K.CheckboxItem>
        ))}
      </div>
    </>
  );
}

function CardMenu({ kit: K, conversation }: { kit: Kit; conversation: Conversation }) {
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const unread = useCwStore((s) => s.unread[conversation.id] ?? 0);
  const id = conversation.id;
  const url = `/dashboard/chat?conversation=${id}`;

  return (
    <>
      {unread > 0 ? (
        <K.Item onSelect={() => cw.markRead(id)}>
          <MailOpen /> Mark as read
        </K.Item>
      ) : (
        <K.Item onSelect={() => cw.markUnread(id)}>
          <Mail /> Mark as unread
        </K.Item>
      )}
      {meta.status !== "open" && (
        <K.Item onSelect={() => setStatusWithToast([id], "open")}>
          <CircleDot /> Reopen conversation
        </K.Item>
      )}
      {meta.status !== "resolved" && (
        <K.Item onSelect={() => setStatusWithToast([id], "resolved")}>
          <CircleCheck /> Mark as resolved
        </K.Item>
      )}
      {meta.status !== "pending" && (
        <K.Item onSelect={() => setStatusWithToast([id], "pending")}>
          <AlarmClock /> Mark as pending
        </K.Item>
      )}
      {meta.status !== "snoozed" && (
        <K.Sub>
          <K.SubTrigger>
            <AlarmClock /> Snooze
          </K.SubTrigger>
          <K.SubContent>
            {snoozeOptions.map((option) => (
              <K.Item key={option.value} onSelect={() => setStatusWithToast([id], "snoozed", option.display)}>
                {snoozeMenuLabels[option.value]}
              </K.Item>
            ))}
          </K.SubContent>
        </K.Sub>
      )}
      <K.Separator />
      <K.Sub>
        <K.SubTrigger>
          <Flag /> Priority
        </K.SubTrigger>
        <K.SubContent className="w-44">
          {[...priorities]
            .sort(byPriorityMenuOrder)
            .filter((option) => option.value !== meta.priority)
            .map((option) => (
              <K.Item
                key={option.value}
                onSelect={() => {
                  cw.setPriority([id], option.value);
                  toast.success(`Changed priority of conversation id ${id} to ${option.label}`);
                }}
              >
                <PriorityIcon priority={option.value} />
                {option.label}
              </K.Item>
            ))}
        </K.SubContent>
      </K.Sub>
      <K.Sub>
        <K.SubTrigger>
          <Tag /> Assign label
        </K.SubTrigger>
        <K.SubContent className="w-52">
          <LabelMenuItems kit={K} conversationId={id} />
        </K.SubContent>
      </K.Sub>
      <K.Sub>
        <K.SubTrigger>
          <UserRound /> Assign agent
        </K.SubTrigger>
        <K.SubContent className="w-52">
          {agents.map((agent) => (
            <K.Item
              key={agent.id}
              onSelect={() => {
                cw.assignAgent([id], agent.id);
                toast.success(`Conversation id ${id} assigned to "${agent.name}"`);
              }}
            >
              <span className="truncate">{agent.name}</span>
              {meta.assigneeId === agent.id && <Check className="ms-auto" />}
            </K.Item>
          ))}
        </K.SubContent>
      </K.Sub>
      <K.Sub>
        <K.SubTrigger>
          <UsersRound /> Assign team
        </K.SubTrigger>
        <K.SubContent className="w-48">
          {teams.map((team) => (
            <K.Item
              key={team.id}
              onSelect={() => {
                cw.assignTeam([id], team.id);
                toast.success(`Assigned team "${team.name}" to conversation id ${id}`);
              }}
            >
              {team.name}
              {meta.teamId === team.id && <Check className="ms-auto" />}
            </K.Item>
          ))}
        </K.SubContent>
      </K.Sub>
      <K.Separator />
      <K.Item onSelect={() => window.open(url, "_blank", "noopener")}>
        <ExternalLink /> Open in new tab
      </K.Item>
      <K.Item
        onSelect={() => {
          void navigator.clipboard?.writeText(`${window.location.origin}${url}`);
          toast.success("Conversation link copied to clipboard");
        }}
      >
        <Copy /> Copy conversation link
      </K.Item>
      <K.Separator />
      <K.Item variant="destructive" onSelect={() => openDialog({ type: "delete-conversation", ids: [id] })}>
        <Trash2 /> Delete conversation
      </K.Item>
    </>
  );
}

const previewIcons = { image: ImageIcon, audio: Mic, file: FileText, location: FileText };

function ConversationCard({
  conversation,
  active,
  condensed,
  onOpen,
}: {
  conversation: Conversation;
  active: boolean;
  condensed: boolean;
  onOpen: () => void;
}) {
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const sent = useCwStore((s) => s.sent[conversation.id]);
  const unread = useCwStore((s) => s.unread[conversation.id] ?? 0);
  const checked = useCwStore((s) => s.selection.includes(conversation.id));
  const selecting = useCwStore((s) => s.selection.length > 0);
  const inbox = inboxOf(conversation);
  const assignee = agentName(meta.assigneeId);
  const preview = lastPreview(conversation, meta, sent);
  const PreviewIcon = preview.icon ? previewIcons[preview.icon] : null;
  const cardRef = useRef<HTMLDivElement>(null);

  // F159: the open conversation's row is always in sight: a deep link (?conversation=24) that lands far down the
  // list, Alt+J / Alt+K, or a conversation opened from the contact panel scroll its row into view.
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* biome-ignore lint/a11y/useSemanticElements: the card holds its own buttons (checkbox, menu), so it cannot be a <button> */}
        <div
          ref={cardRef}
          role="button"
          aria-current={active ? "true" : undefined}
          tabIndex={0}
          data-active={active}
          className={cn(
            "group/card relative w-full rounded-lg px-2.5 py-2.5 text-left ring-inset transition-colors",
            active ? "bg-muted ring-1 ring-primary/40" : "hover:bg-muted/60",
            checked && "bg-primary/5 ring-1 ring-primary/30",
          )}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpen();
          }}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="relative mt-0.5 size-8 shrink-0">
              <PersonAvatar
                name={conversation.name}
                online={isPersonOnline(conversation.id)}
                className={cn(
                  "transition-opacity",
                  (selecting || checked) && "opacity-0",
                  "group-hover/card:opacity-0",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/card:opacity-100",
                  (selecting || checked) && "opacity-100",
                )}
              >
                <Checkbox
                  aria-label={`Select conversation ${conversation.id}`}
                  checked={checked}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={() => cw.toggleSelect(conversation.id)}
                />
              </div>
            </div>

            <div className="w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  <ChannelIcon channel={conversation.channel} className="size-3 shrink-0" />
                  <span className="min-w-0 truncate" title={inbox.name}>
                    {inbox.name}
                  </span>
                  {assignee && (
                    <>
                      <span aria-hidden="true" className="shrink-0">
                        ·
                      </span>
                      <UserRound className="size-3 shrink-0" />
                      <span className="shrink-0" title={assignee}>
                        {assignee.split(" ")[0]}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <PriorityIcon priority={meta.priority} />
                  <span className="text-nowrap">{conversation.time}</span>
                </div>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className={cn("truncate text-sm leading-5", unread > 0 ? "font-semibold" : "font-medium")}>
                  {conversation.name}
                </span>
                {meta.status !== "open" && <StatusPill status={meta.status} className="h-4.5 px-1.5 text-[10px]" />}
              </div>
              {!condensed && (
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex w-0 flex-1 items-center gap-1 text-muted-foreground text-xs leading-5">
                    {/* Chatwoot MessagePreview: a reply arrow when the last message is from an agent. */}
                    {preview.byAgent && <Undo2 aria-label="Reply" className="size-3 shrink-0" />}
                    {PreviewIcon && <PreviewIcon className="size-3 shrink-0" />}
                    <span className={cn("truncate", unread > 0 && "text-foreground")}>{preview.text}</span>
                  </div>
                  {unread > 0 && (
                    <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
              )}
              {(meta.sla || meta.snoozedUntil) && !condensed && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <SlaBadge sla={meta.sla} />
                  {meta.snoozedUntil && (
                    <span className="font-medium text-[10px] text-amber-600 dark:text-amber-400">
                      {meta.snoozedUntil}
                    </span>
                  )}
                </div>
              )}
              {!condensed && <TagChips convId={String(conversation.id)} className="mt-1" max={2} />}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Open actions for conversation ${conversation.id}`}
                className="absolute end-2 bottom-2 bg-background/80 opacity-0 shadow-xs group-hover/card:opacity-100 data-[state=open]:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(event) => event.stopPropagation()}>
              <CardMenu kit={dropdownKit} conversation={conversation} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <CardMenu kit={contextKit} conversation={conversation} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function IconAction({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function BulkActionsBar({ visibleIds }: { visibleIds: number[] }) {
  const selection = useCwStore((s) => s.selection);
  const { tags, byConv } = useChatTags();
  const [labelMode, setLabelMode] = useState<"assign" | "remove">("assign");
  const [picked, setPicked] = useState<string[]>([]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selection.includes(id));
  let selectAllState: boolean | "indeterminate" = false;
  if (allSelected) selectAllState = true;
  else if (selection.length > 0) selectAllState = "indeterminate";

  const meta = useCwStore((s) => s.meta);
  // Chatwoot BulkUpdateActions: an action is hidden when every selected conversation already has that status.
  const allAre = (status: CwStatus) => selection.length > 0 && selection.every((id) => meta[id]?.status === status);

  const update = (status: CwStatus, snoozedUntil?: string) => {
    cw.setStatus(selection, status, snoozedUntil ?? null);
    cw.setSelection([]);
    toast.success("Conversation status updated successfully.");
  };

  return (
    <div className="mx-2 flex flex-col gap-2 rounded-lg border bg-muted/40 p-2">
      <div className="flex items-center gap-2">
        <Checkbox
          aria-label="Select all"
          checked={selectAllState}
          onCheckedChange={(value) => cw.setSelection(value ? visibleIds : [])}
        />
        <span className="font-medium text-xs">{selection.length} selected</span>
        <div className="ms-auto flex items-center gap-0.5">
          <DropdownMenu>
            <IconAction label="Change status">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Change status">
                  <CheckCheck />
                </Button>
              </DropdownMenuTrigger>
            </IconAction>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Change status</DropdownMenuLabel>
              {!allAre("open") && (
                <DropdownMenuItem onSelect={() => update("open")}>
                  <CircleDot /> Open
                </DropdownMenuItem>
              )}
              {!allAre("resolved") && (
                <DropdownMenuItem onSelect={() => update("resolved")}>
                  <CircleCheck /> Resolved
                </DropdownMenuItem>
              )}
              {!allAre("pending") && (
                <DropdownMenuItem onSelect={() => update("pending")}>
                  <AlarmClock /> Pending
                </DropdownMenuItem>
              )}
              {!allAre("snoozed") && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <AlarmClock /> Snooze
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {snoozeOptions.map((option) => (
                      <DropdownMenuItem key={option.value} onSelect={() => update("snoozed", option.display)}>
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => openDialog({ type: "snooze", ids: selection })}>
                      Pick date and time
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <IconAction label="Assign agent">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Assign agent">
                  <UserRound />
                </Button>
              </DropdownMenuTrigger>
            </IconAction>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Assign agent</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => openDialog({ type: "bulk-agent", ids: selection, agentId: null })}>
                None
              </DropdownMenuItem>
              {agents.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onSelect={() => openDialog({ type: "bulk-agent", ids: selection, agentId: agent.id })}
                >
                  {agent.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <IconAction label={labelMode === "assign" ? "Assign labels" : "Remove labels"}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Assign labels">
                  <Tag />
                </Button>
              </PopoverTrigger>
            </IconAction>
            <PopoverContent align="end" className="w-60 p-2">
              <Tabs value={labelMode} onValueChange={(value) => setLabelMode(value as "assign" | "remove")}>
                <TabsList className="w-full">
                  <TabsTrigger value="assign">Assign labels</TabsTrigger>
                  <TabsTrigger value="remove">Remove labels</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="my-2 flex flex-col gap-1">
                {tags.map((tag) => (
                  <Label
                    key={tag.id}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 font-normal hover:bg-muted"
                  >
                    <Checkbox
                      checked={picked.includes(tag.id)}
                      onCheckedChange={(value) =>
                        setPicked((prev) => (value ? [...prev, tag.id] : prev.filter((x) => x !== tag.id)))
                      }
                    />
                    <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span dir="auto">{tag.label}</span>
                  </Label>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={picked.length === 0}
                onClick={() => {
                  bulkLabels(selection, picked, labelMode, byConv);
                  setPicked([]);
                }}
              >
                {labelMode === "assign" ? "Assign selected labels" : "Remove selected labels"}
              </Button>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <IconAction label="Assign team">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Assign team">
                  <UsersRound />
                </Button>
              </DropdownMenuTrigger>
            </IconAction>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Assign team</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => openDialog({ type: "bulk-team", ids: selection, teamId: null })}>
                None
              </DropdownMenuItem>
              {teams.map((team) => (
                <DropdownMenuItem
                  key={team.id}
                  onSelect={() => openDialog({ type: "bulk-team", ids: selection, teamId: team.id })}
                >
                  {team.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => cw.setSelection([])}>
            Clear
          </Button>
        </div>
      </div>
      {allSelected && (
        <Alert className="border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertDescription className="text-xs">Conversations visible on this page are only selected.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function BasicFilter({ showStatus }: { showStatus: boolean }) {
  const statusFilter = useCwStore((s) => s.statusFilter);
  const sortBy = useCwStore((s) => s.sortBy);
  return (
    <Popover>
      <IconAction label="Sort conversations">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Sort conversations">
            <ArrowDownUp />
          </Button>
        </PopoverTrigger>
      </IconAction>
      <PopoverContent align="end" className="grid w-72 gap-3">
        {showStatus && (
          <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
            <Label className="text-muted-foreground text-xs">Status</Label>
            <NativeSelect
              size="sm"
              className="w-full"
              value={statusFilter}
              onChange={(event) => cw.setStatusFilter(event.target.value as typeof statusFilter)}
            >
              {statusFilterItems.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
          <Label className="text-muted-foreground text-xs">Order by</Label>
          <NativeSelect
            size="sm"
            className="w-full"
            value={sortBy}
            onChange={(event) => cw.setSort(event.target.value as typeof sortBy)}
          >
            {sortItems.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ConversationList({
  view,
  onOpen,
  className,
}: {
  view: ViewSpec;
  onOpen: (conversation: Conversation) => void;
  className?: string;
}) {
  const router = useRouter();
  const [chat, setChat] = useChat();
  const [condensed, setCondensed] = useState(false);
  const list = useConversationList(view);
  const folders = useCwStore((s) => s.folders);
  const applied = useCwStore((s) => s.applied);
  const assigneeTab = useCwStore((s) => s.assigneeTab);
  const statusFilter = useCwStore((s) => s.statusFilter);
  const search = useCwStore((s) => s.search);
  const selectionCount = useCwStore((s) => s.selection.length);
  const isFolder = view.kind === "folder";
  const chips = isFolder ? (list.folder?.filters ?? []) : (applied ?? []);
  const title = viewTitle(view, folders, list.tagLabel);
  const viewKey = `${view.kind}:${"id" in view ? view.id : ""}`;

  // Views open on All (cw-store). When a tab the agent picked is empty in the next view (Unattended has nothing
  // under "Mine"), switch to All instead of showing an empty list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check only when the view changes
  useEffect(() => {
    if (!list.hasAppliedFiltersOrFolder && list.counts[assigneeTab] === 0 && list.counts.all > 0)
      cw.setAssigneeTab("all");
  }, [viewKey]);

  // Chatwoot useChatListKeyboardEvents: Alt+J opens the previous conversation of the list, Alt+K the next one
  // (also while typing in a box); past either end it stays on the first or last.
  const rowIds = list.rows.map((c) => c.id);
  // biome-ignore lint/correctness/useExhaustiveDependencies: depends on the visible ids only
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!event.altKey || (event.code !== "KeyJ" && event.code !== "KeyK") || rowIds.length === 0) return;
      event.preventDefault();
      const index = chat.selected === null ? -1 : rowIds.indexOf(chat.selected);
      const next = event.code === "KeyJ" ? index - 1 : index + 1;
      const target = rowIds[Math.min(Math.max(next, 0), rowIds.length - 1)];
      setChat({ selected: target });
      cw.markRead(target);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [rowIds.join(","), chat.selected, setChat]);

  return (
    <div className={cn("flex h-full min-h-0", className)}>
      {view.kind === "label" && list.channelView.open && (
        <ChatChannelStrip tagConversations={list.labelScoped} channel={list.channelView.channel} />
      )}
      <div className="flex h-full min-w-0 flex-1 flex-col gap-2 pb-2">
        <div
          className={cn(
            "flex h-13 items-center justify-between gap-2 px-3",
            list.hasAppliedFiltersOrFolder && "border-b",
          )}
        >
          <div className="flex min-w-0 items-center gap-1">
            {applied && !isFolder && (
              <IconAction label="Clear filters">
                <Button variant="ghost" size="icon-xs" aria-label="Clear filters" onClick={() => cw.applyFilters(null)}>
                  <ChevronLeft />
                </Button>
              </IconAction>
            )}
            {view.kind === "label" ? (
              // Chatwoot names the label here ("#vip"), like folders and teams show their own name. The brown channels
              // toggle stays on it, and a channel picked in the strip is added after the label.
              <div className="min-w-0 [&_h1]:text-base">
                <TagChannelTitle
                  open={list.channelView.open}
                  text={[title, inboxes.find((inbox) => inbox.id === list.channelView.channel)?.name]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </div>
            ) : (
              <h2 className="truncate font-medium text-base" title={title}>
                {title}
              </h2>
            )}
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {list.hasAppliedFiltersOrFolder
                ? list.counts.all
                : statusFilterItems.find((s) => s.value === statusFilter)?.label}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5">
            {applied && !isFolder && (
              <IconAction label="Save filter">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Save filter"
                  onClick={() => openDialog({ type: "save-folder" })}
                >
                  <Save />
                </Button>
              </IconAction>
            )}
            {isFolder && list.folder ? (
              <>
                <IconAction label="Edit folder">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit folder"
                    onClick={() => openDialog({ type: "filter", folderId: list.folder?.id })}
                  >
                    <PenLine />
                  </Button>
                </IconAction>
                <IconAction label="Delete filter">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete filter"
                    className="text-destructive hover:text-destructive"
                    onClick={() => list.folder && openDialog({ type: "delete-folder", folderId: list.folder.id })}
                  >
                    <Trash2 />
                  </Button>
                </IconAction>
              </>
            ) : (
              <IconAction label="Filter conversations">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Filter conversations"
                  onClick={() => openDialog({ type: "filter" })}
                >
                  <ListFilter />
                </Button>
              </IconAction>
            )}
            <BasicFilter showStatus={!list.hasAppliedFiltersOrFolder} />
            <IconAction label="Switch the layout">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Switch the layout"
                onClick={() => setCondensed((v) => !v)}
              >
                {condensed ? <Rows2 /> : <Rows3 />}
              </Button>
            </IconAction>
          </div>
        </div>

        <div className="px-2">
          <InputGroup className="h-8">
            <InputGroupAddon>
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-8 text-sm"
              placeholder="Search for People, Chats, Saved Replies .."
              value={search}
              onChange={(event) => cw.setSearch(event.target.value)}
              onKeyDown={(event) => {
                // Enter opens Chatwoot's full search screen (contacts, conversations, messages, articles).
                if (event.key === "Enter" && search.trim()) {
                  router.push(`/dashboard/chat/search?q=${encodeURIComponent(search.trim())}`);
                }
              }}
            />
            <InputGroupAddon align="inline-end">
              {search && (
                <Button variant="ghost" size="icon-xs" aria-label="Clear search" onClick={() => cw.setSearch("")}>
                  <X />
                </Button>
              )}
              <IconAction label="Open search">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Open search"
                  onClick={() =>
                    router.push(
                      search.trim()
                        ? `/dashboard/chat/search?q=${encodeURIComponent(search.trim())}`
                        : "/dashboard/chat/search",
                    )
                  }
                >
                  <TextSearch />
                </Button>
              </IconAction>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-2">
            {chips.map((row, index) => (
              <Badge key={`${row.attribute}-${index}`} variant="outline" className="gap-1 font-normal text-[11px]">
                {index > 0 && <span className="font-medium text-muted-foreground uppercase">{row.join}</span>}
                <span className="text-muted-foreground">
                  {filterAttributes.find((a) => a.value === row.attribute)?.label}
                </span>
                <span>{filterOperators.find((o) => o.value === row.operator)?.label.toLowerCase()}</span>
                {row.value && <span className="font-medium">{valueLabel(row)}</span>}
              </Badge>
            ))}
          </div>
        )}

        {/* Chatwoot ChatList.vue:924 hides the assignee tabs while a folder or filter is active. */}
        {!list.hasAppliedFiltersOrFolder && (
          <Tabs value={assigneeTab} onValueChange={(value) => cw.setAssigneeTab(value as typeof assigneeTab)}>
            <TabsList
              variant="line"
              className="w-full justify-start gap-1 border-b px-2 *:data-[slot=tabs-trigger]:flex-none"
            >
              {assigneeTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="px-2">
                  {tab.label}
                  <Badge variant="secondary" className="ms-1 h-4.5 px-1.5 text-[10px] tabular-nums">
                    {list.counts[tab.value]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* No "Filtered by tag" bar here: on a label page the page title is the label (the bar stays on /chat). */}

        {selectionCount > 0 && <BulkActionsBar visibleIds={list.rows.map((c) => c.id)} />}

        <ScrollArea
          type="hover"
          className="[&_[data-slot=scroll-area-viewport]>div]:block! h-full min-h-0 flex-1 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
        >
          <div className="flex flex-col gap-1 px-2">
            {list.rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-muted-foreground text-sm">
                There are no active conversations in this group.
              </p>
            ) : (
              list.rows.map((conversation) => (
                <ConversationCard
                  key={conversation.id}
                  conversation={conversation}
                  active={chat.selected === conversation.id}
                  condensed={condensed}
                  onOpen={() => {
                    setChat({ selected: conversation.id });
                    cw.markRead(conversation.id);
                    onOpen(conversation);
                  }}
                />
              ))
            )}
            {list.rows.length > 0 && (
              <p className="py-3 text-center text-muted-foreground text-xs">All conversations loaded 🎉</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
