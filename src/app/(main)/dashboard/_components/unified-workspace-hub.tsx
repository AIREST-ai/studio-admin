"use client";

import * as React from "react";

import Link from "next/link";

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  ListTodo,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type WorkspaceTab = "tasks" | "calendar" | "contacts" | "invoices";

interface TaskRow {
  id: string;
  title: string;
  assignee: string;
  status: string;
  priority: string;
  dueDate: string;
}

interface EventRow {
  id: string;
  title: string;
  eventDate: string;
  eventTime: string;
  participant: string;
  kind: string;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  channel: string;
  segment: string;
  lastNote: string;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amountSar: number;
  status: string;
  issuedDate: string;
}

export function UnifiedWorkspaceHub({ defaultTab = "tasks" }: { defaultTab?: WorkspaceTab }) {
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>(defaultTab);
  const [tasks, setTasks] = React.useState<TaskRow[]>([]);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [contacts, setContacts] = React.useState<ContactRow[]>([]);
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Quick-add form states
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskAssignee, setTaskAssignee] = React.useState("إيمه (الموظف الذكي)");
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventParticipant, setEventParticipant] = React.useState("");
  const [eventTime, setEventTime] = React.useState("05:00 م");
  const [contactName, setContactName] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [contactChannel, setContactChannel] = React.useState("واتساب");
  const [invoiceCustomer, setInvoiceCustomer] = React.useState("");
  const [invoiceAmount, setInvoiceAmount] = React.useState("4500");

  const applyData = React.useCallback((data: any) => {
    if (!data) return;
    if (Array.isArray(data.tasks)) setTasks(data.tasks);
    if (Array.isArray(data.events)) setEvents(data.events);
    if (Array.isArray(data.contacts)) setContacts(data.contacts);
    if (Array.isArray(data.invoices)) setInvoices(data.invoices);
  }, []);

  const loadHub = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace-hub?companyId=tenant_demo_cars", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        applyData(json);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  React.useEffect(() => {
    void loadHub();
  }, [loadHub]);

  async function mutateHub(payload: Record<string, any>) {
    setSaving(true);
    try {
      const res = await fetch("/api/workspace-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "tenant_demo_cars", ...payload }),
      });
      if (res.ok) {
        const json = await res.json();
        applyData(json);
      }
    } finally {
      setSaving(false);
    }
  }

  const openTasksCount = tasks.filter((t) => t.status !== "done").length;
  const paidTotalSar = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (Number(i.amountSar) || 0), 0);
  const pendingTotalSar = invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + (Number(i.amountSar) || 0), 0);

  const tabs: { id: WorkspaceTab; label: string; href: string; count: string; icon: React.ElementType }[] = [
    {
      id: "tasks",
      label: "المهام والمتابعة",
      href: "/dashboard/tasks",
      count: `${openTasksCount} نشطة`,
      icon: ListTodo,
    },
    {
      id: "calendar",
      label: "التقويم والمواعيد",
      href: "/dashboard/calendar",
      count: `${events.length} مواعيد`,
      icon: CalendarDays,
    },
    {
      id: "contacts",
      label: "جهات الاتصال",
      href: "/dashboard/contacts",
      count: `${contacts.length} عملاء`,
      icon: Users,
    },
    {
      id: "invoices",
      label: "الفواتير والتحصيل",
      href: "/dashboard/invoice",
      count: `${paidTotalSar.toLocaleString()} ر.س`,
      icon: ReceiptText,
    },
  ];

  return (
    <Card
      dir="rtl"
      data-testid="unified-workspace-hub"
      className="mb-6 border-primary/25 bg-linear-to-br from-primary/5 via-background to-card shadow-xs"
    >
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Sparkles className="size-4.5" />
            </span>
            <div>
              <CardTitle className="text-base sm:text-lg">
                مركز الأعمال الموحد البسيط · المهام والتقويم وجهات الاتصال والفواتير
              </CardTitle>
              <CardDescription className="text-xs">
                واجهة موحدة نظيفة ومريحة للعين تجمع أقسام العمل الأربعة في مكان واحد مع حفظ فوري في قاعدة البيانات.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              {saving
                ? "جارٍ الحفظ في قاعدة البيانات…"
                : loading
                  ? "جارٍ التحميل…"
                  : "متصل بقاعدة بيانات PostgreSQL الحية"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void loadHub()} className="h-8 gap-1.5 text-xs">
              <RefreshCw className="size-3.5" />
              تحديث
            </Button>
          </div>
        </div>

        {/* شريط التبويبات الموحد للأقسام الأربعة */}
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                data-testid={`hub-tab-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveTab(t.id);
                }}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                  isActive
                    ? "border-primary bg-primary/10 text-foreground shadow-2xs"
                    : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`size-4.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="grid gap-0.5 text-right">
                    <span className="font-semibold text-xs sm:text-sm">{t.label}</span>
                    <span className="text-[11px] text-muted-foreground">{t.count}</span>
                  </div>
                </div>
                <Link
                  href={t.href}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md border bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  فتح مستقل
                </Link>
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {activeTab === "tasks" && (
          <div className="space-y-3" data-testid="hub-panel-tasks">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background/80 p-2.5">
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="أضف مهمة سريعة (مثال: متابعة عرض سعر العميل أو مراجعة تقييم إيمه)…"
                className="h-9 min-w-60 flex-1 text-xs"
              />
              <Input
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                placeholder="المسؤول"
                className="h-9 w-44 text-xs"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => {
                  if (!taskTitle.trim()) return;
                  void mutateHub({ action: "task.create", title: taskTitle.trim(), assignee: taskAssignee.trim() });
                  setTaskTitle("");
                }}
              >
                <Plus className="size-3.5" />
                إضافة مهمة
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {tasks.map((task) => {
                const isDone = task.status === "done";
                return (
                  <div
                    key={task.id}
                    className="flex flex-col justify-between gap-2 rounded-xl border bg-background/90 p-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`font-medium text-xs leading-relaxed ${isDone ? "line-through text-muted-foreground" : ""}`}
                      >
                        {task.title}
                      </span>
                      <Switch
                        checked={isDone}
                        onCheckedChange={() => void mutateHub({ action: "task.toggle", id: task.id })}
                        aria-label={`تبديل حالة المهمة ${task.title}`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{task.assignee}</span>
                      <Badge variant={isDone ? "secondary" : "outline"} className="text-[10px]">
                        {isDone ? "منجزة" : "قيد المتابعة"} · {task.dueDate}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-3" data-testid="hub-panel-calendar">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background/80 p-2.5">
              <Input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="عنوان الموعد أو الاجتماع…"
                className="h-9 min-w-52 flex-1 text-xs"
              />
              <Input
                value={eventParticipant}
                onChange={(e) => setEventParticipant(e.target.value)}
                placeholder="اسم العميل أو الفريق"
                className="h-9 w-40 text-xs"
              />
              <Input
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                placeholder="الوقت (05:00 م)"
                className="h-9 w-28 text-xs"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => {
                  if (!eventTitle.trim()) return;
                  void mutateHub({
                    action: "event.create",
                    title: eventTitle.trim(),
                    participant: eventParticipant.trim() || "عميل المعرض",
                    eventTime: eventTime.trim() || "05:00 م",
                  });
                  setEventTitle("");
                  setEventParticipant("");
                }}
              >
                <Plus className="size-3.5" />
                جدولة موعد
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border bg-background/90 p-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-xs leading-relaxed">{ev.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      <Clock className="ml-1 size-3" />
                      {ev.eventTime}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>المشارك: {ev.participant}</span>
                    <span>{ev.eventDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="space-y-3" data-testid="hub-panel-contacts">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background/80 p-2.5">
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="اسم العميل…"
                className="h-9 min-w-44 flex-1 text-xs"
              />
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="رقم الجوال (+966 5...)"
                className="h-9 w-44 text-xs"
              />
              <Input
                value={contactChannel}
                onChange={(e) => setContactChannel(e.target.value)}
                placeholder="القناة (واتساب)"
                className="h-9 w-32 text-xs"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => {
                  if (!contactName.trim()) return;
                  void mutateHub({
                    action: "contact.create",
                    name: contactName.trim(),
                    phone: contactPhone.trim() || "+966 50 000 0000",
                    channel: contactChannel.trim() || "واتساب",
                  });
                  setContactName("");
                  setContactPhone("");
                }}
              >
                <Plus className="size-3.5" />
                إضافة جهة اتصال
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border bg-background/90 p-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.channel} · {c.segment}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px]">{c.lastNote}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-primary">
                    <Phone className="size-3" />
                    <span dir="ltr">{c.phone}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-3" data-testid="hub-panel-invoices">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/80 p-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <Input
                  value={invoiceCustomer}
                  onChange={(e) => setInvoiceCustomer(e.target.value)}
                  placeholder="اسم العميل لإصدار الفاتورة…"
                  className="h-9 min-w-48 flex-1 text-xs"
                />
                <Input
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="المبلغ (ر.س)"
                  className="h-9 w-32 text-xs"
                />
                <Button
                  size="sm"
                  className="h-9 gap-1.5 text-xs"
                  onClick={() => {
                    if (!invoiceCustomer.trim()) return;
                    void mutateHub({
                      action: "invoice.create",
                      customerName: invoiceCustomer.trim(),
                      amountSar: Number(invoiceAmount) || 1500,
                      status: "paid",
                    });
                    setInvoiceCustomer("");
                  }}
                >
                  <Plus className="size-3.5" />
                  إصدار فاتورة فورية
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  محصّل: {paidTotalSar.toLocaleString()} ر.س
                </Badge>
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  بانتظار السداد: {pendingTotalSar.toLocaleString()} ر.س
                </Badge>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {invoices.map((inv) => {
                const isPaid = inv.status === "paid";
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col justify-between gap-2 rounded-xl border bg-background/90 p-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-xs">{inv.customerName}</span>
                        <span className="mr-2 text-[11px] text-muted-foreground">{inv.invoiceNumber}</span>
                      </div>
                      <Switch
                        checked={isPaid}
                        onCheckedChange={() => void mutateHub({ action: "invoice.toggle", id: inv.id })}
                        aria-label={`تبديل حالة الفاتورة ${inv.invoiceNumber}`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary">{Number(inv.amountSar).toLocaleString()} ر.س</span>
                      <Badge
                        variant="outline"
                        className={
                          isPaid
                            ? "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                        }
                      >
                        <CreditCard className="ml-1 size-3" />
                        {isPaid ? "مدفوعة" : "بانتظار السداد"} · {inv.issuedDate}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
