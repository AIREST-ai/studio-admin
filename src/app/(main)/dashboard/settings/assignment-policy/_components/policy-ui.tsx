"use client";
// Shared parts of the assignment policy pages in the Studio pattern: breadcrumb + big title outside, the form in
// cards, the search-and-add dropdown (Chatwoot components-next/AssignmentPolicy/*), and the confirm dialogs.
import type * as React from "react";

import Link from "next/link";

import { ChevronRight, Plus } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { PageHeader } from "../../labels/_shared/settings-shell";

export const POLICY_HOME = "/dashboard/settings/assignment-policy";

export function PolicyBreadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3.5" /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PolicyFormShell({
  title,
  description,
  crumbs,
  backHref,
  submit,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  crumbs: { label: string; href?: string }[];
  backHref: string;
  submit: string;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <PolicyBreadcrumb items={crumbs} />
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={backHref}>Cancel</Link>
            </Button>
            <Button type="submit" size="sm">
              {submit}
            </Button>
          </>
        }
      />
      <div className="grid gap-4">{children}</div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={backHref}>Cancel</Link>
        </Button>
        <Button type="submit">{submit}</Button>
      </div>
    </form>
  );
}

/** "Add inbox" / "Add agent" / "add tag" button that opens a searchable list (Chatwoot AddDataDropdown). */
export function AddDropdown({
  label,
  placeholder,
  empty = "No results found",
  options,
  onPick,
  size = "sm",
}: {
  label: string;
  placeholder: string;
  empty?: string;
  options: { value: string; label: string; hint?: string; icon?: React.ReactNode }[];
  onPick: (value: string) => void;
  size?: "sm" | "xs";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size={size}>
          <Plus /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.value} value={`${option.label} ${option.hint ?? ""}`} onSelect={() => onPick(option.value)}>
                  {option.icon}
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.hint ? <span className="text-muted-foreground text-xs">{option.hint}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  cancel = "Cancel",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirm: string;
  cancel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}
