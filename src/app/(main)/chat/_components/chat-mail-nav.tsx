"use client";

import { cn } from "cn";
import { ChevronDown, type LucideIcon, Mails, PenLine, ShieldAlert, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mailNavigation } from "@/app/(main)/mail/_components/data";
import { useMail } from "@/app/(main)/mail/_components/use-mail";

import { MailAccountSwitcher } from "./chat-mail-actions";
import { type MailBox, mailsIn, setMailBox, toggleBoxDrawer, useMailBox } from "./chat-mail-store";
import { brown } from "./chat-thread-extras";

// Fahad 2026-10-11: the box tabs sit under the box title (like the chat's All/Open/Snoozed/Closed) in a strip that
// scrolls sideways; clicking the title opens/closes a side drawer with all boxes (icons + counts, like the old rail).
// Spam, Starred and All mail are the missing RFC 6154 boxes (\Junk, \Flagged, \All). Brown = temporary marker.

const rail = [...mailNavigation.navMain, ...mailNavigation.folders];
const standard: MailBox[] = ["inbox", "priority", "drafts", "sent", "archive", "trash"];

export const boxTabs: { id: MailBox; title: string; icon: LucideIcon; added?: boolean; count?: boolean }[] = [
  ...standard.map((id) => {
    const item = rail.find((folder) => folder.id === id);
    return { id, title: item?.title ?? id, icon: item?.icon ?? Mails, count: id === "inbox" || id === "priority" || id === "drafts" };
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

// The box title ("Inbox"): click to open the drawer, click again to close it.
export function BoxTitle() {
  const s = useMailBox();
  const title = boxTabs.find((tab) => tab.id === s.box)?.title ?? "Inbox";

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

  return (
    <Tabs
      value={s.box}
      onValueChange={(value) => {
        const tab = boxTabs.find((item) => item.id === value);
        if (tab) choose(tab.id);
      }}
    >
      <div data-slot="mail-box-tabs" className="overflow-x-auto px-2 pb-1.5 [scrollbar-color:var(--muted-foreground)_transparent] [scrollbar-width:thin]">
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
  if (!s.drawer) return null;

  return (
    <aside
      data-slot="mail-box-drawer"
      className={cn("flex w-12 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r bg-background py-3", brown.line)}
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
