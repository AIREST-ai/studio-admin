"use client";

import type { ReactNode } from "react";

import { cn } from "cn";
import { ChevronDown, Layers } from "lucide-react";
import { siFacebook, siInstagram, siWhatsapp } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { onChannel, setChannelFilter, toggleChannelStrip } from "./chat-channel-filter-store";
import { useChatTags } from "./chat-tags-store";
import { brown } from "./chat-thread-extras";
import { channelItems, type Conversation } from "./data";

// F149 (Fahad 2026-10-11): in a tag view the list title is the tag's name; clicking it opens/closes a narrow strip
// with every channel, same look as the mail strip (chat-mail-nav.tsx). Channels come from channelItems, the same list
// the sidebar "Channels" section shows, so a channel added there appears here by itself. Brown edge = temporary marker.

// Same brand icons as the sidebar "Channels" section; any other channel shows its own icon.
const brandIcons = { whatsapp: siWhatsapp, instagram: siInstagram, facebook: siFacebook } as const;

/** List title inside a tag view: the tag's name with a small chevron; click to show/hide the channel strip. */
export function TagChannelTitle({ open }: { open: boolean }) {
  const { tags, filter } = useChatTags();
  const tag = tags.find((item) => item.id === filter);

  return (
    <h1 className="min-w-0 font-medium text-xl leading-none">
      <button
        type="button"
        data-slot="tag-channel-title"
        onClick={() => (tag ? toggleChannelStrip(tag.id) : undefined)}
        aria-expanded={open}
        title={open ? "Hide channels" : "Show channels"}
        className={cn("-mx-1 flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted", open && "bg-muted")}
      >
        <span dir="auto" className="truncate">
          {tag?.label ?? "Inbox"}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
    </h1>
  );
}

// One square in the strip: icon, tiny neutral count, name in a tooltip (same classes as the mail strip).
function StripItem(props: { id: string; title: string; count: number; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={props.title}
          data-channel={props.id}
          data-active={props.active}
          onClick={props.onClick}
          className="relative flex size-8 items-center justify-center rounded-md p-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          {props.children}
          <Badge
            variant="secondary"
            className="pointer-events-none absolute -top-1 -right-1.5 h-3.5 min-w-3.5 px-1 font-medium text-[9px] tabular-nums"
          >
            {props.count}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{props.title}</TooltipContent>
    </Tooltip>
  );
}

/** Narrow icons-only strip next to the list: "All channels" on top, then every channel with its count in this tag. */
export function ChatChannelStrip({ tagConversations, channel }: { tagConversations: Conversation[]; channel: string | null }) {
  const { filter } = useChatTags();
  if (!filter) return null;
  const choose = (id: string | null) => setChannelFilter(filter, id, tagConversations);

  return (
    <aside
      data-slot="chat-channel-strip"
      className={cn("flex w-12 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r bg-background py-3", brown.line)}
    >
      <StripItem
        id="all"
        title="All channels"
        count={tagConversations.length}
        active={channel === null}
        onClick={() => choose(null)}
      >
        <Layers />
      </StripItem>
      <Separator className="w-6" />
      <nav className="flex flex-col items-center gap-1" aria-label="Channels">
        {channelItems.map((item) => (
          <StripItem
            key={item.id}
            id={item.id}
            title={item.title}
            count={onChannel(tagConversations, item.id).length}
            active={channel === item.id}
            onClick={() => choose(item.id)}
          >
            {item.id in brandIcons ? (
              <SimpleIcon icon={brandIcons[item.id as keyof typeof brandIcons]} />
            ) : (
              <item.icon />
            )}
          </StripItem>
        ))}
      </nav>
    </aside>
  );
}
