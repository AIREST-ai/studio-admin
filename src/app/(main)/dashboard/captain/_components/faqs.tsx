"use client";
// Chatwoot: routes/dashboard/captain/responses/Index.vue (ResponseCard, CreateResponseDialog, BulkSelectBar,
// suggestions banner) and responses/FaqSuggestions.vue (FaqSuggestionCard, FaqSuggestionReviewDialog).
// Studio: heading outside the card, chips, table in a card with one "…" menu per row.
import * as React from "react";

import Link from "next/link";

import { Check, FileText, MessageSquare, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { type Faq, faqs, type Suggestion, suggestions } from "./data";
import { ConfirmDialog, FaqDialog } from "./dialogs";
import { CaptainShell, ChipSelect, RowMenuTrigger, ToneBadge } from "./shared";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
];
const sourceOptions = [
  { value: "all", label: "All sources" },
  { value: "documents", label: "Documents" },
  { value: "conversations", label: "Conversations" },
];

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <InputGroup className="h-7 w-full md:w-64">
      <InputGroupAddon align="inline-start">
        <Search className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        className="h-7"
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </InputGroup>
  );
}

export function FaqsPage() {
  const [items, setItems] = React.useState(faqs);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [selected, setSelected] = React.useState<number[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Faq | null>(null);
  const [deleting, setDeleting] = React.useState<Faq | "bulk" | null>(null);

  const q = query.trim().toLowerCase();
  const rows = items.filter((f) => {
    const fromConversation = f.source.startsWith("Conversation");
    return (
      (!q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)) &&
      (status === "all" || f.status === status) &&
      (source === "all" || (source === "conversations") === fromConversation)
    );
  });
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  function approve(ids: number[]) {
    setItems((list) => list.map((f) => (ids.includes(f.id) ? { ...f, status: "approved" as const } : f)));
    setSelected([]);
    toast.success(ids.length > 1 ? "FAQs approved successfully" : "FAQ approved successfully");
  }

  return (
    <CaptainShell
      title="FAQs"
      subtitle="Questions and answers your assistant uses to reply. Captain generates them from documents and resolved conversations."
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> Create new FAQ
        </Button>
      }
    >
      <Alert className="flex items-center gap-3">
        <Sparkles className="size-4 text-primary" />
        <AlertDescription className="flex-1 text-foreground">
          Captain grouped recurring customer questions into FAQ suggestions.
        </AlertDescription>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/captain/faqs/suggestions">Review suggestions</Link>
        </Button>
      </Alert>

      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">All FAQs</CardTitle>
          <CardDescription>
            {items.filter((f) => f.status === "approved").length} approved ·{" "}
            {items.filter((f) => f.status === "pending").length} pending
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <SearchBox value={query} onChange={setQuery} placeholder="Search FAQs..." />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center gap-3 px-4">
            <ChipSelect label="Status" value={status} options={statusOptions} onChange={setStatus} />
            <ChipSelect label="Source" value={source} options={sourceOptions} onChange={setSource} />
          </div>
          <div className="flex min-h-8 flex-wrap items-center gap-2 px-4">
            <span className="text-muted-foreground text-sm tabular-nums">
              {selected.length} {selected.length === 1 ? "FAQ selected" : "FAQs selected"}
            </span>
            {selected.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}>
                  {allSelected ? `Unselect all (${rows.length})` : `Select all (${rows.length})`}
                </Button>
                <div className="ms-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => approve(selected)}>
                    <Check /> Approve
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
                      aria-label="Select all FAQs"
                      checked={allSelected}
                      onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.id) : [])}
                    />
                  </TableHead>
                  <TableHead className="py-4 font-normal">Question and answer</TableHead>
                  <TableHead className="py-4 font-normal">Source</TableHead>
                  <TableHead className="py-4 font-normal">Status</TableHead>
                  <TableHead className="py-4 font-normal">Created</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((f) => {
                  const fromConversation = f.source.startsWith("Conversation");
                  return (
                    <TableRow
                      key={f.id}
                      className="border-border/60"
                      data-state={selected.includes(f.id) ? "selected" : undefined}
                    >
                      <TableCell className="py-4 align-top">
                        <Checkbox
                          aria-label={`Select ${f.question}`}
                          checked={selected.includes(f.id)}
                          onCheckedChange={(c) => setSelected((p) => (c ? [...p, f.id] : p.filter((x) => x !== f.id)))}
                        />
                      </TableCell>
                      <TableCell className="max-w-xl whitespace-normal py-4">
                        <button type="button" className="grid gap-1 text-left" onClick={() => setEditing(f)}>
                          <span className="font-medium text-sm hover:underline">{f.question}</span>
                          <span className="line-clamp-2 text-muted-foreground text-sm">{f.answer}</span>
                        </button>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground text-sm">
                          {fromConversation ? (
                            <MessageSquare className="size-3.5" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                          <span className="max-w-48 truncate">{f.source}</span>
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        {f.status === "approved" ? (
                          <ToneBadge tone="green">Approved</ToneBadge>
                        ) : (
                          <ToneBadge tone="amber">Pending</ToneBadge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-4 text-muted-foreground text-sm">
                        {f.createdAt}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <DropdownMenu>
                          <RowMenuTrigger label={`Open actions for ${f.question}`} />
                          <DropdownMenuContent align="end" className="w-40">
                            {f.status === "pending" && (
                              <DropdownMenuItem onSelect={() => approve([f.id])}>
                                <Check /> Approve
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => setEditing(f)}>
                              <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(f)}>
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Empty className="border-t">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>No FAQs Found</EmptyTitle>
                <EmptyDescription>
                  FAQs help your assistant provide quick and accurate answers to questions from your customers. They can
                  be generated automatically from your content or can be added manually.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                    setSource("all");
                  }}
                >
                  Clear active filters
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
      </Card>

      <FaqDialog open={creating} onOpenChange={setCreating} />
      <FaqDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null && deleting !== "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Are you sure to delete the FAQ?"
        success="FAQ deleted successfully"
        onConfirm={() => {
          const target = deleting;
          if (target && target !== "bulk") setItems((list) => list.filter((f) => f.id !== target.id));
        }}
      />
      <ConfirmDialog
        open={deleting === "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete FAQs?"
        description="Are you sure you want to delete the selected FAQs? This action cannot be undone."
        confirm="Yes, delete all"
        success="FAQs deleted successfully"
        onConfirm={() => {
          setItems((list) => list.filter((f) => !selected.includes(f.id)));
          setSelected([]);
        }}
      />
    </CaptainShell>
  );
}

const sourceConversations = [
  { id: "#4921", name: "Maryam Al-Kuwari", text: "I paid my October bill twice from the app by mistake..." },
  { id: "#4875", name: "Omar Al-Shehhi", text: "Money taken two times for the same invoice, can I get it back?" },
  { id: "#4810", name: "Aisha Al-Hajri", text: "Double charge on my card for home internet." },
  { id: "#4794", name: "Hamad Al-Marri", text: "Paid by Apple Pay and by card, both went through." },
  { id: "#4772", name: "Reem Al-Otaibi", text: "How long does it take to return a double payment?" },
];

function ReviewDialog({
  s,
  onClose,
  onApprove,
  onDismiss,
}: {
  s: Suggestion | null;
  onClose: () => void;
  onApprove: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}) {
  const [visible, setVisible] = React.useState(3);
  return (
    <Dialog open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {s && (
          <>
            <DialogHeader>
              <DialogTitle>Review FAQ suggestion</DialogTitle>
              <DialogDescription>
                Captain grouped {s.conversations} conversations into this suggestion. Review the evidence and refine the
                FAQ before approval.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="grid content-start gap-3">
                <div className="grid gap-2">
                  <Label>Question</Label>
                  <Input defaultValue={s.question} />
                </div>
                <div className="grid gap-2">
                  <Label>Answer</Label>
                  <Textarea defaultValue={s.answer} className="min-h-32" />
                </div>
              </div>
              <div className="grid content-start gap-2">
                <div className="flex items-center justify-between">
                  <Label>Source conversations</Label>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {Math.min(visible, s.conversations)} of {s.conversations}
                  </span>
                </div>
                <div className="grid max-h-72 gap-2 overflow-y-auto">
                  {sourceConversations.slice(0, visible).map((c) => (
                    <Link
                      key={c.id}
                      href="/dashboard/chat"
                      className="grid gap-1 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">Conversation {c.id}</span>
                      </div>
                      <span className="text-muted-foreground">{c.text}</span>
                    </Link>
                  ))}
                </div>
                {visible < sourceConversations.length && (
                  <Button variant="ghost" size="sm" onClick={() => setVisible(sourceConversations.length)}>
                    Load more
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => onDismiss(s)}>
                Dismiss
              </Button>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => toast.success("Suggestion updated.")}>
                    Save changes
                  </Button>
                </DialogClose>
                <Button onClick={() => onApprove(s)}>Approve FAQ</Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FaqSuggestionsPage() {
  const [items, setItems] = React.useState(suggestions);
  const [query, setQuery] = React.useState("");
  const [reviewing, setReviewing] = React.useState<Suggestion | null>(null);
  const q = query.trim().toLowerCase();
  const rows = items.filter((s) => !q || `${s.question} ${s.answer}`.toLowerCase().includes(q));

  function approve(s: Suggestion) {
    setItems((list) => list.filter((x) => x.id !== s.id));
    setReviewing(null);
    toast.success("FAQ approved and added to Captain's knowledge.");
  }
  function dismiss(s: Suggestion) {
    setItems((list) => list.filter((x) => x.id !== s.id));
    setReviewing(null);
    toast.success("Suggestion dismissed.");
  }

  return (
    <CaptainShell
      title="FAQ suggestions"
      subtitle="Captain grouped recurring customer questions into FAQ suggestions. Approve them so your assistant can resolve more on its own."
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/captain/faqs">Back to FAQs</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">
            {rows.length} {rows.length === 1 ? "suggestion to review" : "suggestions to review"}
          </CardTitle>
          <CardDescription>Ranked by customer demand</CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <SearchBox value={query} onChange={setQuery} placeholder="Search suggestions..." />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 py-4 font-normal">#</TableHead>
                  <TableHead className="py-4 font-normal">Suggested FAQ</TableHead>
                  <TableHead className="py-4 font-normal">Demand</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s, i) => (
                  <TableRow key={s.id} className="border-border/60">
                    <TableCell className="py-4 align-top">
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted font-medium text-xs tabular-nums">
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-2xl whitespace-normal py-4">
                      <button type="button" className="grid gap-1 text-left" onClick={() => setReviewing(s)}>
                        <span className="font-medium text-sm hover:underline">{s.question}</span>
                        <span className="line-clamp-2 text-muted-foreground text-sm">{s.answer}</span>
                      </button>
                    </TableCell>
                    <TableCell className="py-4">
                      <ToneBadge tone="violet">
                        {s.conversations} {s.conversations === 1 ? "conversation" : "conversations"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" onClick={() => approve(s)}>
                          <Check /> Approve
                        </Button>
                        <DropdownMenu>
                          <RowMenuTrigger label={`Open actions for ${s.question}`} />
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => setReviewing(s)}>
                              <MessageSquare /> Review sources
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => approve(s)}>
                              <Check /> Approve
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => dismiss(s)}>
                              <X /> Dismiss
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Check />
                </EmptyMedia>
                <EmptyTitle>The review queue is clear</EmptyTitle>
                <EmptyDescription>New FAQ suggestions will appear here when they are ready to review.</EmptyDescription>
              </EmptyHeader>
              {query && (
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          )}
        </CardContent>
      </Card>
      <ReviewDialog
        key={reviewing?.id}
        s={reviewing}
        onClose={() => setReviewing(null)}
        onApprove={approve}
        onDismiss={dismiss}
      />
    </CaptainShell>
  );
}
