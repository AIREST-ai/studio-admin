"use client";
// F159: Studio Roles tab = Chatwoot v4.18 Settings > Custom Roles (settings/customRoles/Index.vue).
// Texts from i18n/locale/en/customRole.json. Studio kept: grouped table (System roles / Custom roles), Type filter,
// line sub-tabs; the old "Permission sets" placeholder tab now shows a read-only permissions matrix.
// Fahad's rule (final pass): Studio's design-only Import JSON button, Review required alert and Access reviews tab stay.
// F161: Studio-before Owner and Status filters, Last review / Owner / Status columns and row menu items restored.
// The alert count is computed from roles marked "Needs review"; "Review changes" filters to them.
import * as React from "react";

import { type ColumnFiltersState, type PaginationState, useTable } from "@tanstack/react-table";
import { AlertTriangle, Check, ChevronRight, FileUp, Minus, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CeUnavailableNotice } from "@/lib/chatwoot/settings-adapter";
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
  /** م137 round 2: the page header's action slot (users-roles.tsx); Import JSON and Add custom role go there. */
  headerActions?: Element | null;
  /** م137 round 2: the end of the page's tab row (users-roles.tsx); the Roles / Permissions / Access reviews switch. */
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
              () => toast.success(`${role.name} marked as reviewed`, { description: SAVED_IN_PREVIEW }),
              (error: Error) => toast.error(error.message),
            );
            return;
          }
          setRoles((list) => list.map((r) => (r.key === role.key ? updated : r)));
          toast.success(`${role.name} marked as reviewed`);
        },
        onViewDetails: setViewing,
        onDuplicate: (role) => {
          const nextId = Math.max(0, ...roles.map((r) => r.customRoleId ?? 0)) + 1;
          const duplicated = customRole(nextId, `${role.name} (copy)`, role.description, [...role.permissions]);
          void saveCustomRole(duplicated).then(
            () => toast.success(`${role.name} duplicated`, { description: SAVED_IN_PREVIEW }),
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

  const emptyMessage = search.trim()
    ? "No custom roles found matching your search"
    : "There are no items matching this query.";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* م137 round 2 (Fahad 137, judge M137): no second header inside the tab. The title, Chatwoot's line and its
          Learn more link are the page header's (users-roles.tsx); Import JSON and Add custom role sit in the page
          header at the right, as Add Agent does on the Agents tab. */}
      {headerActions
        ? createPortal(
            <>
              <Button size="sm" variant="outline">
                <FileUp data-icon="inline-start" />
                Import JSON
              </Button>
              <Button size="sm" onClick={() => setDialog({ mode: "add" })}>
                <Plus data-icon="inline-start" />
                Add custom role
              </Button>
            </>,
            headerActions,
          )
        : null}

      <CeUnavailableNotice
        area="custom_roles"
        title="Custom roles are unavailable in Chatwoot Community Edition (501)"
      />

      <Tabs className="h-full gap-4" value={subTab} onValueChange={setSubTab}>
        {/* م137 round 2 (judge M137: no third tab row): the three views of the roles (all kept, Fahad's rule above)
            are a small view switch at the end of the page's tab row, like the list / grid switch of the Agents tab. */}
        {viewSlot
          ? createPortal(
              <TabsList aria-label="Roles view" className="h-8">
                <TabsTrigger value="roles" className="px-2.5 text-xs">
                  Roles
                </TabsTrigger>
                <TabsTrigger value="permissions" className="px-2.5 text-xs">
                  Permissions
                </TabsTrigger>
                <TabsTrigger value="access-reviews" className="px-2.5 text-xs">
                  Access reviews
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
                <AlertTitle>Review required</AlertTitle>
                <AlertDescription>
                  {needsReviewCount} {needsReviewCount === 1 ? "role has" : "roles have"} unreviewed permission changes.
                </AlertDescription>
                <AlertAction>
                  <Button size="sm" variant="link" onClick={() => setFilter("status", "Needs review")}>
                    Review changes
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </AlertAction>
              </Alert>
            ) : null}

            {customRoles.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
                <span className="text-muted-foreground text-sm">
                  There are no custom roles available in this account.
                </span>
                <Button size="sm" variant="outline" onClick={() => setDialog({ mode: "add" })}>
                  <Plus data-icon="inline-start" />
                  Add custom role
                </Button>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
              <div className="flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <ExpandingSearch
                  name="custom-roles"
                  label="Search custom roles"
                  placeholder="Search custom roles..."
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
                      <span className="text-muted-foreground">Type:</span>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      <SelectGroup>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="System">System</SelectItem>
                        <SelectItem value="Custom">Custom</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={ownerFilter} onValueChange={(v) => setFilter("owner", v)}>
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">Owner:</span>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      <SelectGroup>
                        {["All", ...owners].map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">Status:</span>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      <SelectGroup>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Needs review">Needs review</SelectItem>
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
              What each role can do. Click a custom role name to edit its permissions.
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-y hover:bg-transparent">
                    <TableHead className="min-w-72 px-4 font-medium text-foreground">Permission</TableHead>
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
                              System
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
                              aria-label="Allowed"
                            />
                          ) : (
                            <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not allowed" />
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
            Access Reviews Coming Soon
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
                    {viewing.group === "System roles" ? "System" : "Custom"}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{viewing.description}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">Access level</span>
                <span>{viewing.accessLevel}</span>
                <span className="text-muted-foreground">Agents</span>
                <span className="tabular-nums">{viewingAgents}</span>
                <span className="text-muted-foreground">Owner</span>
                <span>{viewing.owner}</span>
                <span className="text-muted-foreground">Last review</span>
                <span>{viewing.lastReview}</span>
                <span className="text-muted-foreground">Status</span>
                <span>{viewing.status}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-sm">Permissions</span>
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
          // Mock choice: agents on a deleted custom role fall back to their base Agent role.
          setAgents((list) =>
            list.map((a) => (a.customRoleId === role.customRoleId ? { ...a, customRoleId: null } : a)),
          );
        }}
      />
    </div>
  );
}
