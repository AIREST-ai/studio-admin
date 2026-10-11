"use client";
import type * as React from "react";

import { ExternalLink, Search } from "lucide-react";

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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

interface SettingsShellProps {
  title: string;
  description: string;
  learnMore?: string;
  count?: string;
  search?: { placeholder: string; value: string; onChange: (value: string) => void };
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Chatwoot's BaseSettingsHeader + SettingsLayout, drawn with Studio parts. */
export function SettingsShell({ title, description, learnMore, count, search, actions, children }: SettingsShellProps) {
  return (
    <Card>
      <CardHeader className="gap-4 border-b">
        <div className="grid max-w-3xl gap-1.5">
          <h1 className="font-semibold text-xl leading-none">{title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          {learnMore ? (
            <button
              type="button"
              className="inline-flex w-fit items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
            >
              {learnMore}
              <ExternalLink className="size-3.5" />
            </button>
          ) : null}
        </div>
        {search || actions || count ? (
          <div className="flex flex-wrap items-center gap-2">
            {search ? (
              <InputGroup className="h-8 w-full md:w-72">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  className="h-8"
                  type="search"
                  placeholder={search.placeholder}
                  value={search.value}
                  onChange={(event) => search.onChange(event.target.value)}
                />
              </InputGroup>
            ) : null}
            <div className="ml-auto flex items-center gap-3">
              {count ? <span className="text-muted-foreground text-sm tabular-nums">{count}</span> : null}
              {actions}
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

interface ConfirmDeleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  yes: string;
  no: string;
}

export function ConfirmDelete({ open, onOpenChange, title, message, yes, no }: ConfirmDeleteProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{no}</AlertDialogCancel>
          <AlertDialogAction variant="destructive">{yes}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NoResults({ children }: { children: React.ReactNode }) {
  return <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">{children}</div>;
}
