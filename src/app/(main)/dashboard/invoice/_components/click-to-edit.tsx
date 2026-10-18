"use client";

import * as React from "react";

import { ImageUp, Trash2, UserRound } from "lucide-react";
import { createPortal } from "react-dom";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { getInvoiceTaxOptions, type InvoiceFormValues, taxOptionSuffix } from "./data";

/**
 * M129-D (Fahad 129.4: "when he clicks a place, a small pop-up appears and he writes in it; it does not cover the
 * screen"). A click on a value printed on the invoice preview opens a small pop-up right there to edit that value.
 * The studio paper marks its values with data-edit; on the other templates the clicked text is matched to the draft.
 * Nothing opens while "Arrange manually" is on (a click then picks a block to move).
 */

type TextPath =
  | "referenceNumber"
  | "from.name"
  | "from.email"
  | "from.phone"
  | "from.website"
  | "from.taxId"
  | "from.issuerName"
  | "from.paymentAccountName"
  | "from.routingNumber"
  | "to.name"
  | "to.email"
  | "to.taxId";

export type EditTarget =
  | { kind: "text"; path: TextPath; label: string }
  | { kind: "lines"; path: "from.addressLines" | "to.addressLines"; label: string }
  | { kind: "date"; path: "issuedDate" | "paymentDueDate"; label: string }
  | { kind: "item"; index: number }
  | { kind: "tax" }
  | { kind: "discount" }
  | { kind: "logo" }
  | { kind: "info"; message: string };

const TEXT_LABELS: Record<TextPath, string> = {
  referenceNumber: "Reference number",
  "from.name": "Business name",
  "from.email": "Business email",
  "from.phone": "Business phone",
  "from.website": "Website",
  "from.taxId": "Business tax ID",
  "from.issuerName": "Issued by",
  "from.paymentAccountName": "Payment account",
  "from.routingNumber": "Routing number",
  "to.name": "Client name (as printed)",
  "to.email": "Client email",
  "to.taxId": "Client tax ID",
};

/** "referenceNumber", "to.addressLines", "item:2", "tax", "discount", "logo", "info:Some text" (comma separated). */
function parseEdit(value: string): EditTarget[] {
  if (value.startsWith("info:")) return [{ kind: "info", message: value.slice(5) }];
  return value.split(",").flatMap((part): EditTarget[] => {
    const key = part.trim();
    if (key === "tax" || key === "discount" || key === "logo") return [{ kind: key }];
    if (key.startsWith("item:")) return [{ kind: "item", index: Number(key.slice(5)) }];
    if (key === "issuedDate") return [{ kind: "date", path: key, label: "Issued date" }];
    if (key === "paymentDueDate") return [{ kind: "date", path: key, label: "Due date" }];
    if (key === "from.addressLines") return [{ kind: "lines", path: key, label: "Business address" }];
    if (key === "to.addressLines") return [{ kind: "lines", path: key, label: "Client address" }];
    if (key in TEXT_LABELS) return [{ kind: "text", path: key as TextPath, label: TEXT_LABELS[key as TextPath] }];
    return [];
  });
}

/** For the Invoify templates: which draft value is this printed text? */
function matchText(text: string, invoice: InvoiceFormValues): EditTarget[] {
  const value = text.trim();
  if (!value || value.length > 300) return [];
  const exact = (candidate: string | undefined) => Boolean(candidate) && value === candidate?.trim();
  const within = (candidate: string | undefined) =>
    Boolean(candidate && candidate.trim().length > 2) && value.includes(candidate?.trim() ?? "");
  const targets: EditTarget[] = [];
  for (const path of Object.keys(TEXT_LABELS) as TextPath[]) {
    const [group, key] = path.split(".") as [string, string | undefined];
    const candidate = key
      ? ((invoice as unknown as Record<string, Record<string, unknown>>)[group]?.[key] as string | undefined)
      : (invoice as unknown as Record<string, string>)[group];
    if (exact(candidate)) return [{ kind: "text", path, label: TEXT_LABELS[path] }];
    if (within(candidate)) targets.push({ kind: "text", path, label: TEXT_LABELS[path] });
  }
  invoice.items.forEach((item, index) => {
    if (exact(item.description) || within(item.description)) targets.push({ kind: "item", index });
  });
  if (invoice.from.addressLines.some((line) => exact(line) || within(line)))
    targets.push({ kind: "lines", path: "from.addressLines", label: "Business address" });
  if (invoice.to.addressLines.some((line) => exact(line) || within(line)))
    targets.push({ kind: "lines", path: "to.addressLines", label: "Client address" });
  return targets.slice(0, 3);
}

