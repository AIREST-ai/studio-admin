"use client";
// Chatwoot ArticlesPage + ArticleHeaderControls + ArticleList + ArticleCard (components-next/HelpCenter/Pages/
// ArticlePage) in the Studio pattern of contacts/_components/contacts-list.tsx: heading, line tabs, card with
// search + chip filters, status tabs with counts, table with row "…" menu, bulk bar and pagination.
// With `categorySlug` it is Chatwoot's category articles page (portals_categories_articles_index).
import * as React from "react";

import Link from "next/link";

import {
  Archive,
  ChevronDown,
  ChevronRight,
  Eye,
  FilePen,
  FileText,
  Languages,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Shapes,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { type Article, type ArticleStatus, authors, currentUserId } from "./data";
import { articleLocale, hc, useHelpCenter } from "./hc-store";
import { ArticleStatusBadge, PendingEditsBadge, PersonChip, SearchChip, TableFooter } from "./hc-ui";
import { BulkTranslateDialog, CategoryDialog, DeleteArticlesDialog } from "./help-center-dialogs";
import { HelpCenterHeader } from "./portal-title";

type Tab = "all" | "mine" | "draft" | "archived";

const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "All articles" },
  { value: "mine", label: "Mine" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const emptyStates: Record<Tab | "search" | "category", { title: string; subtitle: string }> = {
  all: { title: "Write an article", subtitle: "Write a rich article, let’s get started!" },
  mine: {
    title: "You haven't written any articles here",
    subtitle: "All articles written by you show up here for quick access.",
  },
  draft: { title: "There are no articles in drafts", subtitle: "Draft articles will appear here" },
  archived: {
    title: "There are no articles in the archive",
    subtitle: "Archived articles don't show up on the portal, you can use it to mark deprecated or outdated pages",
  },
  category: {
    title: "There are no articles in this category",
    subtitle: "Articles in this category will appear here",
  },
  search: {
    title: "No matching articles",
    subtitle: "We couldn't find any articles matching your search. Try a different term.",
  },
};

function matchesTab(article: Article, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "mine") return article.authorId === currentUserId;
  return article.status === tab;
}

const statusActions: { status: ArticleStatus; label: string; icon: typeof Send }[] = [
  { status: "published", label: "Publish", icon: Send },
  { status: "draft", label: "Draft", icon: FilePen },
  { status: "archived", label: "Archive", icon: Archive },
];

// portalHelper.js ARTICLE_MENU_OPTIONS (translate is added after the status items).
const menuOptions: Record<ArticleStatus, ArticleStatus[]> = {
  archived: ["published", "draft"],
  draft: ["published", "archived"],
  published: ["draft", "archived"],
};

function applyStatus(ids: number[], status: ArticleStatus, articles: Article[]) {
  // Chatwoot skips articles with unpublished edits in bulk status changes (BULK_ACTIONS.STATUS_SKIPPED).
  const skipped = articles.filter((a) => ids.includes(a.id) && a.pendingEdits).map((a) => a.id);
  const apply = ids.filter((id) => !skipped.includes(id));
  if (!apply.length) {
    toast.warning("These articles have unpublished edits — open each to publish or discard.");
    return;
  }
  hc.setStatus(apply, status);
  toast.success("Articles updated successfully");
  if (skipped.length) {
    toast.warning(
      skipped.length === 1
        ? "1 article with unpublished edits was skipped — open it to publish or discard."
        : `${skipped.length} articles with unpublished edits were skipped — open them to publish or discard.`,
    );
  }
}

