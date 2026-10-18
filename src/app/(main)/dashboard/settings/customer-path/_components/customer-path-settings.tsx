"use client";
// T-96 Settings > «مسار العميل»: the stages in order, each with its colour dot, and «Add stage» to add more (Fahad:
// «خيار في الاعدادات أن يستطيع أن يضيف»). respond.io Settings > Lifecycle: "+ Add Stage", up to 20 stages in total.
// The six starting stages stay; a stage added here can be deleted, and its contacts go back to no stage.
// T-141 (item 59: «Labels ومسار العميل كلاهما نفس الايقونات والمعنا والشكل … فعليا هذه مستوحاه من دورة الحياة»): drawn as
// a path, not as the Labels table: the whole path on top, then the stages as numbered steps on one line, each with its
// number of contacts (a contact is on one stage at a time). Saved in the shared preview save (lib/cw/customer-path.ts).
// F-9 (sim3 step 9.1b): every stage, the six starting ones too, has Edit (name and colour), Move up and Move down in
// its "…" menu, and a drag handle on the left, as respond.io rearranges Lifecycle stages "by dragging and dropping them
// to your desired position using the button on the left" (respond.io/help/workspace-settings/workspace-settings-lifecycle).
// Each change is saved in the preview and stays after a reload and in another browser.
import * as React from "react";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CustomerPathSaveNotice,
  PathStrip,
  StageDot,
  StageStep,
} from "@/app/(main)/dashboard/chat/_components/customer-path";
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
import {
  customerPath,
  MAX_PATH_STAGES,
  type PathStage,
  useCustomerPath,
  useHydrateCustomerPath,
  whenPathSaved,
} from "@/lib/cw/customer-path";

