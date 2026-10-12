"use client";
// F159: Studio Roles tab = Chatwoot v4.18 Settings > Custom Roles (settings/customRoles/Index.vue).
// Texts from i18n/locale/en/customRole.json. Studio kept: grouped table (System roles / Custom roles), Type filter,
// line sub-tabs; the old "Permission sets" placeholder tab now shows a read-only permissions matrix.
// Fahad's rule (final pass): Studio's design-only Import JSON button, Review required alert and Access reviews tab stay.
import * as React from "react";

import { type ColumnFiltersState, type PaginationState, useTable } from "@tanstack/react-table";
import { AlertTriangle, Check, ChevronRight, ExternalLink, FileUp, Minus, Plus, Search } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataTableFeatures } from "@/lib/data-table-features";

import type { UserRow } from "../../users/_components/data";
import { CustomRoleDialog, type CustomRoleDialogState, DeleteCustomRoleDialog } from "./custom-role-dialogs";
import { makeRolesColumns } from "./roles-table/columns";
import { AVAILABLE_CUSTOM_ROLE_PERMISSIONS, permissionLabels, type Role, roleKeyOf } from "./roles-table/data";
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
}: {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  agents: UserRow[];
  setAgents: React.Dispatch<React.SetStateAction<UserRow[]>>;
  onViewAgents: (role: Role) => void;
}) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 12 });
  const [dialog, setDialog] = React.useState<CustomRoleDialogState>(null);
  const [deleting, setDeleting] = React.useState<Role | null>(null);

  const customRoles = roles.filter((r) => r.group === "Custom roles");

  const columns = React.useMemo(
    () =>
      makeRolesColumns({
        agentCount: (role) => agents.filter((a) => roleKeyOf(a) === role.key).length,
        onEdit: (role) => setDialog({ mode: "edit", role }),
        onDelete: setDeleting,
        onViewAgents,
      }),
    [agents, onViewAgents],
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
  const typeFilter = groupFilter === "System roles" ? "System" : groupFilter === "Custom roles" ? "Custom" : "All";

  const emptyMessage = search.trim()
    ? "No custom roles found matching your search"
    : "There are no items matching this query.";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="flex max-w-3xl flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-xl">Custom Roles</h2>
            <span className="text-muted-foreground text-sm tabular-nums">
              {customRoles.length} custom {customRoles.length === 1 ? "role" : "roles"}
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-snug">
            Custom roles are roles that are created by the account owner or admin. These roles can be assigned to
            agents to define their access and permissions within the account. Custom roles can be created with specific
            permissions and access levels to suit the requirements of the organization.{" "}
            <a
              href="https://chwt.app/hc/agents"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              Learn more about custom roles
              <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <FileUp data-icon="inline-start" />
            Import JSON
          </Button>
          <Button size="sm" onClick={() => setDialog({ mode: "add" })}>
            <Plus data-icon="inline-start" />
            Add custom role
          </Button>
        </div>
      </div>

      <Tabs className="h-full gap-4" defaultValue="roles">
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="access-reviews">Access reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <div className="flex flex-col gap-4">
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
              <AlertTriangle className="size-4" />
              <AlertTitle>Review required</AlertTitle>
              <AlertDescription>3 roles have unreviewed permission changes.</AlertDescription>
              <AlertAction>
                <Button size="sm" variant="link">
                  Review changes
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </AlertAction>
            </Alert>

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
                <InputGroup className="h-7 w-full rounded-md sm:w-82">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    className="h-7"
                    placeholder="Search custom roles..."
                    value={search}
                    onChange={(e) => {
                      table.getColumn("search")?.setFilterValue(e.target.value || undefined);
                      table.setPageIndex(0);
                    }}
                  />
                </InputGroup>

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
                            <Check className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="Allowed" />
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
        onSubmit={(role) =>
          setRoles((list) =>
            list.some((r) => r.key === role.key) ? list.map((r) => (r.key === role.key ? role : r)) : [...list, role],
          )
        }
      />
      <DeleteCustomRoleDialog
        role={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={(role) => {
          setRoles((list) => list.filter((r) => r.key !== role.key));
          // Mock choice: agents on a deleted custom role fall back to their base Agent role.
          setAgents((list) => list.map((a) => (a.customRoleId === role.customRoleId ? { ...a, customRoleId: null } : a)));
          setDeleting(null);
        }}
      />
    </div>
  );
}
