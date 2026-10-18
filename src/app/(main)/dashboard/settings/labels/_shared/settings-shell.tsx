"use client";
import type * as React from "react";

import { ExternalLink } from "lucide-react";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ShellTab {
  value: string;
  label: string;
  count?: number;
}

interface SettingsShellProps {
  title: string;
  description: string;
  learnMore?: string;
  /** Chatwoot helper/featureHelper.js help URL; defaults to HELP_URLS[learnMore], and with neither no link shows. */
  learnMoreHref?: string;
  count?: string;
  search?: { placeholder: string; value: string; onChange: (value: string) => void };
  /** The main button(s): drawn beside the big page title, as on Users & Roles and Contacts. */
  actions?: React.ReactNode;
  /** Line tabs with counts under the title (Studio pattern). */
  tabs?: { value: string; onValueChange: (value: string) => void; items: ShellTab[] };
  /** Title and line of the card that holds the table; defaults to the active tab label, else the page title. */
  cardTitle?: string;
  cardDescription?: string;
  children: React.ReactNode;
}

// Chatwoot helper/featureHelper.js help URLs, by the "Learn more" text each settings page passes. Chatwoot
// (BaseSettingsHeader.vue:75) shows the link only when its feature has a help URL, so a text without one shows nothing.
// F-16 (Fahad 15 Oct: "I do not want their links"): every entry pointed at Chatwoot's help centre (chwt.app,
// chatwoot.com), so the map is empty and no "Learn more" link shows; this site has no help pages of its own yet.
const HELP_URLS: Record<string, string> = {};

/** F-16: a help link is drawn only when it stays on this site (a path such as /dashboard/…). */
const isOwnLink = (href: string) => href.startsWith("/") && !href.startsWith("//");

/** The big title and description outside the card, the main button beside them. */
export function PageHeader({
  title,
  description,
  learnMore,
  learnMoreHref,
  actions,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  learnMore?: string;
  learnMoreHref?: string;
  actions?: React.ReactNode;
}) {
  const wanted = learnMoreHref ?? (learnMore ? HELP_URLS[learnMore] : undefined);
  const helpHref = wanted && isOwnLink(wanted) ? wanted : undefined;
  return (
    // م137 round 2 (judge: the header button moved with the line's length): the buttons sit at the top right, level
    // with the title, on every page and width; the title and line take the rest (Polaris Page: the main button in
    // the page header; HubSpot: "In the upper right").
    <div data-settings-header className="flex flex-wrap items-start justify-between gap-3 md:flex-nowrap md:gap-6">
      <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-1">
        <h1 className="text-3xl tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
          {helpHref ? " " : null}
          {learnMore && helpHref ? (
            <a
              href={helpHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 whitespace-nowrap text-primary underline-offset-4 hover:underline"
            >
              {learnMore}
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </p>
      </div>
      {actions ? (
        <div data-settings-header-actions className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Line tabs with a count badge on each, copied from Contacts and Users & Roles. */
export function CountTabs({
  value,
  onValueChange,
  items,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: ShellTab[];
}) {
  return (
    <Tabs className="gap-4" value={value} onValueChange={onValueChange}>
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
      >
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
            {item.count !== undefined ? (
              <Badge variant="secondary" className="ms-1 tabular-nums">
                {item.count}
              </Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Chatwoot's BaseSettingsHeader + SettingsLayout, drawn in the Studio pattern (Users & Roles, Contacts). */
export function SettingsShell({
  title,
  description,
  learnMore,
  learnMoreHref,
  count,
  search,
  actions,
  tabs,
  cardTitle,
  cardDescription,
  children,
}: SettingsShellProps) {
  const activeTab = tabs?.items.find((item) => item.value === tabs.value);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={description}
        learnMore={learnMore}
        learnMoreHref={learnMoreHref}
        actions={actions}
      />
      {tabs ? <CountTabs value={tabs.value} onValueChange={tabs.onValueChange} items={tabs.items} /> : null}
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">{cardTitle ?? activeTab?.label ?? title}</CardTitle>
          {cardDescription ? (
            <CardDescription className="max-w-md leading-snug">{cardDescription}</CardDescription>
          ) : null}
          {search || count ? (
            <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-3 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
              {count ? <span className="text-muted-foreground text-sm tabular-nums">{count}</span> : null}
              {/* F-13 (Fahad 125.4): every settings list search is a lens; a click opens the box in its place. */}
              {search ? (
                <ExpandingSearch
                  name="settings-list"
                  label={search.placeholder.replace(/(\.\.\.|…)$/, "")}
                  placeholder={search.placeholder}
                  className="w-full md:w-64"
                  value={search.value}
                  onChange={search.onChange}
                />
              ) : null}
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">{children}</CardContent>
      </Card>
    </div>
  );
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

interface ConfirmDeleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  yes: string;
  no: string;
  /** Runs when the user presses the red button (optional, added by settings-b). */
  onConfirm?: () => void;
}

export function ConfirmDelete({ open, onOpenChange, title, message, yes, no, onConfirm }: ConfirmDeleteProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{no}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {yes}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NoResults({ children }: { children: React.ReactNode }) {
  return <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">{children}</div>;
}
