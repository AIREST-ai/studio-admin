"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Labels (labels/Index.vue, AddLabel.vue, EditLabel.vue, validations.js)
// in the Studio pattern: big title + button, count tabs, card with search, table, "…" row menu.
import * as React from "react";

import { Eye, EyeOff, Pencil, Plus, Shuffle, Trash2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Label as LabelType } from "@/lib/cw/data";
import { CHANGED_ELSEWHERE, setCwList, useCwList, whenListsSaved } from "@/lib/cw/store";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../_shared/settings-shell";
import { FieldError, RowMenu, ToneBadge, tableClass } from "../_shared/settings-ui";

// F161: the account labels are the shared list (src/lib/cw): the Conversations sidebar, the "Add tag…" menu and the
// Contacts labels read the same rows, so a label added, edited or deleted here shows there too.
type LabelRow = Omit<LabelType, "id"> & { id?: string };

const swatches = [
  "#8b5cf6",
  "#0ea5e9",
  "#f59e0b",
  "#14b8a6",
  "#ec4899",
  "#f43f5e",
  "#84cc16",
  "#10b981",
  "#f97316",
  "#6366f1",
];

function randomColor() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;
}

// validations.js: required, minLength(2), no spaces (only letters, numbers, hyphen and underscore).
function titleError(title: string, taken: boolean) {
  if (!title) return "Label name is required";
  if (title.length < 2) return "Minimum length 2 is required";
  if (!/^[\p{L}\p{N}_-]+$/u.test(title)) return "Only Alphabets, Numbers, Hyphen and Underscore are allowed";
  if (taken) return "Label name already exists";
  return "";
}

