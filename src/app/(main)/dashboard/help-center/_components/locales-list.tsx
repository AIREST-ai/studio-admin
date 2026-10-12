"use client";
// Chatwoot LocalesPage + LocaleList + LocaleCard (components-next/HelpCenter/Pages/LocalePage) as a Studio table card.
// Every menu item works on the mock store: make default, move to draft, publish, localize, recommended, delete.
import * as React from "react";

import { FilePen, Globe, Languages, MoreHorizontal, Plus, Search, Send, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Locale } from "./data";
import { articleLocale, hc, useHelpCenter } from "./hc-store";
import { ToneBadge } from "./hc-ui";
import { AddLocaleDialog, LocalizeContentDialog, RecommendedContentDialog } from "./help-center-dialogs";
import { HelpCenterHeader } from "./portal-title";

type View = "all" | "published" | "draft";

export function LocalesList() {
  const { locales, articles } = useHelpCenter();
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<View>("all");
  const [dialog, setDialog] = React.useState<"add" | "content" | "popular" | null>(null);
  const [target, setTarget] = React.useState<Locale | null>(null);

  const q = query.trim().toLowerCase();
  const matchView = (l: Locale) => view === "all" || (view === "draft" ? l.isDraft : !l.isDraft);
  const rows = locales.filter((l) => matchView(l) && (!q || l.name.toLowerCase().includes(q) || l.code.includes(q)));
  const articleCount = (l: Locale) => articles.filter((a) => articleLocale(a) === l.code).length;
  const categoryCount = (l: Locale) =>
    new Set(articles.filter((a) => articleLocale(a) === l.code && a.categoryId).map((a) => a.categoryId)).size;
  const countText = (n: number) => (n === 0 ? "No locales available" : `${n} ${n === 1 ? "locale" : "locales"}`);

  return (
    <>
      <div className="flex flex-col gap-4">
        <HelpCenterHeader
          section="locales"
          description="The languages your portal is published in, and the default one readers see first."
          actions={
            <Button size="sm" onClick={() => setDialog("add")}>
              <Plus /> New locale
            </Button>
          }
        />
        <Card>
          <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
            <CardTitle className="text-xl leading-none">Locales</CardTitle>
            <CardDescription className="max-w-sm leading-snug tabular-nums">{countText(rows.length)}</CardDescription>
            <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
              <InputGroup className="h-7 w-full md:w-64">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  className="h-7"
                  type="search"
                  placeholder="Search locales..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </InputGroup>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            <div className="flex items-center justify-end px-4">
              <Tabs value={view} onValueChange={(v) => setView(v as View)}>
                <TabsList>
                  {(
                    [
                      ["all", "All"],
                      ["published", "Published"],
                      ["draft", "Draft"],
                    ] as const
                  ).map(([value, label]) => (
                    <TabsTrigger key={value} value={value} className="px-2.5">
                      {label}
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {
                          locales.filter((l) =>
                            value === "all" ? true : value === "draft" ? l.isDraft : !l.isDraft,
                          ).length
                        }
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            {rows.length ? (
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader className="[&_tr]:border-t">
                  <TableRow>
                    <TableHead className="py-4 font-normal">Locale</TableHead>
                    <TableHead className="py-4 font-normal">Status</TableHead>
                    <TableHead className="py-4 font-normal">Articles</TableHead>
                    <TableHead className="py-4 font-normal">Categories</TableHead>
                    <TableHead className="py-4 font-normal">
                      <div className="text-right">Actions</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((locale) => {
                    const articlesN = articleCount(locale);
                    const categoriesN = categoryCount(locale);
                    return (
                      <TableRow key={locale.code} className="border-border/60">
                        <TableCell className="py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                              <Globe className="size-4 text-muted-foreground" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-sm">{locale.name}</div>
                              <div className="text-muted-foreground text-xs">{locale.code}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex flex-wrap gap-1.5">
                            {locale.isDefault ? <ToneBadge color="blue">Default</ToneBadge> : null}
                            {locale.isDraft ? (
                              <ToneBadge color="amber">Draft</ToneBadge>
                            ) : (
                              <ToneBadge color="green">Published</ToneBadge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle text-sm tabular-nums">
                          {articlesN} {articlesN === 1 ? "article" : "articles"}
                        </TableCell>
                        <TableCell className="py-4 align-middle text-sm tabular-nums">
                          {categoriesN} {categoriesN === 1 ? "category" : "categories"}
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  aria-label={`Open actions for ${locale.name}`}
                                  className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                  size="icon-sm"
                                  variant="ghost"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                {!locale.isDraft ? (
                                  <DropdownMenuItem
                                    disabled={locale.isDefault}
                                    onSelect={() => {
                                      hc.updateLocale(locale.code, { isDefault: true });
                                      toast.success("Portal updated successfully");
                                    }}
                                  >
                                    <Star /> Make default
                                  </DropdownMenuItem>
                                ) : null}
                                {!locale.isDraft ? (
                                  <DropdownMenuItem
                                    disabled={locale.isDefault}
                                    onSelect={() => {
                                      hc.updateLocale(locale.code, { isDraft: true });
                                      toast.success("Portal updated successfully");
                                    }}
                                  >
                                    <FilePen /> Move to draft
                                  </DropdownMenuItem>
                                ) : null}
                                {locale.isDraft ? (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      hc.updateLocale(locale.code, { isDraft: false });
                                      toast.success("Portal updated successfully");
                                    }}
                                  >
                                    <Send /> Publish locale
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setTarget(locale);
                                    setDialog("content");
                                  }}
                                >
                                  <Languages /> Localize content
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setTarget(locale);
                                    setDialog("popular");
                                  }}
                                >
                                  <Sparkles /> Select recommended content
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={locale.isDefault}
                                  onSelect={() => {
                                    hc.deleteLocale(locale.code);
                                    toast.success("Portal updated successfully");
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
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="border-t px-4 pt-4">
                <Empty className="border border-dashed py-14">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Globe />
                    </EmptyMedia>
                    <EmptyTitle>No matching locales</EmptyTitle>
                    <EmptyDescription>
                      We couldn&apos;t find any locales matching your search. Try a different term.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <AddLocaleDialog open={dialog === "add"} onOpenChange={(o) => !o && setDialog(null)} />
      <LocalizeContentDialog open={dialog === "content"} onOpenChange={(o) => !o && setDialog(null)} locale={target} />
      <RecommendedContentDialog
        open={dialog === "popular"}
        onOpenChange={(o) => !o && setDialog(null)}
        locale={target}
      />
    </>
  );
}
