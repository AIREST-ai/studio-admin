"use client";
import * as React from "react";

import { type ColumnFiltersState, type PaginationState, useTable } from "@tanstack/react-table";
import { AlertTriangle, Check, ChevronRight, FileUp, Minus, Plus, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataTableFeatures } from "@/lib/data-table-features";

import type { UserRow } from "../../users/_components/data";
import { CustomRoleDialog, type CustomRoleDialogState, DeleteCustomRoleDialog } from "./custom-role-dialogs";
import { deleteCustomRole, SAVED_IN_PREVIEW, saveCustomRole } from "./roles-store";
import { makeRolesColumns } from "./roles-table/columns";
import {
  AVAILABLE_CUSTOM_ROLE_PERMISSIONS,
  customRole,
  permissionLabels,
  type Role,
  roleKeyOf,
  todayLabel,
} from "./roles-table/data";
import { RolesTable } from "./roles-table/table";

export interface StandardRoleMatrix {
  roleId: "owner" | "manager" | "supervisor" | "agent" | "accountant";
  title: string;
  subtitle: string;
  viewConversations: boolean;
  editEmma: boolean;
  viewReports: boolean;
  topUpBalance: boolean;
  manageInvoices?: boolean;
}

const DEFAULT_STANDARD_ROLES: StandardRoleMatrix[] = [
  {
    roleId: "owner",
    title: "المالك",
    subtitle: "صلاحية كاملة على الشركة، القنوات، إيمه، التقارير، الفواتير، وشحن الرصيد",
    viewConversations: true,
    editEmma: true,
    viewReports: true,
    topUpBalance: true,
    manageInvoices: true,
  },
  {
    roleId: "manager",
    title: "المدير",
    subtitle: "إدارة الفريق، تعديل إيمه، ومراجعة التقارير والمهام وتنبيهات التهرب",
    viewConversations: true,
    editEmma: true,
    viewReports: true,
    topUpBalance: false,
    manageInvoices: true,
  },
  {
    roleId: "supervisor",
    title: "المشرف",
    subtitle: "متابعة المحادثات اليومية والمهام وتقارير جودة الموظفين دون تعديل الفوترة",
    viewConversations: true,
    editEmma: false,
    viewReports: true,
    topUpBalance: false,
    manageInvoices: false,
  },
  {
    roleId: "agent",
    title: "الموظف",
    subtitle: "الرد على محادثات العملاء ومتابعة المهام في الصناديق المخصصة له فقط",
    viewConversations: true,
    editEmma: false,
    viewReports: false,
    topUpBalance: false,
    manageInvoices: false,
  },
  {
    roleId: "accountant",
    title: "المحاسب",
    subtitle: "إدارة الفواتير والمدفوعات وشحن رصيد الذكاء والواتساب ومراجعة التقارير المالية",
    viewConversations: false,
    editEmma: false,
    viewReports: true,
    topUpBalance: true,
    manageInvoices: true,
  },
];

