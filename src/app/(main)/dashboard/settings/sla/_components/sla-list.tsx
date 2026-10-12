"use client";
// F159 settings-b: Chatwoot v4.18 Settings > SLA (sla/Index.vue, AddSLA.vue, SlaForm.vue, SlaTimeInput.vue,
// validations.js; sla.json) in the Studio pattern. Chatwoot lists SLAs with Add and Delete only (no edit).
import * as React from "react";

import { Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, FieldError, RowMenu, tableClass, ToneBadge } from "../../labels/_shared/settings-ui";

type Unit = "Minutes" | "Hours" | "Days";
type Key = "frt" | "nrt" | "rt";

interface Sla {
  id: number;
  name: string;
  description: string;
  /** Thresholds in seconds, as the API stores them; null when not set. */
  frt: number | null;
  nrt: number | null;
  rt: number | null;
  businessHours: boolean;
}

const M = 60;
const H = 3600;
const D = 86400;

const initialSlas: Sla[] = [
  { id: 1, name: "Enterprise P0", description: "Issues raised by enterprise customers, that require immediate attention.", frt: 15 * M, nrt: 30 * M, rt: 4 * H, businessHours: false },
  { id: 2, name: "Enterprise P1", description: "Issues raised by enterprise customers, that needs to be acknowledged quickly.", frt: 1 * H, nrt: 2 * H, rt: 1 * D, businessHours: true },
  { id: 3, name: "VIP Doha", description: "Repeat buyers and corporate accounts in Qatar", frt: 10 * M, nrt: 20 * M, rt: 8 * H, businessHours: false },
  { id: 4, name: "Refund 24h", description: "Refund and billing requests must close within one day", frt: 2 * H, nrt: null, rt: 1 * D, businessHours: true },
  { id: 5, name: "Standard", description: "Default promise for all website and WhatsApp chats", frt: 4 * H, nrt: 8 * H, rt: 3 * D, businessHours: true },
];

const columns: { key: Key; short: string; long: string; label: string; placeholder: string }[] = [
  { key: "frt", short: "FRT", long: "First response time threshold", label: "First Response Time", placeholder: "5" },
  { key: "nrt", short: "NRT", long: "Next response time threshold", label: "Next Response Time", placeholder: "5" },
  { key: "rt", short: "RT", long: "Resolution time threshold", label: "Resolution Time", placeholder: "60" },
];

const unitSeconds: Record<Unit, number> = { Minutes: M, Hours: H, Days: D };

// @chatwoot/utils convertSecondsToTimeUnit, short form for the table (15m, 2h, 1d).
function shortTime(seconds: number | null) {
  if (!seconds) return "---";
  if (seconds % D === 0) return `${seconds / D}d`;
  if (seconds % H === 0) return `${seconds / H}h`;
  return `${Math.round(seconds / M)}m`;
}

interface TimeInput {
  threshold: string;
  unit: Unit;
}

