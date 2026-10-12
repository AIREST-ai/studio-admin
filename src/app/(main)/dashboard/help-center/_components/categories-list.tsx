"use client";
// Chatwoot CategoriesPage + CategoryHeaderControls + CategoryList/CategoryCard (components-next/HelpCenter/Pages/
// CategoryPage) as a Studio table card. A category name opens its articles (categories/[slug]).
import * as React from "react";

import Link from "next/link";

import { FileText, MoreHorizontal, Pencil, Plus, Search, Shapes, Trash2 } from "lucide-react";
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { Category } from "./data";
import { articleLocale, hc, useHelpCenter } from "./hc-store";
import { ChipSelect, ToneBadge } from "./hc-ui";
import { CategoryDialog } from "./help-center-dialogs";
import { HelpCenterHeader } from "./portal-title";

export function CategoriesList() {
  const { categories, locales, articles } = useHelpCenter();
  const [query, setQuery] = React.useState("");
  const [locale, setLocale] = React.useState("en");
  const [dialog, setDialog] = React.useState<{ category: Category | null } | null>(null);

  const q = query.trim().toLowerCase();
  const rows = categories.filter((c) => !q || c.name.toLowerCase().includes(q));
  const activeLocale = locales.find((l) => l.code === locale) ?? locales[0];
  const countOf = (c: Category) => articles.filter((a) => a.categoryId === c.id && articleLocale(a) === locale).length;
  const publishedOf = (c: Category) =>
    articles.filter((a) => a.categoryId === c.id && articleLocale(a) === locale && a.status === "published").length;

  return (
    <>
      <div className="flex flex-col gap-4">
        <HelpCenterHeader
          section="categories"
          description="Group the articles of your portal so readers find them by topic."
          actions={
            <Button size="sm" onClick={() => setDialog({ category: null })}>
              <Plus /> New category
            </Button>
          }
        />
        <Card>
          <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
            <CardTitle className="text-xl leading-none">Categories ({locale})</CardTitle>
            <CardDescription className="max-w-sm leading-snug tabular-nums">
              {rows.length} {rows.length === 1 ? "category" : "categories"} in {activeLocale?.name}
            </CardDescription>
            <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
              <InputGroup className="h-7 w-full md:w-64">
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
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            <div className="flex flex-wrap items-center gap-3 px-4">
              <ChipSelect
                label="Locale"
                value={locale}
                onChange={setLocale}
                options={locales.map((l) => ({ value: l.code, label: `${l.name} (${l.code})` }))}
              />
            </div>
            {rows.length ? (
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader className="[&_tr]:border-t">
                  <TableRow>
                    <TableHead className="py-4 font-normal">Category</TableHead>
                    <TableHead className="py-4 font-normal">Description</TableHead>
                    <TableHead className="py-4 font-normal">Articles</TableHead>
                    <TableHead className="py-4 font-normal">
                      <div className="text-right">Actions</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((category) => {
                    const count = countOf(category);
                    return (
                      <TableRow key={category.id} className="border-border/60">
                        <TableCell className="py-4 align-middle">
                          <Link
                            href={`/dashboard/help-center/categories/${category.slug}`}
                            className="flex items-center gap-3"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-base">
                              {category.icon || <Shapes className="size-4 text-muted-foreground" />}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground text-sm hover:underline">
                                {category.name}
                              </div>
                              <div className="truncate text-muted-foreground text-xs">/{category.slug}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[28rem] py-4 align-middle">
                          <p className="line-clamp-2 whitespace-normal text-muted-foreground text-sm">
                            {category.description || <span className="text-muted-foreground/60">---</span>}
                          </p>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ToneBadge color={count ? "violet" : "muted"} dot={false} className="tabular-nums">
                              <FileText className="size-3" />
                              {count} {count === 1 ? "article" : "articles"}
                            </ToneBadge>
                            {count ? (
                              <span className="text-muted-foreground text-xs tabular-nums">
                                {publishedOf(category)} published
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  aria-label={`Open actions for ${category.name}`}
                                  className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                  size="icon-sm"
                                  variant="ghost"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/help-center/categories/${category.slug}`}>
                                    <FileText /> View articles
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDialog({ category })}>
                                  <Pencil /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => {
                                    hc.deleteCategory(category.id);
                                    toast.success("Category deleted successfully");
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
                      <Shapes />
                    </EmptyMedia>
                    <EmptyTitle>{q ? "No matching categories" : "No categories found"}</EmptyTitle>
                    <EmptyDescription>
                      {q
                        ? "We couldn't find any categories matching your search. Try a different term."
                        : "Categories will appear here. You can add a category by clicking the 'New Category' button."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {q ? null : (
                    <EmptyContent>
                      <Button size="sm" onClick={() => setDialog({ category: null })}>
                        <Plus /> New category
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <CategoryDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        category={dialog?.category}
        localeCode={locale}
      />
    </>
  );
}
