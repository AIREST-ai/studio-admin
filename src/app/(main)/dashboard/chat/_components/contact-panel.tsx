"use client";

// Chatwoot ContactPanel (conversation sidebar): ContactInfo + accordion sections in Chatwoot's default order
// (useUISettings DEFAULT_CONVERSATION_SIDEBAR_ITEMS_ORDER), draggable like Chatwoot's Draggable list, with the open
// sections and the order kept in the agent's UI settings (panel-settings.ts). Studio look.
import { type DragEvent, useEffect, useRef, useState } from "react";

import Link from "next/link";

import {
  ArrowRight,
  Download,
  Eye,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Music,
  Plus,
  Settings2,
  Video,
  X,
} from "lucide-react";

import { TagChips, TagPicker } from "@/app/(main)/chat/_components/chat-tags";
import { brown } from "@/app/(main)/chat/_components/chat-thread-extras";
import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIMULATED } from "@/lib/cw/preview-sim";
import { downloadSample, SimBadge } from "@/lib/cw/preview-sim-ui";
import { useViewer } from "@/lib/cw/view-as";

import { GalleryView } from "./conversation-pane";
import {
  agentName,
  baseConversations,
  buildThread,
  type Conversation,
  contactAttributeDefs,
  contactIdOf,
  conversationAttributeDefs,
  conversationInfo,
  previousConversations,
  priorities,
  shopifyOrders,
  teamName,
  useLiveAgents,
} from "./cw-data";
import { cw, useCwStore } from "./cw-store";
import { AgentAvatar, AgentPicker, ChannelIcon, PriorityIcon, PriorityPicker, StatusPill, TeamPicker } from "./cw-ui";
import { CustomAttributes, PREVIEW_ONLY, previewOnly } from "./panel-attributes";
import { ContactInfo } from "./panel-contact-info";
import { ContactNotes, MacrosList } from "./panel-sections";
import { applyOrder, moveKey, useHydratePanelSettings, usePanelSetting } from "./panel-settings";
import { useLabelSaves } from "./sim-panel-persist";
import { SimCopilot, SimLinearIssues } from "./sim-panel-tools";
import { usePanelTab } from "./studio-profile";

// F159: the contact panel shows a soft fade at its bottom edge while more sections are below, so the last visible
// line reads as "scroll for more" instead of a control cut in half. This sentinel after the last section tells when
// the end is in view.
function EndSentinel({ onMoreBelow }: { onMoreBelow: (more: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = ref.current;
    const root = sentinel?.closest<HTMLElement>("[data-slot=scroll-area-viewport]");
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(([entry]) => onMoreBelow(!entry.isIntersecting), { root });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onMoreBelow]);
  return <div ref={ref} aria-hidden="true" className="-mt-4 h-px shrink-0" />;
}

