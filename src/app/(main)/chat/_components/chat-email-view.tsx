"use client";

import { cn } from "cn";

import { SidebarProvider } from "@/components/ui/sidebar";
// F146/F147: Studio's existing Email UI, imported as-is from the mail component files (nothing copied or moved;
// nothing imported from the mail layout or page files).
import { MailComponent } from "@/app/(main)/mail/_components/mail";
import { DEFAULT_MAIL_LAYOUT } from "@/app/(main)/mail/_components/mail-layout-config";

import { MailBoxDrawer } from "./chat-mail-nav";
import { useBoxMails } from "./chat-mail-store";
import { brown } from "./chat-thread-extras";

// F147 (Fahad): the mail side rail is gone. Its boxes are tabs under the "Inbox" title (chat-mail-nav.tsx, plugged
// into mail-inbox.tsx), and clicking the title opens a side drawer with all boxes, shown here next to the list.
// The tabs and the drawer filter the list (local state in chat-mail-store.ts).

// List rows end with "…" instead of being cut when the panel is narrow (scoped to this view; /mail files untouched).
// The scroll area's inner wrapper is display:table, which grows to the text width; block keeps it to the panel width.
// The list header's rail toggle is hidden here because the rail it opened is now the tab row.
const fitListRows =
  "[&_button_.space-y-2]:min-w-0 [&_button_.space-y-2]:flex-1 [&_button_.justify-between>div:first-child]:min-w-0 [&_[data-slot=scroll-area-viewport]>div]:block! " +
  // sender line is a flex box (no "…" there): show it as a block line, unread dot stays inline
  "[&_section_button_.flex.truncate]:block [&_section_button_.flex.truncate>span]:ml-2 [&_section_button_.flex.truncate>span]:inline-block [&_section_button_.flex.truncate>span]:align-middle " +
  "[&_[data-slot=sidebar-trigger]]:hidden";

// Same mail list + message view as the mail page, inside the chat screen (the chat's channel sidebar stays on the left).
// Thin brown frame = temporary F144-F147 marker. SidebarProvider is kept because the mail view reads it (mobile check).
export function ChatEmailView() {
  const list = useBoxMails();
  return (
    <div
      data-slot="chat-email-view"
      className={cn(
        "relative h-[calc(100svh-var(--header-height))] min-h-0 min-w-0 flex-1 overflow-hidden border",
        brown.line,
        fitListRows,
      )}
    >
      <SidebarProvider className="h-full min-h-0">
        <MailBoxDrawer />
        <div className="min-h-0 w-full min-w-0 flex-1">
          <MailComponent mails={list} defaultLayout={[...DEFAULT_MAIL_LAYOUT]} />
        </div>
      </SidebarProvider>
    </div>
  );
}
