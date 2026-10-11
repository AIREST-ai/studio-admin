"use client";
import * as React from "react";

import { cn } from "cn";
import {
  EllipsisVertical,
  FilePen,
  Globe,
  Languages,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

import { type Locale, locales } from "./data";
import { AddLocaleDialog, LocalizeContentDialog, RecommendedContentDialog } from "./help-center-dialogs";
import { PortalTitle } from "./portal-title";

export function LocalesList() {
  const [query, setQuery] = React.useState("");
  const [dialog, setDialog] = React.useState<"add" | "content" | "popular" | null>(null);
  const [target, setTarget] = React.useState<Locale | null>(null);

  const q = query.trim().toLowerCase();
  const rows = locales.filter((l) => !q || l.name.toLowerCase().includes(q) || l.code.includes(q));

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="self-center">
            <PortalTitle section="Locales" />
          </CardTitle>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-60">
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
            <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
            <Button size="sm" onClick={() => setDialog("add")}>
              <Plus /> New locale
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <span className="text-muted-foreground text-sm tabular-nums">
            {rows.length === 0 ? "No locales available" : `${rows.length} ${rows.length === 1 ? "locale" : "locales"}`}
          </span>
          {rows.length ? (
            <div className="grid gap-2.5">
              {rows.map((locale) => (
                <div
                  key={locale.code}
                  className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Globe className="size-4 text-muted-foreground" />
                    </div>
                    <span className="truncate font-medium text-sm">
                      {locale.name} <span className="text-muted-foreground">({locale.code})</span>
                    </span>
                    {locale.isDefault ? (
                      <span className="inline-flex h-6 items-center rounded-md bg-primary/10 px-2 text-primary text-xs">
                        Default
                      </span>
                    ) : locale.isDraft ? (
                      <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-muted-foreground text-xs">
                        Draft
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="whitespace-nowrap text-muted-foreground text-sm tabular-nums">
                      {locale.articles} {locale.articles === 1 ? "article" : "articles"}
                    </span>
                    <Separator orientation="vertical" className="h-3 data-[orientation=vertical]:h-3" />
                    <span className="whitespace-nowrap text-muted-foreground text-sm tabular-nums">
                      {locale.categories} {locale.categories === 1 ? "category" : "categories"}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label="Locale actions">
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {!locale.isDefault && !locale.isDraft ? (
                          <DropdownMenuItem>
                            <Star /> Make default
                          </DropdownMenuItem>
                        ) : null}
                        {!locale.isDefault && !locale.isDraft ? (
                          <DropdownMenuItem>
                            <FilePen /> Move to draft
                          </DropdownMenuItem>
                        ) : null}
                        {locale.isDraft ? (
                          <DropdownMenuItem>
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
                        <DropdownMenuItem onSelect={() => setDialog("popular")}>
                          <Sparkles /> Select recommended content
                        </DropdownMenuItem>
                        {!locale.isDefault ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive">
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty className={cn("border border-dashed py-14")}>
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
          )}
        </CardContent>
      </Card>
      <AddLocaleDialog open={dialog === "add"} onOpenChange={(o) => !o && setDialog(null)} />
      <LocalizeContentDialog open={dialog === "content"} onOpenChange={(o) => !o && setDialog(null)} locale={target} />
      <RecommendedContentDialog open={dialog === "popular"} onOpenChange={(o) => !o && setDialog(null)} />
    </>
  );
}
