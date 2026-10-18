"use client";

import * as React from "react";

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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { type DraftErrors, type TaskDraft, validateDraft } from "./board";
import { columns } from "./data";
import { channelTitle, conversationChoices, conversationOf, lastExchange } from "./seed";
import type { ColumnId } from "./types";

interface CardDialogProps {
  mode: "create" | "edit";
  initialDraft: TaskDraft;
  /** F-9: the agents of Settings > Agents, for the owner. */
  agents: ReadonlyArray<{ id: number; name: string }>;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
}

// F-9 (sim3 step 11.2b): a card is made from a preview conversation (its customer, channel and link come from it), and
// starts from that conversation's last agent reply and the customer's message before it. The owner is an agent.
// Mounted only while open, so every opening starts from initialDraft.
export function CardDialog({ mode, initialDraft, agents, onClose, onSubmit }: CardDialogProps) {
  const [draft, setDraft] = React.useState(initialDraft);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const choices = React.useMemo(() => conversationChoices(), []);
  const conversation = conversationOf(draft.conversationId);

  function set<K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function pickConversation(id: number) {
    const { problem, dodge } = lastExchange(id);
    setDraft((current) => ({ ...current, conversationId: id, problem, dodge }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(draft);
  }

  const longText = (field: "problem" | "dodge" | "betterReply", label: string, help?: string) => (
    <Field data-invalid={Boolean(errors[field])}>
      <FieldLabel htmlFor={`card-${field}`}>{label}</FieldLabel>
      <Textarea
        id={`card-${field}`}
        rows={2}
        value={draft[field]}
        aria-invalid={Boolean(errors[field])}
        onChange={(event) => set(field, event.target.value)}
      />
      {help ? <FieldDescription>{help}</FieldDescription> : null}
      <FieldError>{errors[field]}</FieldError>
    </Field>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New card" : "Edit card"}</DialogTitle>
            <DialogDescription>
              A reply in a conversation that left the customer's problem open, and the reply that would have solved it.
            </DialogDescription>
          </DialogHeader>

          <Field data-invalid={Boolean(errors.conversationId)}>
            <FieldLabel htmlFor="card-conversation">Conversation</FieldLabel>
            <NativeSelect
              id="card-conversation"
              className="w-full"
              value={String(draft.conversationId)}
              disabled={mode === "edit"}
              onChange={(event) => pickConversation(Number(event.target.value))}
            >
              {choices.map((choice) => (
                <NativeSelectOption key={choice.id} value={String(choice.id)}>
                  {choice.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              {conversation
                ? `Customer: ${conversation.name} · Channel: ${channelTitle(conversation.id)}`
                : "Pick the conversation of the dodge."}
            </FieldDescription>
            <FieldError>{errors.conversationId}</FieldError>
          </Field>
          {longText("problem", "Problem", "The customer's message the reply did not solve.")}
          {longText("dodge", "Dodge", "The agent's reply that left the problem open.")}
          {longText("betterReply", "Better reply (optional)")}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={Boolean(errors.dueDate)}>
              <FieldLabel htmlFor="card-dueDate">Due date (optional)</FieldLabel>
              <Input
                id="card-dueDate"
                type="date"
                value={draft.dueDate}
                aria-invalid={Boolean(errors.dueDate)}
                onChange={(event) => set("dueDate", event.target.value)}
              />
              <FieldError>{errors.dueDate}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="card-owner">Owner</FieldLabel>
              <NativeSelect
                id="card-owner"
                className="w-full"
                value={draft.ownerId === null ? "" : String(draft.ownerId)}
                onChange={(event) => set("ownerId", event.target.value ? Number(event.target.value) : null)}
              >
                <NativeSelectOption value="">Unassigned</NativeSelectOption>
                {agents.map((agent) => (
                  <NativeSelectOption key={agent.id} value={String(agent.id)}>
                    {agent.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="card-column">Column</FieldLabel>
              <NativeSelect
                id="card-column"
                className="w-full"
                value={draft.columnId}
                onChange={(event) => set("columnId", event.target.value as ColumnId)}
              >
                {columns.map((column) => (
                  <NativeSelectOption key={column.id} value={column.id}>
                    {column.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{mode === "create" ? "Add card" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
