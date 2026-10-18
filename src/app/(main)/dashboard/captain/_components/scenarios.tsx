"use client";
// Chatwoot: routes/dashboard/captain/assistants/scenarios/Index.vue + ScenariosCard.vue, AddNewScenariosDialog.vue,
// SuggestedRules (Example scenarios), BulkSelectBar. Studio: heading outside, table in a card, one "…" per row.
import * as React from "react";

import { cn } from "cn";
import { Lightbulb, Pencil, Plus, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { exampleScenarios, type Scenario } from "./data";
import { ConfirmDialog, ScenarioDialog } from "./dialogs";
import { CaptainShell, ChipSelect, RowMenuTrigger, ToneBadge } from "./shared";
import { useCaptainState } from "./store";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

const exampleTools: Record<string, string[]> = {
  "Customer is stuck": [],
  "Speaking in Arabic": [],
};

export function ScenariosList() {
  const [items, setItems] = useCaptainState("scenarios");
  const [examples, setExamples] = React.useState(exampleScenarios);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState<number[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Scenario | null>(null);
  const [deleting, setDeleting] = React.useState<Scenario | "bulk" | null>(null);

  const q = query.trim().toLowerCase();
  const rows = items.filter(
    (s) =>
      (!q || `${s.title} ${s.description} ${s.instruction}`.toLowerCase().includes(q)) &&
      (status === "all" || (status === "enabled") === s.enabled),
  );
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  function addExamples(list: typeof exampleScenarios) {
    setItems((current) => [
      ...current,
      ...list.map((e, i) => ({
        id: Date.now() + i,
        title: e.title,
        description: e.description,
        instruction: e.description,
        tools: exampleTools[e.title] ?? [],
        enabled: true,
      })),
    ]);
    setExamples((current) => current.filter((e) => !list.includes(e)));
    toast.success("Scenarios added successfully");
  }

  function toggle(s: Scenario, v: boolean) {
    setItems((list) => list.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)));
    toast.success(v ? "Scenario enabled successfully" : "Scenario disabled successfully");
  }

  return (
    <CaptainShell
      title="Scenarios"
      subtitle="Give your assistant some context—like “what to do when a user is stuck,” or “how to act during a refund request.”"
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> Add a scenario
        </Button>
      }
    >
      {examples.length > 0 && (
        <Card className="gap-3 border-dashed bg-muted/30 py-4">
          <CardHeader className="px-4">
            <CardTitle className="inline-flex items-center gap-2 text-sm">
              <Lightbulb className="size-4 text-amber-500" /> Example scenarios
            </CardTitle>
            <CardAction className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => addExamples(examples)}>
                Add all
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Close examples" onClick={() => setExamples([])}>
                <X />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-2 px-4 md:grid-cols-2">
            {examples.map((e) => (
              <div key={e.title} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <div className="grid flex-1 gap-0.5">
                  <span className="font-medium text-sm">{e.title}</span>
                  <span className="text-muted-foreground text-xs">{e.description}</span>
                  <span className="text-muted-foreground text-xs">Tools used : —</span>
                </div>
                <Button variant="outline" size="xs" onClick={() => addExamples([e])}>
                  Add this
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">All scenarios</CardTitle>
          <CardDescription>
            {items.filter((s) => s.enabled).length} of {items.length} enabled
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <ExpandingSearch
              name="scenarios"
              label="Search scenarios"
              placeholder="Search..."
              className="w-full md:w-64"
              value={query}
              onChange={setQuery}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center gap-3 px-4">
            <ChipSelect label="Status" value={status} options={statusOptions} onChange={setStatus} />
          </div>
          <div className="flex min-h-8 flex-wrap items-center gap-2 px-4">
            <span className="text-muted-foreground text-sm tabular-nums">
              {selected.length} {selected.length === 1 ? "item selected" : "items selected"}
            </span>
            {selected.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}>
                  {allSelected ? `Unselect all (${rows.length})` : `Select all (${rows.length})`}
                </Button>
                <Button variant="destructive" size="sm" className="ms-auto" onClick={() => setDeleting("bulk")}>
                  <Trash2 /> Delete
                </Button>
              </>
            )}
          </div>
          {rows.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader className="[&_tr]:border-t">
                <TableRow>
                  <TableHead className="w-10 py-4">
                    <Checkbox
                      aria-label="Select all scenarios"
                      checked={allSelected}
                      onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.id) : [])}
                    />
                  </TableHead>
                  <TableHead className="py-4 font-normal">Scenario</TableHead>
                  <TableHead className="py-4 font-normal">How to handle</TableHead>
                  <TableHead className="py-4 font-normal">Tools used</TableHead>
                  <TableHead className="py-4 font-normal">Status</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow
                    key={s.id}
                    className={cn("border-border/60", !s.enabled && "text-muted-foreground")}
                    data-state={selected.includes(s.id) ? "selected" : undefined}
                  >
                    <TableCell className="py-4 align-top">
                      <Checkbox
                        aria-label={`Select ${s.title}`}
                        checked={selected.includes(s.id)}
                        onCheckedChange={(c) => setSelected((p) => (c ? [...p, s.id] : p.filter((x) => x !== s.id)))}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal py-4">
                      <button type="button" className="grid gap-0.5 text-left" onClick={() => setEditing(s)}>
                        <span className="font-medium text-foreground text-sm hover:underline">{s.title}</span>
                        <span className="text-muted-foreground text-sm">{s.description}</span>
                      </button>
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal py-4">
                      <span className="line-clamp-2 whitespace-pre-line text-sm">{s.instruction}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      {s.tools.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {s.tools.map((t) => (
                            <Badge key={t} variant="outline" className="gap-1 px-2 py-1 font-medium">
                              <Wrench className="size-3" /> {t}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">---</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.enabled}
                          aria-label={`Toggle ${s.title}`}
                          onCheckedChange={(v) => toggle(s, v)}
                        />
                        <ToneBadge tone={s.enabled ? "green" : "muted"}>{s.enabled ? "Enabled" : "Disabled"}</ToneBadge>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <RowMenuTrigger label={`Open actions for ${s.title}`} />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onSelect={() => setEditing(s)}>
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(s)}>
                            <Trash2 /> Delete
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
                  <Lightbulb />
                </EmptyMedia>
                <EmptyTitle>{q ? "No scenarios found for this search." : "No scenarios found."}</EmptyTitle>
                <EmptyDescription>
                  {q ? "Try a different search term." : "Create or add examples to begin."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <ScenarioDialog open={creating} onOpenChange={setCreating} />
      <ScenarioDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        scenario={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null && deleting !== "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Are you sure to delete the scenario?"
        success="Scenarios deleted successfully"
        onConfirm={() => {
          const target = deleting;
          if (target && target !== "bulk") setItems((list) => list.filter((s) => s.id !== target.id));
        }}
      />
      <ConfirmDialog
        open={deleting === "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete scenarios?"
        description="Are you sure you want to delete the selected scenarios? This action cannot be undone."
        confirm="Yes, delete all"
        success="Scenarios deleted successfully"
        onConfirm={() => {
          setItems((list) => list.filter((s) => !selected.includes(s.id)));
          setSelected([]);
        }}
      />
    </CaptainShell>
  );
}
