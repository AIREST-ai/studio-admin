"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Custom Attributes (attributes/Index.vue, AddAttribute.vue,
// EditAttribute.vue, constants.js; attributesMgmt.json) in the Studio pattern.
import * as React from "react";

import { cn } from "cn";
import { Calendar, CheckSquare, Hash, Link2, List, Pencil, Plus, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { createSavedList, SAVED_IN_PREVIEW, useSavedList } from "../../_components/settings-preview-client";
import { ConfirmDeleteDialog } from "../../inboxes/_components/settings-ui";
import { NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, FieldError, RowMenu, ToneBadge, tableClass } from "../../labels/_shared/settings-ui";

type Model = "conversation" | "contact";
type AttrType = "Text" | "Number" | "Link" | "Date" | "List" | "Checkbox";

interface Attribute {
  id: number;
  name: string;
  attrKey: string;
  description: string;
  type: AttrType;
  model: Model;
  badges?: ("Pre-chat" | "Resolution")[];
  values?: string[];
  regexPattern?: string;
  regexCue?: string;
}

const initialAttributes: Attribute[] = [
  {
    id: 1,
    name: "Order number",
    attrKey: "order_number",
    description: "Order reference from the online store",
    type: "Text",
    model: "conversation",
    badges: ["Pre-chat", "Resolution"],
    regexPattern: "^QA-[0-9]{6}$",
    regexCue: "Order numbers look like QA-123456",
  },
  {
    id: 2,
    name: "Delivery city",
    attrKey: "delivery_city",
    description: "City where the order is delivered",
    type: "List",
    model: "conversation",
    values: ["Doha", "Al Wakrah", "Lusail", "Dubai", "Riyadh"],
  },
  {
    id: 3,
    name: "Resolution reason",
    attrKey: "resolution_reason",
    description: "Why the conversation was closed",
    type: "List",
    model: "conversation",
    badges: ["Resolution"],
    values: ["Refund issued", "Replaced item", "Information only"],
  },
  {
    id: 4,
    name: "Refund amount (QAR)",
    attrKey: "refund_amount_qar",
    description: "Amount refunded to the customer",
    type: "Number",
    model: "conversation",
  },
  {
    id: 5,
    name: "Callback requested",
    attrKey: "callback_requested",
    description: "Customer asked for a phone call back",
    type: "Checkbox",
    model: "conversation",
  },
  {
    id: 6,
    name: "Tracking link",
    attrKey: "tracking_link",
    description: "Courier tracking page for the parcel",
    type: "Link",
    model: "conversation",
  },
  {
    id: 7,
    name: "Subscription plan",
    attrKey: "subscription_plan",
    description: "Current plan of the customer",
    type: "List",
    model: "contact",
    values: ["Basic", "Plus", "Family"],
  },
  {
    id: 8,
    name: "First purchase date",
    attrKey: "first_purchase_date",
    description: "Date of the first order",
    type: "Date",
    model: "contact",
  },
  {
    id: 9,
    name: "Qatar ID verified",
    attrKey: "qid_verified",
    description: "Identity checked by the branch team",
    type: "Checkbox",
    model: "contact",
  },
  {
    id: 10,
    name: "Loyalty points",
    attrKey: "loyalty_points",
    description: "Points balance in the rewards program",
    type: "Number",
    model: "contact",
  },
  {
    id: 11,
    name: "Preferred language",
    attrKey: "preferred_language",
    description: "Language the contact wants replies in",
    type: "List",
    model: "contact",
    badges: ["Pre-chat"],
    values: ["Arabic", "English"],
  },
  {
    id: 12,
    name: "Company website",
    attrKey: "company_website",
    description: "Main website of the contact's company",
    type: "Link",
    model: "contact",
  },
];

export const attributesStore = createSavedList<Attribute>("customAttributes", initialAttributes);

const typeIcon: Record<AttrType, React.ElementType> = {
  Text: Type,
  Number: Hash,
  Link: Link2,
  Date: Calendar,
  List,
  Checkbox: CheckSquare,
};
const attrTypes = Object.keys(typeIcon) as AttrType[];

// AddAttribute.vue: key = display name in snake case; the key must match /^[a-zA-Z0-9_]+$/ (isValidKey).
function toKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface FormState {
  model: Model | "";
  name: string;
  attrKey: string;
  description: string;
  type: AttrType | "";
  values: string[];
  regex: boolean;
  regexPattern: string;
  regexCue: string;
}

function AttributeDialog({
  open,
  onOpenChange,
  attribute,
  model,
  takenKeys,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attribute?: Attribute;
  model: Model;
  takenKeys: string[];
  onSave: (attr: Omit<Attribute, "id">) => Promise<void>;
}) {
  const blank: FormState = {
    model,
    name: "",
    attrKey: "",
    description: "",
    type: "",
    values: [],
    regex: false,
    regexPattern: "",
    regexCue: "",
  };
  const [form, setForm] = React.useState<FormState>(blank);
  const [keyEdited, setKeyEdited] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setForm(
      attribute
        ? {
            model: attribute.model,
            name: attribute.name,
            attrKey: attribute.attrKey,
            description: attribute.description,
            type: attribute.type,
            values: attribute.values ?? [],
            regex: !!attribute.regexPattern,
            regexPattern: attribute.regexPattern ?? "",
            regexCue: attribute.regexCue ?? "",
          }
        : blank,
    );
    setKeyEdited(!!attribute);
    setDraftValue("");
    setSubmitted(false);
    setSaving(false);
    setSaveError(null);
  }, [open, attribute]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const errors = {
    model: form.model ? "" : "Model is required",
    name: form.name.trim() ? "" : "Name is required",
    attrKey: !form.attrKey
      ? "Key is required"
      : !/^[a-zA-Z0-9_]+$/.test(form.attrKey)
        ? "Invalid key"
        : !attribute && takenKeys.includes(form.attrKey)
          ? "Invalid key"
          : "",
    description: form.description.trim() ? "" : "Description is required",
    type: form.type ? "" : "Type is required",
    values: form.type === "List" && !form.values.length ? "Must have at least one value" : "",
  };
  const hasError = Object.values(errors).some(Boolean);

  function addValue() {
    const v = draftValue.trim();
    if (v && !form.values.includes(v)) set("values", [...form.values, v]);
    setDraftValue("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasError || !form.model || !form.type || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: form.name.trim(),
        attrKey: form.attrKey,
        description: form.description.trim(),
        type: form.type,
        model: form.model,
        badges: attribute?.badges,
        values: form.type === "List" ? form.values : undefined,
        regexPattern: form.type === "Text" && form.regex ? form.regexPattern : undefined,
        regexCue: form.type === "Text" && form.regex ? form.regexCue : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const err = (k: keyof typeof errors) => (submitted ? errors[k] : "");

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{attribute ? "Edit Custom Attribute" : "Add Custom Attribute"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="attr-model">Applies to</Label>
            <NativeSelect
              id="attr-model"
              className="w-full"
              value={form.model}
              onChange={(e) => set("model", e.target.value as Model)}
              disabled={!!attribute}
            >
              <option value="" disabled>
                Please select one
              </option>
              <option value="conversation">Conversation</option>
              <option value="contact">Contact</option>
            </NativeSelect>
            <FieldError>{err("model")}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attr-name">Display Name</Label>
            <Input
              id="attr-name"
              placeholder="Enter custom attribute display name"
              value={form.name}
              aria-invalid={!!err("name")}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, attrKey: keyEdited ? f.attrKey : toKey(name) }));
              }}
            />
            <FieldError>{err("name")}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attr-key">Key</Label>
            <Input
              id="attr-key"
              placeholder="Enter custom attribute key"
              value={form.attrKey}
              aria-invalid={!!err("attrKey")}
              onChange={(e) => {
                setKeyEdited(true);
                set("attrKey", e.target.value);
              }}
              disabled={!!attribute}
              className="font-mono"
            />
            <FieldError>{err("attrKey")}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attr-desc">Description</Label>
            <Textarea
              id="attr-desc"
              placeholder="Enter custom attribute description"
              value={form.description}
              aria-invalid={!!err("description")}
              onChange={(e) => set("description", e.target.value)}
            />
            <FieldError>{err("description")}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attr-type">Type</Label>
            <NativeSelect
              id="attr-type"
              className="w-full"
              value={form.type}
              onChange={(e) => set("type", e.target.value as AttrType)}
              disabled={!!attribute}
            >
              <option value="" disabled>
                Please select a type
              </option>
              {attrTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
            <FieldError>{err("type")}</FieldError>
          </div>
          {form.type === "List" ? (
            <div className="grid gap-2">
              <Label htmlFor="attr-values">List Values</Label>
              <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
                {form.values.map((v) => (
                  <Badge key={v} variant="secondary" className="gap-1">
                    {v}
                    <button
                      type="button"
                      aria-label={`Remove ${v}`}
                      onClick={() =>
                        set(
                          "values",
                          form.values.filter((x) => x !== v),
                        )
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  id="attr-values"
                  className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder={
                    attribute ? "Please enter values and press enter key" : "Please enter value and press enter key"
                  }
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addValue();
                    }
                  }}
                />
              </div>
              <FieldError>{err("values")}</FieldError>
            </div>
          ) : null}
          {form.type === "Text" ? (
            <>
              <div className="flex items-center gap-2">
                <Checkbox id="attr-regex" checked={form.regex} onCheckedChange={(c) => set("regex", c === true)} />
                <Label htmlFor="attr-regex" className="font-normal">
                  Enable regex validation
                </Label>
              </div>
              {form.regex ? (
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="attr-pattern">Regex Pattern</Label>
                    <Input
                      id="attr-pattern"
                      className="font-mono"
                      placeholder="Please enter custom attribute regex pattern. (Optional)"
                      value={form.regexPattern}
                      onChange={(e) => set("regexPattern", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="attr-cue">Regex Cue</Label>
                    <Input
                      id="attr-cue"
                      placeholder="Please enter regex pattern hint. (Optional)"
                      value={form.regexCue}
                      onChange={(e) => set("regexCue", e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {saveError ? (
            <p role="alert" data-attribute-save-error="" className="text-destructive text-sm">
              {saveError}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : attribute ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delete confirm with type-to-confirm, as Chatwoot's woot-delete-modal for attributes (shared dialog, 128.2). */
function DeleteAttribute({
  attribute,
  onOpenChange,
  onConfirm,
}: {
  attribute?: Attribute;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDeleteDialog
      open={!!attribute}
      onOpenChange={onOpenChange}
      title="Delete attribute"
      message="Deleting will remove the custom attribute"
      confirmValue={attribute?.name ?? ""}
      onConfirm={onConfirm}
    />
  );
}

export function AttributesList() {
  const attributes = useSavedList(attributesStore);
  const [model, setModel] = React.useState<Model>("conversation");
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("All");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Attribute | undefined>();
  const [deleting, setDeleting] = React.useState<Attribute | undefined>();

  const q = query.trim().toLowerCase();
  const rows = attributes.filter(
    (a) =>
      a.model === model &&
      (typeFilter === "All" || a.type === typeFilter) &&
      `${a.name} ${a.attrKey} ${a.description}`.toLowerCase().includes(q),
  );
  const count = (m: Model) => attributes.filter((a) => a.model === m).length;

  return (
    <>
      <SettingsShell
        title="Custom Attributes"
        description="A custom attribute tracks additional details about your contacts, companies, or conversations—such as the subscription plan or the date of their first purchase. You can add different types of custom attributes, such as text, lists, or numbers, to capture the specific information you need."
        learnMore="Learn more about custom attributes"
        count={plural(rows.length, "attribute", "attributes")}
        search={{ placeholder: "Search attributes...", value: query, onChange: setQuery }}
        tabs={{
          value: model,
          onValueChange: (v) => setModel(v as Model),
          items: [
            { value: "conversation", label: "Conversation", count: count("conversation") },
            { value: "contact", label: "Contact", count: count("contact") },
          ],
        }}
        cardTitle={model === "conversation" ? "Conversation attributes" : "Contact attributes"}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add Custom Attribute
          </Button>
        }
      >
        <ChipBar>
          <ChipSelect label="Type" value={typeFilter} options={["All", ...attrTypes]} onChange={setTypeFilter} />
        </ChipBar>
        {rows.length ? (
          <Table
            className={cn(
              tableClass,
              "max-xl:**:data-[slot='table-cell']:px-4 max-xl:**:data-[slot='table-head']:px-4",
            )}
          >
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="py-3 font-normal">Description</TableHead>
                <TableHead className="py-3 font-normal">Type</TableHead>
                <TableHead className="py-3 font-normal">Key</TableHead>
                <TableHead className="sticky right-0 w-20 bg-card py-3 text-right font-normal shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((attr) => {
                const Icon = typeIcon[attr.type];
                return (
                  <TableRow key={attr.attrKey} className="border-border/60">
                    <TableCell className="py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{attr.name}</span>
                        {attr.badges?.map((b) => (
                          <ToneBadge key={b} tone={b === "Pre-chat" ? "sky" : "violet"}>
                            {b}
                          </ToneBadge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-sm whitespace-normal py-3.5 text-muted-foreground">
                      {attr.description}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="size-3.5 text-muted-foreground" />
                        {attr.type}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{attr.attrKey}</code>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card py-3.5 text-right shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                      <RowMenu
                        name={attr.name}
                        items={[
                          { label: "Edit", icon: Pencil, onSelect: () => setEditing(attr) },
                          {
                            label: "Delete",
                            icon: Trash2,
                            destructive: true,
                            separatorBefore: true,
                            onSelect: () => setDeleting(attr),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {q || typeFilter !== "All"
              ? "No attributes found matching your search"
              : "There are no custom attributes created"}
          </NoResults>
        )}
      </SettingsShell>

      <AttributeDialog
        open={adding}
        onOpenChange={setAdding}
        model={model}
        takenKeys={attributes.map((a) => a.attrKey)}
        onSave={async (attr) => {
          try {
            await attributesStore.save({ ...attr, id: attributesStore.nextId() });
            setModel(attr.model);
            toast.success("Custom Attribute added successfully!", { description: SAVED_IN_PREVIEW });
          } catch (error) {
            toast.error((error as Error).message);
            throw error;
          }
        }}
      />
      <AttributeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        attribute={editing}
        model={model}
        takenKeys={attributes.map((a) => a.attrKey)}
        onSave={async (attr) => {
          try {
            await attributesStore.save({ ...attr, id: editing?.id ?? attributesStore.nextId() });
            toast.success("Custom Attribute updated successfully", { description: SAVED_IN_PREVIEW });
          } catch (error) {
            toast.error((error as Error).message);
            throw error;
          }
        }}
      />
      <DeleteAttribute
        attribute={deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        onConfirm={() => {
          if (!deleting) return;
          void attributesStore.remove(deleting.id).then(
            () => toast.success("Custom Attribute deleted successfully.", { description: SAVED_IN_PREVIEW }),
            (error: Error) => toast.error(error.message),
          );
        }}
      />
    </>
  );
}
