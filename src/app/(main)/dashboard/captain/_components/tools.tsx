"use client";
// Chatwoot: routes/dashboard/captain/tools/Index.vue + customTool/CustomToolCard.vue, CreateCustomToolDialog.vue.
// Studio: heading outside the card, chips, table with switch + one "…" menu per row.
import * as React from "react";

import { cn } from "cn";
import { KeyRound, Pencil, Plus, Search, Trash2, TriangleAlert, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { scenarios, type Tool, tools } from "./data";
import { ConfirmDialog, ToolDialog } from "./dialogs";
import { CaptainShell, ChipSelect, RowMenuTrigger, ToneBadge } from "./shared";

const SOFT_LIMIT = 10;
const statusOptions = [
  { value: "all", label: "All" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];
const authOptions = ["All", "None", "Bearer Token", "Basic Auth", "API Key"];

const usedBy = (t: Tool) => scenarios.filter((s) => s.enabled && s.tools.includes(t.title)).length;

export function ToolsList() {
  const [items, setItems] = React.useState(tools);
  const [enabled, setEnabled] = React.useState<Record<number, boolean>>(
    Object.fromEntries(tools.map((t) => [t.id, t.enabled])),
  );
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [auth, setAuth] = React.useState("All");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Tool | null>(null);
  const [deleting, setDeleting] = React.useState<Tool | null>(null);
  const [disabling, setDisabling] = React.useState<Tool | null>(null);

  const q = query.trim().toLowerCase();
  const rows = items.filter(
    (t) =>
      (!q || `${t.title} ${t.description} ${t.endpoint}`.toLowerCase().includes(q)) &&
      (status === "all" || (status === "enabled") === enabled[t.id]) &&
      (auth === "All" || t.auth === auth),
  );

  function toggle(t: Tool, v: boolean) {
    setEnabled((p) => Object.assign({}, p, { [t.id]: v }));
    toast.success(v ? "Tool enabled successfully" : "Tool disabled successfully");
  }

  const used = disabling ? usedBy(disabling) : 0;

  return (
    <CaptainShell
      title="Tools"
      subtitle="Create custom tools to connect your assistant with external APIs and services, enabling it to fetch data and perform actions on your behalf."
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> Create a new tool
        </Button>
      }
    >
      {items.length > SOFT_LIMIT && (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertDescription>
            Having more than 10 tools may reduce the assistant's reliability in selecting the right tool. Consider
            removing unused tools for better results.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Custom tools</CardTitle>
          <CardDescription>
            {Object.values(enabled).filter(Boolean).length} of {items.length} enabled
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                placeholder="Search tools..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center gap-3 px-4">
            <ChipSelect label="Status" value={status} options={statusOptions} onChange={setStatus} />
            <ChipSelect label="Authentication" value={auth} options={authOptions} onChange={setAuth} />
          </div>
          {rows.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader className="[&_tr]:border-t">
                <TableRow>
                  <TableHead className="py-4 font-normal">Tool</TableHead>
                  <TableHead className="py-4 font-normal">Endpoint</TableHead>
                  <TableHead className="py-4 font-normal">Authentication</TableHead>
                  <TableHead className="py-4 font-normal">Parameters</TableHead>
                  <TableHead className="py-4 font-normal">Status</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} className={cn("border-border/60", !enabled[t.id] && "text-muted-foreground")}>
                    <TableCell className="py-4">
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => setEditing(t)}>
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Wrench className="size-4" />
                        </div>
                        <div className="grid max-w-xs gap-0.5">
                          <span className="font-medium text-foreground text-sm hover:underline">{t.title}</span>
                          <span className="line-clamp-1 whitespace-normal text-muted-foreground text-sm">
                            {t.description}
                          </span>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex max-w-sm items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono text-[10px]",
                            t.method === "GET"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
                          )}
                        >
                          {t.method}
                        </Badge>
                        <span className="truncate font-mono text-muted-foreground text-xs">{t.endpoint}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
                        <KeyRound className="size-3.5 text-muted-foreground" /> {t.auth}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-sm tabular-nums">
                      {t.params} {t.params === 1 ? "parameter" : "parameters"}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={enabled[t.id]}
                          aria-label={`Toggle ${t.title}`}
                          onCheckedChange={(v) => {
                            if (!v && usedBy(t) > 0) setDisabling(t);
                            else toggle(t, v);
                          }}
                        />
                        <ToneBadge tone={enabled[t.id] ? "green" : "muted"}>
                          {enabled[t.id] ? "Enabled" : "Disabled"}
                        </ToneBadge>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <RowMenuTrigger label={`Open actions for ${t.title}`} />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onSelect={() => setEditing(t)}>
                            <Pencil /> Edit tool
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(t)}>
                            <Trash2 /> Delete tool
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty className="border-t">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wrench />
                </EmptyMedia>
                <EmptyTitle>No custom tools available</EmptyTitle>
                <EmptyDescription>
                  Create custom tools to connect your assistant with external APIs and services, enabling it to fetch
                  data and perform actions on your behalf.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                    setAuth("All");
                  }}
                >
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          )}
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
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete Custom Tool"
        description="Are you sure you want to delete this custom tool? This action cannot be undone."
        success="Custom tool deleted successfully"
        onConfirm={() => {
          const target = deleting;
          if (target) setItems((list) => list.filter((t) => t.id !== target.id));
        }}
      />
      <ConfirmDialog
        open={disabling !== null}
        onOpenChange={(o) => !o && setDisabling(null)}
        title={`Disable ${disabling?.title ?? ""}?`}
        description={
          used === 1
            ? "This tool is used by 1 enabled scenario. Disabling it may cause that scenario to stop working as expected."
            : `This tool is used by ${used} enabled scenarios. Disabling it may cause those scenarios to stop working as expected.`
        }
        confirm="Disable tool"
        onConfirm={() => {
          if (disabling) toggle(disabling, false);
        }}
      />
    </CaptainShell>
  );
}
