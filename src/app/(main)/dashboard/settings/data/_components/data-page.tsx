"use client";
// Chatwoot settings/data/Index.vue + NewImportDialog.vue in the Studio pattern: big title outside the card, line
// tabs Import | Export with counts, imports table in a card with a "…" menu per row.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  Database,
  Download,
  Eye,
  FileText,
  LifeBuoy,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { agentName, baseConversations, inboxOf, teamName } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { contactKeyOf, useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { ImportContactsDialog } from "@/app/(main)/dashboard/contacts/_components/contact-dialogs";
import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadCsv, SimBadge } from "@/lib/cw/preview-sim-ui";

import { createSavedList, SAVED_IN_PREVIEW, useSavedList } from "../../_components/settings-preview-client";
import { CountTabs, PageHeader } from "../../labels/_shared/settings-shell";
import {
  type DataImport,
  dataImports,
  type ImportSource,
  isActive,
  sourceLabel,
  stageLabel,
  statusMeta,
  typeLabel,
} from "./data";

export const dataImportsStore = createSavedList<DataImport>("dataImports", dataImports);
export const useDataImports = () => useSavedList(dataImportsStore);
export const IMPORT_SAVED_NOTE = `${SAVED_IN_PREVIEW} Preview — simulated: no Intercom or Freshdesk import runs in this preview.`;

// M129-A (Fahad 129.2, replaces "Exports are on the way / Coming soon"): Export downloads a CSV built in the browser
// from the preview's own data, including what was added, deleted or merged in the preview. Contacts use Chatwoot's
// default export columns (id, name, email, phone_number, labels: app/jobs/account/contacts_export_job.rb, v4.18.0).
function ExportPanel() {
  const contacts = useContactsStore((s) => s.list);
  const meta = useCwStore((s) => s.meta);
  const deleted = useCwStore((s) => s.deleted);
  const edits = useCwStore((s) => s.contactEdits);
  const conversations = baseConversations.filter((c) => !deleted.includes(c.id));
  const stamp = new Date().toISOString().slice(0, 10);

  const exportContacts = () =>
    downloadCsv(`AIREST_Studio_contacts_${stamp}.csv`, [
      ["id", "name", "email", "phone_number", "labels"],
      ...contacts.map((c) => [c.id, c.name, c.email, c.phone, c.labels.join(",")]),
    ]);
  const exportConversations = () =>
    downloadCsv(`AIREST_Studio_conversations_${stamp}.csv`, [
      [
        "id",
        "inbox",
        "contact_name",
        "contact_email",
        "status",
        "priority",
        "assignee",
        "team",
        "created_at",
        "subject",
      ],
      ...conversations.map((c) => {
        const m = meta[c.id];
        const contact = { ...c.contact, ...edits[contactKeyOf(c)] };
        return [
          c.id,
          inboxOf(c).name,
          contact.name,
          contact.email,
          m?.status ?? "",
          m?.priority ?? "",
          agentName(m?.assigneeId) ?? "",
          teamName(m?.teamId) ?? "",
          m?.createdAt ?? "",
          c.subject,
        ];
      }),
    ]);

  const rows = [
    {
      title: "Contacts",
      detail: `${contacts.length} contacts · id, name, email, phone number, labels`,
      onExport: exportContacts,
    },
    {
      title: "Conversations",
      detail: `${conversations.length} conversations · inbox, contact, status, priority, assignee, team, created, subject`,
      onExport: exportConversations,
    },
  ];
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl leading-none">Export</CardTitle>
        <CardDescription>Download your contacts or conversations as a CSV file.</CardDescription>
        <CardAction>
          <SimBadge />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((row) => (
          <div key={row.title} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Upload className="size-4 text-muted-foreground" />
              </span>
              <div className="grid min-w-0 gap-0.5">
                <span className="font-medium">{row.title}</span>
                <span className="text-muted-foreground text-sm">{row.detail}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={row.onExport}>
              <Download /> Export CSV
            </Button>
          </div>
        ))}
        <p className="text-muted-foreground text-xs">
          The file is built in your browser from this preview's sample data, with the changes made in the preview.
          Nothing is exported from the engine.
        </p>
      </CardContent>
    </Card>
  );
}

// T-290 (Fahad 128.5, 128.6): the contacts CSV import that was on the Contacts page lives here, beside Export, so
// importing and exporting are in one place, as HubSpot (Settings > Data Management > Import & Export), Intercom
// (Settings > Data > Imports & exports), Zoho CRM (Setup > Data Administration) and Pipedrive (Tools and apps). It is
// the same dialog (contacts/_components/contact-dialogs.tsx): the rows are added to the Contacts list at once.
function CsvImportPanel() {
  const contacts = useContactsStore((s) => s.list);
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl leading-none">Import a CSV file</CardTitle>
        <CardDescription>Add contacts from a spreadsheet saved as CSV.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <FileText className="size-4 text-muted-foreground" />
            </span>
            <div className="grid min-w-0 gap-0.5">
              <span className="font-medium">Contacts</span>
              <span className="text-muted-foreground text-sm">
                {contacts.length} contacts now · name, email, phone number, city, country, company
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Upload /> Import CSV
          </Button>
        </div>
      </CardContent>
      <ImportContactsDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

export function SourceIcon({ source, className }: { source: ImportSource; className?: string }) {
  const Icon = source === "intercom" ? MessageSquare : source === "freshdesk" ? LifeBuoy : FileText;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl border shadow-xs",
            source === "intercom" && "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
            source === "freshdesk" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
            source === "file" && "bg-muted text-muted-foreground",
            className,
          )}
        >
          <Icon className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{sourceLabel[source]}</TooltipContent>
    </Tooltip>
  );
}

