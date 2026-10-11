"use client";

import type { CSSProperties } from "react";

import { cn } from "cn";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { TagChips } from "./chat-tags";
import { setTagFilter, useChatTags } from "./chat-tags-store";
import { setChatView } from "./chat-view-store";

// F145/F146 temporary marker (Fahad): added pieces in one brown so he can spot them. One place to change.
export const markStyle = { "--added-mark": "#8B5A2B" } as CSSProperties;
export const mark = {
  heading: "font-medium text-[color:color-mix(in_oklab,var(--added-mark)_65%,white)]",
  active:
    "data-[active=true]:bg-[color:var(--added-mark)]/35! data-[active=true]:text-foreground! data-[active=true]:ring-1 data-[active=true]:ring-[color:var(--added-mark)]",
  bar: "border-[color:var(--added-mark)] bg-[color:var(--added-mark)]/15",
};

/** "Tags" section for the chat sidebar: colour dot, label and count; click filters the list, click again clears. */
export function ChatSidebarTags() {
  const { tags, byConv, filter } = useChatTags();
  const countOf = (tagId: string) => Object.values(byConv).filter((ids) => ids.includes(tagId)).length;

  return (
    <SidebarGroup style={markStyle} data-slot="sidebar-tags">
      <SidebarGroupLabel className={mark.heading}>Tags</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {tags.map((tag) => {
          const active = filter === tag.id;
          return (
            <SidebarMenuItem key={tag.id}>
              <SidebarMenuButton
                size="sm"
                isActive={active}
                tooltip={tag.label}
                data-tag-filter={tag.id}
                aria-pressed={active}
                className={mark.active}
                onClick={() => {
                  setChatView("chat");
                  setTagFilter(active ? null : tag.id);
                }}
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                <span dir="auto" className="font-medium">
                  {tag.label}
                </span>
              </SidebarMenuButton>
              <SidebarMenuBadge className="font-medium">{countOf(tag.id)}</SidebarMenuBadge>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/** Shown above the conversation list while a tag filter is on: the tag and a button to clear it. */
export function TagFilterBar() {
  const { tags, filter } = useChatTags();
  const tag = tags.find((item) => item.id === filter);
  if (!tag) return null;

  return (
    <div
      style={markStyle}
      data-slot="tag-filter-bar"
      className={cn("mx-2 flex items-center gap-2 rounded-md border px-2 py-1 text-xs", mark.bar)}
    >
      <span className="text-muted-foreground">Filtered by tag</span>
      <span dir="auto" className="flex items-center gap-1 font-medium">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
        {tag.label}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-auto"
        aria-label="Clear tag filter"
        onClick={() => setTagFilter(null)}
      >
        <X />
      </Button>
    </div>
  );
}

/** Tag badges under a conversation's subject line in the list (same chips as the thread header). */
export function ConversationTags({ convId }: { convId: string }) {
  return <TagChips convId={convId} className="mt-1 mb-0.5" />;
}
