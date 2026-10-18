"use client";
// F159: Studio Users card = Chatwoot v4.18 Settings > Agents (settings/agents/Index.vue).
// Header texts, search, Add Agent, Edit / Delete and their rules come from Chatwoot; the card, filter chips,
// Hide / Customize / Export buttons, ⌘K hint, list-grid toggle and paginated table are Studio's.
// F161: Studio-before Workspace filter is back as "Inbox" (the Workspace column became Inboxes), default sort is
// newest first again, and the row menu has View profile / Manage team / Resend invite again.
import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { Cog, Download, Grid, Plus, Rows3, SlidersHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataTableFeatures } from "@/lib/data-table-features";

import type { Role } from "../../roles/_components/roles-table/data";
import { AddAgentDialog, DeleteAgentDialog, EditAgentDialog } from "./agent-dialogs";
import { ManageTeamDialog, ViewProfileDialog } from "./agent-extra-dialogs";
import { addAgent, deleteAgent, setAgentTeams, updateAgent } from "./agents-store";
import { availabilityLabels, CURRENT_USER_ID, type UserRow, userStatus } from "./data";
import {
  AgentActionsMenu,
  AgentAvatar,
  AvailabilityBadge,
  makeUsersColumns,
  RoleLabel,
  roleLabel,
  StatusBadge,
} from "./users-columns";
import { UsersTable } from "./users-table";