function SlaDialog({
  open,
  onOpenChange,
  takenNames,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  takenNames: string[];
  onSave: (sla: Omit<Sla, "id">) => void;
}) {
  const blankTimes = (): Record<Key, TimeInput> => ({
    frt: { threshold: "", unit: "Minutes" },
    nrt: { threshold: "", unit: "Minutes" },
    rt: { threshold: "", unit: "Minutes" },
  });
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [times, setTimes] = React.useState(blankTimes);
  const [businessHours, setBusinessHours] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setTimes(blankTimes());
    setBusinessHours(false);
    setSubmitted(false);
  }, [open]);

  const nameError = !name.trim()
    ? "SLA name is required"
    : name.trim().length < 2
      ? "Minimum length 2 is required"
      : takenNames.includes(name.trim().toLowerCase())
        ? "SLA name already exists"
        : "";
  const timeError = (k: Key) => {
    const v = times[k].threshold;
    if (!v) return "";
    return Number(v) > 0 ? "" : "Threshold should be a number and greater than zero";
  };
  const noneSet = columns.every((c) => !times[c.key].threshold);
  const hasError = !!nameError || columns.some((c) => timeError(c.key)) || noneSet;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasError) return;
    const seconds = (k: Key) => (times[k].threshold ? Number(times[k].threshold) * unitSeconds[times[k].unit] : null);
    onSave({
      name: name.trim(),
      description: description.trim(),
      frt: seconds("frt"),
      nrt: seconds("nrt"),
      rt: seconds("rt"),
      businessHours,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Add SLA</DialogTitle>
            <DialogDescription>Friendly promises for great service!</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="sla-name">SLA Name</Label>
            <Input
              id="sla-name"
              placeholder="SLA Name"
              value={name}
              aria-invalid={submitted && !!nameError}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError>{submitted ? nameError : ""}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sla-desc">Description</Label>
            <Textarea
              id="sla-desc"
              rows={2}
              placeholder="SLA for premium customers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {columns.map((c) => {
            const error = timeError(c.key);
            return (
              <div key={c.key} className="grid gap-2">
                <Label htmlFor={`sla-${c.key}`}>{c.label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={`sla-${c.key}`}
                    type="number"
                    min={0}
                    step="any"
                    placeholder={c.placeholder}
                    className="flex-1"
                    aria-invalid={!!error}
                    value={times[c.key].threshold}
                    onChange={(e) =>
                      setTimes((t) => ({ ...t, [c.key]: { ...t[c.key], threshold: e.target.value } }))
                    }
                  />
                  <NativeSelect
                    className="w-28"
                    aria-label={`${c.label} unit`}
                    value={times[c.key].unit}
                    onChange={(e) =>
                      setTimes((t) => ({ ...t, [c.key]: { ...t[c.key], unit: e.target.value as Unit } }))
                    }
                  >
                    <option value="Minutes">Minutes</option>
                    <option value="Hours">Hours</option>
                    <option value="Days">Days</option>
                  </NativeSelect>
                </div>
                <FieldError>{error}</FieldError>
              </div>
            );
          })}
          {submitted && noneSet ? <FieldError>Set at least one threshold time</FieldError> : null}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="grid gap-0.5">
              <Label htmlFor="sla-bh">Business Hours</Label>
              <span className="text-muted-foreground text-xs">Only during business hours</span>
            </div>
            <Switch id="sla-bh" checked={businessHours} onCheckedChange={setBusinessHours} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SlaList() {
  const [slas, setSlas] = React.useState(initialSlas);
  const [query, setQuery] = React.useState("");
  const [hours, setHours] = React.useState("All");
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Sla | undefined>();

  const q = query.trim().toLowerCase();
  const rows = slas.filter(
    (s) =>
      (hours === "All" || (hours === "Turned on") === s.businessHours) &&
      `${s.name} ${s.description}`.toLowerCase().includes(q),
  );

  return (
    <>
      <SettingsShell
        title="Service Level Agreements"
        description="Service Level Agreements (SLAs) are contracts that define clear expectations between your team and customers. They establish standards for response and resolution times, creating a framework for accountability and ensures a consistent, high-quality experience."
        learnMore="Learn more about SLA"
        count={plural(rows.length, "SLA", "SLAs")}
        search={{ placeholder: "Search SLA...", value: query, onChange: setQuery }}
        cardTitle="SLA policies"
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add SLA
          </Button>
        }
      >
        <ChipBar>
          <ChipSelect
            label="Business hours"
            value={hours}
            options={["All", "Turned on", "Turned off"]}
            onChange={setHours}
          />
        </ChipBar>
        {rows.length ? (
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">SLA</TableHead>
                <TableHead className="py-3 font-normal">Business hours</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.key} className="w-24 py-3 font-normal">
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        {c.short} <Info className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>{c.long}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
                <TableHead className="w-20 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((sla) => (
                <TableRow key={sla.id} className="border-border/60">
                  <TableCell className="max-w-md whitespace-normal py-3.5">
                    <div className="grid gap-0.5">
                      <span className="font-medium">{sla.name}</span>
                      <span className="text-muted-foreground text-xs">{sla.description || "---"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    {sla.businessHours ? (
                      <ToneBadge tone="green">Turned on</ToneBadge>
                    ) : (
                      <ToneBadge tone="gray">Turned off</ToneBadge>
                    )}
                  </TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="py-3.5 font-mono text-sm tabular-nums">
                      {shortTime(sla[c.key])}
                    </TableCell>
                  ))}
                  <TableCell className="py-3.5 text-right">
                    <RowMenu
                      name={sla.name}
                      items={[
                        { label: "Delete", icon: Trash2, destructive: true, onSelect: () => setDeleting(sla) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {q || hours !== "All" ? "No SLA found matching your search" : "There are no SLAs available in this account."}
          </NoResults>
        )}
      </SettingsShell>

      <SlaDialog
        open={adding}
        onOpenChange={setAdding}
        takenNames={slas.map((s) => s.name.toLowerCase())}
        onSave={(sla) => {
          setSlas((prev) => [...prev, { ...sla, id: Date.now() }]);
          toast.success("SLA added successfully");
        }}
      />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm Deletion"
        message={`Are you sure you want to delete ${deleting?.name ?? ""}`}
        yes={`Yes, Delete ${deleting?.name ?? ""}`}
        no={`No, Keep ${deleting?.name ?? ""}`}
        onConfirm={() => {
          setSlas((prev) => prev.filter((s) => s.id !== deleting?.id));
          toast.success("SLA deleted successfully");
        }}
      />
    </>
  );
}
