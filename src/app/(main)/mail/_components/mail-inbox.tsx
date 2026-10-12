"use client";

import { Ellipsis, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BoxTitle, MailBoxTabs, useMailLook } from "@/app/(main)/chat/_components/chat-mail-nav";

import type { Mail } from "./data";
import { MailList } from "./mail-list";

interface MailInboxProps {
  mails: Mail[];
  onSelectMail?: (mail: Mail) => void;
}

export function MailInbox({ mails, onSelectMail }: MailInboxProps) {
  const pinnedMails = mails.filter((mail) => mail.isPinned);
  const unpinnedMails = mails.filter((mail) => !mail.isPinned);
  // F159: on the Support Email page of /dashboard/chat the list column reads like the other channel pages (header,
  // search, then the Mine / Unassigned / All tabs); /mail and /chat keep their layout.
  const studio = useMailLook() === "studio";

  const search = (
    <div className="px-2">
      <InputGroup className={studio ? "h-8 w-full" : "h-7 w-full rounded-md"}>
        <InputGroupInput className={studio ? "h-8 text-sm" : "h-7"} placeholder="Search..." />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );

  return (
    <div className={studio ? "flex h-full min-h-0 flex-col gap-2 pb-2" : "flex h-full min-h-0 flex-col gap-3 pt-3"}>
      <div className={studio ? "flex h-13 items-center justify-between gap-2 px-3" : "flex items-center justify-between gap-4 px-2"}>
        <div className="flex min-w-0 items-center">
          {!studio && (
            <>
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 ml-1 h-4 data-vertical:self-center" />
            </>
          )}
          {/* The box title ("Inbox"), now a button that opens/closes the side drawer with all boxes. */}
          <BoxTitle />
        </div>
        <div className={studio ? "flex items-center gap-0.5" : "flex items-center gap-2"}>
          <Button variant="ghost" size="icon-sm">
            <SlidersHorizontal />
          </Button>
          <Button variant="ghost" size="icon-sm">
            <RotateCcw />
          </Button>
          <Button variant="ghost" size="icon-sm">
            <Ellipsis />
          </Button>
        </div>
      </div>

      {studio ? (
        <>
          {search}
          <MailBoxTabs />
        </>
      ) : (
        <>
          <div className="px-2">
            <Separator />
          </div>

          <MailBoxTabs />

          {search}
        </>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <MailList
          groups={[
            {
              id: "pinned",
              title: "Pinned",
              items: pinnedMails,
            },
            {
              id: "inbox",
              title: "Inbox",
              items: unpinnedMails,
            },
          ]}
          onSelectMail={onSelectMail}
        />
      </div>
    </div>
  );
}
