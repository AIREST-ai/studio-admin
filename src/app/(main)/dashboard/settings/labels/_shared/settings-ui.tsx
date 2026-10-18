"use client";
// F159 settings-b: small Studio parts shared by Labels, Attributes, Canned, Automation, Macros, Workflow, Templates, SLA.
// Copied from contacts/_components/contacts-list.tsx (RowActions "…" menu, ChipSelect filter chips).
import type * as React from "react";

import { cn } from "cn";
import { ChevronDown, MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface RowMenuItem {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

/** One "…" button per row, as on Contacts and Users & Roles, instead of stacked icon buttons. */
export function RowMenu({ name, items }: { name: string; items: RowMenuItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${name}`}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {items.map((item) => (
          <MenuEntry key={item.label} item={item} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuEntry({ item }: { item: RowMenuItem }) {
  const Icon = item.icon;
  return (
    <>
      {item.separatorBefore ? <DropdownMenuSeparator /> : null}
      <DropdownMenuItem variant={item.destructive ? "destructive" : "default"} onSelect={item.onSelect}>
        {Icon ? <Icon /> : null}
        {item.label}
      </DropdownMenuItem>
    </>
  );
}

/** "Label: Value" filter chip, copied from Contacts. */
export function ChipSelect({
  label,
  value,
  options,
  onChange,
  align = "start",
}: {
  label: string;
  value: string;
  options: string[];
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
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Row of filter chips inside the card, above the table (Contacts pattern). */
export function ChipBar({ children, end }: { children: React.ReactNode; end?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {end ? <div className="flex flex-wrap items-center gap-3">{end}</div> : null}
    </div>
  );
}

const tones = {
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "border-destructive/20 bg-destructive/10 text-destructive",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  teal: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  pink: "border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400",
  gray: "border-border bg-muted/50 text-muted-foreground",
} as const;

export type Tone = keyof typeof tones;

/** Coloured badge with a dot, same as StatusBadge on Contacts. B-3: light and standard, not a heavy pill. */
export function ToneBadge({ tone, children, dot = true }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <Badge variant="outline" className={cn("h-4.5 gap-1 border px-1.5 py-0 text-[10px] font-normal", tones[tone])}>
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </Badge>
  );
}

/** Small red line under a field that failed validation. */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <span className="text-destructive text-xs">{children}</span>;
}

/** Table classes used by every list in this group. */
export const tableClass = "**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6";

/** Multi-select with checkboxes in a popover (Chatwoot's multiselect for labels, teams, inboxes). */
export function MultiPick({
  options,
  value,
  onChange,
  placeholder = "Select",
  invalid,
  className,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-invalid={invalid}
          className={cn("h-9 w-full justify-between gap-2 font-normal", className)}
        >
          <span className={cn("flex min-w-0 flex-1 gap-1 overflow-hidden", !value.length && "text-muted-foreground")}>
            {value.length
              ? value.map((v) => (
                  <Badge key={v} variant="secondary" className="shrink-0">
                    {v}
                  </Badge>
                ))
              : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <div className="grid max-h-64 overflow-y-auto">
          {options.map((option) => {
            const checked = value.includes(option);
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => onChange(c ? [...value, option] : value.filter((v) => v !== option))}
                />
                {option}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
