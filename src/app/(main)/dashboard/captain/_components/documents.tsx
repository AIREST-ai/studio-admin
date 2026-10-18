"use client";
import * as React from "react";

import { Copy, Eye, FileText, Globe, Plus, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { type CaptainDocument, type DocStatus, documentLimit } from "./data";
import { ConfirmDialog, DocumentDialog } from "./dialogs";
import { CaptainShell, ChipSelect, RowMenuTrigger, type Tone, ToneBadge } from "./shared";
import { type StoredDocument, useCaptainList, useCaptainState } from "./store";

const sampleRaw = (name: string) =>
  `# ${name}\n\nChoose the speed that suits your home. All plans include unlimited data, a free Wi-Fi 6 router and free installation for new customers in Doha, Al Rayyan, Al Wakrah and Lusail.\n\n- Home 100 Mbps: QAR 250 per month\n- Home 500 Mbps: QAR 360 per month\n- Home 1 Gbps: QAR 499 per month, includes TV Starter pack\n\nPrices include VAT where applicable. A 24-month commitment applies to all plans.`;

function syncText(d: CaptainDocument) {
  if (d.status === "Updating") return "updating...";
  if (d.status === "Needs update") return "update stalled";
  if (d.status === "Failed") return "Failed to sync";
  return `last updated ${d.syncedAgo}`;
}

// Copies by selecting a hidden textarea and running the browser's copy command, for pages where navigator.clipboard
// is missing (plain HTTP other than localhost, e.g. the Tailscale preview link) or refuses the write.
// The textarea goes inside the open sheet: outside it the dialog's focus trap pulls focus back and drops the selection.
// It counts as copied only when the command succeeds and the copy event really fired.
function copyBySelection(text: string, host: HTMLElement | null) {
  try {
    const previous = document.activeElement as HTMLElement | null;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.setAttribute("aria-hidden", "true");
    Object.assign(area.style, { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" });
    let fired = false;
    const onCopy = (e: ClipboardEvent) => {
      fired = true;
      if (!e.clipboardData) return; // the browser copies the selected textarea instead
      e.clipboardData.setData("text/plain", text);
      e.preventDefault();
    };
    (host ?? document.body).appendChild(area);
    document.addEventListener("copy", onCopy);
    try {
      area.focus({ preventScroll: true });
      area.select();
      return document.execCommand("copy") && fired;
    } finally {
      document.removeEventListener("copy", onCopy);
      area.remove();
      previous?.focus({ preventScroll: true });
    }
  } catch {
    return false;
  }
}

function DocumentSheet({ doc, onClose }: { doc: StoredDocument | null; onClose: () => void }) {
  const faqs = useCaptainList("faqs");
  const related = faqs.filter((f) => f.source === doc?.name);
  const [raw, setRaw] = React.useState(false);
  const [selectRaw, setSelectRaw] = React.useState(false);
  const actionsRef = React.useRef<HTMLDivElement>(null);
  const rawRef = React.useRef<HTMLPreElement>(null);
  // A Playground document carries its pasted text in `content`; seed documents keep the sample crawled page.
  const saved = doc?.content;

  // After a blocked copy the raw text is shown and selected, so it can be copied by hand.
  React.useEffect(() => {
    const pre = rawRef.current;
    if (!selectRaw || !pre) return;
    setSelectRaw(false);
    const range = document.createRange();
    range.selectNodeContents(pre);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    pre.scrollIntoView({ block: "nearest" });
  }, [selectRaw]);

  async function copy() {
    if (!doc) return;
    const text = saved ?? sampleRaw(doc.name);
    let copied = false;
    if (navigator.clipboard?.writeText) {
      copied = await navigator.clipboard.writeText(text).then(
        () => true,
        () => false,
      );
    }
    // Without navigator.clipboard this runs inside the click itself, as the browser's copy command requires.
    if (!copied) copied = copyBySelection(text, actionsRef.current);
    if (copied) {
      toast.success(saved === undefined ? "Crawled content copied to clipboard" : "Reference text copied to clipboard");
      return;
    }
    setRaw(true);
    setSelectRaw(true);
    toast.error("The browser blocked copying. The text is selected below: press Ctrl+C (⌘C on Mac) to copy it.");
  }
  return (
    <Sheet open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {doc && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{doc.name}</SheetTitle>
              <SheetDescription>
                {saved === undefined
                  ? "Review the crawled content and the FAQs generated from this source."
                  : "Review the reference text saved from the Playground and the FAQs generated from it."}
              </SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 border-b p-4 text-sm">
              <div className="col-span-2 grid gap-1">
                <span className="text-muted-foreground text-xs">Source</span>
                <span className="truncate font-mono text-xs">{doc.url}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">Generated FAQs</span>
                <span>{doc.faqs}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">Used in conversations</span>
                <span>{doc.conversations}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">Last updated</span>
                <span>{doc.syncedAgo}</span>
              </div>
            </div>
            <Tabs defaultValue="content" className="flex-1 overflow-y-auto p-4">
              <TabsList>
                <TabsTrigger value="content">
                  {saved !== undefined && "Reference text"}
                  {saved === undefined && (doc.source === "pdf" ? "PDF details" : "Crawled content")}
                </TabsTrigger>
                <TabsTrigger value="faqs">Related FAQs</TabsTrigger>
              </TabsList>
              <TabsContent value="content" className="grid gap-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    {saved === undefined
                      ? "4,182 characters extracted"
                      : `${saved.length.toLocaleString("en-US")} characters saved`}
                  </span>
                  <div ref={actionsRef} className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRaw((r) => !r)}>
                      {raw ? "View preview" : "View raw"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={copy}>
                      <Copy /> Copy
                    </Button>
                  </div>
                </div>
                {raw && (
                  <pre
                    ref={rawRef}
                    className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed"
                  >
                    {saved ?? sampleRaw(doc.name)}
                  </pre>
                )}
                {!raw && saved !== undefined && (
                  <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                    {saved}
                  </div>
                )}
                {!raw && saved === undefined && (
                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                    <h3 className="font-semibold">{doc.name}</h3>
                    <p>
                      Choose the speed that suits your home. All plans include unlimited data, a free Wi-Fi 6 router and
                      free installation for new customers in Doha, Al Rayyan, Al Wakrah and Lusail.
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Home 100 Mbps: QAR 250 per month</li>
                      <li>Home 500 Mbps: QAR 360 per month</li>
                      <li>Home 1 Gbps: QAR 499 per month, includes TV Starter pack</li>
                    </ul>
                    <p>Prices include VAT where applicable. A 24-month commitment applies to all plans.</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="faqs" className="grid gap-2 pt-2">
                {related.length ? (
                  related.map((f) => (
                    <div key={f.id} className="grid gap-1 rounded-lg border p-3">
                      <span className="font-medium text-sm">{f.question}</span>
                      <span className="text-muted-foreground text-sm">{f.answer}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-muted-foreground text-sm">
                    No FAQs have been generated from this document yet.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const sourceOptions = [
  { value: "all", label: "All sources" },
  { value: "web", label: "Web pages" },
  { value: "pdf", label: "PDFs" },
];
const statusOptions = [
  { value: "any", label: "Any status" },
  { value: "Updated", label: "Updated" },
  { value: "Needs update", label: "Needs update" },
  { value: "Updating", label: "Updating" },
  { value: "Failed", label: "Failed" },
];
const sortOptions = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Recently created" },
  { value: "used", label: "Most used in conversations" },
];
const statusBadgeTone: Record<DocStatus, Tone> = {
  Updated: "green",
  "Needs update": "amber",
  Updating: "sky",
  Failed: "red",
};

export function DocumentsList() {
  const [items, setItems] = useCaptainState("documents");
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState("all");
  const [status, setStatus] = React.useState("any");
  const [sort, setSort] = React.useState("updated");
  const [selected, setSelected] = React.useState<number[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CaptainDocument | "bulk" | null>(null);
  const [viewing, setViewing] = React.useState<StoredDocument | null>(null);
  const [limitBanner, setLimitBanner] = React.useState(true);

  const rows = items
    .filter(
      (d) =>
        (source === "all" || d.source === source) &&
        (status === "any" || d.status === status) &&
        (!query || `${d.name} ${d.url}`.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) => {
      if (sort === "used") return b.conversations - a.conversations;
      if (sort === "created") return b.id - a.id;
      return a.id - b.id;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  function refresh(ids: number[]) {
    setItems((list) => list.map((d) => (ids.includes(d.id) ? { ...d, status: "Updating" as DocStatus } : d)));
    toast.success(ids.length > 1 ? `${ids.length} documents queued for refresh` : "Document refresh queued");
  }

  return (
    <CaptainShell
      title="Documents"
      subtitle="Web pages and PDFs your assistant learns from. Captain turns them into FAQs it can use in replies."
      actions={
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Create a new document
        </Button>
      }
    >
      {limitBanner && items.length >= documentLimit && (
        <Alert className="flex items-center gap-3 border-amber-500/30 bg-amber-500/5">
          <TriangleAlert className="size-4 text-amber-600" />
          <AlertDescription className="flex-1 text-foreground">
            Document limit reached. Upgrade to continue using Captain AI.
          </AlertDescription>
          <Button size="sm" variant="outline">
            Upgrade now
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setLimitBanner(false)}>
            <X />
          </Button>
        </Alert>
      )}
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">All documents</CardTitle>
          <CardDescription>{items.length} knowledge sources for Noor.</CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <ExpandingSearch
              name="documents"
              label="Search documents"
              placeholder="Search..."
              className="w-full md:w-64"
              value={query}
              onChange={setQuery}
            />
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <ChipSelect label="Source" value={source} options={sourceOptions} onChange={setSource} />
              <ChipSelect label="Status" value={status} options={statusOptions} onChange={setStatus} />
            </div>
            <ChipSelect label="Sort" value={sort} options={sortOptions} onChange={setSort} align="end" />
          </div>
          <div className="flex min-h-8 flex-wrap items-center gap-2 px-4">
            <span className="text-muted-foreground text-sm tabular-nums">{selected.length} selected</span>
            {selected.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}>
                  {allSelected ? `Unselect all (${rows.length})` : `Select all (${rows.length})`}
                </Button>
                <div className="ms-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => refresh(selected)}>
                    <RefreshCw /> Refresh
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleting("bulk")}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              </>
            )}
          </div>

          {rows.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader className="[&_tr]:border-t">
                <TableRow>
                  <TableHead className="w-10 py-4">
                    <Checkbox
                      aria-label="Select all"
                      checked={allSelected}
                      onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.id) : [])}
                    />
                  </TableHead>
                  <TableHead className="py-4 font-normal">Document</TableHead>
                  <TableHead className="py-4 font-normal">Sync status</TableHead>
                  <TableHead className="py-4 font-normal">FAQs</TableHead>
                  <TableHead className="py-4 font-normal">Usage</TableHead>
                  <TableHead className="py-4 font-normal">Created</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow
                    key={d.id}
                    className="border-border/60"
                    data-state={selected.includes(d.id) ? "selected" : undefined}
                  >
                    <TableCell className="py-4">
                      <Checkbox
                        aria-label={`Select ${d.name}`}
                        checked={selected.includes(d.id)}
                        onCheckedChange={(c) => setSelected((p) => (c ? [...p, d.id] : p.filter((x) => x !== d.id)))}
                      />
                    </TableCell>
                    <TableCell className="py-4">
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => setViewing(d)}>
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {d.source === "pdf" ? (
                            <FileText className="size-4 text-red-500" />
                          ) : (
                            <Globe className="size-4 text-sky-600" />
                          )}
                        </div>
                        <div className="grid max-w-md gap-0.5">
                          <span className="font-medium text-sm hover:underline">{d.name}</span>
                          <span className="truncate text-muted-foreground text-sm">{d.url}</span>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="py-4">
                      <ToneBadge tone={statusBadgeTone[d.status]}>{syncText(d)}</ToneBadge>
                    </TableCell>
                    <TableCell className="py-4">
                      <ToneBadge tone={d.faqs ? "violet" : "muted"} dot={false}>
                        {d.faqs} {d.faqs === 1 ? "FAQ" : "FAQs"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground text-sm">
                      {d.conversations ? `Used in ${d.conversations} conversations` : "Not used in conversations yet"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-4 text-muted-foreground text-sm">
                      {d.createdAt}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <RowMenuTrigger label={`Open actions for ${d.name}`} />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => setViewing(d)}>
                            <Eye /> View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => refresh([d.id])}>
                            <RefreshCw /> {d.status === "Failed" ? "Retry refresh" : "Refresh now"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(d)}>
                            <Trash2 /> Delete Document
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <>
              {items.length === 0 && (
                <Empty className="border-t">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>No documents available</EmptyTitle>
                    <EmptyDescription>
                      Documents are used by your assistant to generate FAQs. You can import documents to provide context
                      for your assistant.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" onClick={() => setAdding(true)}>
                      <Plus /> Create a new document
                    </Button>
                    <p className="max-w-md text-muted-foreground text-xs">
                      <span className="font-medium text-foreground">Captain Document: </span>A document in Captain
                      serves as a knowledge resource for the assistant. By connecting your help center or guides,
                      Captain can analyze the content and provide accurate responses for customer inquiries.
                    </p>
                  </EmptyContent>
                </Empty>
              )}
              {items.length > 0 && (
                <Empty className="border-t">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>No documents match these filters</EmptyTitle>
                    <EmptyDescription>Try changing the source, status, or search term.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        setSource("all");
                        setStatus("any");
                      }}
                    >
                      Clear filters
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <DocumentDialog open={adding} onOpenChange={setAdding} />
      <DocumentSheet doc={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={deleting !== null && deleting !== "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Are you sure to delete the document?"
        description="This action is permanent. Deleting this document will permanently erase all generated knowledge."
        success="Document deleted successfully"
        onConfirm={() => {
          const target = deleting;
          if (target && target !== "bulk") setItems((list) => list.filter((d) => d.id !== target.id));
        }}
      />
      <ConfirmDialog
        open={deleting === "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete documents?"
        description="Are you sure you want to delete the selected documents? This action cannot be undone."
        confirm="Yes, delete all"
        success="Documents deleted successfully"
        onConfirm={() => {
          setItems((list) => list.filter((d) => !selected.includes(d.id)));
          setSelected([]);
        }}
      />
    </CaptainShell>
  );
}
