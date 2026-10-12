"use client";

import { createContext, useContext } from "react";

import { cn } from "cn";
import { Check, ChevronDown, type LucideIcon, Mails, PenLine, ShieldAlert, Star } from "lucide-react";

import {
  type AssigneeTab,
  assigneeTabs,
  type ConversationMeta,
  CURRENT_AGENT_ID,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import { cw, useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { type Mail, mailNavigation } from "@/app/(main)/mail/_components/data";
import { useMail } from "@/app/(main)/mail/_components/use-mail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { MailAccountSwitcher } from "./chat-mail-actions";
import { type MailBox, mailsIn, setMailBox, toggleBoxDrawer, useMailBox } from "./chat-mail-store";
import { brown } from "./chat-thread-extras";

// F159: "studio" is the Support Email page of /dashboard/chat. There the list column reads like the other channel
// pages: the box title (a menu with every box and its count) with a count pill, the search box, then Chatwoot's
// Mine / Unassigned / All tabs with count pills, neutral lines and no brown marks. "chat" (default) is /mail.
export type MailLook = "chat" | "studio";
export const MailLookContext = createContext<MailLook>("chat");
export const useMailLook = () => useContext(MailLookContext);

// The email conversation a mail comes from (id "cw-<conversation id>"), or null for drafts, spam and the other mails.
export function conversationIdOf(mail: Mail): number | null {
  const match = /^cw-(\d+)$/.exec(mail.id);
  return match ? Number(match[1]) : null;
}

// A mail from an email conversation belongs to that conversation's agent; the other mails of the box (drafts,
// spam, sent) are unassigned.
export function mailAssignee(mail: Mail, meta: Record<number, ConversationMeta>): number | null {
  const id = conversationIdOf(mail);
  return id === null ? null : (meta[id]?.assigneeId ?? null);
}

// F159: on the Support Email page a mail from an email conversation follows the conversation lists: it shows only
// under its conversation's status (Open by default, the same filter as the Conversations view of this inbox) and
// not once the conversation is deleted, so the Mine / Unassigned / All counts match that view. Mails that are not
// conversations (drafts, sent, spam, trash) always show.
export function useConversationMailFilter(): (mail: Mail) => boolean {
  const meta = useCwStore((state) => state.meta);
  const status = useCwStore((state) => state.statusFilter);
  const deleted = useCwStore((state) => state.deleted);
  return (mail) => {
    const id = conversationIdOf(mail);
    if (id === null) return true;
    if (deleted.includes(id)) return false;
    return status === "all" || meta[id]?.status === status;
  };
}

export function inAssigneeTab(mail: Mail, tab: AssigneeTab, meta: Record<number, ConversationMeta>): boolean {
  if (tab === "all") return true;
  const assignee = mailAssignee(mail, meta);
  return tab === "me" ? assignee === CURRENT_AGENT_ID : assignee === null;
}

// Fahad 2026-10-11: the box tabs sit under the box title (like the chat's All/Open/Snoozed/Closed) in a strip that
// scrolls sideways; clicking the title opens/closes a side drawer with all boxes (icons + counts, like the old rail).
// Spam, Starred and All mail are the missing RFC 6154 boxes (\Junk, \Flagged, \All). Brown = temporary marker.

const rail = [...mailNavigation.navMain, ...mailNavigation.folders];
const standard: MailBox[] = ["inbox", "priority", "drafts", "sent", "archive", "trash"];

export const boxTabs: { id: MailBox; title: string; icon: LucideIcon; added?: boolean; count?: boolean }[] = [
  ...standard.map((id) => {
    const item = rail.find((folder) => folder.id === id);
    return {
      id,
      title: item?.title ?? id,
      icon: item?.icon ?? Mails,
      count: id === "inbox" || id === "priority" || id === "drafts",
    };
  }),
  { id: "spam", title: "Spam", icon: ShieldAlert, added: true, count: true },
  { id: "starred", title: "Starred", icon: Star, added: true },
  { id: "all", title: "All mail", icon: Mails, added: true },
];

// Selecting a box also opens its first message.
function useChooseBox() {
  const s = useMailBox();
  const [, setMail] = useMail();
  return (id: MailBox) => {
    setMailBox(id);
    setMail({ selected: mailsIn(id, { ...s, box: id })[0]?.id ?? null });
  };
}

// Studio look: the box title opens a menu of every box with its count (Studio count pills), and a pill shows how many
// mails the open box holds, like "Conversations [Open]" on the other channel pages.
function StudioBoxTitle() {
  const s = useMailBox();
  const choose = useChooseBox();
  const live = useConversationMailFilter();
  const title = boxTabs.find((tab) => tab.id === s.box)?.title ?? "Inbox";

  return (
    <div className="flex min-w-0 items-center gap-1">
      <DropdownMenu>
        <h2 className="min-w-0 font-medium text-base">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Mail boxes"
              className="-mx-1 flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-muted"
            >
              <span className="truncate">{title}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
        </h2>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-muted-foreground text-xs">Mail boxes</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {boxTabs.map((tab) => (
            <DropdownMenuItem key={tab.id} onSelect={() => choose(tab.id)}>
              <tab.icon />
              <span>{tab.title}</span>
              <span className="ms-auto flex items-center gap-1.5">
                <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] tabular-nums">
                  {mailsIn(tab.id, s).filter(live).length}
                </Badge>
                <Check className={cn("size-3.5", s.box !== tab.id && "invisible")} />
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
        {mailsIn(s.box, s).filter(live).length}
      </Badge>
    </div>
  );
}

// Studio look: Chatwoot's Mine / Unassigned / All tabs over the open box, the same bar as the other channel pages
// (shared with their lists through the conversations store).
function StudioAssigneeTabs() {
  const s = useMailBox();
  const meta = useCwStore((state) => state.meta);
  const tab = useCwStore((state) => state.assigneeTab);
  const live = useConversationMailFilter();
  const box = mailsIn(s.box, s).filter(live);

  return (
    <Tabs value={tab} onValueChange={(value) => cw.setAssigneeTab(value as AssigneeTab)}>
      <TabsList
        variant="line"
        className="w-full justify-start gap-1 border-b px-2 *:data-[slot=tabs-trigger]:flex-none"
      >
        {assigneeTabs.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="px-2">
            {item.label}
            <Badge variant="secondary" className="ms-1 h-4.5 px-1.5 text-[10px] tabular-nums">
              {box.filter((mail) => inAssigneeTab(mail, item.value, meta)).length}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// The box title ("Inbox"): click to open the drawer, click again to close it.
export function BoxTitle() {
  const s = useMailBox();
  const look = useMailLook();
  const title = boxTabs.find((tab) => tab.id === s.box)?.title ?? "Inbox";

  if (look === "studio") return <StudioBoxTitle />;

  return (
    <h1 className="font-medium text-xl leading-none">
      <button
        type="button"
        onClick={toggleBoxDrawer}
        aria-expanded={s.drawer}
        title={s.drawer ? "Hide all boxes" : "Show all boxes"}
        className={cn("-mx-1 flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted", s.drawer && "bg-muted")}
      >
        {title}
        <ChevronDown className={cn("size-4 transition-transform", brown.icon, s.drawer && "rotate-180")} />
      </button>
    </h1>
  );
}

// The box tabs under the title, in a strip that scrolls sideways when they don't fit.
export function MailBoxTabs() {
  const s = useMailBox();
  const choose = useChooseBox();
  const look = useMailLook();

  if (look === "studio") return <StudioAssigneeTabs />;

  return (
    <Tabs
      value={s.box}
      onValueChange={(value) => {
        const tab = boxTabs.find((item) => item.id === value);
        if (tab) choose(tab.id);
      }}
    >
      <div
        data-slot="mail-box-tabs"
        className="overflow-x-auto px-2 pb-1.5 [scrollbar-color:var(--muted-foreground)_transparent] [scrollbar-width:thin]"
      >
        <TabsList
          variant="line"
          className={cn("w-max min-w-full border-b px-0 **:data-[slot=tabs-trigger]:border-x-0", brown.line)}
        >
          {boxTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className={cn("flex-none", tab.added && brown.line)}>
              {tab.title}
              {tab.count ? <span className="text-muted-foreground text-xs">({mailsIn(tab.id, s).length})</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}

// Narrow icons-only strip next to the list with every box (Fahad: «بحجم صغير فقط اقونات الاسم يضهر اذا مررت السهم»):
// each box is its icon with the count as a tiny badge, the name shows in a tooltip; account and New email are icons too.
export function MailBoxDrawer() {
  const s = useMailBox();
  const choose = useChooseBox();
  const look = useMailLook();
  // The Studio look lists the boxes in the title menu instead.
  if (!s.drawer || look === "studio") return null;

  return (
    <aside
      data-slot="mail-box-drawer"
      className={cn(
        "flex w-12 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r bg-background py-3",
        brown.line,
      )}
    >
      {/* Same look as Studio's collapsed mail rail: account avatar, compose in an outlined square, folder squares. */}
      <MailAccountSwitcher />
      <Separator className="w-6" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="New email">
            <PenLine />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">New email</TooltipContent>
      </Tooltip>
      <nav className="flex flex-col items-center gap-1" aria-label="Mail boxes">
        {boxTabs.map((tab) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={tab.title}
                data-active={s.box === tab.id}
                onClick={() => choose(tab.id)}
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-md p-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
                  tab.id === "drafts" && "mt-2",
                )}
              >
                <tab.icon />
                {tab.count ? (
                  <Badge
                    variant="secondary"
                    className="pointer-events-none absolute -top-1 -right-1.5 h-3.5 min-w-3.5 px-1 font-medium text-[9px] tabular-nums"
                  >
                    {mailsIn(tab.id, s).length}
                  </Badge>
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{tab.title}</TooltipContent>
          </Tooltip>
        ))}
      </nav>
    </aside>
  );
}
