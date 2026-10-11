"use client";
import * as React from "react";

import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../_shared/settings-shell";

interface LabelRow {
  title: string;
  description: string;
  color: string;
  showOnSidebar: boolean;
}

const labels: LabelRow[] = [
  { title: "vip-customer", description: "Repeat buyers and corporate accounts in Doha", color: "#7C3AED", showOnSidebar: true },
  { title: "billing", description: "Invoices, refunds and payment questions", color: "#2563EB", showOnSidebar: true },
  { title: "delivery-delay", description: "Orders late beyond the promised slot", color: "#DC2626", showOnSidebar: true },
  { title: "ramadan-offer", description: "Questions about the Ramadan campaign prices", color: "#059669", showOnSidebar: false },
  { title: "arabic", description: "Customer prefers to be answered in Arabic", color: "#0891B2", showOnSidebar: true },
  { title: "warranty", description: "Device repair and warranty claims", color: "#D97706", showOnSidebar: false },
  { title: "lead-uae", description: "New sales leads from Dubai and Abu Dhabi", color: "#DB2777", showOnSidebar: true },
  { title: "riyadh-branch", description: "Conversations routed to the Riyadh showroom", color: "#4F46E5", showOnSidebar: false },
  { title: "feedback", description: "", color: "#65A30D", showOnSidebar: false },
];

const swatches = ["#7C3AED", "#2563EB", "#0891B2", "#059669", "#65A30D", "#D97706", "#DC2626", "#DB2777", "#4F46E5", "#475569"];

function LabelDialog({
  open,
  onOpenChange,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: LabelRow;
}) {
  const [color, setColor] = React.useState(label?.color ?? swatches[0]);
  React.useEffect(() => setColor(label?.color ?? swatches[0]), [label]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label ? "Edit label" : "Add label"}</DialogTitle>
          <DialogDescription>Labels let you group the conversations together.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="label-name">Label Name</Label>
            <Input id="label-name" placeholder="Label name" defaultValue={label?.title} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="label-desc">Description</Label>
            <Textarea id="label-desc" placeholder="Label Description" defaultValue={label?.description} />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {swatches.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  onClick={() => setColor(swatch)}
                  className="size-7 rounded-md ring-offset-2 ring-offset-background data-[active=true]:ring-2 data-[active=true]:ring-ring"
                  data-active={color === swatch}
                  style={{ backgroundColor: swatch }}
                />
              ))}
              <Input className="ml-1 h-7 w-28 font-mono text-xs" value={color} readOnly />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="label-sidebar" defaultChecked={label?.showOnSidebar ?? true} />
            <Label htmlFor="label-sidebar" className="font-normal">
              Show label on sidebar
            </Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{label ? "Edit" : "Create"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LabelsSettings() {
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<LabelRow | undefined>();
  const [deleting, setDeleting] = React.useState<LabelRow | undefined>();

  const rows = labels.filter((l) => `${l.title} ${l.description}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <SettingsShell
        title="Labels"
        description="Labels help you categorize and prioritize conversations and leads. You can assign a label to a conversation or contact using the side panel."
        learnMore="Learn more about labels"
        count={plural(rows.length, "label", "labels")}
        search={{ placeholder: "Search labels...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add label
          </Button>
        }
      >
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="py-3 font-normal">Description</TableHead>
                <TableHead className="py-3 font-normal">Color</TableHead>
                <TableHead className="w-28 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((label) => (
                <TableRow key={label.title} className="border-border/60">
                  <TableCell className="py-3.5 font-medium">{label.title}</TableCell>
                  <TableCell className="max-w-md truncate py-3.5 text-muted-foreground">
                    {label.description || "---"}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      <span className="size-4 rounded" style={{ backgroundColor: label.color }} />
                      {label.color}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(label)}>
                            <Pencil />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleting(label)}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>No labels found matching your search</NoResults>
        )}
      </SettingsShell>

      <LabelDialog open={adding} onOpenChange={setAdding} />
      <LabelDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} label={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm Deletion"
        message={`Are you sure to delete ${deleting?.title ?? ""}?`}
        yes={`Yes, Delete ${deleting?.title ?? ""}`}
        no={`No, Keep ${deleting?.title ?? ""}`}
      />
    </>
  );
}
