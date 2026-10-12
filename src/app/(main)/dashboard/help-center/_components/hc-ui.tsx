"use client";
// Small Studio pieces shared by the Help Center pages: status badges (same look as contacts/_components/studio-ui.tsx
// StatusBadge), the chip select of the Contacts card and the table footer with rows-per-page + pagination.
import * as React from "react";

import { cn } from "cn";
import { Check, ChevronDown } from "lucide-react";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import type { ArticleStatus } from "./data";

export const tone = {
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  muted: "border-border bg-muted/50 text-muted-foreground",
  red: "border-destructive/20 bg-destructive/10 text-destructive",
} as const;

export function ToneBadge({
  color,
  children,
  dot = true,
  className,
}: {
  color: keyof typeof tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border px-2 py-1 font-medium", tone[color], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </Badge>
  );
}

const statusColor: Record<ArticleStatus, keyof typeof tone> = { published: "green", draft: "amber", archived: "muted" };
const statusText: Record<ArticleStatus, string> = { published: "Published", draft: "Draft", archived: "Archived" };

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  return <ToneBadge color={statusColor[status]}>{statusText[status]}</ToneBadge>;
}

export function PendingEditsBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge variant="outline" className={cn("gap-1.5 border px-2 py-1 font-medium", tone.muted)}>
            <span className="size-1.5 rounded-full bg-amber-500" />
            Unpublished edits
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>This published article has unpublished edits</TooltipContent>
    </Tooltip>
  );
}

export function PersonChip({ name, size = "sm" }: { name: string; size?: "xs" | "sm" }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className={cn("font-medium", size === "xs" ? "size-5" : "size-7", personToneClass(name))}>
        <AvatarFallback className={size === "xs" ? "text-[9px]" : "text-[11px]"}>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function ChipSelect({
  label,
  value,
  options,
  onChange,
  align = "start",
}: {
  label: string;
  value: string;
  options: { value: string; label: React.ReactNode }[];
  onChange: (value: string) => void;
  align?: "start" | "end";
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align={align}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function TableFooter({
  page,
  pageCount,
  pageSize,
  total,
  noun,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const start = total ? page * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize + pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4">
      <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select value={`${pageSize}`} onValueChange={(value) => onPageSize(Number(value))}>
            <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {[5, 10, 25, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <span className="tabular-nums">
          Showing {start} - {end} of {total} {noun}
        </span>
      </div>
      <Pagination className="mx-0 w-auto justify-start md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text=""
              aria-disabled={page === 0}
              className={page === 0 ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onPage(page - 1);
              }}
            />
          </PaginationItem>
          {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={i === page}
                onClick={(event) => {
                  event.preventDefault();
                  onPage(i);
                }}
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              text=""
              aria-disabled={page >= pageCount - 1}
              className={page >= pageCount - 1 ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onPage(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

/** Searchable filter chip, for Chatwoot's searchable locale and category dropdowns (ArticleHeaderControls.vue). */
export function SearchChip({
  label,
  value,
  options,
  onChange,
  placeholder = "Search...",
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const current = options.find((o) => o.value === value);
  const shown = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-64 font-normal" aria-label={label}>
          <span className="text-muted-foreground">{label}:</span>
          {current?.icon ? <span>{current.icon}</span> : null}
          <span className="truncate">{current?.label}</span>
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <Input
          autoFocus
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-1 h-8"
        />
        <div className="max-h-64 overflow-y-auto">
          {shown.length ? (
            shown.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
              >
                {o.icon ? <span>{o.icon}</span> : null}
                <span className="truncate">{o.label}</span>
                {o.value === value ? <Check className="ml-auto size-4" /> : null}
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-center text-muted-foreground text-sm">No matching results</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
