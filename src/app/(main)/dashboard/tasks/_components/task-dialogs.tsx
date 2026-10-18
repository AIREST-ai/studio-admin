"use client";
import * as React from "react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { labels, priorities, statuses, type Task } from "./data";
import type { SaveResult, TaskDraft } from "./task-store";

const emptyDraft: TaskDraft = { title: "", status: "todo", priority: "medium", label: "feature" };

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The task being edited; null creates a new one. */
  task: Task | null;
  /** When the save fails the dialog stays open with the draft, so the user can try again. */
  onSubmit: (draft: TaskDraft) => SaveResult;
  /** Where focus goes when the dialog closes; call event.preventDefault() to override the default. */
  onCloseAutoFocus?: (event: Event) => void;
}

function SaveError({ message, hint }: { message: string | null; hint: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message} {hint}
    </p>
  );
}

function OptionSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function TaskForm({
  task,
  onSubmit,
  onCancel,
}: Pick<TaskFormDialogProps, "task" | "onSubmit"> & { onCancel: () => void }) {
  const [draft, setDraft] = React.useState<TaskDraft>(
    task ? { title: task.title, status: task.status, priority: task.priority, label: task.label } : emptyDraft,
  );
  const [submitted, setSubmitted] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const titleError = draft.title.trim() ? null : "Title is required.";
  const set = (patch: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (titleError) return;
        const result = onSubmit({ ...draft, title: draft.title.trim() });
        setSaveError(result.ok ? null : result.message);
      }}
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={(submitted && Boolean(titleError)) || undefined}>
          <FieldLabel htmlFor="task-title">Title</FieldLabel>
          <Input
            id="task-title"
            placeholder="What needs to be done?"
            value={draft.title}
            aria-invalid={(submitted && Boolean(titleError)) || undefined}
            onChange={(event) => set({ title: event.target.value })}
          />
          {submitted && titleError ? <FieldError>{titleError}</FieldError> : null}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <OptionSelect
            id="task-status"
            label="Status"
            value={draft.status}
            options={statuses}
            onChange={(status) => set({ status })}
          />
          <OptionSelect
            id="task-priority"
            label="Priority"
            value={draft.priority}
            options={priorities}
            onChange={(priority) => set({ priority })}
          />
          <OptionSelect
            id="task-label"
            label="Label"
            value={draft.label}
            options={labels}
            onChange={(label) => set({ label })}
          />
        </div>
      </FieldGroup>
      <SaveError message={saveError} hint="Nothing was saved; your draft is still here." />
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{task ? "Save changes" : "Create task"}</Button>
      </DialogFooter>
    </form>
  );
}

export function TaskFormDialog({ open, onOpenChange, task, onSubmit, onCloseAutoFocus }: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            {task ? `Update ${task.id}.` : "Add a task to the list."} Saved in this browser only (demo).
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so every open starts from the task (or an empty form), never from the last draft. */}
        {open ? (
          <TaskForm key={task?.id ?? "new"} task={task} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirm: string;
  /** When it fails the dialog stays open and says why, so the user can try again or cancel. */
  onConfirm: () => SaveResult;
  onCloseAutoFocus?: (event: Event) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const [error, setError] = React.useState<string | null>(null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <SaveError message={error} hint="Nothing was changed." />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              const result = onConfirm();
              if (result.ok) return;
              event.preventDefault();
              setError(result.message);
            }}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
