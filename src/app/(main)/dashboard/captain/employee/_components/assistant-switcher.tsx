"use client";
// مبدّل المساعد بمقاس الزر العادي، منسوخ من AssistantSwitcher في shared.tsx (هناك size="sm") كي لا نلمس الملف المشترك.
import Link from "next/link";

import { Bot, Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { setCurrentAssistant, useCurrentAssistant } from "../../_components/shared";
import { useCaptainList } from "../../_components/store";

export function AssistantSwitcher() {
  const assistants = useCaptainList("assistants");
  const current = useCurrentAssistant();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
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
        {assistants.length === 0 && (
          <p className="px-2 py-1.5 text-muted-foreground text-sm">
            No assistants found, please create one to get started
          </p>
        )}
        {assistants.map((a) => (
          <DropdownMenuItem key={a.id} className="items-start" onSelect={() => setCurrentAssistant(a.id)}>
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
          <Link href="/dashboard/captain/assistants?create=1">
            <Plus /> Create Assistant
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
