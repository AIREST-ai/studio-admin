"use client";

// L-2 round 2 (judge: monitor/أحكام-القضاة/L-2.md, items 1 and 2): what the Inbox bar and the header's Messages button
// show while "Conversations" is linked to the Chatwoot test copy. Phase 1 links the conversations page only, so:
// - Quick Create, Create folder and Create team write: disabled with "Read-only link (phase 1)", like every other
//   write control of the linked section (nothing opens, nothing is saved to the preview or to Chatwoot);
// - the bar's message search and the header's Messages list read the preview data: they are not shown while linked,
//   and say "Preview data — not linked yet" instead of listing preview conversations.
// In preview mode none of this renders: section-subnav.tsx and header-inbox.tsx show their own controls as before.
import { useState } from "react";

import Link from "next/link";

import { Lock, MessageCircle, PlusCircleIcon, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { READ_ONLY_TEXT } from "@/lib/chatwoot-link-types";

export const PREVIEW_NOT_LINKED = "Preview data — not linked yet";

/** Quick Create of the Inbox bar, disabled while linked (same place and look as QuickCreateButton in nav-main.tsx). */
export function LinkedQuickCreate() {
  return (
    <div className="flex flex-col gap-1">
      <SidebarMenuButton
        disabled
        aria-disabled
        title={READ_ONLY_TEXT}
        aria-label={`Quick Create (${READ_ONLY_TEXT})`}
        data-linked-read-only
        className="min-w-8 bg-primary text-primary-foreground disabled:opacity-50"
      >
        <PlusCircleIcon />
        <span>Quick Create</span>
      </SidebarMenuButton>
      <span className="flex items-center gap-1 px-2 text-muted-foreground text-xs" data-read-only-link>
        <Lock className="size-3" /> {READ_ONLY_TEXT}
      </span>
    </div>
  );
}

/** The bar's "Search messages and phone numbers", which searches the preview conversations only. */
export function LinkedSearchOff() {
  return (
    <SidebarMenuItem data-inbox-message-search data-preview-not-linked className="mb-2 flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled
        aria-label={`Search messages and phone numbers: ${PREVIEW_NOT_LINKED}`}
        title={PREVIEW_NOT_LINKED}
      >
        <Search />
      </Button>
      <span className="text-muted-foreground text-xs">Search: {PREVIEW_NOT_LINKED}</span>
    </SidebarMenuItem>
  );
}

/** The header's Messages button while linked: no preview count, and no preview conversations in its panel. */
export function LinkedMessagesButton() {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" className="relative" aria-label={`Messages: ${PREVIEW_NOT_LINKED}`}>
          <MessageCircle />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] max-w-[calc(100vw-1rem)] gap-0 p-0"
        data-slot="header-messages"
        data-preview-not-linked
      >
        <div className="px-4 pt-3 pb-2">
          <h2 className="font-semibold text-lg leading-none">Messages</h2>
        </div>
        <div className="flex flex-col gap-1 px-4 pb-3">
          <p className="font-medium text-sm">{PREVIEW_NOT_LINKED}</p>
          <p className="text-muted-foreground text-xs">
            This list shows preview conversations, so it is off while Conversations is linked to the live engine. The
            linked conversations are on the Conversations page.
          </p>
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/dashboard/chat" onClick={() => setOpen(false)}>
              Open Conversations (Live Engine)
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
