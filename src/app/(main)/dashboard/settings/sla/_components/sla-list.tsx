"use client";
// F159 settings-b: Chatwoot v4.18 Settings > SLA (sla/Index.vue, AddSLA.vue, SlaForm.vue, SlaTimeInput.vue,
// validations.js; sla.json) in the Studio pattern. Chatwoot lists SLAs with Add and Delete only (no edit).
// T-261 (buried 6, Fahad item 5 "افتحها"): the list is saved on the preview server (sla-store.ts) and the inbox's SLA
// badge follows it, so a policy can also be edited here: Chatwoot's API has the update (SlaPoliciesController#update
// permits the same fields as create), its settings page only lacks the button.
import * as React from "react";

import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CeUnavailableNotice } from "@/lib/chatwoot/settings-adapter";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, FieldError, RowMenu, ToneBadge, tableClass } from "../../labels/_shared/settings-ui";
import { D, H, M, type Sla } from "./sla-data";
import { loadSlaPolicies, saveSlaChange, useSlaPolicies } from "./sla-store";

type Unit = "Minutes" | "Hours" | "Days";
type Key = "frt" | "nrt" | "rt";

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

// T-261: a saved threshold back in the form's largest whole unit (Chatwoot convertSecondsToTimeUnit).
function timeInput(seconds: number | null): TimeInput {
  if (!seconds) return { threshold: "", unit: "Minutes" };
  if (seconds % D === 0) return { threshold: String(seconds / D), unit: "Days" };
  if (seconds % H === 0) return { threshold: String(seconds / H), unit: "Hours" };
  return { threshold: String(seconds / M), unit: "Minutes" };
}

function SlaDialog({
  open,
  onOpenChange,
  takenNames,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  takenNames: string[];
  /** T-261: the policy being edited; none for Add SLA. */
  editing?: Sla;
  /** Resolves once saved; the dialog stays open with the person's values when it rejects. */
  onSave: (sla: Omit<Sla, "id">) => Promise<void>;
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
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setTimes(
      editing ? { frt: timeInput(editing.frt), nrt: timeInput(editing.nrt), rt: timeInput(editing.rt) } : blankTimes(),
    );
    setBusinessHours(editing?.businessHours ?? false);
    setSubmitted(false);
    setSaving(false);
  }, [open, editing]);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasError || saving) return;
    const seconds = (k: Key) => (times[k].threshold ? Number(times[k].threshold) * unitSeconds[times[k].unit] : null);
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        frt: seconds("frt"),
        nrt: seconds("nrt"),
        rt: seconds("rt"),
        businessHours,
      });
      onOpenChange(false);
    } catch {
      // The reason is shown by the page; the values stay in the form.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit SLA" : "Add SLA"}</DialogTitle>
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
                    onChange={(e) => setTimes((t) => ({ ...t, [c.key]: { ...t[c.key], threshold: e.target.value } }))}
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
            <Checkbox id="sla-bh" checked={businessHours} onCheckedChange={(v) => setBusinessHours(v === true)} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// T-261: every change waits for the preview server; a failed save says why and keeps the saved list.
async function save(change: Parameters<typeof saveSlaChange>[0], done: string) {
  try {
    await saveSlaChange(change);
    toast.success(done);
  } catch (error) {
    toast.error(`SLA not saved: ${(error as Error).message}`);
    throw error;
  }
}

export function SlaList() {
  const slas = useSlaPolicies((state) => state.policies);
  const loadFailed = useSlaPolicies((state) => state.status === "error");
  const [query, setQuery] = React.useState("");
  const [hours, setHours] = React.useState("All");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Sla | undefined>();
  const [deleting, setDeleting] = React.useState<Sla | undefined>();

  React.useEffect(() => {
    void loadSlaPolicies();
  }, []);

  React.useEffect(() => {
    if (loadFailed) toast.error("The saved SLA policies could not be loaded. Changes will not be saved.");
  }, [loadFailed]);

  const q = query.trim().toLowerCase();
  const rows = slas.filter(
    (s) =>
      (hours === "All" || (hours === "Turned on") === s.businessHours) &&
      `${s.name} ${s.description}`.toLowerCase().includes(q),
  );

  return (
    <>
      <SettingsShell
        title="SLA"
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
        <CeUnavailableNotice
          area="sla_policies"
          title="SLA policies are unavailable in Chatwoot Community Edition (501)"
          className="mx-6 mt-4"
        />
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
                        { label: "Edit", icon: Pencil, onSelect: () => setEditing(sla) },
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
            {q || hours !== "All"
              ? "No SLA found matching your search"
              : "There are no SLAs available in this account."}
          </NoResults>
        )}
      </SettingsShell>

      <SlaDialog
        open={adding}
        onOpenChange={setAdding}
        takenNames={slas.map((s) => s.name.toLowerCase())}
        onSave={(sla) => save({ type: "add", sla }, "SLA added successfully")}
      />
      <SlaDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        editing={editing}
        takenNames={slas.filter((s) => s.id !== editing?.id).map((s) => s.name.toLowerCase())}
        onSave={(sla) => {
          const before = editing as Sla;
          // Only the changed fields, so a save made on top of another tab's keeps that tab's other changes.
          const patch = Object.fromEntries(
            (Object.keys(sla) as (keyof typeof sla)[]).filter((k) => sla[k] !== before[k]).map((k) => [k, sla[k]]),
          );
          return save({ type: "update", id: before.id, patch }, "SLA updated successfully");
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
          if (deleting)
            void save({ type: "delete", id: deleting.id }, "SLA deleted successfully").catch(() => undefined);
        }}
      />
    </>
  );
}
