"use client";

// T-285 (Fahad 125.4): a search is a lens only; a click opens the box in its place, and closing it (×, Escape, or
// leaving it empty) brings back the lens alone. A box that still holds text stays open, so a search that narrows a
// list is never hidden while it is on. Used by the page searches; the header's site search does the same with its
// own command field (header/search-dialog.tsx).
import * as React from "react";

import { cn } from "cn";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function ExpandingSearch({
  value,
  onChange,
  label,
  placeholder = "Search…",
  name,
  className,
  size = "sm",
  variant = "outline",
  end,
  onKeyDown,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  /** What the lens and the box are called for screen readers ("Search contacts"). */
  label: string;
  placeholder?: string;
  /** Marks the lens and the box as data-<name>-search-trigger / data-<name>-search-input. */
  name: string;
  /** Width and placement of the open box. */
  className?: string;
  /** sm sits with h-7 toolbar buttons, default with h-8 ones. */
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
  /** Buttons kept at the end of the open box. */
  end?: React.ReactNode;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** F-13 round 2: data-testid of the open box (the lens gets `<testId>-lens`), for a search that had one. */
  testId?: string;
}) {
  const [open, setOpen] = React.useState(Boolean(value));
  const group = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const shown = open || Boolean(value);

  const close = () => {
    onChange("");
    setOpen(false);
  };

  if (!shown) {
    return (
      <Button
        variant={variant}
        size={size === "sm" ? "icon-sm" : "icon"}
        aria-label={label}
        title={label}
        data-testid={testId ? `${testId}-lens` : undefined}
        {...{ [`data-${name}-search-trigger`]: "" }}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
      >
        <Search />
      </Button>
    );
  }

  return (
    <InputGroup
      ref={group}
      className={cn(size === "sm" ? "h-7" : "h-8", className)}
      onBlur={(event) => {
        // Leaving the box (not moving to its own × or end buttons) with nothing typed closes it.
        if (!group.current?.contains(event.relatedTarget as Node | null) && !input.current?.value) setOpen(false);
      }}
    >
      <InputGroupAddon align="inline-start">
        <Search className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        ref={input}
        autoFocus
        aria-label={label}
        className={size === "sm" ? "h-7" : "h-8 text-sm"}
        placeholder={placeholder}
        value={value}
        data-testid={testId}
        {...{ [`data-${name}-search-input`]: "" }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        {end}
        <Button variant="ghost" size="icon-xs" aria-label="Close search" title="Close search" onClick={close}>
          <X />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