export function StandardRolesMatrixCard() {
  const [matrix, setMatrix] = React.useState<StandardRoleMatrix[]>(DEFAULT_STANDARD_ROLES);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"loading" | "ready" | "saved" | "error">("loading");
  const [saveError, setSaveError] = React.useState("");

  React.useEffect(() => {
    fetch("/api/workspace-hub?companyId=tenant_demo_cars", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((res) => {
        if (Array.isArray(res?.roles) && res.roles.length) {
          setMatrix(res.roles);
          setStatus("ready");
        } else {
          throw new Error("لم تُرجع الخدمة صلاحيات محفوظة");
        }
      })
      .catch(() => {
        setStatus("error");
        setSaveError("تعذر قراءة الصلاحيات المحفوظة. أعد تحميل الصفحة للمحاولة مجددًا.");
      });
  }, []);

  function togglePerm(
    roleId: StandardRoleMatrix["roleId"],
    key: "viewConversations" | "editEmma" | "viewReports" | "topUpBalance" | "manageInvoices",
  ) {
    if (saving || status === "loading" || status === "error") return;
    if (roleId === "owner") {
      toast.info("المالك يملك كافة الصلاحيات دائماً بمعيار الشركات العالمية.");
      return;
    }
    const next = matrix.map((r) => (r.roleId === roleId ? { ...r, [key]: !r[key] } : r));
    setMatrix(next);
    setSaving(true);
    setSaveError("");
    Promise.all([
      fetch("/api/workspace-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "tenant_demo_cars", action: "role.toggle", roleId, field: key }),
      }),
      fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "roles.save", standardRoles: next }),
      }),
    ])
      .then((responses) => {
        if (responses.some((response) => !response.ok)) {
          throw new Error("لم تؤكد كل الخدمات حفظ التغيير");
        }
        setStatus("saved");
        toast.success("حُفظت إعدادات الصلاحيات");
      })
      .catch(() => {
        setStatus("error");
        const message = "لم يكتمل تأكيد الحفظ. قد يكون التغيير حُفظ جزئيًا؛ أعد تحميل الصفحة للتحقق قبل تعديل آخر.";
        setSaveError(message);
        toast.error("تعذر تأكيد حفظ الصلاحيات", { description: message });
      })
      .finally(() => setSaving(false));
  }

  return (
    <Card
      data-testid="global-roles-matrix"
      className="border-primary/25 bg-linear-to-br from-primary/5 via-background to-card shadow-xs"
    >
      <CardHeader className="gap-1.5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4.5 text-primary" />
            مصفوفة الصلاحيات والأدوار العالمية البسيطة (المالك · المدير · المشرف · الموظف · المحاسب)
          </CardTitle>
          <Badge variant="outline" className={status === "error" ? "border-destructive text-destructive" : undefined}>
            {saving
              ? "جارٍ حفظ التغيير…"
              : {
                  loading: "جارٍ قراءة الصلاحيات…",
                  error: "تعذر تأكيد الحالة",
                  saved: "حُفظ آخر تغيير",
                  ready: "الإعدادات المحفوظة",
                }[status]}
          </Badge>
        </div>
        <CardDescription>
          أدوار واضحة بمعيار الشركات العالمية (المالك، المدير، المشرف، الموظف، المحاسب)؛ تحكّم بضغطة زر في صلاحيات
          المحادثات، إيمه، التقارير، الرصيد، والفواتير.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {saveError ? (
          <p role="alert" data-role-matrix-error className="mb-3 text-destructive text-sm">
            {saveError}
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-xl border bg-background/80">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="min-w-52 px-4 py-3 font-semibold text-foreground">الدور الوظيفي</TableHead>
                <TableHead className="px-3 py-3 text-center font-semibold text-foreground">
                  رؤية المحادثات والرد
                </TableHead>
                <TableHead className="px-3 py-3 text-center font-semibold text-foreground">
                  تعديل إيمه والذكاء
                </TableHead>
                <TableHead className="px-3 py-3 text-center font-semibold text-foreground">
                  رؤية التقارير والتقييم
                </TableHead>
                <TableHead className="px-3 py-3 text-center font-semibold text-foreground">شحن الرصيد</TableHead>
                <TableHead className="px-3 py-3 text-center font-semibold text-foreground">
                  إدارة الفواتير والمحاسبة
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row) => (
                <TableRow key={row.roleId} data-testid={`role-row-${row.roleId}`} className="hover:bg-muted/20">
                  <TableCell className="px-4 py-3">
                    <div className="grid gap-0.5">
                      <span className="flex items-center gap-2 font-semibold text-sm">
                        {row.title}
                        {row.roleId === "owner" ? (
                          <Badge variant="secondary" className="text-[10px]">
                            كامل الصلاحيات
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground text-xs">{row.subtitle}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <Switch
                        disabled={saving || status === "loading" || status === "error" || row.roleId === "owner"}
                        checked={row.viewConversations}
                        onCheckedChange={() => togglePerm(row.roleId, "viewConversations")}
                        aria-label={`رؤية المحادثات - ${row.title}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <Switch
                        disabled={saving || status === "loading" || status === "error" || row.roleId === "owner"}
                        checked={row.editEmma}
                        onCheckedChange={() => togglePerm(row.roleId, "editEmma")}
                        aria-label={`تعديل إيمه - ${row.title}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <Switch
                        disabled={saving || status === "loading" || status === "error" || row.roleId === "owner"}
                        checked={row.viewReports}
                        onCheckedChange={() => togglePerm(row.roleId, "viewReports")}
                        aria-label={`رؤية التقارير - ${row.title}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <Switch
                        disabled={saving || status === "loading" || status === "error" || row.roleId === "owner"}
                        checked={row.topUpBalance}
                        onCheckedChange={() => togglePerm(row.roleId, "topUpBalance")}
                        aria-label={`شحن الرصيد - ${row.title}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <Switch
                        disabled={saving || status === "loading" || status === "error" || row.roleId === "owner"}
                        checked={Boolean(row.manageInvoices)}
                        onCheckedChange={() => togglePerm(row.roleId, "manageInvoices")}
                        aria-label={`إدارة الفواتير - ${row.title}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const typeToGroup: Record<string, string | undefined> = {
  All: undefined,
  System: "System roles",
  Custom: "Custom roles",
};

export function Roles({
  roles,
  setRoles,
  agents,
  setAgents,
  onViewAgents,
  headerActions,
  viewSlot,
}: {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  agents: UserRow[];
  setAgents: React.Dispatch<React.SetStateAction<UserRow[]>>;
  onViewAgents: (role: Role) => void;
  headerActions?: Element | null;
  viewSlot?: Element | null;
}) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 12 });
  const [dialog, setDialog] = React.useState<CustomRoleDialogState>(null);
  const [deleting, setDeleting] = React.useState<Role | null>(null);
  const [viewing, setViewing] = React.useState<Role | null>(null);
  const [subTab, setSubTab] = React.useState("roles");

  const customRoles = roles.filter((r) => r.group === "Custom roles");

  const columns = React.useMemo(
    () =>
      makeRolesColumns({
        agentCount: (role) => agents.filter((a) => roleKeyOf(a) === role.key).length,
        onEdit: (role) => setDialog({ mode: "edit", role }),
        onDelete: setDeleting,
        onViewAgents,
        onReview: (role) => {
          const updated: Role = { ...role, status: "Active", lastReview: todayLabel() };
          if (role.group === "Custom roles") {
            void saveCustomRole(updated).then(
              () => toast.success(`تم اعتماد مراجعة ${role.name}`, { description: SAVED_IN_PREVIEW }),
              (error: Error) => toast.error(error.message),
            );
            return;
          }
          setRoles((list) => list.map((r) => (r.key === role.key ? updated : r)));
          toast.success(`تم اعتماد مراجعة ${role.name}`);
        },
        onViewDetails: setViewing,
        onDuplicate: (role) => {
          const nextId = Math.max(0, ...roles.map((r) => r.customRoleId ?? 0)) + 1;
          const duplicated = customRole(nextId, `${role.name} (نسخة)`, role.description, [...role.permissions]);
          void saveCustomRole(duplicated).then(
            () => toast.success(`تم نسخ الدور ${role.name}`, { description: SAVED_IN_PREVIEW }),
            (error: Error) => toast.error(error.message),
          );
        },
        onReviewPermissions: () => setSubTab("permissions"),
      }),
    [agents, onViewAgents, roles, setRoles],
  );

  const table = useTable({
    features: dataTableFeatures,
    data: roles,
    columns,
    defaultColumn: { size: 140, minSize: 80, maxSize: 420 },
    state: { columnFilters, pagination },
    getRowId: (row) => row.key,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    initialState: { columnVisibility: { group: false, search: false } },
  });

  const search = (columnFilters.find((f) => f.id === "search")?.value as string | undefined) ?? "";
  const groupFilter = (columnFilters.find((f) => f.id === "group")?.value as string | undefined) ?? "";
  const typeFilter = Object.keys(typeToGroup).find((k) => typeToGroup[k] === (groupFilter || undefined)) ?? "All";
  const ownerFilter = (columnFilters.find((f) => f.id === "owner")?.value as string | undefined) ?? "All";
  const statusFilter = (columnFilters.find((f) => f.id === "status")?.value as string | undefined) ?? "All";
  const owners = Array.from(new Set(roles.map((r) => r.owner)));
  const needsReviewCount = roles.filter((r) => r.status === "Needs review").length;
  const viewingAgents = viewing ? agents.filter((a) => roleKeyOf(a) === viewing.key).length : 0;

  function setFilter(id: string, value: string) {
    table.getColumn(id)?.setFilterValue(value === "All" ? undefined : value);
    table.setPageIndex(0);
  }

  const emptyMessage = search.trim() ? "لا توجد أدوار مطابقة لبحثك" : "لا توجد عناصر مطابقة.";

  return (
    <div className="flex h-full flex-col gap-4">
      {headerActions
        ? createPortal(
            <>
              <Button size="sm" variant="outline">
                <FileUp data-icon="inline-start" />
                استيراد ملف صلاحيات
              </Button>
              <Button size="sm" onClick={() => setDialog({ mode: "add" })}>
                <Plus data-icon="inline-start" />
                إضافة دور مخصص
              </Button>
            </>,
            headerActions,
          )
        : null}

      <StandardRolesMatrixCard />

      <Tabs className="h-full gap-4" value={subTab} onValueChange={setSubTab}>
        {viewSlot
          ? createPortal(
              <TabsList aria-label="عرض الأدوار" className="h-8">
                <TabsTrigger value="roles" className="px-2.5 text-xs">
                  سجل الأدوار
                </TabsTrigger>
                <TabsTrigger value="permissions" className="px-2.5 text-xs">
                  جدول الصلاحيات
                </TabsTrigger>
                <TabsTrigger value="access-reviews" className="px-2.5 text-xs">
                  مراجعات الوصول
                </TabsTrigger>
              </TabsList>,
              viewSlot,
            )
          : null}

        <TabsContent value="roles">
          <div className="flex flex-col gap-4">
            {needsReviewCount > 0 ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                <AlertTriangle className="size-4" />
                <AlertTitle>مراجعة مطلوبة</AlertTitle>
                <AlertDescription>{`يوجد ${needsReviewCount} دور يحتاج تأكيد تغييرات الصلاحيات.`}</AlertDescription>
                <AlertAction>
                  <Button size="sm" variant="link" onClick={() => setFilter("status", "Needs review")}>
                    مراجعة التغييرات
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </AlertAction>
              </Alert>
            ) : null}

            {customRoles.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
                <span className="text-muted-foreground text-sm">لا توجد أدوار مخصصة إضافية في هذا الحساب.</span>
                <Button size="sm" variant="outline" onClick={() => setDialog({ mode: "add" })}>
                  <Plus data-icon="inline-start" />
                  إضافة دور مخصص
                </Button>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
              <div className="flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <ExpandingSearch
                  name="custom-roles"
                  label="بحث في الأدوار"
                  placeholder="ابحث في الأدوار..."
                  className="w-full sm:w-82"
                  value={search}
                  onChange={(value) => {
                    table.getColumn("search")?.setFilterValue(value || undefined);
                    table.setPageIndex(0);
                  }}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => {
                      table.getColumn("group")?.setFilterValue(typeToGroup[v]);
                      table.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">النوع:</span>
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      <SelectGroup>
                        <SelectItem value="All">الكل</SelectItem>
                        <SelectItem value="System">قياسي</SelectItem>
                        <SelectItem value="Custom">مخصص</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={ownerFilter} onValueChange={(v) => setFilter("owner", v)}>
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">المسؤول:</span>
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      <SelectGroup>
                        {["All", ...owners].map((o) => (
                          <SelectItem key={o} value={o}>
                            {o === "All" ? "الكل" : o}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">الحالة:</span>
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      <SelectGroup>
                        <SelectItem value="All">الكل</SelectItem>
                        <SelectItem value="Active">نشط</SelectItem>
                        <SelectItem value="Needs review">بانتظار المراجعة</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <RolesTable table={table} emptyMessage={emptyMessage} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
            <div className="px-4 py-4 text-muted-foreground text-sm">
              صلاحيات كل دور بالتفصيل. اضغط على اسم الدور المخصص لتعديله.
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-y hover:bg-transparent">
                    <TableHead className="min-w-72 px-4 font-medium text-foreground">الصلاحية</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role.key} className="px-3 text-center font-medium text-foreground">
                        {role.group === "Custom roles" ? (
                          <button
                            type="button"
                            className="cursor-pointer underline decoration-dotted underline-offset-4 hover:text-primary"
                            onClick={() => setDialog({ mode: "edit", role })}
                          >
                            {role.name}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {role.name}
                            <Badge variant="secondary" className="rounded-sm text-[10px]">
                              قياسي
                            </Badge>
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {AVAILABLE_CUSTOM_ROLE_PERMISSIONS.map((permission) => (
                    <TableRow key={permission} className="h-12 hover:bg-muted/20">
                      <TableCell className="px-4 text-sm">{permissionLabels[permission]}</TableCell>
                      {roles.map((role) => (
                        <TableCell key={role.key} className="px-3 text-center">
                          {role.permissions.includes(permission) ? (
                            <Check
                              className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
                              aria-label="مسموح"
                            />
                          ) : (
                            <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="غير مسموح" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="access-reviews">
          <div className="flex h-full min-h-60 items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm">
            سجل مراجعات الصلاحيات الدورية
          </div>
        </TabsContent>
      </Tabs>

      <CustomRoleDialog
        state={dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        roles={roles}
        onSubmit={async (role) => {
          await saveCustomRole(role);
        }}
      />
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewing.name}
                  <Badge variant="secondary" className="rounded-sm text-[10px]">
                    {viewing.group === "System roles" ? "قياسي" : "مخصص"}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{viewing.description}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">مستوى الوصول</span>
                <span>{viewing.accessLevel}</span>
                <span className="text-muted-foreground">الموظفون</span>
                <span className="tabular-nums">{viewingAgents}</span>
                <span className="text-muted-foreground">المسؤول</span>
                <span>{viewing.owner}</span>
                <span className="text-muted-foreground">آخر مراجعة</span>
                <span>{viewing.lastReview}</span>
                <span className="text-muted-foreground">الحالة</span>
                <span>{viewing.status}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-sm">الصلاحيات</span>
                <ul className="mb-0 list-disc ps-4">
                  {viewing.permissions.map((p) => (
                    <li key={p} className="text-muted-foreground text-sm">
                      {permissionLabels[p]}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <DeleteCustomRoleDialog
        role={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={async (role) => {
          setDeleting(null);
          await deleteCustomRole(role);
          setAgents((list) =>
            list.map((a) => (a.customRoleId === role.customRoleId ? { ...a, customRoleId: null } : a)),
          );
        }}
      />
    </div>
  );
}
