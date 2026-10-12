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
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ShellTab {
  value: string;
  label: string;
  count?: number;
}

interface SettingsShellProps {
  title: string;
  description: string;
  learnMore?: string;
  count?: string;
  search?: { placeholder: string; value: string; onChange: (value: string) => void };
  /** The main button(s): drawn beside the big page title, as on Users & Roles and Contacts. */
  actions?: React.ReactNode;
  /** Line tabs with counts under the title (Studio pattern). */
  tabs?: { value: string; onValueChange: (value: string) => void; items: ShellTab[] };
  /** Title and line of the card that holds the table; defaults to the active tab label, else the page title. */
  cardTitle?: string;
  cardDescription?: string;
  children: React.ReactNode;
}

/** The big title and description outside the card, the main button beside them. */
export function PageHeader({
  title,
  description,
  learnMore,
  actions,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  learnMore?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex max-w-3xl flex-col gap-1">
        <h1 className="text-3xl tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
          {learnMore ? " " : null}
          {learnMore ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 whitespace-nowrap text-primary underline-offset-4 hover:underline"
            >
              {learnMore}
              <ExternalLink className="size-3.5" />
            </button>
          ) : null}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Line tabs with a count badge on each, copied from Contacts and Users & Roles. */
export function CountTabs({
  value,
  onValueChange,
  items,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: ShellTab[];
}) {
  return (
    <Tabs className="gap-4" value={value} onValueChange={onValueChange}>
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
      >
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
            {item.count !== undefined ? (
              <Badge variant="secondary" className="ms-1 tabular-nums">
                {item.count}
              </Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Chatwoot's BaseSettingsHeader + SettingsLayout, drawn in the Studio pattern (Users & Roles, Contacts). */
export function SettingsShell({
  title,
  description,
  learnMore,
  count,
  search,
  actions,
  tabs,
  cardTitle,
  cardDescription,
  children,
}: SettingsShellProps) {
  const activeTab = tabs?.items.find((item) => item.value === tabs.value);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={description} learnMore={learnMore} actions={actions} />
      {tabs ? <CountTabs value={tabs.value} onValueChange={tabs.onValueChange} items={tabs.items} /> : null}
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">{cardTitle ?? activeTab?.label ?? title}</CardTitle>
          {cardDescription ? (
            <CardDescription className="max-w-md leading-snug">{cardDescription}</CardDescription>
          ) : null}
          {search || count ? (
            <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-3 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
              {count ? <span className="text-muted-foreground text-sm tabular-nums">{count}</span> : null}
              {search ? (
                <InputGroup className="h-7 w-full md:w-64">
                  <InputGroupAddon align="inline-start">
                    <Search className="size-3.5" />
                  </InputGroupAddon>
                  <InputGroupInput
                    className="h-7"
                    type="search"
                    placeholder={search.placeholder}
                    value={search.value}
                    onChange={(event) => search.onChange(event.target.value)}
                  />
                </InputGroup>
              ) : null}
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">{children}</CardContent>
      </Card>
    </div>
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
  /** Runs when the user presses the red button (optional, added by settings-b). */
  onConfirm?: () => void;
}

export function ConfirmDelete({ open, onOpenChange, title, message, yes, no, onConfirm }: ConfirmDeleteProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{no}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {yes}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NoResults({ children }: { children: React.ReactNode }) {
  return <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">{children}</div>;
}
