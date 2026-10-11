"use client";

import { useState } from "react";

import { cn } from "cn";
import { Inbox, LogOut, Settings2, ShieldAlert, Star, UserPlus, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";
import { accounts, type Mail } from "@/app/(main)/mail/_components/data";

import { folderOf, moveMail, toggleStar, useMailBox } from "./chat-mail-store";
import { brown } from "./chat-thread-extras";

// F147 standard mail actions (RFC 6154 \Flagged and \Junk), plugged into the existing mail view and list.
// Brown = temporary marker for what was added.

// Star toggle for the message toolbar.
export function StarToggle({ mail }: { mail: Mail | null }) {
  const { starred } = useMailBox();
  const isStarred = Boolean(mail && starred[mail.id]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isStarred ? "Unstar" : "Star"}
          aria-pressed={isStarred}
          disabled={!mail}
          onClick={() => mail && toggleStar(mail.id)}
          className={cn("border", brown.line)}
        >
          <Star className={cn(isStarred && "fill-amber-400 text-amber-400")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isStarred ? "Unstar" : "Star"}</TooltipContent>
    </Tooltip>
  );
}

// "Report spam", added after the existing items of the message's More actions menu.
export function ReportSpamItem({ mail }: { mail: Mail | null }) {
  const s = useMailBox();
  if (!mail || folderOf(mail, s) === "spam") return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => moveMail(mail.id, "spam")} className={cn("border", brown.line)}>
          <ShieldAlert />
          Report spam
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}

// Shown at the top of a message that is in Spam: "Not spam" moves it back to the Inbox.
export function NotSpamBar({ mail }: { mail: Mail | null }) {
  const s = useMailBox();
  if (!mail || folderOf(mail, s) !== "spam") return null;

  return (
    <div
      data-slot="not-spam-bar"
      className={cn("flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs", brown.line)}
    >
      <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-muted-foreground">This message is in Spam.</span>
      <Button size="xs" variant="outline" onClick={() => moveMail(mail.id, "inbox")}>
        <Inbox />
        Not spam
      </Button>
    </div>
  );
}

// Star mark on starred rows in the mail list.
export function RowStar({ mailId }: { mailId: string }) {
  const { starred } = useMailBox();
  if (!starred[mailId]) return null;

  return <Star aria-label="Starred" className="ml-1 inline-block size-3 shrink-0 fill-amber-400 align-middle text-amber-400" />;
}

type Account = (typeof accounts)[number];

// The mail rail's account switcher, now at the right end of the top tab row (same accounts and menu items).
export function MailAccountSwitcher() {
  const [account, setAccount] = useState<Account>(accounts[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Account: ${account.label}`}
          title={`${account.label} · ${account.email}`}
          className="relative size-7 min-w-7 rounded-sm bg-primary p-0 text-primary-foreground text-xs hover:bg-primary/90 hover:text-primary-foreground"
        >
          {getInitials(account.label).slice(0, 1)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-56", brown.menu)}>
        <DropdownMenuLabel>Accounts</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(account.id)}
          onValueChange={(value) => {
            const next = accounts.find((item) => item.id === Number(value));
            if (next) setAccount(next);
          }}
        >
          {accounts.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={String(item.id)}>
              <div className="flex min-w-0 flex-col">
                <span>{item.label}</span>
                <span className="truncate text-muted-foreground text-xs">{item.email}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserPlus />
            Add account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <UsersRound />
            Manage accounts
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings2 />
            Account settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
