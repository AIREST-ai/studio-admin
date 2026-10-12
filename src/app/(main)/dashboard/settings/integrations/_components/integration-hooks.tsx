"use client";
// Chatwoot IntegrationHooks.vue: one page for every hook-based app (OpenAI, Dialogflow, Google Translate, Dyte,
// LeadSquared). Single apps show the Connect / Disconnect row (SingleIntegrationHooks.vue); inbox apps list one hook
// per inbox in a table with search, count and "Add a new hook" (MultipleIntegrationHooks.vue).
import * as React from "react";

import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { NoResults, PageHeader, SettingsShell } from "../../labels/_shared/settings-shell";
import { hookApps, type IntegrationHook } from "./data";
import {
  BackToIntegrations,
  ConfirmAction,
  EnabledBadge,
  HookDialog,
  IntegrationRow,
  integrationById,
} from "./integration-ui";

export function IntegrationHooks({ integrationId }: { integrationId: string }) {
  const item = integrationById(integrationId);
  const app = hookApps[integrationId];
  const [hooks, setHooks] = React.useState<IntegrationHook[]>(app?.hooks ?? []);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<IntegrationHook | null>(null);
  const [query, setQuery] = React.useState("");

  if (!item || !app) {
    return (
      <div className="flex flex-col gap-4">
        <BackToIntegrations />
        <PageHeader title="Integration not found" description="This integration is not available on this account." />
      </div>
    );
  }

  const isInbox = app.hookType === "inbox";
  const connected = hooks.length > 0;

  function create(values: Record<string, string>) {
    const properties =
      app.mode === "multiple"
        ? (app.headers ?? []).map((h) => {
            const field = app.fields.find((f) => f.name === h.field);
            return values[h.field] || field?.options?.[0] || "—";
          })
        : [values[app.fields[0].name] ?? ""];
    setHooks((prev) => [...prev, { id: Date.now(), inbox: values.inbox, properties }]);
  }

  function confirmDelete() {
    if (!deleting) return;
    setHooks((prev) => prev.filter((h) => h.id !== deleting.id));
    toast.success("Hook deleted successfully");
    setDeleting(null);
  }

  const dialogs = (
    <>
      <HookDialog app={app} item={item} open={adding} onOpenChange={setAdding} onCreated={create} />
      <ConfirmDeleteControlled
        hook={deleting}
        isInbox={isInbox}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );

  if (app.mode === "single") {
    return (
      <div className="flex flex-col gap-4">
        <BackToIntegrations />
        <PageHeader
          title={item.name}
          description={app.shortDescription}
          learnMore={`Learn more about ${item.name}`}
          actions={<EnabledBadge enabled={connected} />}
        />
        <Card className="py-0">
          <CardContent className="px-0">
            <IntegrationRow
              item={item}
              action={
                connected ? (
                  <Button variant="destructive" onClick={() => setDeleting(hooks[0])}>
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={() => setAdding(true)}>Connect</Button>
                )
              }
            />
            {connected ? (
              <div className="grid gap-1 border-t px-6 py-4 text-sm">
                <span className="text-muted-foreground">Connected with</span>
                <span className="font-mono">{hooks[0].properties[0] || "Configured"}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
        {dialogs}
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const rows = q
    ? hooks.filter((h) => [...h.properties, h.inbox ?? ""].some((v) => v.toLowerCase().includes(q)))
    : hooks;

  return (
    <div className="flex flex-col gap-4">
      <BackToIntegrations />
      <SettingsShell
        title={item.name}
        description={item.description}
        learnMore={`Learn more about ${item.name}`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add a new hook
          </Button>
        }
        cardTitle="Hooks"
        cardDescription="One hook per inbox. Each hook sends that inbox's conversations to your agent first."
        count={hooks.length ? `${hooks.length} ${hooks.length === 1 ? "integration" : "integrations"}` : undefined}
        search={{ placeholder: "Search...", value: query, onChange: setQuery }}
      >
        {hooks.length === 0 ? (
          <NoResults>There are no {item.id} integrations configured in this account.</NoResults>
        ) : (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                {(app.headers ?? []).map((h) => (
                  <TableHead key={h.label} className="py-4 font-normal">
                    {h.label}
                  </TableHead>
                ))}
                {isInbox ? <TableHead className="py-4 font-normal">Inbox</TableHead> : null}
                <TableHead className="py-4 font-normal">
                  <div className="text-right">Actions</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((hook) => (
                  <TableRow key={hook.id} className="border-border/60">
                    {hook.properties.map((p, i) => (
                      <TableCell key={`${hook.id}-${i}`} className={i === 0 ? "py-4 font-medium" : "py-4"}>
                        {p}
                      </TableCell>
                    ))}
                    {isInbox ? <TableCell className="py-4 text-muted-foreground">{hook.inbox}</TableCell> : null}
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label="Open hook actions"
                            className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                            size="icon-sm"
                            variant="ghost"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(hook)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={(app.headers?.length ?? 0) + 2}>
                    <NoResults>No results found matching your search</NoResults>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </SettingsShell>
      {dialogs}
    </div>
  );
}

/** Chatwoot's woot-delete-modal texts differ for inbox hooks (delete) and account hooks (disconnect). */
function ConfirmDeleteControlled({
  hook,
  isInbox,
  onCancel,
  onConfirm,
}: {
  hook: IntegrationHook | null;
  isInbox: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmAction
      open={Boolean(hook)}
      onOpenChange={(open) => !open && onCancel()}
      onConfirm={onConfirm}
      title={isInbox ? "Confirm deletion" : "Disconnect"}
      message={isInbox ? "Are you sure to delete?" : "Are you sure to disconnect?"}
      yes={isInbox ? "Yes, Delete" : "Yes, Disconnect"}
      no="Cancel"
    />
  );
}
