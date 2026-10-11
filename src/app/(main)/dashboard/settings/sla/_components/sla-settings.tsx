"use client";
import * as React from "react";

import { Info, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";

interface Sla {
  id: number;
  name: string;
  description: string;
  frt: string;
  nrt: string;
  rt: string;
  businessHours: boolean;
}

const slas: Sla[] = [
  { id: 1, name: "Enterprise P0", description: "Issues raised by enterprise customers, that require immediate attention.", frt: "15m", nrt: "30m", rt: "4h", businessHours: false },
  { id: 2, name: "Enterprise P1", description: "Issues raised by enterprise customers, that needs to be acknowledged quickly.", frt: "1h", nrt: "2h", rt: "1d", businessHours: true },
  { id: 3, name: "VIP Doha", description: "Repeat buyers and corporate accounts in Qatar", frt: "10m", nrt: "20m", rt: "8h", businessHours: false },
  { id: 4, name: "Refund 24h", description: "Refund and billing requests must close within one day", frt: "2h", nrt: "4h", rt: "1d", businessHours: true },
  { id: 5, name: "Standard", description: "Default promise for all website and WhatsApp chats", frt: "4h", nrt: "8h", rt: "3d", businessHours: true },
];

const columns = [
  { key: "frt", short: "FRT", long: "First response time threshold" },
  { key: "nrt", short: "NRT", long: "Next response time threshold" },
  { key: "rt", short: "RT", long: "Resolution time threshold" },
] as const;

function TimeField({ id, label, placeholder, unit }: { id: string; label: string; placeholder: string; unit: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} type="number" min={1} placeholder={placeholder} className="flex-1" />
        <NativeSelect className="w-28" defaultValue={unit}>
          <option value="Minutes">Minutes</option>
          <option value="Hours">Hours</option>
          <option value="Days">Days</option>
        </NativeSelect>
      </div>
    </div>
  );
}

function AddSlaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add SLA</DialogTitle>
          <DialogDescription>Friendly promises for great service!</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sla-name">SLA Name</Label>
            <Input id="sla-name" placeholder="SLA Name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sla-desc">Description</Label>
            <Input id="sla-desc" placeholder="SLA for premium customers" />
          </div>
          <TimeField id="sla-frt" label="First Response Time" placeholder="5" unit="Minutes" />
          <TimeField id="sla-nrt" label="Next Response Time" placeholder="5" unit="Minutes" />
          <TimeField id="sla-rt" label="Resolution Time" placeholder="60" unit="Minutes" />
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="grid gap-0.5">
              <Label htmlFor="sla-bh">Business Hours</Label>
              <span className="text-muted-foreground text-xs">Only during business hours</span>
            </div>
            <Switch id="sla-bh" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Create</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SlaSettings() {
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Sla | undefined>();

  const q = query.trim().toLowerCase();
  const rows = slas.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q));

  return (
    <>
      <SettingsShell
        title="Service Level Agreements"
        description="Service Level Agreements (SLAs) are contracts that define clear expectations between your team and customers. They establish standards for response and resolution times, creating a framework for accountability and ensures a consistent, high-quality experience."
        learnMore="Learn more about SLA"
        count={plural(rows.length, "SLA", "SLAs")}
        search={{ placeholder: "Search SLA...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add SLA
          </Button>
        }
      >
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">SLA</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.key} className="w-24 py-3 font-normal">
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        {c.short}
                        <Info className="size-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>{c.long}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
                <TableHead className="w-36 py-3 font-normal">Business hours</TableHead>
                <TableHead className="w-16 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="border-border/60">
                  <TableCell className="py-3.5 whitespace-normal">
                    <div className="grid gap-0.5">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground text-xs">{s.description}</span>
                    </div>
                  </TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="py-3.5 font-medium tabular-nums">
                      {s[c.key]}
                    </TableCell>
                  ))}
                  <TableCell className="py-3.5">
                    <Badge variant={s.businessHours ? "secondary" : "outline"} className="font-normal">
                      {s.businessHours ? "Turned on" : "Turned off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete SLA"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete SLA</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>No SLA found matching your search</NoResults>
        )}
      </SettingsShell>

      <AddSlaDialog open={adding} onOpenChange={setAdding} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm Deletion"
        message={`Are you sure you want to delete ${deleting?.name ?? ""}?`}
        yes={`Yes, Delete ${deleting?.name ?? ""}`}
        no={`No, Keep ${deleting?.name ?? ""}`}
      />
    </>
  );
}
