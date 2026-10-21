"use client";
// Chatwoot: routes/dashboard/captain/responses/Index.vue (ResponseCard, CreateResponseDialog, BulkSelectBar,
// suggestions banner) and responses/FaqSuggestions.vue (FaqSuggestionCard, FaqSuggestionReviewDialog).
// Studio: heading outside the card, chips, table in a card with one "…" menu per row.
import * as React from "react";

import Link from "next/link";

import { Check, FileText, MessageSquare, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
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
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import type { Faq, Suggestion } from "./data";
import { ConfirmDialog, FaqDialog } from "./dialogs";
import { CaptainShell, ChipSelect, RowMenuTrigger, ToneBadge } from "./shared";
import { nextId, setCaptainList, useCaptainState } from "./store";

const statusOptions = [
  { value: "all", label: "الكل" },
  { value: "approved", label: "معتمدة" },
  { value: "pending", label: "معلقة" },
];
const sourceOptions = [
  { value: "all", label: "كل المصادر" },
  { value: "documents", label: "المستندات" },
  { value: "conversations", label: "المحادثات" },
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
    <ExpandingSearch
      name="faqs"
      label={placeholder.replace(/(\.\.\.|…)$/, "")}
      placeholder={placeholder}
      className="w-full md:w-64"
      value={value}
      onChange={onChange}
    />
  );
}

