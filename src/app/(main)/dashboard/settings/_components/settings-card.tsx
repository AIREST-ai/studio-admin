"use client";
// Studio card used by the form pages of settings (account, inbox settings tabs, assignment policies): the card
// header holds the section title and line (Chatwoot SectionLayout), with an optional control at its end.
import type * as React from "react";

import { cn } from "cn";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SettingsCard({
  title,
  description,
  action,
  footer,
  children,
  className,
  tone,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  tone?: "danger";
}) {
  return (
    <Card className={cn(tone === "danger" && "border-destructive/30", className)}>
      <CardHeader
        className={cn(
          "min-w-0 has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]",
          children ? "border-b" : undefined,
        )}
      >
        <CardTitle
          className={cn(
            "min-w-0 text-lg leading-snug [overflow-wrap:anywhere]",
            tone === "danger" && "text-destructive",
          )}
        >
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="min-w-0 max-w-2xl leading-relaxed [overflow-wrap:anywhere]">
            {description}
          </CardDescription>
        ) : null}
        {action ? (
          <CardAction className="col-start-1 row-start-auto max-w-full justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center sm:justify-self-end">
            {action}
          </CardAction>
        ) : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
      {footer ? <CardFooter className="border-t">{footer}</CardFooter> : null}
    </Card>
  );
}

/** Small Studio stat card (title, big number, line), as on the Overview page and the team page. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription className="flex items-center gap-2">
          {Icon ? <Icon className="size-4" /> : null}
          {label}
        </CardDescription>
        <CardTitle className="font-semibold text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="px-4 text-muted-foreground text-xs">{hint}</CardContent> : null}
    </Card>
  );
}