function LabelDialog({
  open,
  onOpenChange,
  label,
  existing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: LabelRow;
  existing: string[];
  onSave: (row: LabelRow) => Promise<void>;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState(swatches[0]);
  const [sidebar, setSidebar] = React.useState(true);
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(label?.title ?? "");
    setDescription(label?.description ?? "");
    setColor(label?.color ?? randomColor());
    setSidebar(label?.showOnSidebar ?? true);
    setTouched(false);
    setSaving(false);
    setSaveError(null);
  }, [open, label]);

  const error = titleError(
    title.trim(),
    existing.includes(title.trim().toLowerCase()) && title.trim() !== label?.title,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (error || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title: title.trim().toLowerCase(),
        description: description.trim(),
        color,
        showOnSidebar: sidebar,
      });
      onOpenChange(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{label ? "Edit label" : "Add label"}</DialogTitle>
            <DialogDescription>Labels let you group the conversations together.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="label-name">Label Name</Label>
            <Input
              id="label-name"
              placeholder="Label name"
              value={title}
              aria-invalid={touched && !!error}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            <FieldError>{touched ? error : ""}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="label-desc">Description</Label>
            <Textarea
              id="label-desc"
              placeholder="Label Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            </div>
            <div className="flex items-center gap-2">
              <label
                className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border"
                style={{ backgroundColor: color }}
              >
                <input
                  type="color"
                  aria-label="Pick a colour"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <Input
                className="h-8 w-28 font-mono text-xs"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Hex colour"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setColor(randomColor())}>
                <Shuffle /> Random
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="label-sidebar" checked={sidebar} onCheckedChange={(c) => setSidebar(c === true)} />
            <Label htmlFor="label-sidebar" className="font-normal">
              Show label on sidebar
            </Label>
          </div>
          {saveError ? (
            <p role="alert" data-label-save-error="" className="text-destructive text-sm">
              Not saved ({saveError})
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : label ? "Edit" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Tabs from Chatwoot's "Show label on sidebar" option of each label.
type LabelView = "all" | "sidebar" | "hidden";
const labelViews: Record<LabelView, { label: string; match: (l: LabelRow) => boolean }> = {
  all: { label: "All labels", match: () => true },
  sidebar: { label: "Shown on sidebar", match: (l) => l.showOnSidebar },
  hidden: { label: "Hidden from sidebar", match: (l) => !l.showOnSidebar },
};

function notSavedReason(error: unknown): string {
  if (error instanceof Error && error.message === CHANGED_ELSEWHERE) return "changed in another tab or device";
  return error instanceof Error ? error.message : String(error);
}

async function persistLabels(
  change: () => void,
  before: LabelType[],
  successMessage: string,
  toastId?: string | number,
): Promise<void> {
  const saved = whenListsSaved(["labels"]);
  change();
  try {
    await saved;
    toast.success(successMessage, toastId !== undefined ? { id: toastId } : undefined);
  } catch (error) {
    if (!(error instanceof Error && error.message === CHANGED_ELSEWHERE)) {
      setCwList("labels", before);
    }
    const reason = notSavedReason(error);
    if (error instanceof Error && error.message === CHANGED_ELSEWHERE && toastId !== undefined) {
      toast.dismiss(toastId);
    } else if (!(error instanceof Error && error.message === CHANGED_ELSEWHERE)) {
      toast.error(`Not saved (${reason})`, toastId !== undefined ? { id: toastId } : undefined);
    }
    throw new Error(reason);
  }
}

export function LabelsList() {
  const [labels, setLabels] = useCwList("labels");
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<LabelView>("all");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<LabelRow | undefined>();
  const [deleting, setDeleting] = React.useState<LabelRow | undefined>();

  const q = query.trim().toLowerCase();
  const rows = labels.filter(
    (l) => labelViews[view].match(l) && `${l.title} ${l.description}`.toLowerCase().includes(q),
  );
  const titles = labels.map((l) => l.title);

  return (
    <>
      <SettingsShell
        title="Labels"
        description="Labels help you categorize and prioritize conversations and leads. You can assign a label to a conversation or contact using the side panel."
        learnMore="Learn more about labels"
        count={plural(rows.length, "label", "labels")}
        search={{ placeholder: "Search labels...", value: query, onChange: setQuery }}
        tabs={{
          value: view,
          onValueChange: (v) => setView(v as LabelView),
          items: (Object.keys(labelViews) as LabelView[]).map((key) => ({
            value: key,
            label: labelViews[key].label,
            count: labels.filter(labelViews[key].match).length,
          })),
        }}
        cardTitle="Manage labels"
        cardDescription="Labels let you group the conversations together."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add label
          </Button>
        }
      >
        {rows.length ? (
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="py-3 font-normal">Description</TableHead>
                <TableHead className="py-3 font-normal">Color</TableHead>
                <TableHead className="sticky right-0 w-20 bg-card py-3 text-right font-normal shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((label) => (
                <TableRow key={label.title} className="border-border/60">
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                      <span className="font-medium">{label.title}</span>
                      {label.showOnSidebar ? null : <ToneBadge tone="gray">Hidden from sidebar</ToneBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal py-3.5 text-muted-foreground">
                    {label.description || "---"}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      <span className="size-4 rounded" style={{ backgroundColor: label.color }} />
                      {label.color}
                    </span>
                  </TableCell>
                  <TableCell className="sticky right-0 bg-card py-3.5 text-right shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                    <RowMenu
                      name={label.title}
                      items={[
                        { label: "Edit", icon: Pencil, onSelect: () => setEditing(label) },
                        {
                          label: label.showOnSidebar ? "Hide from sidebar" : "Show on sidebar",
                          icon: label.showOnSidebar ? EyeOff : Eye,
                          onSelect: () => {
                            const before = labels;
                            void persistLabels(
                              () =>
                                setLabels((prev) =>
                                  prev.map((l) =>
                                    l.title === label.title ? { ...l, showOnSidebar: !l.showOnSidebar } : l,
                                  ),
                                ),
                              before,
                              "Label updated successfully",
                            ).catch(() => undefined);
                          },
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          destructive: true,
                          separatorBefore: true,
                          onSelect: () => setDeleting(label),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {q ? "No labels found matching your search" : "There are no labels available in this account."}
          </NoResults>
        )}
      </SettingsShell>

      <LabelDialog
        open={adding}
        onOpenChange={setAdding}
        existing={titles}
        onSave={async (row) => {
          const before = labels;
          await persistLabels(
            () => setLabels((prev) => [...prev, { ...row, id: row.title }]),
            before,
            "Label added successfully",
          );
        }}
      />
      <LabelDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        label={editing}
        existing={titles}
        onSave={async (row) => {
          const before = labels;
          await persistLabels(
            () =>
              setLabels((prev) =>
                prev.map((l) => (l.title === editing?.title ? { ...row, id: l.id ?? row.title } : l)),
              ),
            before,
            "Label updated successfully",
          );
        }}
      />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm Deletion"
        message={`Are you sure to delete ${deleting?.title ?? ""}?`}
        yes={`Yes, Delete ${deleting?.title ?? ""}`}
        no={`No, Keep ${deleting?.title ?? ""}`}
        onConfirm={() => {
          if (!deleting) return;
          const before = labels;
          const id = `delete-label-${deleting.title}`;
          toast.loading(`Deleting “${deleting.title}”…`, { id });
          void persistLabels(
            () => setLabels((prev) => prev.filter((l) => l.title !== deleting.title)),
            before,
            "Label deleted successfully",
            id,
          ).catch(() => undefined);
        }}
      />
    </>
  );
}