// "Conversation #6" -> 6, opened at Chatwoot's conversation URL (/dashboard/chat/conversations/<id>).
const conversationId = (source: string) => source.match(/^Conversation #(\d+)$/)?.[1];

export function FaqsPage() {
  const [items, setItems] = useCaptainState("faqs");
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
    toast.success(ids.length > 1 ? "تم اعتماد الأسئلة بنجاح" : "تم اعتماد السؤال بنجاح");
  }

  return (
    <CaptainShell
      title="الأسئلة الشائعة"
      subtitle="أسئلة وأجوبة يستخدمها مساعدك الذكي للرد. يولدها الكابتن من المستندات والمحادثات المحلولة."
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> إضافة سؤال جديد
        </Button>
      }
    >
      <Alert className="flex items-center gap-3">
        <Sparkles className="size-4 text-primary" />
        <AlertDescription className="flex-1 text-foreground">
          جمّع الكابتن الأسئلة المتكررة من العملاء في اقتراحات أسئلة شائعة.
        </AlertDescription>
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/captain/faqs/suggestions">مراجعة الاقتراحات</Link>
        </Button>
      </Alert>

      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">كل الأسئلة الشائعة</CardTitle>
          <CardDescription>
            {items.filter((f) => f.status === "approved").length} معتمدة ·{" "}
            {items.filter((f) => f.status === "pending").length} معلقة
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <SearchBox value={query} onChange={setQuery} placeholder="ابحث في الأسئلة الشائعة…" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center gap-3 px-4">
            <ChipSelect label="الحالة" value={status} options={statusOptions} onChange={setStatus} />
            <ChipSelect label="المصدر" value={source} options={sourceOptions} onChange={setSource} />
          </div>
          <div className="flex min-h-8 flex-wrap items-center gap-2 px-4">
            <span className="text-muted-foreground text-sm tabular-nums">
              {selected.length} {selected.length === 1 ? "محدد" : "محدد"}
            </span>
            {selected.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}>
                  {allSelected ? `إلغاء تحديد الكل (${rows.length})` : `تحديد الكل (${rows.length})`}
                </Button>
                <div className="ms-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => approve(selected)}>
                    <Check /> اعتماد
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleting("bulk")}>
                    <Trash2 /> حذف
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
                      aria-label="تحديد الكل"
                      checked={allSelected}
                      onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.id) : [])}
                    />
                  </TableHead>
                  <TableHead className="py-4 font-normal">السؤال والجواب</TableHead>
                  <TableHead className="py-4 font-normal">المصدر</TableHead>
                  <TableHead className="py-4 font-normal">الحالة</TableHead>
                  <TableHead className="py-4 font-normal">تاريخ الإنشاء</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">إجراءات</div>
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
                          aria-label={`تحديد: ${f.question}`}
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
                          {conversationId(f.source) ? (
                            <Link
                              href={`/dashboard/chat/conversations/${conversationId(f.source)}`}
                              className="max-w-48 truncate text-primary hover:underline"
                            >
                              {f.source}
                            </Link>
                          ) : (
                            <span className="max-w-48 truncate">{f.source}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        {f.status === "approved" ? (
                          <ToneBadge tone="green">معتمدة</ToneBadge>
                        ) : (
                          <ToneBadge tone="amber">معلقة</ToneBadge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-4 text-muted-foreground text-sm">
                        {f.createdAt}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <DropdownMenu>
                          <RowMenuTrigger label={`إجراءات السؤال: ${f.question}`} />
                          <DropdownMenuContent align="end" className="w-40">
                            {f.status === "pending" && (
                              <DropdownMenuItem onSelect={() => approve([f.id])}>
                                <Check /> اعتماد
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => setEditing(f)}>
                              <Pencil /> تعديل
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(f)}>
                              <Trash2 /> حذف
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
                <EmptyMedia variant="icon" />
                <EmptyTitle>لا توجد أسئلة شائعة</EmptyTitle>
                <EmptyDescription>
                  الأسئلة الشائعة تساعد مساعدك الذكي في تقديم إجابات سريعة ودقيقة لأسئلة عملائك. يمكن توليدها آلياً من
                  محتواك أو إضافتها يدوياً.
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
                  مسح عوامل التصفية
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
        title="هل أنت متأكد من حذف هذا السؤال الشائع؟"
        success="تم حذف السؤال بنجاح"
        onConfirm={() => {
          const target = deleting;
          if (target && target !== "bulk") setItems((list) => list.filter((f) => f.id !== target.id));
        }}
      />
      <ConfirmDialog
        open={deleting === "bulk"}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="حذف الأسئلة الشائعة؟"
        description="هل أنت متأكد من حذف الأسئلة المحددة؟ لا يمكن التراجع عن هذا الإجراء."
        confirm="نعم، احذف الكل"
        success="تم حذف الأسئلة بنجاح"
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
  // The question and answer can be edited before approving; the approved FAQ keeps the edited text.
  const [question, setQuestion] = React.useState(s?.question ?? "");
  const [answer, setAnswer] = React.useState(s?.answer ?? "");
  return (
    <Dialog open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {s && (
          <>
            <DialogHeader>
              <DialogTitle>مراجعة اقتراح سؤال شائع</DialogTitle>
              <DialogDescription>
                يضم هذا الاقتراح {s.conversations} محادثة من بيانات مساحة الاختبار. راجع السؤال والجواب قبل الاعتماد.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="grid content-start gap-3">
                <div className="grid gap-2">
                  <Label>السؤال</Label>
                  <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>الجواب</Label>
                  <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-32" />
                </div>
              </div>
              <div className="grid content-start gap-2">
                <div className="flex items-center justify-between">
                  <Label>المحادثات المصدر</Label>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {Math.min(visible, s.conversations)} من {s.conversations}
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
                        <span className="text-muted-foreground">محادثة {c.id}</span>
                      </div>
                      <span className="text-muted-foreground">{c.text}</span>
                    </Link>
                  ))}
                </div>
                {visible < sourceConversations.length && (
                  <Button variant="ghost" size="sm" onClick={() => setVisible(sourceConversations.length)}>
                    تحميل المزيد
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => onDismiss(s)}>
                تجاهل
              </Button>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => toast.success("تم تحديث الاقتراح.")}>
                    حفظ التغييرات
                  </Button>
                </DialogClose>
                <Button
                  disabled={!question.trim() || !answer.trim()}
                  onClick={() => onApprove({ ...s, question: question.trim(), answer: answer.trim() })}
                >
                  اعتماد السؤال
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FaqSuggestionsPage() {
  const [items, setItems] = useCaptainState("suggestions");
  const [query, setQuery] = React.useState("");
  const [reviewing, setReviewing] = React.useState<Suggestion | null>(null);
  const q = query.trim().toLowerCase();
  const rows = items.filter((s) => !q || `${s.question} ${s.answer}`.toLowerCase().includes(q));

  // Approving adds the suggestion to the FAQs list (approved, sourced from the first conversation in its review).
  function approve(s: Suggestion) {
    setCaptainList("faqs", (list) => [
      {
        id: nextId(list),
        question: s.question,
        answer: s.answer,
        status: "approved",
        source: `Conversation ${sourceConversations[0].id}`,
        createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      },
      ...list,
    ]);
    setItems((list) => list.filter((x) => x.id !== s.id));
    setReviewing(null);
    toast.success("تم اعتماد السؤال وإضافته لمعرفة الكابتن.");
  }
  function dismiss(s: Suggestion) {
    setItems((list) => list.filter((x) => x.id !== s.id));
    setReviewing(null);
    toast.success("تم تجاهل الاقتراح.");
  }

  return (
    <CaptainShell
      title="اقتراحات الأسئلة الشائعة"
      subtitle="جمّع الكابتن الأسئلة المتكررة من العملاء في اقتراحات أسئلة شائعة. اعتمدها ليتمكن مساعدك من حل المزيد بنفسه."
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/captain/faqs">العودة للأسئلة الشائعة</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">
            {rows.length} {rows.length === 1 ? "اقتراح للمراجعة" : "اقتراح للمراجعة"}
          </CardTitle>
          <CardDescription>مرتبة حسب طلب العملاء</CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <SearchBox value={query} onChange={setQuery} placeholder="ابحث في الاقتراحات…" />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 py-4 font-normal">#</TableHead>
                  <TableHead className="py-4 font-normal">السؤال المقترح</TableHead>
                  <TableHead className="py-4 font-normal">الطلب</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">إجراءات</div>
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
                        {s.conversations} {s.conversations === 1 ? "محادثة" : "محادثة"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" onClick={() => approve(s)}>
                          <Check /> اعتماد
                        </Button>
                        <DropdownMenu>
                          <RowMenuTrigger label={`إجراءات الاقتراح: ${s.question}`} />
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => setReviewing(s)}>
                              <MessageSquare /> مراجعة المصادر
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => approve(s)}>
                              <Check /> اعتماد
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => dismiss(s)}>
                              <X /> تجاهل
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
                <EmptyTitle>قائمة المراجعة فارغة</EmptyTitle>
                <EmptyDescription>ستظهر اقتراحات الأسئلة الشائعة الجديدة هنا حين تكون جاهزة للمراجعة.</EmptyDescription>
              </EmptyHeader>
              {query && (
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                    مسح البحث
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
