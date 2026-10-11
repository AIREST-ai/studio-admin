"use client";
import * as React from "react";

import { cn } from "cn";
import { EllipsisVertical, KeyRound, Pencil, Trash2, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

import { type Tool, tools } from "./data";
import { ConfirmDialog, ToolDialog } from "./dialogs";
import { CaptainCardHeader } from "./shared";

export function ToolsList() {
  const [enabled, setEnabled] = React.useState<Record<number, boolean>>(
    Object.fromEntries(tools.map((t) => [t.id, t.enabled])),
  );
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Tool | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [disabling, setDisabling] = React.useState<Tool | null>(null);

  return (
    <>
      <Card>
        <CaptainCardHeader
          title="Tools"
          description="Create custom tools to connect your assistant with external APIs and services, enabling it to fetch data and perform actions on your behalf."
        >
          <Button size="sm" onClick={() => setCreating(true)}>
            Create a new tool
          </Button>
        </CaptainCardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {tools.map((t) => (
            <div key={t.id} className={cn("grid gap-3 rounded-xl border p-4", !enabled[t.id] && "opacity-70")}>
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Wrench className="size-4" />
                </div>
                <div className="grid flex-1 gap-0.5">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-muted-foreground text-sm">{t.description}</span>
                </div>
                <Switch
                  checked={enabled[t.id]}
                  aria-label={`Toggle ${t.title}`}
                  onCheckedChange={(v) => {
                    if (!v && t.id === 1) setDisabling(t);
                    else setEnabled((p) => ({ ...p, [t.id]: v }));
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Tool options">
                      <EllipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={() => setEditing(t)}>
                      <Pencil /> Edit tool
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                      <Trash2 /> Delete tool
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-[10px]",
                    t.method === "GET" ? "text-emerald-700 dark:text-emerald-400" : "text-sky-700 dark:text-sky-400",
                  )}
                >
                  {t.method}
                </Badge>
                <span className="truncate font-mono text-muted-foreground text-xs">{t.endpoint}</span>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="size-3.5" /> {t.auth}
                </span>
                <span>
                  {t.params} {t.params === 1 ? "parameter" : "parameters"}
                </span>
                <span className="ml-auto">{enabled[t.id] ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ToolDialog open={creating} onOpenChange={setCreating} />
      <ToolDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        tool={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete Custom Tool"
        description="Are you sure you want to delete this custom tool? This action cannot be undone."
      />
      <ConfirmDialog
        open={disabling !== null}
        onOpenChange={(o) => !o && setDisabling(null)}
        title={`Disable ${disabling?.title ?? ""}?`}
        description="This tool is used by 1 enabled scenario. Disabling it may cause that scenario to stop working as expected."
        confirm="Disable tool"
      />
    </>
  );
}
