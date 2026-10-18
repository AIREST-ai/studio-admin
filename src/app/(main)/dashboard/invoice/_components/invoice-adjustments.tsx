import { Controller, useFormContext, useWatch } from "react-hook-form";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { getInvoiceTaxOptions, type InvoiceFormValues, taxOptionSuffix, ZATCA_VAT_SOURCE } from "./data";

// Radix Select reports "" when its value is replaced from outside (form.reset with a saved draft); keep the value.
function keepValue(onChange: (value: string) => void) {
  return (value: string) => {
    if (value) onChange(value);
  };
}

export function InvoiceAdjustments() {
  const { control, register } = useFormContext<InvoiceFormValues>();
  const discountType = useWatch({ control, name: "discountType" });
  const currency = useWatch({ control, name: "currency" });
  // F-5B (condition 3): the tax menu is Bigcapital's own tax rates (loaded by the Bigcapital bar) plus "No tax".
  const taxRates = useWatch({ control, name: "taxRates" });
  const taxOptions = getInvoiceTaxOptions({ taxRates });

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium tracking-tight">Adjustments</h2>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Controller
          control={control}
          name="taxId"
          render={({ field }) => (
            <Field className="gap-1">
              <FieldLabel className="text-xs">Tax</FieldLabel>
              <Select value={field.value} onValueChange={keepValue(field.onChange)}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select tax" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {taxOptions.map((taxOption) => (
                      <SelectItem key={taxOption.id} value={taxOption.id}>
                        <bdi>{taxOption.name}</bdi>
                        {taxOptionSuffix(taxOption)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription className="text-xs" data-testid="tax-source">
                {taxRates?.length
                  ? `${taxRates.length} tax rates from the invoices server`
                  : "Loading tax rates from the invoices server…"}
                {" · "}
                <a
                  className="underline underline-offset-2"
                  href={ZATCA_VAT_SOURCE.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ZATCA_VAT_SOURCE.label}
                </a>
              </FieldDescription>
            </Field>
          )}
        />

        <div className="grid grid-cols-[1fr_112px] gap-4">
          <Controller
            control={control}
            name="discountType"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs">Discount</FieldLabel>
                <Select value={field.value} onValueChange={keepValue(field.onChange)}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                      <SelectItem value="percent">Percent</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Field className="gap-1">
            <FieldLabel className="text-xs opacity-0">Value</FieldLabel>
            <InputGroup>
              <InputGroupInput
                type="number"
                step="0.01"
                aria-label="Discount value"
                {...register("discountValue", { valueAsNumber: true })}
              />
              <InputGroupAddon align="inline-end">
                {discountType === "fixed" ? (currency?.sign ?? "SR") : "%"}
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
      </div>
    </section>
  );
}
