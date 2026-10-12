"use client";
// Chatwoot PortalSwitcher (components-next/HelpCenter/PortalSwitcher) inside the Studio page heading, plus the
// portal sections (Chatwoot's Help Center sidebar entries) as Studio line tabs with counts.
import * as React from "react";

import Link from "next/link";

import { ArrowUpRight, Building2, Check, ChevronDown, Link2, Plus } from "lucide-react";

import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { articleLocale, hc, useActivePortal, useHelpCenter } from "./hc-store";
import { CreatePortalDialog } from "./help-center-dialogs";
import { PortalsEmpty } from "./portals-empty";

export function PortalSwitcher({ children }: { children: React.ReactNode }) {
  const { portals, activePortalId, articles } = useHelpCenter();
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="start" className="w-[27.5rem] max-w-[calc(100vw-2rem)] p-0">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="grid gap-1">
              <div className="flex items-center gap-1.5">
                <Link
                  href="/dashboard/help-center/portals"
                  className="font-medium text-sm hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Portals
                </Link>
                <Button variant="ghost" size="icon-xs" aria-label="Preview portal" asChild>
                  <a href="https://help.weblabs.studio" target="_blank" rel="noreferrer">
                    <ArrowUpRight />
                  </a>
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">Create and manage multiple portals</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus /> New portal
            </Button>
          </div>
          <div className="grid gap-1 p-2">
            {portals.map((portal) => {
              const count = portal.id === activePortalId ? articles.length : portal.articles;
              return (
                <button
                  key={portal.id}
                  type="button"
                  onClick={() => {
                    hc.setActivePortal(portal.id);
                    setOpen(false);
                  }}
                  className="flex h-10 w-full min-w-0 items-center gap-2.5 rounded-md ps-2 pe-3 text-left hover:bg-muted"
                >
                  <Avatar className="size-6 rounded-md">
                    <AvatarFallback className="rounded-md text-white" style={{ background: portal.color }}>
                      <Building2 className="size-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate font-medium text-sm">{portal.name}</span>
                  {portal.customDomain ? (
                    <span className="hidden min-w-0 shrink items-center gap-1 text-muted-foreground text-xs sm:flex">
                      <Link2 className="size-3" />
                      <span className="truncate">{portal.customDomain}</span>
                    </span>
                  ) : null}
                  <span className="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground text-xs tabular-nums">
                    {count} articles
                    {portal.id === activePortalId ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : (
                      <span className="size-4" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <CreatePortalDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export function PortalTitle() {
  const portal = useActivePortal();
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <h1 className="truncate text-3xl tracking-tight">{portal?.name ?? "Help Center"}</h1>
      <PortalSwitcher>
        <Button variant="ghost" size="icon-sm" aria-label="Switch portal">
          <ChevronDown />
        </Button>
      </PortalSwitcher>
    </div>
  );
}

export type HelpCenterSection = "articles" | "categories" | "locales" | "settings";

/** Studio page header for the Help Center: big portal title (with the portal switcher), description, main button,
 * then the portal sections as line tabs with counts. */
export function HelpCenterHeader({
  section,
  description,
  actions,
}: {
  section: HelpCenterSection;
  description: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { articles, categories, locales } = useHelpCenter();
  const sections: { value: HelpCenterSection; label: string; href: string; count?: number }[] = [
    {
      value: "articles",
      label: "Articles",
      href: "/dashboard/help-center",
      count: articles.filter((a) => articleLocale(a) === "en").length,
    },
    { value: "categories", label: "Categories", href: "/dashboard/help-center/categories", count: categories.length },
    { value: "locales", label: "Locales", href: "/dashboard/help-center/locales", count: locales.length },
    { value: "settings", label: "Settings", href: "/dashboard/help-center/settings" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <PortalTitle />
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <Tabs value={section}>
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          {sections.map((item) => (
            <TabsTrigger key={item.value} value={item.value} asChild>
              <Link href={item.href}>
                {item.label}
                {item.count !== undefined ? (
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {item.count}
                  </Badge>
                ) : null}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

/** Chatwoot sends an account without portals to the portal empty state; the Help Center pages do the same. */
export function PortalGate({ children }: { children: React.ReactNode }) {
  const { portals } = useHelpCenter();
  if (portals.length === 0) return <PortalsEmptyPage />;
  return <>{children}</>;
}

function PortalsEmptyPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Help Center" subtitle="Self-service portals for your customers." />
      <PortalsEmpty />
    </div>
  );
}
