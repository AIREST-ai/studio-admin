"use client";
import type * as React from "react";

import Link from "next/link";

import { Bot, Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { assistants } from "./data";

export function AssistantSwitcher() {
  const current = assistants[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
            <Bot className="size-3.5" />
          </span>
          {current.name}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5">
          <span>Assistants</span>
          <span className="font-normal text-muted-foreground text-xs">Switch between assistants</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {assistants.map((a) => (
          <DropdownMenuItem key={a.id} className="items-start">
            <Bot className="mt-0.5" />
            <div className="grid flex-1 gap-0.5">
              <span>{a.name}</span>
              <span className="line-clamp-1 text-muted-foreground text-xs">{a.productName}</span>
            </div>
            {a.id === current.id && <Check className="mt-0.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/captain/assistants">
            <Plus /> Create Assistant
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CaptainCardHeader({
  title,
  description,
  children,
  switcher = true,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  switcher?: boolean;
}) {
  return (
    <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl leading-none">{title}</CardTitle>
          {switcher && <AssistantSwitcher />}
        </div>
        {description && <CardDescription className="max-w-2xl">{description}</CardDescription>}
      </div>
      {children && (
        <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
          {children}
        </CardAction>
      )}
    </CardHeader>
  );
}
