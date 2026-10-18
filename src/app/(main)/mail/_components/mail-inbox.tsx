"use client";

import { useState } from "react";

import { Ellipsis, RotateCcw, SlidersHorizontal } from "lucide-react";

import { BoxTitle, MailBoxTabs, useMailLook } from "@/app/(main)/chat/_components/chat-mail-nav";
import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import type { Mail } from "./data";
import { MailList } from "./mail-list";

interface MailInboxProps {
  mails: Mail[];
  onSelectMail?: (mail: Mail) => void;
}

export function MailInbox({ mails, onSelectMail }: MailInboxProps) {
  // F-13 round 2 (Fahad 125.4): the box was always open and searched nothing. Now a lens like every page search, and
  // what is typed narrows the list (sender, address, subject or text).
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? mails.filter((mail) =>
        [mail.from.name, mail.from.email, mail.subject, mail.body].some((value) => value.toLowerCase().includes(q)),
      )
    : mails;
  const pinnedMails = shown.filter((mail) => mail.isPinned);
  const unpinnedMails = shown.filter((mail) => !mail.isPinned);
  // F159: on the Support Email page of /dashboard/chat the list column reads like the other channel pages (header,
  // search, then the Mine / Unassigned / All tabs); /mail and /chat keep their layout.
  const studio = useMailLook() === "studio";

  const search = (
    <div className="flex px-2">
      <ExpandingSearch
        name="mail"
        label="Search mail"
        placeholder="Search..."
        size={studio ? "default" : "sm"}
        className="w-full"
        value={query}
        onChange={setQuery}
      />
    </div>
  );

  return (
    <div className={studio ? "flex h-full min-h-0 flex-col gap-2 pb-2" : "flex h-full min-h-0 flex-col gap-3 pt-3"}>
      <div
        className={
          studio ? "flex h-13 items-center justify-between gap-2 px-3" : "flex items-center justify-between gap-4 px-2"
        }
      >
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
