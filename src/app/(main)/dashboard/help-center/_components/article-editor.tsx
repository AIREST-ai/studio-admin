"use client";
// Chatwoot ArticleEditorPage (components-next/HelpCenter/Pages/ArticleEditorPage): ArticleEditorHeader (back,
// pending changes + diff, Saving.../Saved, Preview, Publish split button), ArticlePendingChangesPopover,
// ArticleEditorControls (author, category, More properties), ArticleEditorProperties and the editor itself.
// Studio pattern: big title outside the card, subtitle, actions on the right, editor inside a card.
// New articles are created on the first title (as Chatwoot does) and the URL moves to /articles/[id].
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Eye,
  FilePen,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Shapes,
  SlidersHorizontal,
  Strikethrough,
  Table,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { type Article, type ArticleStatus, authors, type Category, currentUserId, sampleArticleBody } from "./data";
import { articleLocale, hc, useActivePortal, useHelpCenter } from "./hc-store";
import { ArticleStatusBadge, PersonChip, SearchChip } from "./hc-ui";
import { ArticleDiffDialog } from "./help-center-dialogs";

type ToolbarItem = { icon: typeof Bold; label: string; run: () => void } | null;

function format(command: string, value?: string) {
  document.execCommand(command, false, value);
}

// ARTICLE_EDITOR_STATUS_OPTIONS in portalHelper.js
const editorStatusOptions: Record<ArticleStatus, ArticleStatus[]> = {
  published: ["archived", "draft"],
  archived: ["draft"],
  draft: ["archived"],
};
const statusMenu: Record<ArticleStatus, { label: string; icon: typeof FilePen }> = {
  published: { label: "Publish", icon: Check },
  draft: { label: "Draft", icon: FilePen },
  archived: { label: "Archive", icon: Archive },
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Mock body of an article: the sample guide for article 1, a short guide built from the title for the others. */
function bodyParagraphs(article: Article | undefined, category: Category | undefined): string[] {
  if (!article) return [];
  if (article.body) return article.body;
  if (article.id === 1) return sampleArticleBody;
  const topic = category?.name.toLowerCase() ?? "your workspace";
  return [
    `This guide explains ${article.title.toLowerCase()} step by step. It is part of ${topic} and takes a few minutes.`,
    "Steps",
    "1. Open Settings from the left sidebar.\n2. Choose the section named in this guide.\n3. Make your change and click Save changes.",
    "Still stuck? Reply to any of our emails or start a chat from the help center and our team will help you.",
  ];
}

function bodyHtml(lines: string[]) {
  if (!lines.length) return "";
  const [intro, heading, steps, note] = lines;
  const items = (steps ?? "")
    .split("\n")
    .map((l) => `<li>${escapeHtml(l.replace(/^\d+\.\s*/, ""))}</li>`)
    .join("");
  return `<p>${escapeHtml(intro)}</p><h2>${escapeHtml(heading)}</h2><ol>${items}</ol><blockquote>${escapeHtml(note ?? "")}</blockquote>`;
}

function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = React.useState("");
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/30">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={value.length ? "" : "Add meta tags"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            if (!value.includes(draft.trim())) onChange([...value, draft.trim()]);
            setDraft("");
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

export function ArticleEditor({ articleId }: { articleId?: number }) {
  const router = useRouter();
  const portal = useActivePortal();
  const { articles, categories, locales } = useHelpCenter();
  const article = articles.find((a) => a.id === articleId);
  const isNew = articleId === undefined;
  const category = categories.find((c) => c.id === article?.categoryId);

  const [title, setTitle] = React.useState(article?.title ?? "");
  const [authorId, setAuthorId] = React.useState(article?.authorId ?? currentUserId);
  const [categoryId, setCategoryId] = React.useState<number | null>(article?.categoryId ?? null);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">(isNew ? "idle" : "saved");
  const [metaTitle, setMetaTitle] = React.useState(article?.title ?? "");
  const [metaDescription, setMetaDescription] = React.useState(article?.metaDescription ?? "");
  const [metaTags, setMetaTags] = React.useState<string[]>(article?.metaTags ?? []);
  const [propsOpen, setPropsOpen] = React.useState(false);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<ArticleStatus | null>(null);
  const [isEmpty, setIsEmpty] = React.useState(true);
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const createTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const liveBody = React.useMemo(() => bodyParagraphs(article, category), [article?.id, category?.id]);

  // Fill the editor once per article (contentEditable keeps its own DOM after that).
  React.useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = bodyHtml(liveBody);
    setIsEmpty(!liveBody.length);
    // biome-ignore lint/correctness/useExhaustiveDependencies: only when the article changes
  }, [article?.id]);

  React.useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(createTimer.current);
    },
    [],
  );

  if (!isNew && !article) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Article not found" subtitle="This article was deleted or never existed in this portal." />
        <Empty className="border border-dashed py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Article not found</EmptyTitle>
            <EmptyDescription>Go back to the articles list to pick another article.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/help-center">
                <ArrowLeft /> Back to articles
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const status = article?.status ?? "draft";
  const hasPendingChanges = status === "published" && Boolean(article?.pendingEdits);
  const author = authors.find((a) => a.id === authorId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const rtl = article ? ["ar", "ur", "fa"].includes(articleLocale(article)) : false;
  const localeName = locales.find((l) => l.code === (article ? articleLocale(article) : "en"))?.name ?? "English";

  // Autosave: every edit shows Saving... then Saved; a published article keeps its live version and gets
  // "Pending changes" until Publish changes (Chatwoot v4.18 drafts of published articles).
  function touch(patch: Partial<Article> = {}) {
    if (isNew) {
      clearTimeout(createTimer.current);
      const nextTitle = patch.title ?? title;
      if (!nextTitle.trim()) return;
      setSaveState("saving");
      createTimer.current = setTimeout(() => {
        const id = hc.createArticle({
          title: nextTitle.trim(),
          status: "draft",
          authorId,
          categoryId,
          locale: "en",
        });
        router.replace(`/dashboard/help-center/articles/${id}`);
      }, 900);
      return;
    }
    if (!article) return;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const pending =
        article.status === "published"
          ? { pendingEdits: true, liveTitle: article.liveTitle ?? article.title }
          : {};
      hc.updateArticle(article.id, { ...pending, ...patch });
      setSaveState("saved");
    }, 700);
  }

  function changeStatus(next: ArticleStatus) {
    if (!article) return;
    if (hasPendingChanges && next !== "published") {
      setPendingStatus(next);
      return;
    }
    hc.setStatus([article.id], next);
    toast.success(
      next === "published"
        ? hasPendingChanges
          ? "Changes published successfully"
          : "Article published successfully"
        : next === "archived"
          ? "Article archived successfully"
          : "Article set to draft successfully",
    );
  }

  function discardChanges() {
    if (!article) return;
    const liveTitle = article.liveTitle ?? article.title;
    hc.updateArticle(article.id, { pendingEdits: false, title: liveTitle, liveTitle: undefined });
    setTitle(liveTitle);
    if (editorRef.current) editorRef.current.innerHTML = bodyHtml(liveBody);
    toast.success("Changes discarded");
  }

  function resolvePending(apply: boolean) {
    if (!article || !pendingStatus) return;
    if (!apply) discardChanges();
    hc.setStatus([article.id], pendingStatus);
    toast.success(apply ? "Changes published successfully" : "Changes discarded");
    setPendingStatus(null);
  }

  const toolbar: ToolbarItem[] = [
    { icon: Bold, label: "Bold", run: () => format("bold") },
    { icon: Italic, label: "Italic", run: () => format("italic") },
    { icon: Strikethrough, label: "Strikethrough", run: () => format("strikeThrough") },
    {
      icon: Link2,
      label: "Link",
      run: () => {
        const url = window.prompt("Link URL", "https://");
        if (url) format("createLink", url);
      },
    },
    null,
    { icon: Heading1, label: "Heading 1", run: () => format("formatBlock", "h1") },
    { icon: Heading2, label: "Heading 2", run: () => format("formatBlock", "h2") },
    { icon: Heading3, label: "Heading 3", run: () => format("formatBlock", "h3") },
    null,
    { icon: List, label: "Bulleted list", run: () => format("insertUnorderedList") },
    { icon: ListOrdered, label: "Numbered list", run: () => format("insertOrderedList") },
    { icon: Quote, label: "Quote", run: () => format("formatBlock", "blockquote") },
    { icon: Code, label: "Code", run: () => format("formatBlock", "pre") },
    null,
    { icon: ImageIcon, label: "Upload image", run: () => fileRef.current?.click() },
    {
      icon: Table,
      label: "Table",
      run: () =>
        format(
          "insertHTML",
          "<table><tbody><tr><th>Plan</th><th>Price</th></tr><tr><td>Starter</td><td>$19</td></tr></tbody></table><p></p>",
        ),
    },
  ];

  const draftBody = editorRef.current
    ? Array.from(editorRef.current.children).map((el) => (el as HTMLElement).innerText)
    : liveBody;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
        <Link href="/dashboard/help-center">
          <ArrowLeft /> Back to articles
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title={isNew ? "New article" : "Edit article"}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {portal?.name} · {localeName}
              </span>
              {article ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Eye className="size-3.5" />
                    {article.views.toLocaleString("en-US")} {article.views === 1 ? "view" : "views"}
                  </span>
                  <span aria-hidden>·</span>
                  <span>Updated {article.updated}</span>
                </>
              ) : null}
            </span>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          {hasPendingChanges ? (
            <Button
              variant="outline"
              size="sm"
              title="View unpublished changes"
              onClick={() => setDiffOpen(true)}
              className="border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
            >
              <span className="size-1.5 rounded-full bg-amber-500" />
              Pending changes
            </Button>
          ) : null}
          {saveState !== "idle" ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
              {saveState === "saving" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" /> Saved
                </>
              )}
            </span>
          ) : null}
          <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
          {isNew || !article ? (
            <Button variant="outline" size="sm" disabled>
              <ArrowUpRight /> Preview
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://${portal?.customDomain || "help.weblabs.studio"}/${articleLocale(article)}/articles/${article.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <ArrowUpRight /> Preview
              </a>
            </Button>
          )}
          <div className="relative">
            <ButtonGroup>
              <Button
                size="sm"
                disabled={isNew || (status === "published" && !hasPendingChanges)}
                onClick={() => changeStatus("published")}
              >
                {hasPendingChanges ? "Publish changes" : "Publish"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" disabled={isNew} aria-label="More status options">
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {editorStatusOptions[status].map((option) => {
                    const item = statusMenu[option];
                    return (
                      <DropdownMenuItem key={option} onSelect={() => changeStatus(option)}>
                        <item.icon /> {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                  {hasPendingChanges ? (
                    <DropdownMenuItem onSelect={discardChanges}>
                      <Undo2 /> Discard changes
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
            {pendingStatus ? (
              <div className="absolute end-0 top-full z-50 mt-2 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-xl border bg-popover p-4 shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid gap-1">
                    <h3 className="font-medium text-base">Unpublished changes</h3>
                    <p className="text-muted-foreground text-sm">
                      This article has draft changes that aren&apos;t live yet. Apply them before changing the status,
                      or discard them?
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={() => setPendingStatus(null)}>
                    <X />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => resolvePending(false)}
                  >
                    Discard changes
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => resolvePending(true)}>
                    Apply changes
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Card className="w-full">
        <CardContent className="grid gap-4 px-6 md:px-10">
          <Textarea
            value={title}
            dir={rtl ? "rtl" : "auto"}
            onChange={(e) => {
              setTitle(e.target.value);
              touch({ title: e.target.value });
            }}
            placeholder="Title"
            rows={1}
            aria-label="Title"
            className="field-sizing-content min-h-0 resize-none border-0 px-0 font-semibold text-3xl shadow-none focus-visible:ring-0 md:text-3xl dark:bg-transparent"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <SearchChip
              label="Author"
              value={String(authorId)}
              onChange={(v) => {
                setAuthorId(Number(v));
                touch({ authorId: Number(v) });
              }}
              options={authors.map((a) => ({ value: String(a.id), label: a.name }))}
            />
            <SearchChip
              label="Category"
              value={categoryId === null ? "none" : String(categoryId)}
              onChange={(v) => {
                const next = v === "none" ? null : Number(v);
                setCategoryId(next);
                touch({ categoryId: next });
              }}
              options={[
                { value: "none", label: "Uncategorized" },
                ...categories.map((c) => ({ value: String(c.id), label: c.name, icon: c.icon })),
              ]}
            />
            <Popover open={propsOpen} onOpenChange={setPropsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="font-normal" disabled={isNew}>
                  <SlidersHorizontal /> More properties
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)]">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Article properties</span>
                    <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={() => setPropsOpen(false)}>
                      <X />
                    </Button>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="meta-description">Meta description</Label>
                    <Textarea
                      id="meta-description"
                      placeholder="Add meta description"
                      className="min-h-20"
                      value={metaDescription}
                      onChange={(e) => {
                        setMetaDescription(e.target.value);
                        touch({ metaDescription: e.target.value });
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="meta-title">Meta title</Label>
                    <Input
                      id="meta-title"
                      placeholder="Add meta title"
                      value={metaTitle}
                      onChange={(e) => {
                        setMetaTitle(e.target.value);
                        touch();
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Meta tags</Label>
                    <TagInput
                      value={metaTags}
                      onChange={(tags) => {
                        setMetaTags(tags);
                        touch({ metaTags: tags });
                      }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {article ? (
              <span className="ml-auto">
                <ArticleStatusBadge status={article.status} />
              </span>
            ) : null}
          </div>

          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/60 p-1 backdrop-blur">
            {toolbar.map((item, index) =>
              item ? (
                <Button
                  key={item.label}
                  variant="ghost"
                  size="icon-sm"
                  aria-label={item.label}
                  title={item.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editorRef.current?.focus();
                    item.run();
                    touch();
                  }}
                >
                  <item.icon />
                </Button>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: static separators
                <Separator key={index} orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
              ),
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                editorRef.current?.focus();
                format("insertImage", URL.createObjectURL(file));
                touch();
                e.target.value = "";
              }}
            />
          </div>

          <div className="relative">
            {isEmpty ? (
              <span className="pointer-events-none absolute start-0 top-0 text-base text-muted-foreground">
                Write your content here. Type &apos;/&apos; for formatting options.
              </span>
            ) : null}
            <div
              ref={editorRef}
              dir={rtl ? "rtl" : undefined}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Article content"
              tabIndex={0}
              onInput={(e) => {
                setIsEmpty(!(e.currentTarget.textContent ?? "").trim() && !e.currentTarget.querySelector("img"));
                touch();
              }}
              className={cn(
                "min-h-80 pb-10 text-[0.95rem] leading-7 outline-none",
                "[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h1]:font-semibold [&_h1]:text-2xl [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:font-semibold [&_h3]:text-lg [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/60 [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6 [&>*+*]:mt-4",
              )}
            />
          </div>
          {author ? (
            <div className="flex items-center gap-2 border-t pt-4 text-muted-foreground text-xs">
              Written by <PersonChip name={author.name} size="xs" />
              {selectedCategory ? (
                <span className="inline-flex items-center gap-1">
                  in {selectedCategory.icon} {selectedCategory.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Shapes className="size-3" /> Uncategorized
                </span>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {article ? (
        <ArticleDiffDialog
          open={diffOpen}
          onOpenChange={setDiffOpen}
          liveTitle={article.liveTitle ?? article.title}
          draftTitle={title}
          liveBody={liveBody.flatMap((l) => l.split("\n"))}
          draftBody={draftBody.flatMap((l) => l.split("\n"))}
        />
      ) : null}
    </div>
  );
}
