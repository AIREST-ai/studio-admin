"use client";
// Portals: the list of Chatwoot's PortalSwitcher popover drawn as a Studio table (heading, card, row "…" menu), and
// Chatwoot's PortalEmptyState (EmptyState/Portal/PortalEmptyState.vue) when no portal is left (or with ?state=empty).
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Building2, Check, Link2, MoreHorizontal, Plus, Search, Settings2, Trash2 } from "lucide-react";

import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { Portal } from "./data";
import { hc, useHelpCenter } from "./hc-store";
import { ToneBadge } from "./hc-ui";
import { CreatePortalDialog, DeletePortalDialog } from "./help-center-dialogs";
import { PortalsEmpty } from "./portals-empty";

export function PortalsList({ forceEmpty }: { forceEmpty?: boolean }) {
  const router = useRouter();
  const { portals, activePortalId, articles, locales } = useHelpCenter();
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  if (forceEmpty || portals.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Help Center" subtitle="Self-service portals for your customers." />
        <PortalsEmpty />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const rows = portals.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.slug.includes(q) || p.customDomain.includes(q),
  );
  const countOf = (p: Portal) => (p.id === activePortalId ? articles.length : p.articles);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading title="Portals" subtitle="Create and manage multiple portals" />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> New portal
        </Button>
      </div>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Portals</CardTitle>
          <CardDescription className="max-w-sm leading-snug tabular-nums">
            {portals.length} {portals.length === 1 ? "portal" : "portals"} · the checked one is open in the Help Center
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                type="search"
                placeholder="Portal name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="py-4 font-normal">Portal</TableHead>
                <TableHead className="py-4 font-normal">Domain</TableHead>
                <TableHead className="py-4 font-normal">Articles</TableHead>
                <TableHead className="py-4 font-normal">Status</TableHead>
                <TableHead className="py-4 font-normal">
                  <div className="text-right">Actions</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((portal) => {
                  const active = portal.id === activePortalId;
                  return (
                    <TableRow key={portal.id} className="border-border/60">
                      <TableCell className="py-4 align-middle">
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left"
                          onClick={() => {
                            hc.setActivePortal(portal.id);
                            router.push("/dashboard/help-center");
                          }}
                        >
                          <Avatar className="size-9 rounded-lg">
                            <AvatarFallback className="rounded-lg text-white" style={{ background: portal.color }}>
                              <Building2 className="size-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-sm hover:underline">{portal.name}</div>
                            <div className="truncate text-muted-foreground text-xs">app.chatwoot.com/hc/{portal.slug}</div>
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="py-4 align-middle text-sm">
                        {portal.customDomain ? (
                          <span className="inline-flex items-center gap-1">
                            <Link2 className="size-3.5 text-muted-foreground" />
                            {portal.customDomain}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-middle text-sm tabular-nums">
                        {countOf(portal)} articles
                        {active ? (
                          <span className="text-muted-foreground"> · {locales.length} locales</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        {active ? (
                          <ToneBadge color="green">
                            <Check className="size-3" /> Active
                          </ToneBadge>
                        ) : (
                          <ToneBadge color="muted" dot={false}>
                            Not open
                          </ToneBadge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <div className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Open actions for ${portal.name}`}
                                className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                size="icon-sm"
                                variant="ghost"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onSelect={() => {
                                  hc.setActivePortal(portal.id);
                                  router.push("/dashboard/help-center");
                                }}
                              >
                                <Check /> Open articles
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href="/dashboard/help-center/settings"
                                  onClick={() => hc.setActivePortal(portal.id)}
                                >
                                  <Settings2 /> Settings
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  hc.setActivePortal(portal.id);
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No matching results
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <CreatePortalDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeletePortalDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
