"use client";
// M129-F: create or edit a Twenty task (title, status, assignee, due date, description and every custom field the
// client added). Pattern of the previous task editor (_board/task-dialog.tsx); saving writes to Twenty.
// F-5B: "Delete task" with a confirmation (AlertDialog, the pattern of _components/task-dialogs.tsx ConfirmDialog). It
// moves the task to Twenty's deleted records (soft delete, restorable in Twenty); the text says only what Twenty did.
// F-8 (sim3 11.1c): the Assignee list has the site's agents (Settings > Agents) first, then the Twenty users who are not
// one of them. A site agent who is not a Twenty user is kept in the task's "Studio agent" field and the window says so
// (lib/twenty/agents.ts).
import * as React from "react";

import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useCwShared } from "@/lib/cw/store";
import {
  AGENT_FIELD,
  assigneeChoices,
  assigneeFields,
  assigneeValueOf,
  normalizeAssignee,
  type SiteAgent,
} from "@/lib/twenty/agents";
import type { BoardMember, BoardStatus, BoardTask, CardField, TaskInput } from "@/lib/twenty/server";

// F-18b: History, Related and Files of the task, as on the tasks server's own task page (task-activity.tsx)
import { TaskActivityPanel } from "./task-activity";

export type CustomValue = string | number | boolean | null;

export interface TwentyDraft {
  title: string;
  status: string;
  /** F-8: an Assignee value of lib/twenty/agents.ts ("agent:<id>", "member:<uuid>" or "" for unassigned). */
  assignee: string;
  dueDate: string;
  body: string;
  custom: Record<string, CustomValue>;
}

/** F-8: the site's agents and Twenty's users, which the Assignee value is read against. */
export interface AssigneeLists {
  agents: SiteAgent[];
  members: BoardMember[];
}

export function draftFrom(task: BoardTask | null, status: string, assignee: string, lists: AssigneeLists): TwentyDraft {
  return {
    title: task?.title ?? "",
    status: task?.status ?? status,
    assignee: task ? assigneeValueOf(task, lists.agents, lists.members) : normalizeAssignee(assignee),
    dueDate: task?.dueAt ? task.dueAt.slice(0, 10) : "",
    body: task?.body ?? "",
    custom: Object.fromEntries(Object.entries(task?.custom ?? {}).map(([k, v]) => [k, (v ?? null) as CustomValue])),
  };
}