export function ImportStatusBadge({ item }: { item: DataImport }) {
  const meta = statusMeta[item.status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badge)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {stageLabel[item.stage]}
    </Badge>
  );
}

function NewImportDialog({
  open,
  onOpenChange,
  onCreate,
  blocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (item: Omit<DataImport, "id">) => Promise<void>;
  blocked: boolean;
}) {
  const [source, setSource] = React.useState<"intercom" | "freshdesk">("intercom");
  const [name, setName] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [key, setKey] = React.useState("");
  const [keyState, setKeyState] = React.useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [types, setTypes] = React.useState<("contacts" | "conversations")[]>(["contacts", "conversations"]);
  const [errors, setErrors] = React.useState<{ domain?: string; key?: string; types?: string }>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSource("intercom");
      setName("");
      setDomain("");
      setKey("");
      setKeyState("idle");
      setTypes(["contacts", "conversations"]);
      setErrors({});
      setSaving(false);
      setSaveError(null);
    }
  }, [open]);

  // Mock key check: Chatwoot validates the key with the source as you type; here 20+ characters count as valid.
  React.useEffect(() => {
    if (!key) {
      setKeyState("idle");
      return;
    }
    setKeyState("validating");
    const t = window.setTimeout(() => setKeyState(key.trim().length >= 20 ? "valid" : "invalid"), 700);
    return () => window.clearTimeout(t);
  }, [key]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (source === "freshdesk" && !/^[a-z0-9-]+\.freshdesk\.com$/i.test(domain.trim()))
      next.domain = "Enter your Freshdesk domain, e.g. acme.freshdesk.com";
    if (keyState !== "valid") next.key = "Could not validate this access key.";
    if (!types.length) next.types = "Select at least one type";
    setErrors(next);
    if (Object.keys(next).length || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreate({
        name: name.trim() || (source === "intercom" ? "Intercom import" : "Freshdesk import"),
        source,
        types,
        status: "pending",
        stage: "queued",
        imported: 0,
        total: 0,
        created: "Just now",
        duration: "-",
        startedBy: "Arham Khan",
        errors: [],
        skipLogs: [],
      });
      onOpenChange(false);
      toast.success("Import has started.", { description: IMPORT_SAVED_NOTE });
    } catch (error) {
      const msg = (error as Error).message;
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const keyLabel = source === "intercom" ? "Intercom access key" : "Freshdesk API key";
  const keyPlaceholder = source === "intercom" ? "Paste your Intercom access key" : "Paste your Freshdesk API key";

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>New import</DialogTitle>
            <DialogDescription className="sr-only">Import contacts and conversations</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="import-source">Source</Label>
            <NativeSelect
              id="import-source"
              className="w-full"
              value={source}
              onChange={(e) => {
                setSource(e.target.value as "intercom" | "freshdesk");
                setKey("");
                setErrors({});
              }}
            >
              <option value="intercom">Intercom</option>
              <option value="freshdesk">Freshdesk</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="import-name">Import name</Label>
            <Input
              id="import-name"
              placeholder="July support migration"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {source === "freshdesk" ? (
            <div className="grid gap-2">
              <Label htmlFor="import-domain">Freshdesk domain</Label>
              <Input
                id="import-domain"
                placeholder="acme.freshdesk.com"
                value={domain}
                aria-invalid={Boolean(errors.domain)}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setErrors((p) => ({ ...p, domain: undefined }));
                }}
              />
              {errors.domain ? <p className="text-destructive text-xs">{errors.domain}</p> : null}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="import-key">{keyLabel}</Label>
            <Input
              id="import-key"
              type="password"
              placeholder={keyPlaceholder}
              value={key}
              aria-invalid={keyState === "invalid" || Boolean(errors.key)}
              onChange={(e) => {
                setKey(e.target.value);
                setErrors((p) => ({ ...p, key: undefined }));
              }}
            />
            {keyState === "validating" ? (
              <p className="text-muted-foreground text-xs">Validating access key...</p>
            ) : keyState === "valid" ? (
              <p className="text-emerald-600 text-xs dark:text-emerald-400">Access key validated.</p>
            ) : keyState === "invalid" || errors.key ? (
              <p className="text-destructive text-xs">Could not validate this access key.</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Data to import</Label>
            <div className="flex gap-6">
              {(["contacts", "conversations"] as const).map((t) => (
                <Label key={t} className="font-normal">
                  <Checkbox
                    checked={types.includes(t)}
                    onCheckedChange={(checked) => {
                      setErrors((p) => ({ ...p, types: undefined }));
                      setTypes((prev) => (checked === true ? [...prev, t] : prev.filter((x) => x !== t)));
                    }}
                  />
                  {typeLabel[t]}
                </Label>
              ))}
            </div>
            {errors.types ? <p className="text-destructive text-xs">{errors.types}</p> : null}
          </div>
          {blocked ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-300">
              Wait for the active import to finish before starting another one.
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" data-import-save-error="" className="text-destructive text-sm">
              {saveError}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={blocked || saving}>
              {saving ? "Saving…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DataPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState("import");
  const rows = useDataImports();
  const [open, setOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const activeImport = rows.some(isActive);

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  }

  function abandon(item: DataImport) {
    void dataImportsStore.update(item.id, { status: "abandoned", stage: "abandoned" }).then(
      () => toast.success("Import has been abandoned.", { description: IMPORT_SAVED_NOTE }),
      (error: Error) => toast.error(error.message),
    );
  }

  function retry(item: DataImport) {
    void dataImportsStore.update(item.id, { status: "pending", stage: "queued" }).then(
      () => toast.success("Import has been queued to resume.", { description: IMPORT_SAVED_NOTE }),
      (error: Error) => toast.error(error.message),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Import & Export"
        description="Import contacts from a CSV file, or bring your existing contacts and past conversations from another support tool, and download your account data as CSV files. Each import runs in the background, so you can keep working while it finishes, track its progress, and review anything that was skipped along the way."
        actions={
          tab === "import" ? (
            <Button onClick={() => setOpen(true)}>
              <Download /> Import
            </Button>
          ) : null
        }
      />
      <CountTabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: "import", label: "Import", count: rows.length },
          { value: "export", label: "Export" },
        ]}
      />

      {tab === "import" ? <CsvImportPanel /> : null}
      {tab === "export" ? (
        <ExportPanel />
      ) : (
        <Card>
          <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
            <CardTitle className="text-xl leading-none">Recent imports</CardTitle>
            <CardDescription>Open an import to see its progress, errors and skipped records.</CardDescription>
            <CardAction className="col-start-1 row-start-auto flex items-center gap-3 md:col-start-2 md:row-span-2 md:row-start-1">
              {activeImport ? (
                <span className="hidden items-center gap-1.5 text-muted-foreground text-sm sm:inline-flex">
                  <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                  Live updates every 5s
                </span>
              ) : null}
              <span className="text-muted-foreground text-sm tabular-nums">{rows.length} imports</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Refresh"
                title="Refresh"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn(refreshing && "animate-spin")} />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {rows.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Database className="size-5 text-muted-foreground" />
                </span>
                <div className="grid gap-1">
                  <h3 className="font-medium text-lg">No imports yet</h3>
                  <p className="max-w-sm text-muted-foreground text-sm">
                    Start an import to bring your existing customer history into this account.
                  </p>
                </div>
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Download /> Import
                </Button>
              </div>
            ) : (
              <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32%] min-w-64 py-4 font-normal">Name</TableHead>
                    <TableHead className="py-4 font-normal">Type</TableHead>
                    <TableHead className="py-4 font-normal">Status</TableHead>
                    <TableHead className="py-4 font-normal">Imported</TableHead>
                    <TableHead className="py-4 font-normal">Created</TableHead>
                    <TableHead className="py-4 font-normal">
                      <div className="text-right">Actions</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer border-border/60"
                      onClick={() => router.push(`/dashboard/settings/data/${item.id}`)}
                    >
                      <TableCell className="w-[32%] min-w-64 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <SourceIcon source={item.source} />
                          <div className="grid min-w-0 gap-0.5">
                            <span className="line-clamp-2 font-medium whitespace-normal">
                              {item.name || "Untitled import"}
                            </span>
                            <span className="text-muted-foreground text-xs">{sourceLabel[item.source]}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-muted-foreground">
                        {item.types.map((t) => typeLabel[t]).join(", ")}
                      </TableCell>
                      <TableCell className="py-4">
                        <ImportStatusBadge item={item} />
                      </TableCell>
                      <TableCell className="py-4 tabular-nums">{item.imported.toLocaleString()} imported</TableCell>
                      <TableCell className="py-4 text-muted-foreground">{item.created}</TableCell>
                      <TableCell className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={`Open actions for ${item.name || "Untitled import"}`}
                              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                              size="icon-sm"
                              variant="ghost"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/settings/data/${item.id}`}>
                                <Eye /> View import
                              </Link>
                            </DropdownMenuItem>
                            {item.status === "failed" ? (
                              <DropdownMenuItem onSelect={() => retry(item)}>
                                <RotateCcw /> Retry
                              </DropdownMenuItem>
                            ) : null}
                            {isActive(item) && item.source !== "file" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => abandon(item)}>
                                  <XCircle /> Abandon
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <NewImportDialog
        open={open}
        onOpenChange={setOpen}
        onCreate={async (item) => {
          const next: DataImport = { ...item, id: dataImportsStore.nextId() };
          await dataImportsStore.apply((items) => [next, ...items]);
        }}
        blocked={rows.some((r) => isActive(r) && r.source !== "file")}
      />
    </div>
  );
}