function Participants({ conversation }: { conversation: Conversation }) {
  const participants = useCwStore((s) => s.meta[conversation.id]?.participants ?? []);
  const agents = useLiveAgents();
  // F-5A "View as": "you" is the person the page is viewed as.
  const me = useViewer().id;
  const watching = participants.includes(me);
  const count = participants.length;
  // F159: Chatwoot ConversationParticipant.vue layout, two rows: the count text with the settings button, then the
  // avatars with "You are participating" or the "Join conversation" link beside them. The old three rows pushed the
  // join button under the bottom edge of the panel on a 1000px high screen.
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className={count === 0 ? "text-muted-foreground text-sm" : "text-sm"}>
          {count === 0
            ? "No one is participating!"
            : count === 1
              ? "1 person is participating."
              : `${count} people are participating.`}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Select participants">
              <Settings2 />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-0">
            <Command>
              <CommandInput placeholder="Select participants" />
              <CommandList>
                <CommandEmpty>No results found</CommandEmpty>
                <CommandGroup heading="Select participants">
                  {agents.map((agent) => {
                    const on = participants.includes(agent.id);
                    return (
                      <CommandItem
                        key={agent.id}
                        value={agent.name}
                        onSelect={() => {
                          cw.setParticipants(
                            conversation.id,
                            on ? participants.filter((p) => p !== agent.id) : [...participants, agent.id],
                          );
                          previewOnly("Participants updated");
                        }}
                      >
                        <Checkbox checked={on} className="pointer-events-none" />
                        <AgentAvatar id={agent.id} size="sm" showStatus />
                        {agent.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex -space-x-2">
          {participants.slice(0, 4).map((id) => (
            <AgentAvatar key={id} id={id} size="default" className="ring-2 ring-background" />
          ))}
          {count > 4 && (
            <span className="grid size-8 place-items-center rounded-full bg-muted text-xs ring-2 ring-background">
              +{count - 4}
            </span>
          )}
        </div>
        {watching ? (
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Eye className="size-3.5" /> You are participating
          </p>
        ) : (
          <Button
            variant="link"
            size="xs"
            className="h-6 gap-1 px-0"
            onClick={() => {
              cw.setParticipants(conversation.id, [...participants, me]);
              previewOnly("Participants updated");
            }}
          >
            Join conversation <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function ConversationActions({ conversation }: { conversation: Conversation }) {
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const me = useViewer().id;
  const id = conversation.id;
  const assignee = agentName(meta.assigneeId);
  const team = teamName(meta.teamId);
  const priority = priorities.find((p) => p.value === meta.priority);
  const convId = String(conversation.id);
  const row =
    "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm hover:bg-muted/50";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground text-xs">Assigned Agent</span>
          {meta.assigneeId !== me && (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              onClick={() => {
                cw.assignAgent([id], me);
                previewOnly("Conversation Assignee changed");
              }}
            >
              Assign to me
            </Button>
          )}
        </div>
        <AgentPicker
          align="start"
          value={meta.assigneeId}
          onChange={(agentId) => {
            cw.assignAgent([id], agentId);
            previewOnly("Conversation Assignee changed");
          }}
          trigger={
            <button type="button" className={row}>
              <span className="flex min-w-0 items-center gap-2">
                <AgentAvatar id={meta.assigneeId} size="sm" showStatus />
                <span className="truncate">{assignee ?? "None"}</span>
              </span>
            </button>
          }
        />
      </div>
      <div className="grid gap-1.5">
        <span className="font-medium text-muted-foreground text-xs">Assigned Team</span>
        <TeamPicker
          align="start"
          value={meta.teamId}
          onChange={(teamId) => {
            cw.assignTeam([id], teamId);
            previewOnly("Conversation team changed");
          }}
          trigger={
            <button type="button" className={row}>
              <span className="truncate">{team ?? "None"}</span>
            </button>
          }
        />
      </div>
      <div className="grid gap-1.5">
        <span className="font-medium text-muted-foreground text-xs">Priority</span>
        <PriorityPicker
          align="start"
          value={meta.priority}
          onChange={(value) => {
            cw.setPriority([id], value);
            previewOnly(`Priority changed to ${value}`);
          }}
          trigger={
            <button type="button" className={row}>
              <span className="flex items-center gap-2">
                <PriorityIcon priority={meta.priority} />
                {priority?.label ?? "None"}
              </span>
            </button>
          }
        />
      </div>
      <div className="grid gap-1.5">
        <span className="font-medium text-muted-foreground text-xs">Conversation Labels</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <TagChips convId={convId} />
          <TagPicker convId={convId}>
            <Button variant="outline" size="xs" className={brown.line}>
              <Plus /> Add Labels
            </Button>
          </TagPicker>
        </div>
        {/* M129-A round 2: labels on the conversation are kept in the preview's saved copy (sim-panel-persist.ts).
            F-19: the line says "saved" only after the server took this page's change, and says plainly when not. */}
        <LabelSaveLine convId={convId} />
      </div>
    </div>
  );
}

// F-19 (F-8's note): was a fixed "saved in this preview" line, shown even when the save failed.
function LabelSaveLine({ convId }: { convId: string }) {
  const save = useLabelSaves((state) => state[convId]);
  if (!save) return null;
  if (save.state === "saving")
    return (
      <p className="text-muted-foreground text-xs" data-labels-save="saving">
        Saving the labels in this preview…
      </p>
    );
  if (save.state === "saved")
    return (
      <p className="text-muted-foreground text-xs" data-labels-save="saved">
        {PREVIEW_ONLY}.
      </p>
    );
  return (
    <p className="text-destructive text-xs" data-labels-save="failed">
      Not saved in the preview ({save.message}). This label change shows on this page only and will be gone after a
      reload.
    </p>
  );
}

function SharedFiles({ conversation }: { conversation: Conversation }) {
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const sent = useCwStore((s) => s.sent[conversation.id]);
  const [allMedia, setAllMedia] = useState(false);
  const [allFiles, setAllFiles] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  // Chatwoot SharedFiles.vue: Media = images and videos, Files = documents and audio; locations and shared
  // contact cards are not files, so they are left out.
  const thread = [...buildThread(conversation, meta), ...(sent ?? [])];
  const files = thread.flatMap((m) => m.attachments ?? []);
  // M129-A: who sent a file and when, for the image viewer's header (Chatwoot GalleryView).
  const messageOf = (name: string) => thread.find((m) => m.attachments?.some((f) => f.name === name));
  const viewed = viewing ? files.find((f) => f.name === viewing) : undefined;
  const viewedMessage = viewing ? messageOf(viewing) : undefined;
  const media = files.filter((f) => f.type === "image" || f.type === "video");
  const docs = files.filter((f) => f.type === "file" || f.type === "audio");
  if (media.length + docs.length === 0) return <p className="text-muted-foreground text-xs">No attachments yet</p>;
  const shownMedia = allMedia || media.length <= 6 ? media : media.slice(0, 5);
  const shownDocs = allFiles || docs.length <= 3 ? docs : docs.slice(0, 3);
  return (
    <div className="flex flex-col gap-3">
      {media.length > 0 && (
        <div className="grid gap-1.5">
          <span className="font-medium text-muted-foreground text-xs">Media</span>
          <div className="grid grid-cols-3 gap-1.5">
            {shownMedia.map((file) => (
              <button
                key={file.name}
                type="button"
                title={file.name}
                aria-label={file.name}
                // M129-A (Fahad 129.2): opens the conversation's image viewer (GalleryView) on this file.
                onClick={() => setViewing(file.name)}
                className="relative grid aspect-square place-items-center rounded-md border bg-gradient-to-br from-sky-100 to-indigo-100 text-indigo-500 dark:from-sky-500/15 dark:to-indigo-500/15"
              >
                {file.type === "video" ? <Video className="size-5" /> : <ImageIcon className="size-5" />}
                {file.type === "video" && file.duration && (
                  <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {file.duration}
                  </span>
                )}
              </button>
            ))}
            {!allMedia && media.length > 6 && (
              <button
                type="button"
                className="grid aspect-square place-items-center rounded-md border bg-muted font-medium text-sm hover:bg-muted/70"
                onClick={() => setAllMedia(true)}
              >
                +{media.length - 5}
              </button>
            )}
          </div>
          {allMedia && media.length > 6 && (
            <Button variant="link" size="xs" className="w-fit px-0" onClick={() => setAllMedia(false)}>
              Show less
            </Button>
          )}
        </div>
      )}
      {docs.length > 0 && (
        <div className="grid gap-1.5">
          <span className="font-medium text-muted-foreground text-xs">Files</span>
          {shownDocs.map((file) => (
            <div key={file.name} className="group/file flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              {file.type === "audio" ? (
                <Music className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-24 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-muted-foreground text-xs">{file.size ?? file.duration}</span>
              {/* M129-A (Fahad 129.2, replaces T-277's disabled button): downloads the sample file kept with the preview. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ms-auto"
                    aria-label={`Download ${file.name}`}
                    onClick={() => downloadSample(file.name)}
                  >
                    <Download />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download sample file — {SIMULATED}</TooltipContent>
              </Tooltip>
            </div>
          ))}
          {docs.length > 3 && (
            <Button variant="link" size="xs" className="w-fit px-0" onClick={() => setAllFiles(!allFiles)}>
              {allFiles ? "Show less" : "View all"}
            </Button>
          )}
        </div>
      )}
      {viewed && (
        <GalleryView
          file={viewed}
          sender={viewedMessage?.sender ?? (viewedMessage?.kind === "incoming" ? conversation.name : "Arham Khan")}
          time={viewedMessage?.time ?? ""}
          open
          onOpenChange={(open) => {
            if (!open) setViewing(null);
          }}
        />
      )}
    </div>
  );
}

// Chatwoot ContactConversations: the same person's other conversations; clicking one opens it.
function PreviousConversations({ conversation }: { conversation: Conversation }) {
  const meta = useCwStore((s) => s.meta);
  const sent = useCwStore((s) => s.sent);
  const deleted = useCwStore((s) => s.deleted);
  const [, setChat] = useChat();
  const items = previousConversations(conversation, meta, sent).filter((item) => !deleted.includes(item.id));

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">There are no previous conversations associated to this contact.</p>
    );
  }
  return (
    <>
      {items.map((item) => {
        const itemMeta = meta[item.id];
        const assignee = agentName(itemMeta?.assigneeId ?? item.assigneeId);
        return (
          <button
            key={item.id}
            type="button"
            className="rounded-md border p-2 text-left text-sm transition-colors hover:bg-muted/50"
            onClick={() => {
              cw.focus(item.id);
              setChat({ selected: item.id });
            }}
          >
            <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
              <span className="flex min-w-0 items-center gap-1">
                <ChannelIcon channel={item.channel} className="size-3 shrink-0" />
                <span className="truncate">
                  #{item.id} · {item.inbox}
                </span>
              </span>
              <span className="shrink-0">{item.time}</span>
            </div>
            <div className="mt-1 truncate font-medium text-xs">{item.subject}</div>
            <div className="mt-0.5 truncate text-muted-foreground text-xs">{item.preview}</div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
                {assignee ? (
                  <>
                    <AgentAvatar id={itemMeta?.assigneeId ?? item.assigneeId} size="sm" className="size-4" />
                    <span className="truncate">{assignee}</span>
                  </>
                ) : (
                  "Unassigned"
                )}
              </span>
              {itemMeta && <StatusPill status={itemMeta.status} className="h-4.5 px-1.5 text-[10px]" />}
            </div>
          </button>
        );
      })}
    </>
  );
}

type SectionId =
  | "conversation_actions"
  | "macros"
  | "conversation_info"
  | "contact_attributes"
  | "contact_notes"
  | "shared_files"
  | "previous_conversation"
  | "conversation_participants"
  | "linear_issues"
  | "shopify_orders";

// Chatwoot useUISettings DEFAULT_CONVERSATION_SIDEBAR_ITEMS_ORDER and the CONVERSATION_SIDEBAR.ACCORDION titles.
const PANEL_SECTIONS: { id: SectionId; title: string }[] = [
  { id: "conversation_actions", title: "Conversation Actions" },
  { id: "macros", title: "Macros" },
  { id: "conversation_info", title: "Conversation Information" },
  { id: "contact_attributes", title: "Contact Attributes" },
  { id: "contact_notes", title: "Contact Notes" },
  { id: "shared_files", title: "Attachments" },
  { id: "previous_conversation", title: "Previous Conversations" },
  { id: "conversation_participants", title: "Conversation participants" },
  { id: "linear_issues", title: "Linked Linear Issues" },
  { id: "shopify_orders", title: "Shopify Orders" },
];

const DEFAULT_OPEN: SectionId[] = ["conversation_actions", "conversation_info"];

// M129-A (Fahad 129.2, replaces T-277's disabled buttons): Link issue and Create issue work as a simulation
// (sim-panel-tools.tsx); the issues stay in the preview and nothing is sent to Linear.
function LinearIssues({ conversation }: { conversation: Conversation }) {
  return <SimLinearIssues conversation={conversation} />;
}

function ShopifyOrders() {
  return (
    <div className="flex flex-col gap-2">
      {/* T-277: the same sample orders show for every contact (no Shopify store); M129-A: said in English. */}
      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
        <SimBadge />
        <span>Sample orders: the same ones show for every contact.</span>
      </div>
      {shopifyOrders.map((order) => (
        <div key={order.id} className="rounded-md border p-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Order #{order.id}</span>
            <span className="text-muted-foreground text-xs">{order.date}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="text-[10px]">
              {order.financial}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {order.fulfillment}
            </Badge>
            <span className="ms-auto text-xs">{order.total}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Item 105c: Chatwoot's Copilot sits beside Contact in the conversation (SidepanelSwitch.vue). Studio's Captain
// pages are the place it belongs to. M129-A (Fahad 129.2): the prompts and "Ask Copilot" work with ready-made sample
// answers marked as such (sim-panel-tools.tsx) instead of being disabled until Captain is linked.
const CAPTAIN_LINKS = [
  { href: "/dashboard/captain", label: "Captain" },
  { href: "/dashboard/captain/assistants", label: "Assistants" },
  { href: "/dashboard/captain/playground", label: "Playground" },
];

function CopilotTab({ conversation }: { conversation: Conversation }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <SimCopilot conversation={conversation} />
      <Separator />
      <div className="flex flex-col gap-1">
        {CAPTAIN_LINKS.map((link) => (
          <Button key={link.href} variant="link" size="sm" className="w-fit px-0" asChild>
            <Link href={link.href}>
              {link.label}
              <ArrowRight />
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function SectionBody({ section, conversation }: { section: SectionId; conversation: Conversation }) {
  const conversationAttrs = useCwStore((s) => s.conversationAttrs[conversation.id]) ?? {};
  const contactAttrs = useCwStore((s) => s.contactAttrs[conversation.id]) ?? {};
  const profileId = contactIdOf(conversation.id);

  switch (section) {
    case "conversation_actions":
      return <ConversationActions conversation={conversation} />;
    case "macros":
      return <MacrosList conversation={conversation} />;
    case "conversation_info":
      // Chatwoot ConversationInfo.vue: the static rows (initiated at, browser, ...) and the conversation custom
      // attributes in one CustomAttributes list.
      return (
        <CustomAttributes
          attributeFrom="conversation_panel"
          staticRows={conversationInfo(conversation).map((item) => ({
            key: `static-${item.label}`,
            label: item.label,
            value: item.value,
            href: item.label === "Initiated from" ? item.value : undefined,
          }))}
          defs={conversationAttributeDefs}
          values={conversationAttrs}
          onSet={(name, value) => cw.setConversationAttr(conversation.id, name, value)}
        />
      );
    case "contact_attributes":
      return (
        <CustomAttributes
          attributeFrom="conversation_contact_panel"
          emptyStateMessage="No attributes found"
          defs={contactAttributeDefs}
          values={contactAttrs}
          onSet={(name, value) => {
            // Contact attributes belong to the person: every conversation of the same contact gets the new value.
            const ids =
              profileId === null
                ? [conversation.id]
                : baseConversations.filter((c) => contactIdOf(c.id) === profileId).map((c) => c.id);
            for (const id of ids) cw.setContactAttr(id, name, value);
          }}
        />
      );
    case "contact_notes":
      return <ContactNotes conversation={conversation} />;
    case "shared_files":
      return <SharedFiles conversation={conversation} />;
    case "previous_conversation":
      return (
        <div className="flex flex-col gap-2">
          <PreviousConversations conversation={conversation} />
          {previousConversations(conversation).length > 0 && (
            <Button variant="link" size="sm" className="w-fit px-0" asChild>
              <Link href={profileId ? `/dashboard/contacts/${profileId}` : "/dashboard/contacts"}>
                View all conversations
              </Link>
            </Button>
          )}
        </div>
      );
    case "conversation_participants":
      return <Participants conversation={conversation} />;
    case "linear_issues":
      return <LinearIssues conversation={conversation} />;
    case "shopify_orders":
      return <ShopifyOrders />;
    default:
      return null;
  }
}

export function ContactPanel({ conversation, onClose }: { conversation: Conversation; onClose?: () => void }) {
  useHydratePanelSettings();
  const panelTab = usePanelTab((s) => s.tab);
  // Item 73: the old Profile tab is gone; "profile" (View profile in the header) opens the first tab.
  // Item 105c brought Copilot back beside it.
  const tab = panelTab === "profile" ? "contact" : panelTab;
  const [moreBelow, setMoreBelow] = useState(false);
  const [savedOrder, setSavedOrder] = usePanelSetting<string[]>("conversation_sidebar_items_order", []);
  const [open, setOpen] = usePanelSetting<string[]>("conversation_sidebar_open", DEFAULT_OPEN);
  const [armed, setArmed] = useState<SectionId | null>(null);
  const [dragId, setDragId] = useState<SectionId | null>(null);
  const [overId, setOverId] = useState<SectionId | null>(null);
  const ordered = applyOrder(PANEL_SECTIONS, (item) => item.id, savedOrder);

  const onDrop = (event: DragEvent, target: SectionId) => {
    event.preventDefault();
    if (dragId) {
      setSavedOrder(
        moveKey(
          ordered.map((item) => item.id),
          dragId,
          target,
        ),
      );
    }
    setDragId(null);
    setOverId(null);
    setArmed(null);
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => usePanelTab.setState({ tab: value as typeof panelTab })}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <TabsList variant="line" className="h-8">
          <TabsTrigger value="contact">Profile</TabsTrigger>
          <TabsTrigger value="copilot">Copilot</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>

      <TabsContent value="contact" className="relative m-0 min-h-0 flex-1">
        {/* Radix's scroll wrapper is display:table and grows with long text; block keeps it to the panel width. */}
        <ScrollArea className="[&_[data-slot=scroll-area-viewport]>div]:block! h-full">
          <div className="flex min-w-0 flex-col gap-4 p-4">
            {/* T-285 (Fahad 124.4): Customer Path (T-96 «مسار العميل») sits inside the details, right above the phone. */}
            <ContactInfo conversation={conversation} />

            <Separator />

            <Accordion type="multiple" value={open} onValueChange={setOpen} className="-mx-1">
              {ordered.map((item) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: drop target for mouse reordering of panel sections; the row is not a control
                <div
                  key={item.id}
                  draggable={armed === item.id}
                  onDragStart={(event) => {
                    setDragId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    if (!dragId) return;
                    event.preventDefault();
                    setOverId(item.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                    setArmed(null);
                  }}
                  onDrop={(event) => onDrop(event, item.id)}
                  className={`not-last:border-b ${
                    dragId === item.id
                      ? "opacity-50"
                      : overId === item.id && dragId
                        ? "rounded-md ring-2 ring-primary/40"
                        : ""
                  }`}
                >
                  <AccordionItem value={item.id} className="group/section">
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        title="Drag to reorder"
                        className="absolute top-1/2 -left-2.5 z-10 -translate-y-1/2 cursor-grab text-muted-foreground opacity-0 group-hover/section:opacity-100"
                        onPointerDown={() => setArmed(item.id)}
                        onPointerUp={() => setArmed(null)}
                      >
                        <GripVertical className="size-3.5" />
                      </span>
                      <AccordionTrigger className="px-1">{item.title}</AccordionTrigger>
                    </div>
                    {/* T-277: h-auto drops the height measured at open, so a narrower panel cannot cut off the last row. */}
                    <AccordionContent className="h-auto px-1">
                      <SectionBody section={item.id} conversation={conversation} />
                    </AccordionContent>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>
            <EndSentinel onMoreBelow={setMoreBelow} />
          </div>
        </ScrollArea>
        <div
          aria-hidden="true"
          className={
            moreBelow
              ? "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t from-card to-transparent"
              : "hidden"
          }
        />
      </TabsContent>

      <TabsContent value="copilot" className="m-0 min-h-0 flex-1">
        <ScrollArea className="h-full">
          <CopilotTab conversation={conversation} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
