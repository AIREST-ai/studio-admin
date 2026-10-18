"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PRODUCT_NAME } from "@/config/app-config";

import { type InvoiceDesign, STUDIO_TEMPLATE_ID } from "./data";
import { TEMPLATES } from "./templates/registry";

export const NUDGE_STEP = 4;

const TEMPLATE_IDS = new Set([STUDIO_TEMPLATE_ID, ...TEMPLATES.map((template) => template.id)]);

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
] as const;

/**
 * The invoice design options above the preview: which template draws the invoice, the language its labels print in,
 * and the optional manual arrangement. Turning manual arrangement on lets the blocks on the preview be dragged, or
 * selected and moved with these arrow buttons (or the keyboard arrows), so moving never needs a drag.
 */
export function InvoiceDesignBar({
  design,
  selectedLabel,
  canReset,
  onChange,
  onNudge,
  onReset,
}: {
  design: InvoiceDesign;
  selectedLabel: string | null;
  canReset: boolean;
  onChange: (next: Partial<InvoiceDesign>) => void;
  onNudge: (dx: number, dy: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3" data-slot="invoice-design">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-full gap-1 sm:w-48">
          <FieldLabel htmlFor="invoice-template" className="text-xs">
            Template
          </FieldLabel>
          <Select
            value={String(design.templateId)}
            onValueChange={(value) => {
              // The hidden native select can report "" before its options exist; only a real choice counts.
              const templateId = Number(value);
              if (value !== "" && TEMPLATE_IDS.has(templateId) && templateId !== design.templateId)
                onChange({ templateId });
            }}
          >
            <SelectTrigger id="invoice-template" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectItem value={String(STUDIO_TEMPLATE_ID)}>{`${PRODUCT_NAME} (original)`}</SelectItem>
                {TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={String(template.id)}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="w-full gap-1 sm:w-40">
          <FieldLabel htmlFor="invoice-document-language" className="text-xs">
            Document language
          </FieldLabel>
          <Select
            value={design.language}
            onValueChange={(value) => {
              if ((value === "en" || value === "ar") && value !== design.language) onChange({ language: value });
            }}
          >
            <SelectTrigger id="invoice-document-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {LANGUAGES.map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field orientation="horizontal" className="w-auto items-center gap-2 pb-2">
          <Switch
            id="invoice-manual-layout"
            checked={design.manualLayout}
            onCheckedChange={(checked) => onChange({ manualLayout: checked === true })}
          />
          <FieldLabel htmlFor="invoice-manual-layout" className="font-normal text-sm">
            Arrange manually
          </FieldLabel>
        </Field>
      </div>

      {design.manualLayout ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 basis-60 text-muted-foreground text-xs" aria-live="polite">
            {selectedLabel
              ? `Selected: ${selectedLabel}. Drag it, or use the arrows.`
              : "Drag a block on the invoice, or click it and use the arrows. Save as Draft keeps the layout."}
          </p>
          <ButtonGroup aria-label="Move the selected block">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!selectedLabel}
              aria-label="Move left"
              onClick={() => onNudge(-NUDGE_STEP, 0)}
            >
              <ArrowLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!selectedLabel}
              aria-label="Move up"
              onClick={() => onNudge(0, -NUDGE_STEP)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!selectedLabel}
              aria-label="Move down"
              onClick={() => onNudge(0, NUDGE_STEP)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!selectedLabel}
              aria-label="Move right"
              onClick={() => onNudge(NUDGE_STEP, 0)}
            >
              <ArrowRight />
            </Button>
          </ButtonGroup>
          <Button type="button" variant="ghost" disabled={!canReset} onClick={onReset}>
            <RotateCcw data-icon="inline-start" />
            Reset positions
          </Button>
        </div>
      ) : null}
    </div>
  );
}