const columnTitles: Record<string, string> = {
  role: "Role / Team",
  availability: "Availability",
  inboxes: "Inboxes",
  status: "Status",
  joinedDate: "Joined date",
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
  align = "start",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  align?: "start" | "end";
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align={align}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function exportCsv(rows: UserRow[], roles: Role[]) {
  const header = ["Name", "Email", "Role", "Availability", "Status", "Team", "Inboxes", "Joined date"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      roleLabel(r, roles),
      availabilityLabels[r.availability],
      userStatus(r),
      r.teams.join("; "),
      r.inboxes.join("; "),
      r.joinedDate,
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agents.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} agents`);
}

export function Users({
  agents,
  teamNames,
  inboxNames,
  roles,
  roleFilterRequest,
  onRoleFilterApplied,
  headerActions,
}: {
  agents: UserRow[];
  teamNames: string[];
  inboxNames: string[];
  roles: Role[];
  /** Set by Roles tab "View agents": pre-selects the Role filter. */
  roleFilterRequest?: { role: string; at: number } | null;
  /** Called once the request is applied, so it does not come back after the filter is cleared and the tab re-opens. */
  onRoleFilterApplied?: () => void;
  /** م137 round 2: the page header's action slot (users-roles.tsx); Customize, Export and Add Agent are drawn there. */
  headerActions?: Element | null;
}) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "joinedDate", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    search: false,
    team: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [deleting, setDeleting] = React.useState<UserRow | null>(null);
  const [viewing, setViewing] = React.useState<UserRow | null>(null);
  const [managingTeam, setManagingTeam] = React.useState<UserRow | null>(null);

  const menuHandlers = React.useMemo(
    () => ({
      onEdit: setEditing,
      onDelete: setDeleting,
      onView: setViewing,
      onManageTeam: setManagingTeam,
      // F-6A (sim2 problem 12: "Invitation resent" and nothing was sent): the preview sends no email, and says so.
      onResendInvite: (agent: UserRow) =>
        toast.info(`Invitation not sent to ${agent.email}`, {
          description:
            "Preview — simulated: this preview sends no email. In the engine the invitation email would be sent again to this address.",
        }),
    }),
    [],
  );

  const columns = React.useMemo(
    () => makeUsersColumns({ roles, agents, ...menuHandlers }),
    [roles, agents, menuHandlers],
  );

  const table = useTable({
    features: dataTableFeatures,
    data: agents,
    columns,
    state: { rowSelection, sorting, columnFilters, columnVisibility, pagination },
    getRowId: (row) => String(row.id),
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  React.useEffect(() => {
    if (!roleFilterRequest) return;
    setColumnFilters((current) => [
      ...current.filter((f) => f.id !== "role"),
      { id: "role", value: roleFilterRequest.role },
    ]);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    onRoleFilterApplied?.();
  }, [roleFilterRequest, onRoleFilterApplied]);

  // Array columns (team, inboxes) use TanStack v9 arrIncludes, whose filter value is a list: read its first item.
  const filterValue = (id: string) => {
    const value = columnFilters.find((f) => f.id === id)?.value as string | string[] | undefined;
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const searchQuery = filterValue("search");
  const roleFilter = filterValue("role") || "All";
  const availabilityFilter = filterValue("availability") || "All";
  const statusFilter = filterValue("status") || "All";
  const teamFilter = filterValue("team") || "All";
  const inboxFilter = filterValue("inboxes") || "All";
  const selectedCount = Object.keys(rowSelection).length;

  function setColumnSelectFilter(columnId: string, value: string) {
    const arrayColumn = columnId === "team" || columnId === "inboxes";
    let next: string | string[] | undefined;
    if (value !== "All") next = arrayColumn ? [value] : value;
    table.getColumn(columnId)?.setFilterValue(next);
    table.setPageIndex(0);
  }

  const emptyMessage = !agents.length
    ? "There are no agents associated to this account"
    : searchQuery.trim()
      ? "No agents found matching your search"
      : "No results found.";

  const hideable = ["role", "availability", "inboxes", "status", "joinedDate"];
  const filteredRows = table.getSortedRowModel().rows.map((r) => r.original);

  return (
    <>
      {/* م137 round 2 (Fahad 137, judge M137): the page's own buttons in the page header at the right (Chatwoot
          agents/Index.vue: Add Agent in BaseSettingsHeader's actions; Polaris: page actions in the page header). The
          title, line and Learn more are the page header's (users-roles.tsx), so the card has no second header. */}
      {headerActions
        ? createPortal(
            <>
              {/* Studio design-only control, kept by Fahad's rule (shows, no action). */}
              <Button variant="outline" size="sm">
                <Cog /> Customize
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCsv(filteredRows, roles)}>
                <Download /> Export
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus /> Add Agent
              </Button>
            </>,
            headerActions,
          )
        : null}
      <Card>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <ExpandingSearch
                name="agents"
                label="Search agents"
                placeholder="Search agents..."
                size="default"
                className="w-full md:w-64"
                value={searchQuery}
                onChange={(value) => {
                  table.getColumn("search")?.setFilterValue(value || undefined);
                  table.setPageIndex(0);
                }}
              />
              <FilterSelect
                label="Role"
                value={roleFilter}
                options={["All", ...roles.map((r) => r.name)]}
                onChange={(v) => setColumnSelectFilter("role", v)}
              />
              <FilterSelect
                label="Availability"
                value={availabilityFilter}
                options={["All", "Online", "Busy", "Offline"]}
                onChange={(v) => setColumnSelectFilter("availability", v)}
              />
              <FilterSelect
                label="Status"
                value={statusFilter}
                options={["All", "Verified", "Verification Pending"]}
                onChange={(v) => setColumnSelectFilter("status", v)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterSelect
                label="Team"
                value={teamFilter}
                options={["All", ...teamNames]}
                onChange={(v) => setColumnSelectFilter("team", v)}
                align="end"
              />
              <FilterSelect
                label="Inbox"
                value={inboxFilter}
                options={["All", ...inboxNames]}
                onChange={(v) => setColumnSelectFilter("inboxes", v)}
                align="end"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4">
            <div className="text-muted-foreground text-sm tabular-nums">
              {selectedCount} selected · {filteredRows.length} of {agents.length} agents
            </div>
            {/* T-282 round 2 (Fahad 123): the view (columns, then list or grid) comes after the filters above it, as the
                shadcn/ui tasks toolbar (filters, then View) and Twenty's view bar (filter, sort, options). Hide used
                to sit in the header row, before the filters. */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal /> Hide
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {hideable.map((id) => {
                    const column = table.getColumn(id);
                    if (!column) return null;
                    return (
                      <DropdownMenuCheckboxItem
                        key={id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {columnTitles[id]}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Tabs value={view} onValueChange={(v) => setView(v === "grid" ? "grid" : "list")}>
                <TabsList>
                  <TabsTrigger value="list" aria-label="List view">
                    <Rows3 />
                  </TabsTrigger>
                  <TabsTrigger value="grid" aria-label="Grid view">
                    <Grid />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {view === "list" ? (
            <UsersTable table={table} emptyMessage={emptyMessage} />
          ) : filteredRows.length ? (
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredRows.map((agent) => (
                <div key={agent.id} className="flex items-start justify-between gap-3 rounded-xl border p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <AgentAvatar user={agent} />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="truncate font-medium text-sm capitalize">
                        {agent.name}
                        {agent.id === CURRENT_USER_ID ? <span className="text-muted-foreground"> (You)</span> : null}
                      </span>
                      <span className="truncate text-muted-foreground text-sm">{agent.email}</span>
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                        <RoleLabel user={agent} roles={roles} />
                        <span className="h-3 w-px bg-border" />
                        <StatusBadge status={userStatus(agent)} />
                        <AvailabilityBadge availability={agent.availability} />
                      </div>
                    </div>
                  </div>
                  <AgentActionsMenu user={agent} agents={agents} {...menuHandlers} />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-20 text-center text-muted-foreground">{emptyMessage}</div>
          )}
        </CardContent>
      </Card>

      <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} roles={roles} agents={agents} onAdd={addAgent} />
      <EditAgentDialog
        agent={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        roles={roles}
        onSave={updateAgent}
      />
      <ViewProfileDialog
        agent={viewing}
        roleText={viewing ? roleLabel(viewing, roles) : ""}
        onOpenChange={(open) => !open && setViewing(null)}
      />
      <ManageTeamDialog
        agent={managingTeam}
        teamNames={teamNames}
        onOpenChange={(open) => !open && setManagingTeam(null)}
        onSave={setAgentTeams}
      />
      <DeleteAgentDialog
        agent={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={async (agent) => {
          setDeleting(null);
          await deleteAgent(agent);
          // Only once the delete is saved: until then the row is still selectable, and a refused delete brings it back.
          setRowSelection((sel: Record<string, boolean>) => {
            const next = { ...sel };
            delete next[String(agent.id)];
            return next;
          });
        }}
      />
    </>
  );
}
