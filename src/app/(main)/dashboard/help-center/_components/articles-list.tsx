"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Eye,
  FilePen,
  FileText,
  Languages,
  Plus,
  Search,
  Send,
  Shapes,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";

import {
  type Article,
  articles,
  authorOf,
  categories,
  categoryOf,
  currentUserId,
  locales,
  statusLabel,
  statusTone,
} from "./data";
import { BulkTranslateDialog, DeleteArticlesDialog } from "./help-center-dialogs";
import { PortalTitle } from "./portal-title";

const PAGE_SIZE = 8;

type Tab = "all" | "mine" | "draft" | "published" | "archived";

const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "All articles" },
  { value: "mine", label: "Mine" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const emptyStates: Record<Tab | "search" | "category", { title: string; subtitle: string }> = {
  all: { title: "Write an article", subtitle: "Write a rich article, let’s get started!" },
  mine: {
    title: "You haven't written any articles here",
    subtitle: "All articles written by you show up here for quick access.",
  },
  draft: { title: "There are no articles in drafts", subtitle: "Draft articles will appear here" },
  published: { title: "There are no published articles", subtitle: "Published articles will appear here" },
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

function ArticleRow({
  article,
  selected,
  onToggle,
  onDelete,
  onTranslate,
}: {
  article: Article;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onTranslate: () => void;
}) {
  const author = authorOf(article);
  const category = categoryOf(article);
  return (
    <div
      className={cn(
        "group flex gap-3 rounded-xl border px-4 py-3.5 transition-colors hover:bg-muted/40",
        selected && "border-primary/40 bg-primary/5",
      )}
    >
      <Checkbox
        aria-label={`Select ${article.title}`}
        checked={selected}
        onCheckedChange={(checked) => onToggle(checked === true)}
        className="mt-1"
      />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/dashboard/help-center/articles/${article.id}`}
            className="line-clamp-1 font-medium text-[0.95rem] underline-offset-2 hover:text-primary hover:underline"
          >
            {article.title}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {article.pendingEdits ? (
              <span
                title="This published article has unpublished edits"
                className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 font-medium text-muted-foreground text-xs"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                Unpublished edits
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-md bg-muted px-2 font-medium text-xs",
                statusTone[article.status],
              )}
            >
              {statusLabel[article.status]}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Article actions">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {article.status !== "published" ? (
                  <DropdownMenuItem>
                    <Send /> Publish
                  </DropdownMenuItem>
                ) : null}
                {article.status !== "draft" ? (
                  <DropdownMenuItem>
                    <FilePen /> Draft
                  </DropdownMenuItem>
                ) : null}
                {article.status !== "archived" ? (
                  <DropdownMenuItem>
                    <Archive /> Archive
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={onTranslate}>
                  <Languages /> Translate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 text-muted-foreground text-sm">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar className="size-4">
                <AvatarFallback className="text-[8px]">{getInitials(author?.name ?? "-")}</AvatarFallback>
              </Avatar>
              <span className="truncate">{author?.name ?? "-"}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1">
              {category ? <span className="text-sm">{category.icon}</span> : <Shapes className="size-3.5" />}
              <span className="truncate">{category?.name ?? "Uncategorised"}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
              <Eye className="size-3.5" />
              {article.views.toLocaleString("en-US")} {article.views === 1 ? "view" : "views"}
            </span>
          </div>
          <span className="shrink-0">{article.updated}</span>
        </div>
      </div>
    </div>
  );
}

export function ArticlesList() {
  const [tab, setTab] = React.useState<Tab>("all");
  const [query, setQuery] = React.useState("");
  const [locale, setLocale] = React.useState("en");
  const [category, setCategory] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [dialog, setDialog] = React.useState<{ kind: "delete" | "translate"; count: number } | null>(null);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter(
      (a) =>
        matchesTab(a, tab) &&
        (category === "all" || String(a.categoryId) === category) &&
        (!q || a.title.toLowerCase().includes(q)),
    );
  }, [tab, query, category]);

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const start = rows.length ? current * PAGE_SIZE + 1 : 0;
  const end = current * PAGE_SIZE + pageRows.length;
  const activeLocale = locales.find((l) => l.code === locale) ?? locales[0];
  const activeCategory = categories.find((c) => String(c.id) === category);
  const empty = query ? emptyStates.search : category !== "all" ? emptyStates.category : emptyStates[tab];

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="self-center">
            <PortalTitle section="Articles" />
          </CardTitle>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-60">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                type="search"
                placeholder="Search articles..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </InputGroup>
            <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
            <Button size="sm" asChild>
              <Link href="/dashboard/help-center/articles/new">
                <Plus /> New article
              </Link>
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v as Tab);
                setPage(0);
                setSelected([]);
              }}
            >
              <TabsList>
                {tabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="px-2.5">
                    {t.label}
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {articles.filter((a) => matchesTab(a, t.value)).length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {activeLocale.name} <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="max-w-52">
                    {activeCategory ? <span>{activeCategory.icon}</span> : null}
                    <span className="truncate">{activeCategory?.name ?? "All categories"}</span>
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuRadioGroup
                    value={category}
                    onValueChange={(v) => {
                      setCategory(v);
                      setPage(0);
                    }}
                  >
                    <DropdownMenuRadioItem value="all">All categories</DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    {categories.map((c) => (
                      <DropdownMenuRadioItem key={c.id} value={String(c.id)}>
                        <span>{c.icon}</span> {c.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {selected.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2">
              <Checkbox
                aria-label="Select all"
                checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
                onCheckedChange={(checked) => setSelected(checked ? rows.map((r) => r.id) : [])}
              />
              <span className="font-medium text-sm tabular-nums">{selected.length} selected</span>
              <Button variant="link" size="sm" className="px-1" onClick={() => setSelected(rows.map((r) => r.id))}>
                Select all ({rows.length})
              </Button>
              <Button variant="link" size="sm" className="px-1 text-muted-foreground" onClick={() => setSelected([])}>
                Clear selection
              </Button>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                <Button variant="ghost" size="sm">
                  <Send /> Publish
                </Button>
                <Button variant="ghost" size="sm">
                  <FilePen /> Draft
                </Button>
                <Button variant="ghost" size="sm">
                  <Archive /> Archive
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialog({ kind: "translate", count: selected.length })}
                >
                  <Languages /> Translate
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Shapes /> Category <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {categories.map((c) => (
                      <DropdownMenuItem key={c.id}>
                        <span>{c.icon}</span> {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDialog({ kind: "delete", count: selected.length })}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
          ) : null}

          {pageRows.length ? (
            <div className="grid gap-2.5">
              {pageRows.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  selected={selected.includes(article.id)}
                  onToggle={(checked) => toggle(article.id, checked)}
                  onDelete={() => setDialog({ kind: "delete", count: 1 })}
                  onTranslate={() => setDialog({ kind: "translate", count: 1 })}
                />
              ))}
            </div>
          ) : (
            <Empty className="border border-dashed py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>{empty.title}</EmptyTitle>
                <EmptyDescription>{empty.subtitle}</EmptyDescription>
              </EmptyHeader>
              {tab === "all" && !query ? (
                <EmptyContent>
                  <Button size="sm" asChild>
                    <Link href="/dashboard/help-center/articles/new">
                      <Plus /> New article
                    </Link>
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          )}

          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm tabular-nums">
              Showing {start} - {end} of {rows.length} articles
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="text-sm tabular-nums">
                {current + 1} <span className="text-muted-foreground">of</span> {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeleteArticlesDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        count={dialog?.count ?? 1}
      />
      <BulkTranslateDialog
        open={dialog?.kind === "translate"}
        onOpenChange={(open) => !open && setDialog(null)}
        count={dialog?.count ?? 1}
      />
    </>
  );
}
