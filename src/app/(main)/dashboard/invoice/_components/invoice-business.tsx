"use client";

import * as React from "react";

import Link from "next/link";

import { Loader2, Save } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { fromSavedBusiness, saveBusiness } from "./bigcapital-client";
import type { InvoiceFormValues } from "./data";

type BusinessTextField = "from.name" | "from.email" | "from.phone" | "from.website" | "from.taxId" | "from.issuerName";

const contactFields: Array<{ id: string; label: string; name: BusinessTextField; type?: string }> = [
  { id: "business-email", label: "Email", name: "from.email", type: "email" },
  { id: "business-phone", label: "Phone", name: "from.phone", type: "tel" },
  { id: "business-website", label: "Website", name: "from.website" },
  { id: "business-tax-id", label: "Tax ID", name: "from.taxId" },
];

/**
 * Edits the issuer ("from") details already kept in the draft. Payment account fields are left out on purpose.
 * F-5B (conditions 1 and 2): "Save business details" keeps them as the business every new invoice starts from:
 * name, address, phone and tax number in Bigcapital's organization profile (its PDF prints them as the seller), the
 * rest on the preview server. "Create" in Send Invoice also writes them to Bigcapital first.
 */
export function InvoiceBusiness() {
  const { control, getValues, register, setValue } = useFormContext<InvoiceFormValues>();
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const { business, changed } = await saveBusiness(getValues("from"));
      setValue("from", fromSavedBusiness(business), { shouldDirty: true });
      const text = changed.length
        ? `Saved. Invoices server organization profile updated: ${changed.join(", ")}.`
        : "Saved. The invoices server already had this name, address, phone and tax number.";
      setResult({ ok: true, text });
      toast.success("Business details saved", { description: text });
    } catch (error) {
      setResult({ ok: false, text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium tracking-tight">Business Details</h2>

      <FieldGroup>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="business-name">
            Business Name
          </FieldLabel>
          {/* F-21: the seller name is the account name of Settings > General (it is written to the invoices server's
              organization profile when General Settings is saved, and every save here keeps it). */}
          <Input id="business-name" readOnly className="bg-muted/40" {...register("from.name")} />
          <FieldDescription className="text-xs" data-testid="business-name-source">
            From the account name in{" "}
            <Link href="/dashboard/settings/account" className="underline underline-offset-4">
              Settings › General Settings
            </Link>
            . It is the seller name printed on every invoice PDF; change it there.
          </FieldDescription>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          {contactFields.map((contactField) => (
            <Field key={contactField.name} className="gap-1">
              <FieldLabel className="text-xs" htmlFor={contactField.id}>
                {contactField.label}
              </FieldLabel>
              <Input id={contactField.id} type={contactField.type} {...register(contactField.name)} />
            </Field>
          ))}
        </div>

        <Controller
          control={control}
          name="from.addressLines"
          render={({ field }) => (
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="business-address">
                Address
              </FieldLabel>
              <Textarea
                id="business-address"
                name={field.name}
                ref={field.ref}
                value={field.value.join("\n")}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value.split("\n"))}
              />
            </Field>
          )}
        />

        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="business-issuer-name">
            Issued By
          </FieldLabel>
          <Input id="business-issuer-name" {...register("from.issuerName")} />
        </Field>

        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" className="w-fit" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            Save business details
          </Button>
          <FieldDescription className="text-xs" data-testid="business-save-note">
            Address, phone and tax number are saved in the invoices server’s organization profile, which is printed as
            the seller on every invoice PDF. Email, website, “Issued by” and the payment account are kept on this
            preview server. New invoices start from these details.
          </FieldDescription>
          {result ? (
            <p
              role={result.ok ? "status" : "alert"}
              className={result.ok ? "text-emerald-700 text-xs dark:text-emerald-400" : "text-destructive text-xs"}
              data-testid="business-save-result"
            >
              {result.text}
            </p>
          ) : null}
        </div>
      </FieldGroup>
    </section>
  );
}
