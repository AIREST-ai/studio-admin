"use client";
// F159: Studio Users columns carrying Chatwoot v4.18 Agents fields (settings/agents/Index.vue):
// avatar with availability dot, name, email, role label (custom role hover card), Verified / Verification Pending,
// and Edit / Delete in the row "…" menu with Chatwoot's visibility rules.
import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { cn } from "cn";
import { parse } from "date-fns";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { getInitials } from "@/lib/utils";

import { personToneClass } from "../../contacts/_components/studio-ui";
import { permissionLabels, type Role, roleKeyOf } from "../../roles/_components/roles-table/data";
import {
  type Availability,
  availabilityLabels,
  availabilityMeta,
  CURRENT_USER_ID,
  statusMeta,
  type UserRow,
  type UserStatus,
  userStatus,
} from "./data";

export function findRole(user: UserRow, roles: Role[]) {
  const wanted = roleKeyOf(user);
  return roles.find((r) => r.key === wanted);
}

export function roleLabel(user: UserRow, roles: Role[]) {
  if (!user.customRoleId) return user.role === "administrator" ? "Administrator" : "Agent";
  return findRole(user, roles)?.name ?? "";
}

/** Chatwoot showEditAction: never on your own row. */
export function canEdit(user: UserRow) {
  return user.id !== CURRENT_USER_ID;
}

/** Chatwoot showDeleteAction: not yourself; always for unconfirmed; not the last verified administrator. */
export function canDelete(user: UserRow, agents: UserRow[]) {
  if (user.id === CURRENT_USER_ID) return false;
  if (!user.confirmed) return true;
  if (user.role === "administrator" && !user.customRoleId) {
    const verifiedAdmins = agents.filter((a) => a.role === "administrator" && !a.customRoleId && a.confirmed);
    return verifiedAdmins.length !== 1;
  }
  return true;
}

export function RoleLabel({ user, roles }: { user: UserRow; roles: Role[] }) {
  const label = roleLabel(user, roles);
  const role = user.customRoleId ? findRole(user, roles) : undefined;
  if (!role) return <span className="whitespace-nowrap">{label}</span>;
  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-pointer whitespace-nowrap text-start underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          {label}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[300px]">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-sm">Available custom role permissions</span>
          <ul className="mb-0 list-disc ps-4">
            {role.permissions.map((permission) => (
              <li key={permission} className="text-muted-foreground text-sm">
                {permissionLabels[permission]}
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function RoleCell({ user, roles }: { user: UserRow; roles: Role[] }) {
  return (
    <div className="grid gap-0.5">
      <RoleLabel user={user} roles={roles} />
      <span className="text-muted-foreground text-xs">{user.team}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: UserStatus }) {
  const meta = statusMeta[status];
  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {status}
    </Badge>
  );
}

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const meta = availabilityMeta[availability];
  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {availabilityLabels[availability]}
    </Badge>
  );
}

/** Chatwoot Avatar with status; offline status dot hidden (hide-offline-status). */
export function AgentAvatar({ user, size = "lg" }: { user: UserRow; size?: "default" | "sm" | "lg" }) {
  return (
    <Avatar size={size} className={cn("font-medium", personToneClass(user.name))}>
      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      {user.availability !== "offline" ? (
        <AvatarBadge
          aria-label={availabilityLabels[user.availability]}
          className={user.availability === "online" ? "bg-green-600" : "bg-amber-500"}
        />
      ) : null}
    </Avatar>
  );
}

function InboxesCell({ inboxes }: { inboxes: string[] }) {
  const [first, ...rest] = inboxes;
  if (!first) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <div className="flex items-center gap-2" title={inboxes.join(", ")}>
      <AvatarGroup className="*:data-[slot=avatar]:ring-0">
        <Avatar className="after:rounded-sm">
          <AvatarFallback className="rounded-sm ring-0">{getInitials(first)}</AvatarFallback>
        </Avatar>
        {rest.length > 0 ? (
          <AvatarGroupCount className="rounded-sm border ring-card">+{rest.length}</AvatarGroupCount>
        ) : null}
      </AvatarGroup>
      <span className="text-sm">{first}</span>
    </div>
  );
}

export function AgentActionsMenu({
  user,
  agents,
  onEdit,
  onDelete,
}: {
  user: UserRow;
  agents: UserRow[];
  onEdit: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
}) {
  const edit = canEdit(user);
  const del = canDelete(user, agents);
  if (!edit && !del) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${user.name}`}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {edit ? (
          <DropdownMenuItem onSelect={() => onEdit(user)}>
            <Pencil /> Edit
          </DropdownMenuItem>
        ) : null}
        {edit && del ? <DropdownMenuSeparator /> : null}
        {del ? (
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(user)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function makeUsersColumns({
  roles,
  agents,
  onEdit,
  onDelete,
}: {
  roles: Role[];
  agents: UserRow[];
  onEdit: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
}): ColumnDef<DataTableFeatures, UserRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Subscribe
            source={table.atoms.rowSelection}
            selector={() =>
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")
            }
          >
            {(checked) => (
              <Checkbox
                aria-label="Select all agents"
                checked={checked}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              />
            )}
          </Subscribe>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
            {(checked) => (
              <Checkbox
                aria-label={`Select ${row.original.name}`}
                checked={checked}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
              />
            )}
          </Subscribe>
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "search",
      accessorFn: (row) => `${row.name} ${row.email}`,
      filterFn: "includesString",
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Agent",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <AgentAvatar user={row.original} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate font-medium text-foreground text-sm capitalize">
              {row.original.name}
              {row.original.id === CURRENT_USER_ID ? (
                <Badge variant="secondary" className="normal-case">
                  You
                </Badge>
              ) : null}
            </div>
            <div className="truncate text-muted-foreground text-sm">{row.original.email}</div>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      accessorFn: (row) => roleLabel(row, roles),
      header: "Role / Team",
      filterFn: "equalsString",
      cell: ({ row }) => <RoleCell user={row.original} roles={roles} />,
    },
    {
      accessorKey: "team",
      header: "Team",
      filterFn: "equalsString",
      cell: ({ row }) => <div className="text-sm">{row.original.team}</div>,
    },
    {
      id: "availability",
      accessorFn: (row) => availabilityLabels[row.availability],
      header: "Availability",
      filterFn: "equalsString",
      cell: ({ row }) => <AvailabilityBadge availability={row.original.availability} />,
    },
    {
      accessorKey: "inboxes",
      header: "Inboxes",
      filterFn: "arrIncludes",
      enableSorting: false,
      cell: ({ row }) => <InboxesCell inboxes={row.original.inboxes} />,
    },
    {
      id: "status",
      accessorFn: (row) => userStatus(row),
      header: "Status",
      filterFn: "equalsString",
      cell: ({ row }) => <StatusBadge status={userStatus(row.original)} />,
    },
    {
      id: "joinedDate",
      accessorFn: (row) => parse(row.joinedDate, "dd MMM yyyy, h:mm a", new Date()).getTime(),
      header: "Joined date",
      cell: ({ row }) => <div className="text-foreground text-sm">{row.original.joinedDate}</div>,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <AgentActionsMenu user={row.original} agents={agents} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
    },
  ];
}
