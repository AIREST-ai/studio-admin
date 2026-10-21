"use client";
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Clock, Copy, FlaskConical, LayoutTemplate, Pencil, Plus, Sparkles, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ConfirmDelete, NoResults, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, RowMenu, ToneBadge, tableClass } from "../../labels/_shared/settings-ui";
import { approvalState } from "../_flow/compile";
import { type AutomationItem, type FlowRecord, flowOfRule, flowsOf, rulesOf, withRules } from "../_flow/model";
import { isSimDoc } from "../_flow/sim-catalog";
import { loadAutomation, SectionConflict, saveAutomation } from "../_flow/storage";
import { durationText, eventLabels, type Rule, RuleDialog, type RunType } from "./rule-form";

function today() {
  return new Date().toLocaleDateString("ar-SA", { month: "short", day: "2-digit", year: "numeric" });
}

const flowHref = (id: string) => `/dashboard/automation/flow/${id}`;

interface DbAutomationRule {
  id: string;
  name: string;
  triggerLabel: string;
  actionLabel: string;
  channel: string;
  active: boolean;
  executionsCount: number;
}

function LuxuryAutomationStudioCard() {
  const [dbRules, setDbRules] = React.useState<DbAutomationRule[]>([]);
  const [newName, setNewName] = React.useState("");
  const [newTrigger, setNewTrigger] = React.useState("عند رصد تأخر رد أو رسالة عميل مهمة");
  const [newAction, setNewAction] = React.useState("تدخل إيمه الفوري وتنبيه المشرف في الصندوق الموحد");
  const [saving, setSaving] = React.useState(false);

  const loadDbRules = React.useCallback(async () => {
    try {
      const res = await fetch("/api/workspace-hub?companyId=tenant_demo_cars", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.automationRules)) setDbRules(data.automationRules);
      }
    } catch {
      // ignore transient errors
    }
  }, []);

  React.useEffect(() => {
    void loadDbRules();
  }, [loadDbRules]);

  async function toggleRule(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/workspace-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "tenant_demo_cars", action: "automation.toggle", id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.automationRules)) setDbRules(data.automationRules);
        toast.success("حُفظت حالة قاعدة الأتمتة في قاعدة بيانات PostgreSQL");
      }
    } finally {
      setSaving(false);
    }
  }

  async function createQuickRule() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workspace-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: "tenant_demo_cars",
          action: "automation.create",
          name: newName.trim(),
          triggerLabel: newTrigger.trim(),
          actionLabel: newAction.trim(),
          channel: "جميع القنوات",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.automationRules)) setDbRules(data.automationRules);
        setNewName("");
        toast.success("أُضيفت قاعدة الأتمتة الفخمة وحُفظت في قاعدة بيانات PostgreSQL");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      dir="rtl"
      data-testid="luxury-automation-studio"
      className="border-primary/25 bg-linear-to-br from-primary/10 via-violet-500/5 to-card shadow-xs"
    >
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4.5 text-primary" />
              <span className="font-semibold text-base sm:text-lg">
                لوحة الأتمتة الفخمة المبسطة · تحكم ذكي بضغطة زر
              </span>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                {saving ? "جارٍ الحفظ في PostgreSQL…" : "متصل بقاعدة بيانات PostgreSQL الحية"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              قواعد أتمتة فخمة واضحة دون تعقيد: تصعيد الغضب الفوري، بوابة القاضي سول لكشف التهرب المهذب، استلام إيمه
              خارج الدوام، وإصدار الفواتير التلقائي.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/automation/templates">
                <LayoutTemplate className="size-4" /> مكتبة القوالب الجاهزة
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/automation/flow/new">
                <Workflow className="size-4" /> فتح مصمم التدفق البصري
              </Link>
            </Button>
          </div>
        </div>

        {/* إضافة قاعدة أتمتة سريعة بضغطة زر */}
        <div className="grid gap-2 rounded-xl border bg-background/85 p-3 sm:grid-cols-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم القاعدة الجديدة (مثال: تحويل عملاء VIP للمدير)…"
            className="h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
            placeholder="الحدث المشغّل (متى تعمل؟)"
            className="h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            placeholder="الإجراء التلقائي (ماذا تفعل؟)"
            className="h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={() => void createQuickRule()}>
            <Plus className="size-3.5" />
            إضافة قاعدة أتمتة ذكية
          </Button>
        </div>

        {/* بطاقات قواعد الأتمتة الفخمة المرتبطة بـ PostgreSQL */}
        <div className="grid gap-3 md:grid-cols-2">
          {dbRules.map((rule) => (
            <div
              key={rule.id}
              data-testid={`luxury-rule-${rule.id}`}
              className="flex flex-col justify-between gap-2.5 rounded-xl border bg-background/90 p-3.5 shadow-2xs transition hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{rule.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {rule.channel}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    <strong className="text-foreground">الشرط:</strong> {rule.triggerLabel}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    <strong className="text-foreground">الإجراء:</strong> {rule.actionLabel}
                  </p>
                </div>
                <Switch
                  checked={rule.active}
                  onCheckedChange={() => void toggleRule(rule.id)}
                  aria-label={`تفعيل ${rule.name}`}
                />
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
                <span>
                  الحالة:{" "}
                  <strong className={rule.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                    {rule.active ? "مفعّلة وتعمل حياً" : "متوقفة مؤقتاً"}
                  </strong>
                </span>
                <span>عدد مرات التنفيذ: {rule.executionsCount} مرة</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AutomationList() {
  const router = useRouter();
  const [items, setItems] = React.useState<AutomationItem[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = React.useState("");
  const [deletingDraft, setDeletingDraft] = React.useState<FlowRecord | undefined>();
  const itemsRef = React.useRef<AutomationItem[]>([]);
  const revRef = React.useRef(0);
  const queue = React.useRef<Promise<void>>(Promise.resolve());
  const rules = React.useMemo(() => rulesOf(items), [items]);
  const flows = React.useMemo(() => flowsOf(items), [items]);

  const load = React.useCallback(async () => {
    setStatus("loading");
    try {
      const loaded = await loadAutomation();
      itemsRef.current = loaded.items;
      revRef.current = loaded.rev;
      setItems(loaded.items);
      setStatus("ready");
    } catch (error) {
      setLoadError((error as Error).message);
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = (nextItems: AutomationItem[], success: string) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
    queue.current = queue.current.then(async () => {
      try {
        const saved = await saveAutomation(nextItems, revRef.current);
        revRef.current = saved.rev;
        toast.success(success);
      } catch (error) {
        toast.error(
          error instanceof SectionConflict
            ? "لم يُحفظ: تم تعديل الأتمتة في نافذة أخرى وتم تحديث القائمة."
            : `تعذر الحفظ: ${(error as Error).message}`,
        );
        await load();
      }
    });
  };
  const setRules = (change: (prev: Rule[]) => Rule[], success: string) =>
    save(withRules(itemsRef.current, change(rulesOf(itemsRef.current))), success);
  const [tab, setTab] = React.useState<RunType>("instant");
  const [query, setQuery] = React.useState("");
  const [eventFilter, setEventFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [editing, setEditing] = React.useState<Rule | undefined>();
  const [deleting, setDeleting] = React.useState<Rule | undefined>();
  const [toggling, setToggling] = React.useState<Rule | undefined>();

  const q = query.trim().toLowerCase();
  const rows = rules.filter(
    (r) =>
      r.runType === tab &&
      (eventFilter === "All" || eventLabels[r.event] === eventFilter) &&
      (statusFilter === "All" || (statusFilter === "Active") === r.active) &&
      `${r.name} ${r.description}`.toLowerCase().includes(q),
  );
  const filtered = q || eventFilter !== "All" || statusFilter !== "All";
  const ruleIds = new Set(rules.map((r) => r.id));
  const drafts = flows.filter((flow) => !Object.values(flow.ruleIds).some((id) => ruleIds.has(id)));

  return (
    <div className="flex flex-col gap-4">
      <LuxuryAutomationStudioCard />

      <SettingsShell
        title="قواعد وتدفقات الأتمتة"
        description="تولّى المهام الروتينية آلياً مثل تصنيف المحادثات، توجيهها للفريق المختص، وتصعيد التأخير دون تدخل يدوي."
        learnMore="دليل الأتمتة الذكية"
        count={`${rows.length} قاعدة`}
        search={{ placeholder: "ابحث في قواعد الأتمتة...", value: query, onChange: setQuery }}
        tabs={{
          value: tab,
          onValueChange: (v) => setTab(v as RunType),
          items: [
            {
              value: "instant",
              label: "تنفيذ فوري عند الحدث",
              count: rules.filter((r) => r.runType === "instant").length,
            },
            {
              value: "delayed",
              label: "تنفيذ بعد مهلة انتظار",
              count: rules.filter((r) => r.runType === "delayed").length,
            },
          ],
        }}
        cardDescription={
          tab === "delayed"
            ? "قواعد تنتظر مهلة زمنية محددة (مثل عدم رد العميل أو تأخر الموظف) قبل التنفيذ."
            : "قواعد تعمل في نفس اللحظة التي يقع فيها الحدث."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/automation/templates">
                <LayoutTemplate /> القوالب
              </Link>
            </Button>
            <Button size="sm" onClick={() => router.push(flowHref("new"))} disabled={status !== "ready"}>
              <Plus /> إنشاء أتمتة جديدة
            </Button>
          </div>
        }
      >
        <ChipBar>
          {tab === "instant" ? (
            <ChipSelect
              label="الحدث"
              value={eventFilter}
              options={["All", ...Object.values(eventLabels)]}
              onChange={setEventFilter}
            />
          ) : null}
          <ChipSelect
            label="الحالة"
            value={statusFilter}
            options={["All", "Active", "Inactive"]}
            onChange={setStatusFilter}
          />
        </ChipBar>
        {status !== "ready" ? (
          <NoResults>
            {status === "loading" ? (
              "جارٍ تحميل قواعد الأتمتة…"
            ) : (
              <span className="flex flex-col items-center gap-2 text-center">
                تعذر تحميل قواعد الأتمتة: {loadError}
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  إعادة المحاولة
                </Button>
              </span>
            )}
          </NoResults>
        ) : null}
        {status === "ready" &&
          (rows.length ? (
            <Table className={tableClass}>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3 font-medium">القاعدة والمسار</TableHead>
                  <TableHead className="w-24 py-3 font-medium">التفعيل</TableHead>
                  <TableHead className="w-36 py-3 font-medium">تاريخ الإنشاء</TableHead>
                  <TableHead className="w-28 py-3 text-end font-medium">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((rule) => {
                  const flow = flowOfRule(flows, rule.id);
                  const flowState = flow ? approvalState(flow, rules) : null;
                  return (
                    <TableRow key={rule.id} className="border-border/60">
                      <TableCell className="whitespace-normal py-3.5">
                        <div className="grid gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {rule.name}
                            {rule.wait ? (
                              <ToneBadge tone="amber" dot={false}>
                                <Clock className="size-3" /> بعد مهلة {durationText(rule.wait.amount, rule.wait.unit)}
                              </ToneBadge>
                            ) : null}
                            {flow ? (
                              <ToneBadge tone="violet" dot={false}>
                                <Workflow className="size-3" /> تدفق بصري
                              </ToneBadge>
                            ) : null}
                            {flowState === "changed" ? (
                              <ToneBadge tone="sky">تعديلات بانتظار الاعتماد</ToneBadge>
                            ) : null}
                          </span>
                          <span className="text-muted-foreground text-xs">{rule.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Switch checked={rule.active} onCheckedChange={() => setToggling(rule)} aria-label="تفعيل" />
                      </TableCell>
                      <TableCell className="py-3.5 text-muted-foreground tabular-nums">{rule.createdOn}</TableCell>
                      <TableCell className="py-3.5 text-end">
                        <RowMenu
                          name={rule.name}
                          items={[
                            {
                              label: "تعديل في المصمم البصري",
                              icon: Pencil,
                              onSelect: () => router.push(flowHref(flow ? flow.id : `rule-${rule.id}`)),
                            },
                            {
                              label: "محاكاة واختبار",
                              icon: FlaskConical,
                              onSelect: () => router.push(`${flowHref(flow ? flow.id : `rule-${rule.id}`)}?simulate=1`),
                            },
                            {
                              label: "نسخ القاعدة",
                              icon: Copy,
                              onSelect: () => {
                                setRules(
                                  (prev) => [
                                    ...prev,
                                    { ...rule, id: Date.now(), name: `${rule.name} (نسخة)`, createdOn: today() },
                                  ],
                                  "تم نسخ قاعدة الأتمتة بنجاح",
                                );
                              },
                            },
                            {
                              label: "حذف",
                              icon: Trash2,
                              destructive: true,
                              separatorBefore: true,
                              onSelect: () => setDeleting(rule),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <NoResults>
              {filtered
                ? "لا توجد قواعد أتمتة مطابقة لبحثك"
                : tab === "delayed"
                  ? "لا توجد قواعد مؤجلة حالياً"
                  : "لا توجد قواعد أتمتة حالياً"}
            </NoResults>
          ))}
        {status === "ready" && drafts.length ? (
          <div className="grid gap-2 border-t px-6 py-4" data-slot="visual-drafts">
            <div className="grid gap-0.5">
              <p className="font-medium text-sm">المسودات البصرية وتدفقات المحاكاة</p>
              <p className="text-muted-foreground text-xs">
                محفوظة في بيئة التصميم والمحاكاة دون إرسال فعلي للعملاء حتى يتم اعتمادها.
              </p>
            </div>
            <ul className="grid gap-1.5">
              {drafts.map((flow) => (
                <li
                  key={flow.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <span className="grid gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium text-sm">
                      {flow.name || "تدفق بدون عنوان"}
                      {isSimDoc(flow.doc) ? (
                        <ToneBadge tone="violet" dot={false} data-sim-flow={flow.id}>
                          <FlaskConical className="size-3" />{" "}
                          {flow.simApprovedAt
                            ? flow.updatedAt === flow.simApprovedAt
                              ? "معتمد للمحاكاة"
                              : "تعديلات غير معتمدة"
                            : "مسودة محاكاة"}
                        </ToneBadge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground text-xs">{`${flow.doc.nodes.length - 1} خطوات`}</span>
                  </span>
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={flowHref(flow.id)}>
                        <Workflow /> فتح
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`${flowHref(flow.id)}?simulate=1`}>
                        <FlaskConical /> محاكاة
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeletingDraft(flow)}
                    >
                      <Trash2 /> حذف
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SettingsShell>

      <RuleDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        rule={editing}
        onSave={(draft) => {
          setRules(
            (prev) => prev.map((r) => (r.id === editing?.id ? { ...r, ...draft } : r)),
            "تم تحديث قاعدة الأتمتة بنجاح",
          );
          setTab(draft.runType);
        }}
      />
      <AlertDialog open={!!toggling} onOpenChange={(o) => !o && setToggling(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggling?.active ? "إيقاف قاعدة الأتمتة" : "تفعيل قاعدة الأتمتة"}</AlertDialogTitle>
            <AlertDialogDescription>
              {`هل أنت متأكد من ${toggling?.active ? "إيقاف" : "تفعيل"} القاعدة «${toggling?.name ?? ""}»؟`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const wasActive = toggling?.active;
                setRules(
                  (prev) => prev.map((r) => (r.id === toggling?.id ? { ...r, active: !r.active } : r)),
                  wasActive ? "تم إيقاف القاعدة" : "تم تفعيل القاعدة بنجاح",
                );
              }}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="تأكيد الحذف"
        message={`هل تريد حذف قاعدة الأتمتة «${deleting?.name ?? ""}»؟`}
        yes="نعم، احذف القاعدة"
        no="إلغاء"
        onConfirm={() => {
          setRules((prev) => prev.filter((r) => r.id !== deleting?.id), "تم حذف قاعدة الأتمتة");
        }}
      />
      <ConfirmDelete
        open={!!deletingDraft}
        onOpenChange={(o) => !o && setDeletingDraft(undefined)}
        title="حذف المسودة البصرية"
        message={`هل تريد حذف المسودة «${deletingDraft?.name.trim() ? deletingDraft.name : "بدون عنوان"}»؟`}
        yes="نعم، احذف المسودة"
        no="إلغاء"
        onConfirm={() => {
          save(
            itemsRef.current.filter((item) => !(item.kind === "flow" && item.flow.id === deletingDraft?.id)),
            "تم حذف المسودة البصرية",
          );
        }}
      />
    </div>
  );
}
