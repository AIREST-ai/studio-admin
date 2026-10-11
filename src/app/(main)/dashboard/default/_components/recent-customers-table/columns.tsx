"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { addMinutes, differenceInCalendarDays, endOfToday, format, parseISO } from "date-fns";
import { CircleAlertIcon, CircleCheckIcon, Clock3Icon, LoaderIcon, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { DataTableFeatures } from "@/lib/data-table-features";

import type { RecentCustomerRow } from "./schema";

function statusIcon(status: string) {
  switch (status) {
    case "Solved":
      return <CircleCheckIcon className="fill-green-500 stroke-primary-foreground dark:fill-green-600" />;
    case "In progress":
      return <LoaderIcon />;
    case "Dodge detected":
      return <CircleAlertIcon className="text-amber-600 dark:text-amber-500" />;
    case "Waiting on customer":
      return <Clock3Icon className="text-muted-foreground" />;
    default:
      return null;
  }
}

export const recentCustomersColumns: ColumnDef<DataTableFeatures, RecentCustomerRow>[] = [
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
              checked={checked}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all dodges on this page"
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
              checked={checked}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select ${row.original.name}`}
            />
          )}
        </Subscribe>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
          <UserRound className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-end justify-between gap-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-sm leading-none">{row.original.name}</span>
              <span className="truncate text-muted-foreground text-xs leading-none">Chat #{row.original.id}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: "search",
    accessorFn: (row) => `${row.id} ${row.name} ${row.agent} ${row.dodge}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "dodge",
    header: "Dodge",
    cell: ({ row }) => (
      <span className="block max-w-64 truncate text-muted-foreground text-sm">“{row.original.dodge}”</span>
    ),
  },
  {
    accessorKey: "channel",
    header: "Channel",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.channel}
      </Badge>
    ),
  },
  {
    accessorKey: "agent",
    header: "Agent",
    cell: ({ row }) => <span className="text-sm">{row.original.agent}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {statusIcon(row.original.status)}
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: "detectedWindow",
    accessorFn: (row) => {
      const daysSinceDetected = differenceInCalendarDays(endOfToday(), parseISO(row.detected));

      if (daysSinceDetected <= 7) return ["7", "30"];
      if (daysSinceDetected <= 30) return ["30"];
      return [];
    },
    filterFn: "arrIncludes",
    enableHiding: true,
  },
  {
    accessorKey: "detected",
    header: "Detected",
    cell: ({ row }) => {
      const baseDate = parseISO(row.original.detected);
      const detectedAt = addMinutes(baseDate, 9 * 60 + (Number(row.original.id) % 12) * 17);

      return (
        <div className="grid gap-0.5">
          <span className="text-sm">{format(detectedAt, "do MMMM yyyy")}</span>
          <span className="text-muted-foreground text-xs">at {format(detectedAt, "h:mm a")}</span>
        </div>
      );
    },
  },
];
