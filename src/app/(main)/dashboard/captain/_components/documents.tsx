"use client";
import * as React from "react";

import { cn } from "cn";
import { Copy, EllipsisVertical, Eye, FileText, Globe, RefreshCw, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { type CaptainDocument, type DocStatus, documents, faqs } from "./data";
import { ConfirmDialog, DocumentDialog } from "./dialogs";
import { CaptainCardHeader } from "./shared";

const statusTone: Record<DocStatus, string> = {
  Updated: "bg-emerald-500",
  "Needs update": "bg-amber-500",
  Updating: "bg-sky-500",
  Failed: "bg-red-500",
};

function syncText(d: CaptainDocument) {
  if (d.status === "Updating") return "updating...";
  if (d.status === "Failed") return "Failed to sync";
  return `last updated ${d.syncedAgo}`;
}

function DocumentSheet({ doc, onClose }: { doc: CaptainDocument | null; onClose: () => void }) {
  const related = faqs.filter((f) => f.source === doc?.name);
  return (
    <Sheet open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {doc && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{doc.name}</SheetTitle>
              <SheetDescription>Review the crawled content and the FAQs generated from this source.</SheetDescription>
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
                <TabsTrigger value="content">{doc.source === "pdf" ? "PDF details" : "Crawled content"}</TabsTrigger>
                <TabsTrigger value="faqs">Related FAQs</TabsTrigger>
              </TabsList>
              <TabsContent value="content" className="grid gap-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">4,182 characters extracted</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      View raw
                    </Button>
                    <Button variant="outline" size="sm">
                      <Copy /> Copy
                    </Button>
                  </div>
                </div>
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

export function DocumentsList() {
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState("all");
  const [status, setStatus] = React.useState("any");
  const [selected, setSelected] = React.useState<number[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<"one" | "bulk" | null>(null);
  const [viewing, setViewing] = React.useState<CaptainDocument | null>(null);

  const rows = documents.filter(
    (d) =>
      (source === "all" || d.source === source) &&
      (status === "any" || d.status === status) &&
      (!query || d.name.toLowerCase().includes(query.toLowerCase())),
  );
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <>
      <Card>
        <CaptainCardHeader title="Documents">
          <InputGroup className="h-7 w-full md:w-56">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              type="search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
          <Button size="sm" onClick={() => setAdding(true)}>
            Create a new document
          </Button>
        </CaptainCardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center gap-2 px-4">
            <NativeSelect size="sm" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              <option value="web">Web pages</option>
              <option value="pdf">PDFs</option>
            </NativeSelect>
            <NativeSelect size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="any">Any status</option>
              <option value="Updated">Updated</option>
              <option value="Needs update">Needs update</option>
              <option value="Updating">Updating</option>
              <option value="Failed">Failed</option>
            </NativeSelect>
            <NativeSelect size="sm" defaultValue="updated">
              <option value="updated">Recently updated</option>
              <option value="created">Recently created</option>
              <option value="used">Most used in conversations</option>
            </NativeSelect>
            {selected.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-muted-foreground text-sm tabular-nums">{selected.length} selected</span>
                <Button variant="outline" size="sm">
                  <RefreshCw /> Refresh
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleting("bulk")}>
                  <Trash2 /> Delete
                </Button>
              </div>
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
                  <TableHead className="py-4 font-normal">Name</TableHead>
                  <TableHead className="py-4 font-normal">Status</TableHead>
                  <TableHead className="py-4 font-normal">FAQs</TableHead>
                  <TableHead className="py-4 font-normal">Usage</TableHead>
                  <TableHead className="py-4 font-normal">Created</TableHead>
                  <TableHead className="w-12 py-4" />
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
                        onCheckedChange={(c) =>
                          setSelected((p) => (c ? [...p, d.id] : p.filter((x) => x !== d.id)))
                        }
                      />
                    </TableCell>
                    <TableCell className="py-4">
                      <button
                        type="button"
                        className="flex items-center gap-3 text-left"
                        onClick={() => setViewing(d)}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {d.source === "pdf" ? (
                            <FileText className="size-4 text-red-500" />
                          ) : (
                            <Globe className="size-4 text-sky-600" />
                          )}
                        </div>
                        <div className="grid max-w-md gap-0.5">
                          <span className="font-medium">{d.name}</span>
                          <span className="truncate text-muted-foreground text-xs">{d.url}</span>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                        <span className={cn("size-2 rounded-full", statusTone[d.status])} />
                        <span className={cn(d.status === "Failed" && "text-red-600")}>{syncText(d)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="font-normal">
                        {d.faqs} {d.faqs === 1 ? "FAQ" : "FAQs"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground text-sm">
                      Used in {d.conversations} conversations
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-4 text-muted-foreground text-sm">
                      {d.createdAt}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Document options">
                            <EllipsisVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => setViewing(d)}>
                            <Eye /> View details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RefreshCw /> {d.status === "Failed" ? "Retry refresh" : "Refresh now"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting("one")}>
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
            <Empty className="border-t">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No matching documents</EmptyTitle>
                <EmptyDescription>Try changing the source, status, or search term.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <DocumentDialog open={adding} onOpenChange={setAdding} />
      <DocumentSheet doc={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={deleting === "one"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Are you sure to delete the document?"
        description="This action is permanent. Deleting this document will permanently erase all generated knowledge."
      />
      <ConfirmDialog
        open={deleting === "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete documents?"
        description="Are you sure you want to delete the selected documents? This action cannot be undone."
        confirm="Yes, delete all"
      />
    </>
  );
}
