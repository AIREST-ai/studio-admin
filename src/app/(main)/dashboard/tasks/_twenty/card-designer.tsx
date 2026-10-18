"use client";
// M129-F (Fahad 129.6 "the client designs his card"): pick the fields shown on every card and add custom fields.
// Both are saved in Twenty: the switches are the field visibility of the Twenty board view, a new field is a Twenty
// custom field on the Task object (https://docs.twenty.com/user-guide/data-model/capabilities/fields).
import * as React from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { PRODUCT_NAME } from "@/config/app-config";
import type { BoardMember, BoardStatus, BoardTask, CardField, CustomFieldType } from "@/lib/twenty/server";

import { TwentyCard } from "./twenty-card";

const TYPE_LABEL: Record<string, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  DATE_TIME: "Date and time",
  BOOLEAN: "Yes / No",
  SELECT: "Select",
  RELATION: "Member",
  RICH_TEXT: "Rich text",
  ACTOR: "Person",
};

const NEW_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "SELECT", label: "Select (list of options)" },
];

const sampleTask: BoardTask = {
  id: "preview",
  title: "Call the customer back about order 1042",
  status: "TODO",
  assigneeId: null,
  dueAt: new Date().toISOString(),
  body: "The customer asked for a delivery date.",
  position: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: PRODUCT_NAME,
  custom: {},
};

export function CardDesigner({
  open,
  onOpenChange,
  fields,
  members,
  statuses,
  example,
  busy,
  onToggle,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: CardField[];
  members: BoardMember[];
  statuses: BoardStatus[];
  example: BoardTask | undefined;
  busy: boolean;
  onToggle: (fieldId: string, visible: boolean) => Promise<{ ok: boolean; message?: string }>;
  onAdd: (label: string, type: CustomFieldType, options: string[]) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<CustomFieldType>("TEXT");
  const [options, setOptions] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const task = example ?? sampleTask;

  async function toggle(field: CardField, visible: boolean) {
    setNotice(null);
    const result = await onToggle(field.id, visible);
    setError(result.ok ? null : `Not saved: ${result.message}`);
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    const list = options
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
    const result = await onAdd(label.trim(), type, list);
    if (!result.ok) {
      setError(`Not added: ${result.message}`);
      return;
    }
    setError(null);
    setNotice(`"${label.trim()}" was added to the tasks server and is now on the cards.`);
    setLabel("");
    setOptions("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Card design</SheetTitle>
          <SheetDescription>
            Choose what every task card shows, or add your own field. Saved on the tasks server, so it stays after a
            reload.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <section aria-label="Card preview" className="rounded-xl bg-muted/40 p-3">
            <p className="mb-2 text-muted-foreground text-xs">Preview</p>
            <TwentyCard
              task={task}
              fields={fields}
              members={members}
              status={statuses.find((s) => s.value === task.status)}
            />
          </section>

          <section aria-label="Fields on the card" className="flex flex-col gap-1">
            <h3 className="font-medium text-sm">Fields on the card</h3>
            <p className="mb-2 text-muted-foreground text-xs">The title is always shown.</p>
            {fields.map((field) => (
              <label
                key={field.id}
                htmlFor={`card-field-${field.name}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{field.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {`${TYPE_LABEL[field.type] ?? field.type}${field.isCustom ? " · custom" : ""}`}
                  </span>
                </span>
                <Switch
                  id={`card-field-${field.name}`}
                  checked={field.visible}
                  disabled={busy}
                  onCheckedChange={(checked) => void toggle(field, checked)}
                />
              </label>
            ))}
          </section>

          <form onSubmit={add} className="flex flex-col gap-3 rounded-xl border p-3" aria-label="Add a custom field">
            <h3 className="font-medium text-sm">Add a custom field</h3>
            <Field>
              <FieldLabel htmlFor="new-field-label">Field name</FieldLabel>
              <Input
                id="new-field-label"
                placeholder="e.g. Order number"
                value={label}
                maxLength={60}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-field-type">Type</FieldLabel>
              <NativeSelect
                id="new-field-type"
                value={type}
                onChange={(e) => setType(e.target.value as CustomFieldType)}
              >
                {NEW_TYPES.map((each) => (
                  <NativeSelectOption key={each.value} value={each.value}>
                    {each.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {type === "SELECT" ? (
              <Field>
                <FieldLabel htmlFor="new-field-options">Options (comma separated)</FieldLabel>
                <Input
                  id="new-field-options"
                  placeholder="e.g. WhatsApp, Instagram, Email"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                />
              </Field>
            ) : null}
            {error ? <FieldError>{error}</FieldError> : null}
            {notice ? (
              <p role="status" className="text-emerald-700 text-sm dark:text-emerald-400">
                {notice}
              </p>
            ) : null}
            <Button type="submit" disabled={busy || !label.trim()} className="self-start">
              <Plus data-icon="inline-start" /> Add field
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
