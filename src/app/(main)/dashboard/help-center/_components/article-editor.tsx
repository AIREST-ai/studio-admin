"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  Archive,
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  Code,
  FilePen,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Shapes,
  SlidersHorizontal,
  Strikethrough,
  Table,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";

import { articles, authors, categories, currentUserId, sampleArticleBody, statusLabel } from "./data";

const toolbar = [
  { icon: Bold, label: "Bold" },
  { icon: Italic, label: "Italic" },
  { icon: Strikethrough, label: "Strikethrough" },
  { icon: Link2, label: "Link" },
  null,
  { icon: Heading1, label: "Heading 1" },
  { icon: Heading2, label: "Heading 2" },
  { icon: Heading3, label: "Heading 3" },
  null,
  { icon: List, label: "Bulleted list" },
  { icon: ListOrdered, label: "Numbered list" },
  { icon: Quote, label: "Quote" },
  { icon: Code, label: "Code" },
  null,
  { icon: ImageIcon, label: "Upload image" },
  { icon: Table, label: "Table" },
];

export function ArticleEditor({ articleId }: { articleId?: number }) {
  const article = articles.find((a) => a.id === articleId);
  const isNew = !article;
  const [author, setAuthor] = React.useState(String(article?.authorId ?? currentUserId));
  const [category, setCategory] = React.useState(String(article?.categoryId ?? ""));
  const selectedAuthor = authors.find((a) => String(a.id) === author);
  const selectedCategory = categories.find((c) => String(c.id) === category);

  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/help-center">
            <ArrowLeft /> Back to articles
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {article?.pendingEdits ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 font-medium text-muted-foreground text-xs">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Pending changes
            </span>
          ) : null}
          {!isNew ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
              <Check className="size-3.5" /> Saved
            </span>
          ) : null}
          <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
          <Button variant="outline" size="sm" disabled={isNew}>
            Preview
          </Button>
          <ButtonGroup>
            <Button size="sm" disabled={isNew}>
              {article?.pendingEdits ? "Publish changes" : "Publish"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" disabled={isNew} aria-label="More status options">
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem>
                  <FilePen /> Draft
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive /> Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 px-6 md:px-10">
        <Textarea
          defaultValue={article?.title ?? ""}
          placeholder="Title"
          rows={1}
          className="min-h-0 resize-none border-0 px-0 font-semibold text-3xl shadow-none focus-visible:ring-0 md:text-3xl dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="-ml-2 font-normal">
                <Avatar className="size-5">
                  <AvatarFallback className="text-[9px]">{getInitials(selectedAuthor?.name ?? "-")}</AvatarFallback>
                </Avatar>
                {selectedAuthor?.name ?? "-"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Author</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={author} onValueChange={setAuthor}>
                {authors.map((a) => (
                  <DropdownMenuRadioItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-3 data-[orientation=vertical]:h-3" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="font-normal">
                {selectedCategory ? <span>{selectedCategory.icon}</span> : <Shapes />}
                {selectedCategory?.name ?? "Uncategorized"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={category} onValueChange={setCategory}>
                {categories.map((c) => (
                  <DropdownMenuRadioItem key={c.id} value={String(c.id)}>
                    <span>{c.icon}</span> {c.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-3 data-[orientation=vertical]:h-3" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="font-normal" disabled={isNew}>
                <SlidersHorizontal /> More properties
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96">
              <div className="grid gap-4">
                <span className="font-medium text-sm">Article properties</span>
                <div className="grid gap-1.5">
                  <Label>Meta title</Label>
                  <Input placeholder="Add meta title" defaultValue={article?.title} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Meta description</Label>
                  <Textarea placeholder="Add meta description" className="min-h-20" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Meta tags</Label>
                  <Input placeholder="Add meta tags" defaultValue="booking, appointment, app" />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {article ? (
            <span
              className={cn(
                "ml-auto inline-flex h-6 items-center rounded-md bg-muted px-2 font-medium text-muted-foreground text-xs",
              )}
            >
              {statusLabel[article.status]}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/40 p-1">
          {toolbar.map((item, index) =>
            item ? (
              <Button key={item.label} variant="ghost" size="icon-sm" aria-label={item.label}>
                <item.icon />
              </Button>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: static separators
              <Separator key={index} orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
            ),
          )}
        </div>

        {isNew ? (
          <Textarea
            placeholder="Write your content here. Type '/' for formatting options."
            className="min-h-80 resize-none border-0 px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        ) : (
          <div
            contentEditable
            suppressContentEditableWarning
            className="min-h-80 space-y-4 pb-10 text-[0.95rem] leading-7 outline-none"
          >
            <p>{sampleArticleBody[0]}</p>
            <h2 className="font-semibold text-xl">{sampleArticleBody[1]}</h2>
            <ol className="list-decimal space-y-1 pl-6">
              {sampleArticleBody[2].split("\n").map((line) => (
                <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
            <blockquote className="border-l-2 pl-4 text-muted-foreground">{sampleArticleBody[3]}</blockquote>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
