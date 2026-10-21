"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "cn";
import { CheckCheck, Copy, Eye, ListChecks, MoreVertical, Pencil, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/lib/data-table-features";

import { permissionLabels, permissionShortLabels, type Role } from "./data";

export function makeRolesColumns({
  agentCount,
  onEdit,
  onDelete,
  onViewAgents,
  onReview,
  onViewDetails,
  onDuplicate,
  onReviewPermissions,
}: {
  agentCount: (role: Role) => number;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onViewAgents: (role: Role) => void;
  onReview: (role: Role) => void;
  onViewDetails: (role: Role) => void;
  onDuplicate: (role: Role) => void;
  onReviewPermissions: (role: Role) => void;
}): ColumnDef<DataTableFeatures, Role>[] {
  return [
    {
      id: "group",
      accessorKey: "group",
      filterFn: "equalsString",
      enableHiding: true,
    },
    {
      id: "search",
      accessorFn: (row) => `${row.name} ${row.description}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      id: "role",
      accessorKey: "name",
      header: "الدور",
      size: 170,
      minSize: 150,
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
    },
    {
      id: "description",
      accessorKey: "description",
      header: "الوصف",
      size: 300,
      cell: ({ row }) => (
        <span className="block truncate text-start text-muted-foreground text-sm" title={row.original.description}>
          {row.original.description}
        </span>
      ),
    },
    {
      id: "accessLevel",
      accessorKey: "accessLevel",
      header: "نطاق الصلاحية",
      size: 110,
      cell: ({ row }) => (
        <Badge className="rounded-sm" variant="outline">
          {row.original.accessLevel === "Full" ? "شامل" : "محدد"}
        </Badge>
      ),
    },
    {
      id: "agents",
      accessorFn: (row) => agentCount(row),
      header: "الموظفون",
      size: 80,
      cell: ({ row }) => <span className="text-sm tabular-nums">{agentCount(row.original)}</span>,
    },
    {
      id: "permissions",
      accessorFn: (row) => row.permissions.join(" "),
      header: "الصلاحيات",
      size: 330,
      cell: ({ row }) => {
        const perms = row.original.permissions;
        return (
          <div
            className="flex flex-wrap items-center justify-start gap-1.5"
            title={perms.map((p) => permissionLabels[p]).join("، ")}
          >
            {perms.slice(0, 3).map((p) => (
              <Badge className="rounded-sm" variant="outline" key={p}>
                {permissionShortLabels[p]}
              </Badge>
            ))}
            {perms.length > 3 ? <span className="text-sm tabular-nums">+{perms.length - 3}</span> : null}
          </div>
        );
      },
    },
    {
      id: "lastReview",
      accessorKey: "lastReview",
      header: "آخر مراجعة",
      size: 120,
      cell: ({ row }) => <span className="text-sm">{row.original.lastReview}</span>,
    },
    {
      id: "owner",
      accessorKey: "owner",
      header: "المسؤول",
      size: 120,
      filterFn: "equalsString",
      cell: ({ row }) => <span className="text-sm">{row.original.owner}</span>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "الحالة",
      size: 130,
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge
          className={cn(
            "rounded-sm",
            row.original.status === "Needs review"
              ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          )}
          variant="outline"
        >
          {row.original.status === "Needs review" ? "بانتظار المراجعة" : "نشط"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "إجراءات",
      size: 80,
      cell: ({ row }) => {
        const isSystemRole = row.original.group === "System roles";
        const needsReview = row.original.status === "Needs review";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`إجراءات ${row.original.name}`}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
              <DropdownMenuGroup>
                {needsReview ? (
                  <DropdownMenuItem onSelect={() => onReview(row.original)}>
                    <CheckCheck /> اعتماد المراجعة
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => onViewDetails(row.original)}>
                  <Eye /> عرض التفاصيل
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isSystemRole} onSelect={() => onEdit(row.original)}>
                  <Pencil /> تعديل
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isSystemRole} onSelect={() => onDuplicate(row.original)}>
                  <Copy /> نسخ الدور
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onReviewPermissions(row.original)}>
                  <ListChecks /> جدول الصلاحيات
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onViewAgents(row.original)}>
                  <Users /> عرض الموظفين
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isSystemRole} variant="destructive" onSelect={() => onDelete(row.original)}>
                <Trash2 /> حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableColumnFilter: false,
    },
  ];
}
