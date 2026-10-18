"use client";
// F159: Chatwoot Filters/v3 ActiveFilterChip + AddFilterChip (CSAT and SLA reports): "Add filter" lists the filter
// types not used yet, each with a searchable option list; an active chip shows "<Type>: <value>", opens the same
// searchable list to change it and has an x to remove it; "Clear all" removes every chip. One value per type.
import * as React from "react";

import { Check, ChevronDown, ListFilter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FilterGroup {
  key: string;
  label: string;
  placeholder: string;
  options: string[];
}

export type FilterValues = Record<string, string | undefined>;

function OptionList({ group, value, onPick }: { group: FilterGroup; value?: string; onPick: (value: string) => void }) {
  return (
    <Command>
      <CommandInput placeholder={group.placeholder} />
      <CommandList>
        <CommandEmpty>No results found</CommandEmpty>
        <CommandGroup>
          {group.options.map((o) => (
            <CommandItem key={o} value={o} onSelect={() => onPick(o)}>
              <span className="truncate">{o}</span>
              {value === o ? <Check className="ml-auto" /> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function ActiveChip({
  group,
  value,
  onChange,
  onRemove,
  joiner,
}: {
  group: FilterGroup;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  joiner?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="inline-flex h-8 items-center rounded-md border bg-muted/40 text-sm">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-full items-center gap-1 rounded-l-md pr-1 pl-2.5 hover:bg-muted"
          >
            <span className="text-muted-foreground">{group.label}</span>
            {joiner ? (
              <span className="text-muted-foreground">{joiner}</span>
            ) : (
              <span className="text-muted-foreground">:</span>
            )}
            <span className="max-w-40 truncate font-medium">{value}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-0">
          <OptionList
            group={group}
            value={value}
            onPick={(v) => {
              onChange(v);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={`Clear ${group.label}`}
        className="inline-flex h-full items-center rounded-r-md border-l px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onRemove}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function FilterBar({
  groups,
  values,
  onChange,
  joiner,
  noFilterText = "No filters available",
}: {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  joiner?: string;
  noFilterText?: string;
}) {
  const active = groups.filter((g) => values[g.key]);
  const remaining = groups.filter((g) => !values[g.key]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((g) => (
        <ActiveChip
          key={g.key}
          group={g}
          value={values[g.key] as string}
          joiner={joiner}
          onChange={(v) => onChange({ ...values, [g.key]: v })}
          onRemove={() => onChange({ ...values, [g.key]: undefined })}
        />
      ))}
      {active.length && remaining.length ? <span className="h-5 w-px bg-border" /> : null}
      {remaining.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ListFilter />
              Add filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {remaining.map((g) => (
              <DropdownMenuSub key={g.key}>
                <DropdownMenuSubTrigger>{g.label}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60 p-0">
                  {/* Keys typed in the search box stay in it (the menu's own typeahead would take them). */}
                  <div
                    role="presentation"
                    onKeyDown={(e) => {
                      if (e.key !== "Escape") e.stopPropagation();
                    }}
                  >
                    <OptionList group={g} onPick={(v) => onChange({ ...values, [g.key]: v })} />
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {!groups.length ? <span className="text-muted-foreground text-sm">{noFilterText}</span> : null}
      {active.length ? (
        <>
          <span className="h-5 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            Clear all
          </Button>
        </>
      ) : null}
    </div>
  );
}
