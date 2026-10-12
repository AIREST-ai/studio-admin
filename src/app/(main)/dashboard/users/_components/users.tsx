"use client";
// F159: Studio Users card = Chatwoot v4.18 Settings > Agents (settings/agents/Index.vue).
// Header texts, search, Add Agent, Edit / Delete and their rules come from Chatwoot; the card, filter chips,
// Hide / Customize / Export buttons, ⌘K hint, list-grid toggle and paginated table are Studio's.
import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { Cog, Download, ExternalLink, Grid, Plus, Rows3, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataTableFeatures } from "@/lib/data-table-features";

import type { Role } from "../../roles/_components/roles-table/data";
import { AddAgentDialog, DeleteAgentDialog, EditAgentDialog } from "./agent-dialogs";
import { availabilityLabels, CURRENT_USER_ID, teamValues, type UserRow, userStatus } from "./data";
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
    [r.name, r.email, roleLabel(r, roles), availabilityLabels[r.availability], userStatus(r), r.team, r.inboxes.join("; "), r.joinedDate]
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
  setAgents,
  roles,
  roleFilterRequest,
}: {
  agents: UserRow[];
  setAgents: React.Dispatch<React.SetStateAction<UserRow[]>>;
  roles: Role[];
  /** Set by Roles tab "View agents": pre-selects the Role filter. */
  roleFilterRequest?: { role: string; at: number } | null;
}) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "joinedDate", desc: false }]);
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

  const columns = React.useMemo(
    () => makeUsersColumns({ roles, agents, onEdit: setEditing, onDelete: setDeleting }),
    [roles, agents],
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
  }, [roleFilterRequest]);

  const filterValue = (id: string) => (columnFilters.find((f) => f.id === id)?.value as string | undefined) ?? "";
  const searchQuery = filterValue("search");
  const roleFilter = filterValue("role") || "All";
  const availabilityFilter = filterValue("availability") || "All";
  const statusFilter = filterValue("status") || "All";
  const teamFilter = filterValue("team") || "All";
  const selectedCount = Object.keys(rowSelection).length;

  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === "All" ? undefined : value);
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
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Agents</CardTitle>
          <CardDescription className="max-w-xl leading-snug">
            An agent is a member of your customer support team who can view and respond to user messages. The list
            below shows all the agents in your account.{" "}
            <a
              href="https://chwt.app/hc/agents"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              Learn about user roles
              <ExternalLink className="size-3" />
            </a>
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(event) => {
                  table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                  table.setPageIndex(0);
                }}
              />
              <InputGroupAddon align="inline-end">
                <Kbd className="h-4 text-[10px]">⌘K</Kbd>
              </InputGroupAddon>
            </InputGroup>
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
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
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
            <FilterSelect
              label="Team"
              value={teamFilter}
              options={["All", ...teamValues]}
              onChange={(v) => setColumnSelectFilter("team", v)}
              align="end"
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-4">
            <div className="text-muted-foreground text-sm tabular-nums">
              {selectedCount} selected · {filteredRows.length} of {agents.length} agents
            </div>
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
                  <AgentActionsMenu user={agent} agents={agents} onEdit={setEditing} onDelete={setDeleting} />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-20 text-center text-muted-foreground">{emptyMessage}</div>
          )}
        </CardContent>
      </Card>

      <AddAgentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        roles={roles}
        agents={agents}
        onAdd={(agent) => setAgents((list) => [...list, agent])}
      />
      <EditAgentDialog
        agent={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        roles={roles}
        onSave={(agent) => setAgents((list) => list.map((a) => (a.id === agent.id ? agent : a)))}
      />
      <DeleteAgentDialog
        agent={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={(agent) => {
          setAgents((list) => list.filter((a) => a.id !== agent.id));
          setRowSelection((sel: Record<string, boolean>) => {
            const next = { ...sel };
            delete next[String(agent.id)];
            return next;
          });
          setDeleting(null);
        }}
      />
    </>
  );
}
