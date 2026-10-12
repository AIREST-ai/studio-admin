"use client";
import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import { Bot, Check, ChevronsUpDown, MoreHorizontal, Plus } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PageHeading } from "../../contacts/_components/studio-ui";
import { assistants, connectedInboxes, documents, faqs, scenarios, suggestions, tools } from "./data";

// The assistant picked in the switcher, shared by every Captain page while the tab is open (mock, no backend).
let currentAssistantId = 1;
const assistantListeners = new Set<() => void>();
function subscribeAssistant(cb: () => void) {
  assistantListeners.add(cb);
  return () => assistantListeners.delete(cb);
}
export function setCurrentAssistant(id: number) {
  currentAssistantId = id;
  for (const cb of assistantListeners) cb();
}
export function useCurrentAssistant() {
  const id = React.useSyncExternalStore(
    subscribeAssistant,
    () => currentAssistantId,
    () => 1,
  );
  return assistants.find((a) => a.id === id) ?? assistants[0];
}

export function AssistantSwitcher() {
  const current = useCurrentAssistant();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
            <Bot className="size-3.5" />
          </span>
          {current.name}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5">
          <span>Assistants</span>
          <span className="font-normal text-muted-foreground text-xs">Switch between assistants</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {assistants.map((a) => (
          <DropdownMenuItem key={a.id} className="items-start" onSelect={() => setCurrentAssistant(a.id)}>
            <Bot className="mt-0.5" />
            <div className="grid flex-1 gap-0.5">
              <span>{a.name}</span>
              <span className="line-clamp-1 text-muted-foreground text-xs">{a.productName}</span>
            </div>
            {a.id === current.id && <Check className="mt-0.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/captain/assistants?create=1">
            <Plus /> Create Assistant
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Chatwoot's Captain sidebar (Sidebar.vue: Overview, FAQs, Documents, Scenarios, Playground, Inboxes, Tools,
// Settings) shown as Studio line tabs with count pills, because the Studio sidebar keeps one "Captain" link.
const captainNav = [
  { href: "/dashboard/captain", label: "Overview" },
  { href: "/dashboard/captain/faqs", label: "FAQs", count: faqs.length + suggestions.length },
  { href: "/dashboard/captain/documents", label: "Documents", count: documents.length },
  { href: "/dashboard/captain/scenarios", label: "Scenarios", count: scenarios.length },
  { href: "/dashboard/captain/playground", label: "Playground" },
  { href: "/dashboard/captain/inboxes", label: "Inboxes", count: connectedInboxes.length },
  { href: "/dashboard/captain/tools", label: "Tools", count: tools.length },
  { href: "/dashboard/captain/settings", label: "Settings" },
];

export function CaptainNav() {
  const pathname = usePathname();
  const active =
    [...captainNav].sort((a, b) => b.href.length - a.href.length).find((n) => pathname.startsWith(n.href))?.href ??
    captainNav[0].href;
  return (
    <Tabs value={active}>
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 overflow-x-auto border-b ps-0 [scrollbar-width:none] *:data-[slot=tabs-trigger]:flex-none [&::-webkit-scrollbar]:hidden"
      >
        {captainNav.map((n) => (
          <TabsTrigger key={n.href} value={n.href} asChild>
            <Link href={n.href}>
              {n.label}
              {n.count !== undefined && (
                <Badge variant="secondary" className="ms-1 tabular-nums">
                  {n.count}
                </Badge>
              )}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// Studio page heading (big title outside the card, one line under it, main button on its side), as on Contacts.
export function CaptainShell({
  title,
  subtitle,
  actions,
  switcher = true,
  nav = true,
  className,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  actions?: React.ReactNode;
  switcher?: boolean;
  nav?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeading title={title} subtitle={subtitle} />
        {[switcher, actions !== undefined].some(Boolean) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {switcher && <AssistantSwitcher />}
            {actions}
          </div>
        )}
      </div>
      {nav && <CaptainNav />}
      {children}
    </div>
  );
}

// Studio row menu trigger ("…" in a muted square), the same as the Contacts table.
export function RowMenuTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        aria-label={label}
        className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
        size="icon-sm"
        variant="ghost"
      >
        <MoreHorizontal className="size-4" />
      </Button>
    </DropdownMenuTrigger>
  );
}

// Studio coloured badge with a dot (statusMeta tones of contacts/_components/studio-ui.tsx).
const tones = {
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  red: "border-destructive/20 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/50 text-muted-foreground",
} as const;

export type Tone = keyof typeof tones;

export function ToneBadge({ tone, children, dot = true }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border px-2 py-1 font-medium", tones[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </Badge>
  );
}

// Studio filter chip (label: value) used under the card header, as on Contacts.
export { ChipSelect } from "./chip-select";