import { ConfirmDelete, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { FieldError, RowMenu } from "../../labels/_shared/settings-ui";

const swatches = [
  "#0ea5e9",
  "#f43f5e",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#64748b",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

function stageNameError(name: string, stages: PathStage[], editingId?: string): string {
  if (!name) return "Stage name is required";
  if (stages.some((stage) => stage.id !== editingId && stage.name.trim().toLowerCase() === name.toLowerCase()))
    return "Stage name already exists";
  return "";
}

/** Add a stage, or (F-9) edit one: `editing` is the stage whose name and colour change. */
function StageDialog({
  open,
  onOpenChange,
  stages,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PathStage[];
  editing?: PathStage | null;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(swatches[0]);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? swatches[stages.length % swatches.length]);
    setTouched(false);
  }, [open, stages.length, editing]);

  const trimmed = name.trim();
  const error = stageNameError(trimmed, stages, editing?.id);
  // The colours to pick from, with the stage's own colour first when it is not one of them.
  const choices = editing && !swatches.includes(editing.color) ? [editing.color, ...swatches] : swatches;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (error) return;
            if (editing) {
              customerPath.editStage(editing.id, trimmed, color);
              saidWhenSaved("Stage updated");
            } else {
              customerPath.addStage(trimmed, color);
              saidWhenSaved("Stage added");
            }
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add stage"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Its contacts stay on it. The new name and colour show everywhere the stage is shown."
                : "The new stage is added after the last one."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="path-stage-name">Stage name</Label>
            <Input
              id="path-stage-name"
              value={name}
              maxLength={60}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            {touched ? <FieldError>{error}</FieldError> : null}
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {choices.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  aria-pressed={color === swatch}
                  onClick={() => setColor(swatch)}
                  className="size-6 rounded-full ring-offset-2 ring-offset-background data-[active=true]:ring-2 data-[active=true]:ring-ring"
                  data-active={color === swatch}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{editing ? "Save" : "Add stage"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// The line under each saved change: honest about where it is kept (Fahad 129.2), shown only once the preview server
// has the change; a failed save shows the store's own "Customer Path not saved" with Retry instead.
const SAVED_NOTE = "Preview — simulated: saved in this preview, not in the engine. It stays after a reload.";

function saidWhenSaved(title: string) {
  whenPathSaved().then(
    () => toast.success(title, { description: SAVED_NOTE }),
    () => undefined,
  );
}

function moved(run: () => void) {
  run();
  saidWhenSaved("Stage order saved");
}

function StageRow({
  stage,
  index,
  count,
  contacts,
  onEdit,
  onDelete,
}: {
  stage: PathStage;
  index: number;
  count: number;
  contacts: number;
  onEdit: (stage: PathStage) => void;
  onDelete: (stage: PathStage) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: stage.id, index, type: "stage", accept: "stage" });
  const items = [
    { label: "Edit", icon: Pencil, onSelect: () => onEdit(stage) },
    ...(index > 0
      ? [{ label: "Move up", icon: ArrowUp, onSelect: () => moved(() => customerPath.moveStage(stage.id, -1)) }]
      : []),
    ...(index < count - 1
      ? [{ label: "Move down", icon: ArrowDown, onSelect: () => moved(() => customerPath.moveStage(stage.id, 1)) }]
      : []),
    ...(stage.added
      ? [{ label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => onDelete(stage) }]
      : []),
  ];
  return (
    <li
      ref={ref}
      data-stage={stage.name}
      data-stage-id={stage.id}
      className={cn(
        "relative flex min-h-12 items-center gap-3 border-b bg-card last:border-b-0",
        isDragging && "z-10 opacity-70 shadow-md",
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Drag to reorder ${stage.name}`}
        title="Drag to reorder"
        className="-ms-1 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted/50 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <StageStep stage={stage} index={index} />
      <StageDot color={stage.color} />
      <span dir="auto" className="min-w-0 truncate font-medium">
        {stage.name}
      </span>
      <span className="ms-auto shrink-0 text-muted-foreground text-xs tabular-nums">
        {plural(contacts, "contact", "contacts")}
      </span>
      <span className="flex w-8 shrink-0 justify-end">
        <RowMenu name={stage.name} items={items} />
      </span>
    </li>
  );
}

export function CustomerPathSettings() {
  useHydrateCustomerPath();
  const stages = useCustomerPath((s) => s.stages);
  const assigned = useCustomerPath((s) => s.assigned);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<PathStage | null>(null);
  const [deleting, setDeleting] = React.useState<PathStage | null>(null);
  const full = stages.length >= MAX_PATH_STAGES;
  const contacts = React.useMemo(() => {
    const out = new Map<string, number>();
    for (const id of Object.values(assigned)) out.set(id, (out.get(id) ?? 0) + 1);
    return out;
  }, [assigned]);

  function onDragEnd(event: DragEndEvent) {
    if (event.canceled || event.operation.source?.type !== "stage") return;
    const ids = stages.map((stage) => stage.id);
    const next = move(ids, event);
    if (next.join() === ids.join()) return;
    customerPath.reorder(next);
    saidWhenSaved("Stage order saved");
  }

  return (
    <>
      <SettingsShell
        title="Customer Path"
        description="The path a customer moves along, stage by stage. Unlike labels, a contact is on one stage at a time. Move a contact along the path from its conversation; filter the inbox by stage from the Inbox bar. Rename, recolour or reorder any stage here."
        count={plural(stages.length, "stage", "stages")}
        actions={
          <Button
            onClick={() => setAdding(true)}
            disabled={full}
            title={full ? `Up to ${MAX_PATH_STAGES} stages` : undefined}
          >
            <Plus /> Add stage
          </Button>
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-6 py-4">
          <div className="grid min-w-0 gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Route className="size-3.5" /> The path, in order
            </div>
            <PathStrip stages={stages} />
          </div>
          <CustomerPathSaveNotice />
          <DragDropProvider onDragEnd={onDragEnd}>
            <ol className="grid" data-slot="customer-path-stages">
              {stages.map((stage, index) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={index}
                  count={stages.length}
                  contacts={contacts.get(stage.id) ?? 0}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              ))}
            </ol>
          </DragDropProvider>
        </div>
      </SettingsShell>
      <StageDialog open={adding} onOpenChange={setAdding} stages={stages} />
      <StageDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        stages={stages}
        editing={editing}
      />
      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "stage"}?`}
        message="Contacts on this stage go back to no stage."
        yes="Delete"
        no="Cancel"
        onConfirm={() => {
          if (deleting) customerPath.deleteStage(deleting.id);
          setDeleting(null);
          saidWhenSaved("Stage deleted");
        }}
      />
    </>
  );
}
