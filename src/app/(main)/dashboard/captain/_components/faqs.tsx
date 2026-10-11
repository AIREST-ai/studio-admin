"use client";
import * as React from "react";

import { Check, EllipsisVertical, FileText, MessageSquare, Pencil, Search, Sparkles, Trash2, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { type Faq, faqs, type Suggestion, suggestions } from "./data";
import { ConfirmDialog, FaqDialog } from "./dialogs";
import { CaptainCardHeader } from "./shared";

function FaqCard({
  faq,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  faq: Faq;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fromConversation = faq.source.startsWith("Conversation");
  return (
    <div className="group flex gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/40 data-[selected=true]:border-primary/40 data-[selected=true]:bg-primary/5" data-selected={selected}>
      <Checkbox className="mt-1" checked={selected} onCheckedChange={(c) => onSelect(c === true)} aria-label="Select FAQ" />
      <div className="grid flex-1 gap-2">
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium">{faq.question}</span>
          <div className="flex items-center gap-1">
            {faq.status === "pending" && (
              <Badge variant="outline" className="border-amber-500/40 font-normal text-amber-700 dark:text-amber-400">
                Pending
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="FAQ options">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {faq.status === "pending" && (
                  <DropdownMenuItem>
                    <Check /> Approve
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{faq.answer}</p>
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span className="inline-flex items-center gap-1.5">
            {fromConversation ? <MessageSquare className="size-3.5" /> : <FileText className="size-3.5" />}
            {faq.source}
          </span>
          <span>·</span>
          <span>{faq.createdAt}</span>
        </div>
      </div>
    </div>
  );
}

function ReviewDialog({ s, onClose }: { s: Suggestion | null; onClose: () => void }) {
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
                  <span className="text-muted-foreground text-xs tabular-nums">3 of {s.conversations}</span>
                </div>
                {[
                  ["#4921", "Maryam Al-Kuwari", "I paid my October bill twice from the app by mistake..."],
                  ["#4875", "Omar Haddad", "Money taken two times for the same invoice, can I get it back?"],
                  ["#4810", "Aisha Al-Suwaidi", "Double charge on my card for home internet."],
                ].map(([id, name, text]) => (
                  <div key={id} className="grid gap-1 rounded-lg border p-3 text-sm">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">Conversation {id}</span>
                    </div>
                    <span className="text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <DialogClose asChild>
                <Button variant="ghost">Dismiss</Button>
              </DialogClose>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Save changes</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Approve FAQ</Button>
                </DialogClose>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FaqsPage({ initialTab = "approved" }: { initialTab?: string }) {
  const [tab, setTab] = React.useState(initialTab);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<number[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Faq | null>(null);
  const [deleting, setDeleting] = React.useState<"one" | "bulk" | null>(null);
  const [reviewing, setReviewing] = React.useState<Suggestion | null>(null);

  const q = query.toLowerCase();
  const rows = faqs.filter((f) => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  const pending = suggestions.filter((s) => !q || s.question.toLowerCase().includes(q));

  return (
    <>
      <Card>
        <CaptainCardHeader title="FAQs">
          <InputGroup className="h-7 w-full md:w-56">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              type="search"
              placeholder={tab === "pending" ? "Search suggestions..." : "Search FAQs..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
          <Button size="sm" onClick={() => setCreating(true)}>
            Create new FAQ
          </Button>
        </CaptainCardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="approved">
                  FAQs <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{faqs.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pending">
                  FAQ suggestions{" "}
                  <Badge className="ml-1 h-4 px-1.5 text-[10px]">{suggestions.length}</Badge>
                </TabsTrigger>
              </TabsList>
              {tab === "approved" && selected.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm tabular-nums">{selected.length} selected</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(rows.map((r) => r.id))}>
                    Select all ({rows.length})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleting("bulk")}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="approved" className="grid gap-3">
              <Alert className="flex items-center gap-3">
                <Sparkles className="size-4 text-primary" />
                <AlertDescription className="flex-1 text-foreground">
                  Captain grouped recurring customer questions into FAQ suggestions.
                </AlertDescription>
                <Button size="sm" variant="outline" onClick={() => setTab("pending")}>
                  Review suggestions
                </Button>
              </Alert>
              {rows.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {rows.map((f) => (
                    <FaqCard
                      key={f.id}
                      faq={f}
                      selected={selected.includes(f.id)}
                      onSelect={(v) => setSelected((p) => (v ? [...p, f.id] : p.filter((x) => x !== f.id)))}
                      onEdit={() => setEditing(f)}
                      onDelete={() => setDeleting("one")}
                    />
                  ))}
                </div>
              ) : (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Search />
                    </EmptyMedia>
                    <EmptyTitle>No FAQs Found</EmptyTitle>
                    <EmptyDescription>
                      FAQs help your assistant provide quick and accurate answers to questions from your customers.
                      They can be generated automatically from your content or can be added manually.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                      Clear active filters
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </TabsContent>

            <TabsContent value="pending" className="grid gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">{pending.length} suggestions to review</span>
                <span className="text-muted-foreground text-xs">Ranked by customer demand</span>
              </div>
              {pending.length ? (
                pending.map((s, i) => (
                  <div key={s.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-start">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs tabular-nums">
                      {i + 1}
                    </div>
                    <div className="grid flex-1 gap-1.5">
                      <span className="font-medium">{s.question}</span>
                      <p className="text-muted-foreground text-sm">{s.answer}</p>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                        <MessageSquare className="size-3.5" /> {s.conversations} conversations
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="ghost" size="sm">
                        <X /> Dismiss
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReviewing(s)}>
                        Review sources
                      </Button>
                      <Button size="sm">
                        <Check /> Approve
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Check />
                    </EmptyMedia>
                    <EmptyTitle>The review queue is clear</EmptyTitle>
                    <EmptyDescription>New FAQ suggestions will appear here when they are ready to review.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <FaqDialog open={creating} onOpenChange={setCreating} />
      <FaqDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ?? undefined}
      />
      <ReviewDialog s={reviewing} onClose={() => setReviewing(null)} />
      <ConfirmDialog
        open={deleting === "one"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Are you sure to delete the FAQ?"
      />
      <ConfirmDialog
        open={deleting === "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete FAQs?"
        description="Are you sure you want to delete the selected FAQs? This action cannot be undone."
        confirm="Yes, delete all"
      />
    </>
  );
}
