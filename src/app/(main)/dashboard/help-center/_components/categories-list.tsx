"use client";
import * as React from "react";

import Link from "next/link";

import { ChevronDown, EllipsisVertical, Pencil, Plus, Search, Shapes, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

import { type Category, categories, locales } from "./data";
import { CategoryDialog } from "./help-center-dialogs";
import { PortalTitle } from "./portal-title";

export function CategoriesList() {
  const [query, setQuery] = React.useState("");
  const [locale, setLocale] = React.useState("en");
  const [dialog, setDialog] = React.useState<{ category: Category | null } | null>(null);

  const rows = categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const activeLocale = locales.find((l) => l.code === locale) ?? locales[0];

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="self-center">
            <PortalTitle section="Categories" />
          </CardTitle>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-60">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                type="search"
                placeholder="Search categories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
            <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
            <Button size="sm" onClick={() => setDialog({ category: null })}>
              <Plus /> New category
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {activeLocale.name} <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Locale</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={locale} onValueChange={setLocale}>
                  {locales.map((l) => (
                    <DropdownMenuRadioItem key={l.code} value={l.code}>
                      {l.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-4 data-[orientation=vertical]:h-4" />
            <span className="text-muted-foreground text-sm tabular-nums">
              {rows.length} {rows.length === 1 ? "category" : "categories"}
            </span>
          </div>

          {rows.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-2 rounded-xl border px-4 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href="/dashboard/help-center"
                        className="flex min-w-0 items-center gap-1.5 font-medium underline-offset-2 hover:text-primary hover:underline"
                      >
                        <span>{category.icon}</span>
                        <span className="truncate">{category.name}</span>
                      </Link>
                      <span className="inline-flex h-6 shrink-0 items-center rounded-lg border px-2 text-muted-foreground text-xs tabular-nums">
                        {category.articles} {category.articles === 1 ? "article" : "articles"}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label="Category actions">
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onSelect={() => setDialog({ category })}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive">
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="line-clamp-3 text-muted-foreground text-sm">
                    {category.description || <span className="text-muted-foreground/60">No description</span>}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty className="border border-dashed py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Shapes />
                </EmptyMedia>
                <EmptyTitle>{query ? "No matching categories" : "No categories found"}</EmptyTitle>
                <EmptyDescription>
                  {query
                    ? "We couldn't find any categories matching your search. Try a different term."
                    : "Categories will appear here. You can add a category by clicking the 'New Category' button."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <CategoryDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        category={dialog?.category}
      />
    </>
  );
}