function RowActions({
  article,
  onDelete,
  onTranslate,
}: {
  article: Article;
  onDelete: () => void;
  onTranslate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${article.title}`}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {(menuOptions[article.status] ?? []).map((key) => {
          const action = statusActions.find((a) => a.status === key);
          if (!action) return null;
          return (
            <DropdownMenuItem
              key={key}
              onSelect={() => {
                hc.setStatus([article.id], action.status);
                toast.success("Articles updated successfully");
              }}
            >
              <action.icon /> {action.label}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem onSelect={onTranslate}>
          <Languages /> Translate
        </DropdownMenuItem>
        {article.pendingEdits ? (
          <DropdownMenuItem
            onSelect={() => {
              hc.updateArticle(article.id, {
                pendingEdits: false,
                title: article.liveTitle ?? article.title,
                liveTitle: undefined,
              });
              toast.success("Changes discarded");
            }}
          >
            <Undo2 /> Discard changes
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ArticlesList({ categorySlug }: { categorySlug?: string }) {
  const { articles, categories, locales } = useHelpCenter();
  const fixedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;
  const [tab, setTab] = React.useState<Tab>("all");
  const [query, setQuery] = React.useState("");
  const [locale, setLocale] = React.useState("en");
  const [category, setCategory] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [dialog, setDialog] = React.useState<{ kind: "delete" | "translate"; ids: number[] } | null>(null);
  const [editCategory, setEditCategory] = React.useState(false);

  const activeCategoryId = fixedCategory ? String(fixedCategory.id) : category;
  const inScope = articles.filter(
    (a) => articleLocale(a) === locale && (activeCategoryId === "all" || String(a.categoryId) === activeCategoryId),
  );
  const q = query.trim().toLowerCase();
  const rows = inScope.filter((a) => matchesTab(a, tab) && (!q || a.title.toLowerCase().includes(q)));

  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));
  const someOnPage = pageRows.some((r) => selected.includes(r.id));
  const activeLocale = locales.find((l) => l.code === locale) ?? locales[0];
  const activeCategory = categories.find((c) => String(c.id) === activeCategoryId);
  const empty = q
    ? emptyStates.search
    : activeCategoryId !== "all" && tab === "all"
      ? emptyStates.category
      : emptyStates[tab];
  const newHref = "/dashboard/help-center/articles/new";

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
      setSelected([]);
    };
  }

  if (categorySlug && !fixedCategory) {
    return (
      <div className="flex flex-col gap-4">
        <HelpCenterHeader
          section="categories"
          description="Group the articles of your portal so readers find them by topic."
        />
        <Empty className="border border-dashed py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Shapes />
            </EmptyMedia>
            <EmptyTitle>No categories found</EmptyTitle>
            <EmptyDescription>This category was deleted or does not exist in this portal.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/help-center/categories">Back to categories</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const categoryCount = fixedCategory
    ? articles.filter((a) => a.categoryId === fixedCategory.id && articleLocale(a) === locale).length
    : 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <HelpCenterHeader
          section={fixedCategory ? "categories" : "articles"}
          description={
            fixedCategory
              ? fixedCategory.description || "Articles in this category will appear here"
              : "Write, publish and translate the articles of your self-service portal."
          }
          actions={
            <>
              {fixedCategory ? (
                <Button variant="outline" size="sm" onClick={() => setEditCategory(true)}>
                  <Pencil /> Edit category
                </Button>
              ) : null}
              <Button size="sm" asChild>
                <Link href={newHref}>
                  <Plus /> New article
                </Link>
              </Button>
            </>
          }
        />

        {fixedCategory ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
            <Link href="/dashboard/help-center/categories" className="text-muted-foreground hover:text-foreground">
              Categories ({locale})
            </Link>
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <span className="font-medium">
              {fixedCategory.icon} {fixedCategory.name} ({categoryCount} {categoryCount === 1 ? "article" : "articles"})
            </span>
          </nav>
        ) : null}

        <Card>
          <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
            <CardTitle className="text-xl leading-none">
              {fixedCategory ? fixedCategory.name : tabs.find((t) => t.value === tab)?.label}
            </CardTitle>
            <CardDescription className="max-w-sm leading-snug">
              Articles in {activeLocale?.name}
              {activeCategory && !fixedCategory ? ` · ${activeCategory.name}` : ""}
            </CardDescription>
            <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
              <ExpandingSearch
                name="articles"
                label="Search articles"
                placeholder="Search articles..."
                className="w-full md:w-64"
                value={query}
                onChange={resetPage(setQuery)}
              />
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 px-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4">
              <div className="flex flex-wrap items-center gap-3">
                <SearchChip
                  label="Locale"
                  value={locale}
                  onChange={resetPage(setLocale)}
                  options={locales.map((l) => ({ value: l.code, label: `${l.name} (${l.code})` }))}
                />
                {fixedCategory ? null : (
                  <SearchChip
                    label="Category"
                    value={category}
                    onChange={resetPage(setCategory)}
                    options={[
                      { value: "all", label: "All categories" },
                      ...categories.map((c) => ({ value: String(c.id), label: c.name, icon: c.icon })),
                    ]}
                  />
                )}
              </div>
              <Tabs value={tab} onValueChange={(v) => resetPage(setTab)(v as Tab)}>
                <TabsList className="h-auto flex-wrap">
                  {tabs.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="px-1.5 sm:px-2.5">
                      {t.label}
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {inScope.filter((a) => matchesTab(a, t.value)).length}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {selected.length ? (
              <div className="mx-4 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2">
                <span className="font-medium text-sm tabular-nums">{selected.length} selected</span>
                <Button variant="link" size="sm" className="px-1" onClick={() => setSelected(rows.map((r) => r.id))}>
                  Select all ({rows.length})
                </Button>
                <Button variant="link" size="sm" className="px-1 text-muted-foreground" onClick={() => setSelected([])}>
                  <X /> Clear selection
                </Button>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {statusActions.map((action) => (
                    <Button
                      key={action.status}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        applyStatus(selected, action.status, articles);
                        setSelected([]);
                      }}
                    >
                      <action.icon /> {action.label}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "translate", ids: selected })}>
                    <Languages /> Translate
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Shapes /> Category <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Move to category</DropdownMenuLabel>
                      {categories.map((c) => (
                        <DropdownMenuItem
                          key={c.id}
                          onSelect={() => {
                            hc.moveArticles(selected, c.id);
                            toast.success("Articles moved successfully");
                            setSelected([]);
                          }}
                        >
                          <span>{c.icon}</span> {c.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDialog({ kind: "delete", ids: selected })}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="px-4 text-muted-foreground text-sm tabular-nums">0 selected</div>
            )}

            {pageRows.length ? (
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader className="[&_tr]:border-t">
                  <TableRow>
                    <TableHead className="w-10 py-4 font-normal">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          aria-label="Select all articles"
                          checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                          onCheckedChange={(checked) =>
                            setSelected((prev) =>
                              checked
                                ? Array.from(new Set([...prev, ...pageRows.map((r) => r.id)]))
                                : prev.filter((id) => !pageRows.some((r) => r.id === id)),
                            )
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-64 py-4 font-normal">Article</TableHead>
                    <TableHead className="py-4 font-normal">Author</TableHead>
                    <TableHead className="py-4 font-normal">Status</TableHead>
                    <TableHead className="py-4 text-right font-normal">Views</TableHead>
                    <TableHead className="py-4 font-normal">Last updated</TableHead>
                    <TableHead className="sticky right-0 bg-card py-4 font-normal">
                      <div className="text-right">Actions</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((article) => {
                    const author = authors.find((a) => a.id === article.authorId);
                    const cat = categories.find((c) => c.id === article.categoryId);
                    return (
                      <TableRow
                        key={article.id}
                        className="border-border/60"
                        data-state={selected.includes(article.id) ? "selected" : undefined}
                      >
                        <TableCell className="py-4 align-middle">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              aria-label={`Select ${article.title}`}
                              checked={selected.includes(article.id)}
                              onCheckedChange={(checked) => toggle(article.id, checked === true)}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[26rem] py-4 align-middle">
                          <div className="grid min-w-0 gap-0.5">
                            <Link
                              href={`/dashboard/help-center/articles/${article.id}`}
                              dir="auto"
                              className="truncate font-medium text-foreground text-sm underline-offset-2 hover:underline"
                            >
                              {article.title}
                            </Link>
                            <span className="flex items-center gap-1 text-muted-foreground text-xs">
                              {cat ? <span>{cat.icon}</span> : <Shapes className="size-3" />}
                              <span className="truncate">{cat?.name ?? "Uncategorised"}</span>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle text-sm">
                          <PersonChip name={author?.name ?? "-"} />
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ArticleStatusBadge status={article.status} />
                            {article.pendingEdits ? <PendingEditsBadge /> : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-right align-middle">
                          <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                            <Eye className="size-3.5 text-muted-foreground" />
                            {article.views.toLocaleString("en-US")}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-4 align-middle text-sm">{article.updated}</TableCell>
                        <TableCell className="sticky right-0 bg-card py-4 align-middle [tr[data-state=selected]>&]:bg-muted">
                          <div className="text-right">
                            <RowActions
                              article={article}
                              onDelete={() => setDialog({ kind: "delete", ids: [article.id] })}
                              onTranslate={() => setDialog({ kind: "translate", ids: [article.id] })}
                            />
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
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>{empty.title}</EmptyTitle>
                    <EmptyDescription>{empty.subtitle}</EmptyDescription>
                  </EmptyHeader>
                  {tab === "all" && !q ? (
                    <EmptyContent>
                      <Button size="sm" asChild>
                        <Link href={newHref}>
                          <Plus /> New article
                        </Link>
                      </Button>
                    </EmptyContent>
                  ) : null}
                </Empty>
              </div>
            )}

            <Separator />
            <TableFooter
              page={current}
              pageCount={pageCount}
              pageSize={pageSize}
              total={rows.length}
              noun="articles"
              onPage={setPage}
              onPageSize={(size) => {
                setPageSize(size);
                setPage(0);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <DeleteArticlesDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={dialog?.ids ?? []}
        onDone={() => setSelected([])}
      />
      <BulkTranslateDialog
        open={dialog?.kind === "translate"}
        onOpenChange={(open) => !open && setDialog(null)}
        ids={dialog?.ids ?? []}
        onDone={() => setSelected([])}
      />
      {fixedCategory ? (
        <CategoryDialog
          open={editCategory}
          onOpenChange={setEditCategory}
          category={fixedCategory}
          localeCode={locale}
        />
      ) : null}
    </>
  );
}