export function inputFrom(draft: TwentyDraft, fields: CardField[], lists: AssigneeLists): TaskInput {
  const custom: Record<string, CustomValue> = {};
  for (const field of fields.filter((f) => f.isCustom && f.name !== AGENT_FIELD)) {
    const value = draft.custom[field.name];
    if (value === undefined) continue;
    if (field.type === "NUMBER") custom[field.name] = value === "" || value === null ? null : Number(value);
    else if (field.type === "BOOLEAN") custom[field.name] = Boolean(value);
    else if (field.type === "DATE") custom[field.name] = value ? String(value) : null;
    else custom[field.name] = value === "" ? null : value;
  }
  // F-8: Twenty's own assignee and the "Studio agent" field, from the one Assignee choice.
  const owner = assigneeFields(draft.assignee, lists.agents, lists.members);
  custom[AGENT_FIELD] = owner.agentName || null;
  return {
    title: draft.title.trim(),
    status: draft.status,
    assigneeId: owner.assigneeId,
    dueAt: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00Z`).toISOString() : null,
    body: draft.body,
    custom,
  };
}

function CustomInput({
  field,
  value,
  onChange,
}: {
  field: CardField;
  value: CustomValue | undefined;
  onChange: (value: CustomValue) => void;
}) {
  const id = `task-custom-${field.name}`;
  if (field.type === "BOOLEAN") {
    return (
      <Field orientation="horizontal">
        <Checkbox id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked === true)} />
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      </Field>
    );
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      {field.type === "SELECT" ? (
        <NativeSelect id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value || null)}>
          <NativeSelectOption value="">Not set</NativeSelectOption>
          {field.options.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          dir="auto"
          type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
          value={
            value === null || value === undefined ? "" : String(value).slice(0, field.type === "DATE" ? 10 : undefined)
          }
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/** F-8: the Assignee list of the task windows: Unassigned, the site's agents, then the other Twenty users. */
export function AssigneeSelect({
  id,
  value,
  choices,
  unknownAgent = null,
  disabled,
  size,
  className,
  first,
  onChange,
}: {
  id: string;
  value: string;
  choices: ReturnType<typeof assigneeChoices>;
  /** A site agent a task names who is no longer in Settings > Agents. */
  unknownAgent?: string | null;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
  /** Options before the lists (the board filter's All and Unassigned); default: Unassigned. */
  first?: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      id={id}
      size={size}
      className={className}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {(first ?? [{ value: "", label: "Unassigned" }]).map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
      {unknownAgent ? (
        <NativeSelectOption
          value={`agent-name:${unknownAgent}`}
        >{`${unknownAgent} (not in Agents)`}</NativeSelectOption>
      ) : null}
      <NativeSelectOptGroup label="Agents">
        {choices.agents.map((choice) => (
          <NativeSelectOption key={choice.value} value={choice.value}>
            {choice.label}
          </NativeSelectOption>
        ))}
      </NativeSelectOptGroup>
      {choices.members.length ? (
        <NativeSelectOptGroup label="Other task users">
          {choices.members.map((choice) => (
            <NativeSelectOption key={choice.value} value={choice.value}>
              {choice.label}
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
      ) : null}
    </NativeSelect>
  );
}

export function TwentyTaskDialog({
  mode,
  task,
  initial,
  statuses,
  members,
  fields,
  busy,
  error,
  onClose,
  onSubmit,
  onDelete,
}: {
  mode: "create" | "edit";
  task: BoardTask | null;
  initial: TwentyDraft;
  statuses: BoardStatus[];
  members: BoardMember[];
  fields: CardField[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: TwentyDraft) => void;
  /** Moves the task to Twenty's deleted records; resolves after Twenty answered. */
  onDelete?: () => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const set = <K extends keyof TwentyDraft>(key: K, value: TwentyDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  // F-8: the "Studio agent" field is set by the Assignee list, not typed in as a custom field.
  const customFields = fields.filter((field) => field.isCustom && field.name !== AGENT_FIELD);
  const agents = useCwShared((state) => state.agents);
  const choices = assigneeChoices(agents, members);
  const owner = assigneeFields(draft.assignee, agents, members);
  const unknownAgent = draft.assignee.startsWith("agent-name:") ? draft.assignee.slice("agent-name:".length) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New task" : "Edit task"}</DialogTitle>
          <DialogDescription>Saved on the tasks server behind this page.</DialogDescription>
        </DialogHeader>
        <form
          id="twenty-task-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(draft);
          }}
        >
          <Field>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input
              id="task-title"
              dir="auto"
              required
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task-status">Status</FieldLabel>
              <NativeSelect id="task-status" value={draft.status} onChange={(e) => set("status", e.target.value)}>
                {statuses.map((status) => (
                  <NativeSelectOption key={status.value} value={status.value}>
                    {status.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-assignee">Assignee</FieldLabel>
              <AssigneeSelect
                id="task-assignee"
                value={draft.assignee}
                choices={choices}
                unknownAgent={unknownAgent}
                onChange={(value) => set("assignee", value)}
              />
            </Field>
          </div>
          {owner.note ? (
            <p className="-mt-2 text-muted-foreground text-xs" data-assignee-note="">
              {owner.note}
            </p>
          ) : null}
          <Field>
            <FieldLabel htmlFor="task-due">Due date</FieldLabel>
            <Input id="task-due" type="date" value={draft.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-body">Description</FieldLabel>
            <Textarea
              id="task-body"
              dir="auto"
              rows={5}
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
            />
          </Field>
          {customFields.length ? (
            <fieldset className="flex flex-col gap-4 rounded-lg border p-3">
              <legend className="px-1 text-muted-foreground text-xs">Custom fields</legend>
              {customFields.map((field) => (
                <CustomInput
                  key={field.id}
                  field={field}
                  value={draft.custom[field.name]}
                  onChange={(value) => setDraft((d) => ({ ...d, custom: { ...d.custom, [field.name]: value } }))}
                />
              ))}
            </fieldset>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
          {task ? <TaskActivityPanel taskId={task.id} version={task.updatedAt} /> : null}
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {task ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {onDelete ? (
                <Button
                  variant="destructive"
                  type="button"
                  disabled={busy || deleting}
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmOpen(true);
                  }}
                >
                  <Trash2 data-icon="inline-start" /> Delete task
                </Button>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="twenty-task-form" disabled={busy || !draft.title.trim()}>
              {mode === "create" ? "Create task" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {task && onDelete ? (
        <AlertDialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (deleting) return;
            setConfirmOpen(open);
            if (!open) setDeleteError(null);
          }}
        >
          <AlertDialogContent data-testid="twenty-delete-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
              <AlertDialogDescription dir="auto">
                {`"${task.title}" will be moved to the deleted records of the tasks server (a soft delete). It leaves this board. It is not erased: you can restore it from the Deleted tab.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError ? (
              <p role="alert" className="text-destructive text-sm">
                {`The tasks server did not confirm the delete: ${deleteError}`}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleting}
                onClick={async (event) => {
                  event.preventDefault();
                  setDeleting(true);
                  setDeleteError(null);
                  const result = await onDelete();
                  setDeleting(false);
                  if (result.ok) setConfirmOpen(false);
                  else setDeleteError(result.message);
                }}
              >
                {deleting ? "Deleting…" : "Delete task"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </Dialog>
  );
}
