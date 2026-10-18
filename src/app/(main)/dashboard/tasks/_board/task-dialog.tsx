"use client";
// T-244 round 2: the task editor, on the pattern of Studio's board dialog (dashboard/kanban/_components/card-dialog.tsx).
// One owner and any followers (decision 77.17). When the save is refused because someone else saved the task first,
// the dialog stays open with this user's edit and offers both ways out (decision 77.18: no edit is lost).
import * as React from "react";

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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import {
  type BoardTask,
  personName,
  TASK_LABELS,
  TASK_PEOPLE,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskChanges,
  type TaskLabel,
  type TaskPriority,
  type TaskStatus,
} from "./model";

export type TaskDraft = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  label: TaskLabel;
  ownerId: number | null;
  followerIds: number[];
  dueDate: string;
};

export function draftFromTask(task: BoardTask): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    label: task.label,
    ownerId: task.ownerId,
    followerIds: task.followerIds,
    dueDate: task.dueDate ?? "",
  };
}

export function emptyDraft(status: TaskStatus): TaskDraft {
  return {
    title: "",
    description: "",
    status,
    priority: "medium",
    label: "feature",
    ownerId: null,
    followerIds: [],
    dueDate: "",
  };
}

export function changesFromDraft(draft: TaskDraft): TaskChanges {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    priority: draft.priority,
    label: draft.label,
    ownerId: draft.ownerId,
    followerIds: draft.followerIds.filter((id) => id !== draft.ownerId),
    dueDate: draft.dueDate || null,
  };
}

export type TaskConflictView = { theirs: BoardTask };

interface TaskDialogProps {
  mode: "create" | "edit";
  taskId?: string;
  initialDraft: TaskDraft;
  conflict: TaskConflictView | null;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
  onKeepTheirs: () => void;
  onSaveOnTop: (draft: TaskDraft) => void;
}

// Mounted only while open, so every opening starts from initialDraft.
export function TaskDialog({
  mode,
  taskId,
  initialDraft,
  conflict,
  error,
  busy,
  onClose,
  onSubmit,
  onKeepTheirs,
  onSaveOnTop,
}: TaskDialogProps) {
  const [draft, setDraft] = React.useState(initialDraft);
  const [titleError, setTitleError] = React.useState<string | null>(null);

  function set<K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleFollower(id: number, on: boolean) {
    setDraft((current) => ({
      ...current,
      followerIds: on ? [...current.followerIds, id] : current.followerIds.filter((each) => each !== id),
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setTitleError("Enter a title.");
      return;
    }
    setTitleError(null);
    onSubmit(draft);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          // Back to the card or row this task was opened from (Escape, Cancel, the close button or a save).
          const origin = taskId && document.querySelector<HTMLElement>(`[data-task-open="${CSS.escape(taskId)}"]`);
          if (origin) {
            event.preventDefault();
            origin.focus();
          }
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New task" : `Edit ${taskId}`}</DialogTitle>
            <DialogDescription>One owner is responsible; followers are kept informed.</DialogDescription>
          </DialogHeader>

          {conflict ? (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
              <p>
                {`${taskId} was saved by someone else while you were editing ("${conflict.theirs.title}", owner ${
                  personName(conflict.theirs.ownerId) ?? "none"
                }). Your changes below were not saved and are still here.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => onSaveOnTop(draft)}>
                  Save mine on top
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onKeepTheirs}>
                  Keep their version
                </Button>
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {`Not saved: ${error}`}
            </p>
          ) : null}

          <Field data-invalid={Boolean(titleError)}>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input
              id="task-title"
              dir="auto"
              value={draft.title}
              aria-invalid={Boolean(titleError)}
              onChange={(event) => set("title", event.target.value)}
            />
            <FieldError>{titleError}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="task-description">Description</FieldLabel>
            <Textarea
              id="task-description"
              dir="auto"
              rows={3}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="task-status">Status</FieldLabel>
              <NativeSelect
                id="task-status"
                className="w-full"
                value={draft.status}
                onChange={(event) => set("status", event.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((status) => (
                  <NativeSelectOption key={status.id} value={status.id}>
                    {status.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
              <NativeSelect
                id="task-priority"
                className="w-full"
                value={draft.priority}
                onChange={(event) => set("priority", event.target.value as TaskPriority)}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <NativeSelectOption key={priority.id} value={priority.id}>
                    {priority.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-label">Label</FieldLabel>
              <NativeSelect
                id="task-label"
                className="w-full"
                value={draft.label}
                onChange={(event) => set("label", event.target.value as TaskLabel)}
              >
                {TASK_LABELS.map((label) => (
                  <NativeSelectOption key={label.id} value={label.id}>
                    {label.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task-owner">Owner</FieldLabel>
              <NativeSelect
                id="task-owner"
                className="w-full"
                value={draft.ownerId === null ? "" : String(draft.ownerId)}
                onChange={(event) => set("ownerId", event.target.value ? Number(event.target.value) : null)}
              >
                <NativeSelectOption value="">No owner</NativeSelectOption>
                {TASK_PEOPLE.map((person) => (
                  <NativeSelectOption key={person.id} value={String(person.id)}>
                    {person.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-due">Due date</FieldLabel>
              <Input
                id="task-due"
                type="date"
                value={draft.dueDate}
                onChange={(event) => set("dueDate", event.target.value)}
              />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium text-sm">Followers</legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
              {TASK_PEOPLE.map((person) => {
                const isOwner = person.id === draft.ownerId;
                const id = `task-follower-${person.id}`;
                return (
                  <label key={person.id} htmlFor={id} className="flex min-h-7 items-center gap-2 text-sm">
                    <Checkbox
                      id={id}
                      disabled={isOwner}
                      checked={!isOwner && draft.followerIds.includes(person.id)}
                      onCheckedChange={(checked) => toggleFollower(person.id, checked === true)}
                    />
                    <span className={isOwner ? "text-muted-foreground" : undefined}>
                      {isOwner ? `${person.name} (owner)` : person.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy || Boolean(conflict)}>
              {mode === "create" ? "Add task" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