export function ClickToEdit({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const { getValues } = useFormContext<InvoiceFormValues>();
  const [target, setTarget] = React.useState<{ element: Element; rect: DOMRect; edits: EditTarget[] } | null>(null);

  React.useEffect(() => {
    if (!target) return;
    // Keep the pop-up on its value when the page scrolls or resizes.
    const follow = () => setTarget((t) => (t ? { ...t, rect: t.element.getBoundingClientRect() } : t));
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [target?.element]);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!enabled) return;
    // Clicks inside the pop-up (it is portalled, but React still bubbles them here) are not clicks on the invoice.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    const marked = element.closest<HTMLElement>("[data-edit]");
    let edits: EditTarget[];
    let anchor: Element = element;
    if (marked) {
      edits = parseEdit(marked.dataset.edit ?? "");
      anchor = marked;
    } else {
      edits = matchText(element.textContent ?? "", getValues());
      if (!edits.length && element.closest("img")) edits = [{ kind: "logo" }];
      if (!edits.length) {
        edits = [
          {
            kind: "info",
            message:
              "This is template text. Change it with the Template or Document language options above; the values come from the form.",
          },
        ];
      }
    }
    if (!edits.length) return;
    setTarget({ element: anchor, rect: anchor.getBoundingClientRect(), edits });
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegates clicks on the printed values (each value is also editable in the form)
    // biome-ignore lint/a11y/useKeyWithClickEvents: the same values are reachable from the keyboard in the form fields
    <div
      onClick={handleClick}
      data-click-to-edit={enabled || undefined}
      className={
        enabled
          ? "[&_[data-edit]:hover]:bg-primary/10 [&_[data-edit]:hover]:outline-1 [&_[data-edit]:hover]:outline-primary/50 [&_[data-edit]:hover]:outline-dashed [&_[data-edit]]:cursor-pointer"
          : undefined
      }
    >
      {children}
      <Popover open={target !== null} onOpenChange={(open) => (open ? undefined : setTarget(null))}>
        {/* The paper sits inside a scaled (transformed) box, where position: fixed is not the screen; the anchor is
            put on the page body so the pop-up opens exactly at the clicked value. */}
        {target
          ? createPortal(
              <PopoverAnchor asChild>
                <span
                  aria-hidden
                  className="pointer-events-none fixed"
                  style={{
                    left: target.rect.left,
                    top: target.rect.top,
                    width: target.rect.width,
                    height: target.rect.height,
                  }}
                />
              </PopoverAnchor>,
              document.body,
            )
          : null}
        <PopoverContent
          className="w-80"
          side="bottom"
          align="start"
          collisionPadding={12}
          data-testid="click-edit-popover"
          onOpenAutoFocus={(event) => {
            // Focus the first field instead of the content box.
            event.preventDefault();
            const root = event.currentTarget as HTMLElement | null;
            root?.querySelector<HTMLElement>("input,textarea,button[role=combobox]")?.focus();
          }}
        >
          {target ? <EditFields edits={target.edits} onDone={() => setTarget(null)} /> : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function EditFields({ edits, onDone }: { edits: EditTarget[]; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {edits.map((edit, index) => (
        <EditOne key={`${edit.kind}-${index}`} edit={edit} />
      ))}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function EditOne({ edit }: { edit: EditTarget }) {
  const { control, setValue } = useFormContext<InvoiceFormValues>();
  const invoice = useWatch({ control }) as InvoiceFormValues;
  const set = (path: string, value: unknown) =>
    setValue(path as "referenceNumber", value as string, { shouldDirty: true });

  switch (edit.kind) {
    case "info":
      return <p className="text-muted-foreground text-sm">{edit.message}</p>;
    case "text": {
      const [group, key] = edit.path.split(".");
      const value = key
        ? ((invoice as unknown as Record<string, Record<string, string>>)[group]?.[key] ?? "")
        : ((invoice as unknown as Record<string, string>)[group] ?? "");
      return (
        <Field className="gap-1">
          <FieldLabel className="text-xs">{edit.label}</FieldLabel>
          <Input dir="auto" value={value} onChange={(event) => set(edit.path, event.target.value)} />
          {edit.path.startsWith("to.") ? <ChooseClientHint /> : null}
        </Field>
      );
    }
    case "lines": {
      const lines = (edit.path === "from.addressLines" ? invoice.from.addressLines : invoice.to.addressLines) ?? [];
      return (
        <Field className="gap-1">
          <FieldLabel className="text-xs">{edit.label} (one line each)</FieldLabel>
          <Textarea
            dir="auto"
            rows={3}
            value={lines.join("\n")}
            onChange={(event) => set(edit.path, event.target.value.split("\n"))}
          />
        </Field>
      );
    }
    case "date":
      return (
        <Field className="gap-1">
          <FieldLabel className="text-xs">{edit.label}</FieldLabel>
          <Input type="date" value={invoice[edit.path]} onChange={(event) => set(edit.path, event.target.value)} />
        </Field>
      );
    case "item": {
      const item = invoice.items[edit.index];
      if (!item) return null;
      return (
        <div className="flex flex-col gap-2">
          <Field className="gap-1">
            <FieldLabel className="text-xs">Item {edit.index + 1}</FieldLabel>
            <Input
              dir="auto"
              value={item.description}
              onChange={(event) => set(`items.${edit.index}.description`, event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field className="gap-1">
              <FieldLabel className="text-xs">Units</FieldLabel>
              <Input
                type="number"
                value={Number.isFinite(item.quantity) ? item.quantity : ""}
                onChange={(event) => set(`items.${edit.index}.quantity`, event.target.valueAsNumber)}
              />
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-xs">Unit cost</FieldLabel>
              <Input
                type="number"
                step="0.01"
                value={Number.isFinite(item.unitPrice) ? item.unitPrice : ""}
                onChange={(event) => set(`items.${edit.index}.unitPrice`, event.target.valueAsNumber)}
              />
            </Field>
          </div>
        </div>
      );
    }
    case "tax":
      return (
        <Field className="gap-1">
          <FieldLabel className="text-xs">Tax</FieldLabel>
          <Select value={invoice.taxId} onValueChange={(value) => value && set("taxId", value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {getInvoiceTaxOptions(invoice).map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <bdi>{option.name}</bdi>
                    {taxOptionSuffix(option)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      );
    case "discount":
      return (
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <Field className="gap-1">
            <FieldLabel className="text-xs">Discount</FieldLabel>
            <Select value={invoice.discountType} onValueChange={(value) => value && set("discountType", value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="percent">Percent</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className="gap-1">
            <FieldLabel className="text-xs">Value</FieldLabel>
            <Input
              type="number"
              step="0.01"
              value={Number.isFinite(invoice.discountValue) ? invoice.discountValue : ""}
              onChange={(event) => set("discountValue", event.target.valueAsNumber)}
            />
          </Field>
        </div>
      );
    case "logo":
      return <LogoEdit />;
  }
}

function ChooseClientHint() {
  return (
    <Button
      type="button"
      variant="link"
      size="xs"
      className="h-auto self-start px-0"
      onClick={() => {
        const picker = document.getElementById("invoice-client");
        picker?.scrollIntoView({ block: "center" });
        picker?.click();
      }}
    >
      <UserRound data-icon="inline-start" />
      Choose another client
    </Button>
  );
}

/**
 * Same rule as Bigcapital's own logo upload: PNG or JPEG, up to 5 MB (CompanyLogoUpload.tsx, lines 76-77):
 * https://github.com/bigcapitalhq/bigcapital/blob/v0.15.43/packages/webapp/src/containers/ElementCustomize/components/CompanyLogoUpload.tsx#L76-L77
 * F-16: the page says the rule without naming Bigcapital or linking to it.
 */
const LOGO_TYPES = ["image/png", "image/jpeg"];
const LOGO_MAX_BYTES = 5 * 1024 ** 2;

function LogoEdit() {
  const { control, setValue } = useFormContext<InvoiceFormValues>();
  const logo = useWatch({ control, name: "logo" });
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("Logo must be PNG or JPG");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo is larger than 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setValue("logo", String(reader.result), { shouldDirty: true });
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-sm">Logo</p>
      <p className="text-muted-foreground text-xs">
        PNG or JPG, up to 5 MB, the same rule as the invoices server’s own logo upload.
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <ImageUp data-icon="inline-start" />
          {logo ? "Replace logo" : "Upload logo"}
        </Button>
        {logo ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setValue("logo", "", { shouldDirty: true })}>
            <Trash2 data-icon="inline-start" />
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_TYPES.join(",")}
        className="sr-only"
        aria-label="Upload logo"
        onChange={onFile}
      />
    </div>
  );
}
