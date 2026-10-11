"use client";

import { type ReactNode, useState } from "react";

import { cn } from "cn";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { addTag, type ChatTag, toggleTag, useChatTags } from "./chat-tags-store";
import { brown } from "./chat-thread-extras";
import { type Contact, conversations } from "./data";

// The thread only receives the contact, so find its conversation id in data.ts.
export function tagConvId(contact: Contact): string {
  const match = conversations.find((conversation) => conversation.contact.email === contact.email);
  return String(match?.id ?? contact.email);
}

// Opens from the existing "Tag" button (passed as children): one checkbox per tag + "Add tag…".
export function TagPicker({ convId, children }: { convId: string; children: ReactNode }) {
  const { tags, byConv } = useChatTags();
  const selected = byConv[convId] ?? [];
  const [draft, setDraft] = useState("");

  const create = () => {
    if (!draft.trim()) return;
    const tag = addTag(draft);
    if (!selected.includes(tag.id)) toggleTag(convId, tag.id);
    setDraft("");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-56", brown.menu)} data-slot="tag-picker">
        <DropdownMenuLabel>Tags</DropdownMenuLabel>
        {tags.map((tag) => (
          <DropdownMenuCheckboxItem
            key={tag.id}
            checked={selected.includes(tag.id)}
            onCheckedChange={() => toggleTag(convId, tag.id)}
            onSelect={(event) => event.preventDefault()}
          >
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
            <span dir="auto">{tag.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <form
          className="flex items-center gap-1 p-1"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Add tag…"
            aria-label="Add tag"
            dir="auto"
            className="h-7 text-sm"
          />
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Create tag">
            <Plus />
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Small coloured badges for the tags on one conversation.
export function TagChips({ convId, className }: { convId: string; className?: string }) {
  const { tags, byConv } = useChatTags();
  const items = (byConv[convId] ?? [])
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is ChatTag => Boolean(tag));

  if (items.length === 0) return null;

  return (
    <div data-slot="tag-chips" className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          data-tag={tag.id}
          dir="auto"
          className={cn("h-4.5 gap-1 px-1.5 text-[10px] text-foreground", brown.line)}
          style={{ backgroundColor: `${tag.color}26` }}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.label}
        </Badge>
      ))}
    </div>
  );
}
