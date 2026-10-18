"use client";
import * as React from "react";

import { cn } from "cn";
import { Check, ChevronsUpDown, Copy, ExternalLink, Search, X } from "lucide-react";
import { toast } from "sonner";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getInitials } from "@/lib/utils";

import { useAgentRoster } from "./inboxes-store";

/** Chatwoot BaseSettingsHeader, rebuilt with Studio components. */
export function SettingsHeader({
  title,
  description,
  linkText,
  count,
  search,
  onSearch,
  searchPlaceholder,
  actions,
  back,
}: {
  title: string;
  description?: string;
  linkText?: string;
  count?: string;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b px-6 pt-6 pb-5">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-3xl gap-2">
          <h1 className="font-semibold text-xl leading-none">{title}</h1>
          {description ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {description}{" "}
              {linkText ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  {linkText}
                  <ExternalLink className="size-3" />
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {onSearch || actions || count ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {onSearch ? (
              <InputGroup className="h-8 w-full md:w-80">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  className="h-8"
                  type="search"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                />
              </InputGroup>
            ) : null}
            {count ? <span className="text-muted-foreground text-sm tabular-nums">{count}</span> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Chatwoot SectionLayout: heading + description, then content. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-4 border-b px-6 py-6 last:border-b-0", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-2xl gap-1">
          <h2 className="font-medium text-base">{title}</h2>
          {description ? <p className="text-muted-foreground text-sm leading-relaxed">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Chatwoot woot-confirm-delete-modal: type the name to confirm.
 * 128.2: the word to type is shown once as selectable text with a copy button; buttons are just Cancel and Delete.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmValue,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmValue: string;
  onConfirm?: () => void;
}) {
  const [value, setValue] = React.useState("");
  const wordRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!open) setValue("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            To confirm, type
            <code
              ref={wordRef}
              data-slot="confirm-word"
              className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
            >
              {confirmValue}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Copy"
              onClick={async () => {
                // navigator.clipboard is missing on plain http (e.g. the Tailscale address): select the word and copy it.
                const selectAndCopy = () => {
                  const word = wordRef.current;
                  const selection = window.getSelection();
                  if (!word || !selection) return false;
                  selection.selectAllChildren(word);
                  try {
                    return document.execCommand("copy");
                  } catch {
                    return false;
                  }
                };
                const copied = navigator.clipboard
                  ? await navigator.clipboard.writeText(confirmValue).then(
                      () => true,
                      () => selectAndCopy(),
                    )
                  : selectAndCopy();
                if (copied) toast.success("Copied to clipboard successfully");
                else toast.error("Couldn't copy. The word is selected, copy it with Ctrl+C or Cmd+C.");
              }}
            >
              <Copy />
            </Button>
          </p>
          <Input aria-label="Confirmation" value={value} onChange={(event) => setValue(event.target.value)} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" disabled={value !== confirmValue} onClick={onConfirm}>
              Delete
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small wizard step list used by Chatwoot's add-inbox and team flows. */
export function WizardSteps({ steps, current }: { steps: { title: string; body: string }[]; current: number }) {
  return (
    <ol className="grid gap-1">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li key={step.title} className="flex gap-3 rounded-lg p-3 data-[state=current]:bg-muted" data-state={state}>
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-medium text-xs tabular-nums",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary text-primary",
                state === "todo" && "text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <div className="grid gap-0.5">
              <span className={cn("font-medium text-sm", state === "todo" && "text-muted-foreground")}>
                {step.title}
              </span>
              <span className="text-muted-foreground text-xs">{step.body}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// F159: the agent's own colour from the shared person palette, so Arham, Priya and Lina look the same here as in
// Conversations, Contacts and Reports.
export function AgentAvatar({ name, className }: { id: number; name: string; className?: string }) {
  return (
    <Avatar className={cn("size-6 font-medium", personToneClass(name), className)}>
      <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Multi-select of agents shown as removable chips (Chatwoot multiselect). */
export function AgentMultiSelect({
  value,
  onChange,
  placeholder = "Pick agents for the inbox",
}: {
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const agents = useAgentRoster(); // F-6B: the live agents (an invited agent too), not the seed
  const selected = agents.filter((a) => value.includes(a.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-left text-sm shadow-xs"
        >
          {selected.length ? (
            selected.map((agent) => (
              <span
                key={agent.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-muted py-0.5 pr-1 pl-0.5 text-xs"
              >
                <AgentAvatar id={agent.id} name={agent.name} className="size-5" />
                {agent.name}
                <X
                  className="size-3 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(value.filter((id) => id !== agent.id));
                  }}
                />
              </span>
            ))
          ) : (
            <span className="px-1 text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandEmpty>No agents found</CommandEmpty>
            <CommandGroup>
              {agents.map((agent) => {
                const isOn = value.includes(agent.id);
                return (
                  <CommandItem
                    key={agent.id}
                    value={agent.name}
                    onSelect={() => onChange(isOn ? value.filter((id) => id !== agent.id) : [...value, agent.id])}
                  >
                    <AgentAvatar id={agent.id} name={agent.name} />
                    <span className="flex-1">{agent.name}</span>
                    {isOn ? <Check className="size-4" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
