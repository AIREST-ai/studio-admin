"use client";
import * as React from "react";

import Link from "next/link";

import { ArrowUpRight, Building2, Check, ChevronDown, Link2, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import { activePortal, portals } from "./data";
import { CreatePortalDialog } from "./help-center-dialogs";

export function PortalTitle({ section }: { section?: string }) {
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [active, setActive] = React.useState(activePortal.id);
  const current = portals.find((p) => p.id === active) ?? activePortal;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-semibold text-xl leading-none">{current.name}</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Switch portal">
              <ChevronDown />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[27.5rem] p-0">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div className="grid gap-1">
                <div className="flex items-center gap-1.5">
                  <Link href="/dashboard/help-center/portals" className="font-medium text-sm hover:underline">
                    Portals
                  </Link>
                  <Button variant="ghost" size="icon-xs" aria-label="Preview portal">
                    <ArrowUpRight />
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm">Create and manage multiple portals</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
              >
                <Plus /> New portal
              </Button>
            </div>
            <div className="grid gap-1 p-2">
              {portals.map((portal) => (
                <button
                  key={portal.id}
                  type="button"
                  onClick={() => {
                    setActive(portal.id);
                    setOpen(false);
                  }}
                  className="flex h-10 items-center gap-2.5 rounded-md px-2 text-left hover:bg-muted"
                >
                  <Avatar className="size-6 rounded-md">
                    <AvatarFallback className="rounded-md text-[10px] text-white" style={{ background: portal.color }}>
                      <Building2 className="size-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium text-sm">{portal.name}</span>
                  {portal.customDomain ? (
                    <span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
                      <Link2 className="size-3" />
                      <span className="truncate">{portal.customDomain}</span>
                    </span>
                  ) : null}
                  <span className="ml-auto flex items-center gap-2 text-muted-foreground text-xs tabular-nums">
                    {portal.articles} articles
                    {portal.id === active ? <Check className="size-4 text-emerald-600" /> : <span className="size-4" />}
                  </span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {section ? (
        <>
          <Separator orientation="vertical" className="h-4 data-[orientation=vertical]:h-4" />
          <span className="truncate font-semibold text-xl leading-none">{section}</span>
        </>
      ) : null}
      <CreatePortalDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
