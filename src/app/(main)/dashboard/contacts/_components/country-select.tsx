"use client";

// T-285 (Fahad 125.9): the country field lists every country with a search inside it, and keeps the size of the
// select it replaces (h-8, or h-7 for size="sm" in the Filter rows). Used by the contact form (Add contact, the
// row's edit form, the contact page) and the Filter's Country value.
import * as React from "react";

import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { countries } from "./data";

export function CountrySelect({
  value,
  onChange,
  placeholder = "Select country",
  size = "default",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // A stored country outside the list (an import) still shows and stays selectable.
  const options = value && !countries.includes(value) ? [value, ...countries] : countries;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Country"
          data-country-select=""
          className={cn(
            "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent pr-2.5 pl-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            size === "sm" && "h-7 rounded-[min(var(--radius-md),10px)]",
            className,
          )}
        >
          <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
        <Command>
          <CommandInput placeholder="Search country" data-country-search="" />
          <CommandList className="max-h-64">
            <CommandEmpty>No country found</CommandEmpty>
            <CommandGroup>
              {options.map((country) => (
                <CommandItem
                  key={country}
                  value={country}
                  data-checked={country === value}
                  data-country-option=""
                  onSelect={() => {
                    onChange(country);
                    setOpen(false);
                  }}
                >
                  {country}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
