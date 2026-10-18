"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { type BigcapitalCustomer, type ClientInput, createBigcapitalCustomer } from "./bigcapital-client";

const EMPTY: Required<ClientInput> = { name: "", email: "", phone: "", company: "", country: "", city: "" };

const FIELDS: Array<{ key: keyof ClientInput; label: string; type?: string; placeholder?: string }> = [
  { key: "name", label: "Client name", placeholder: "Person or business name" },
  { key: "email", label: "Email", type: "email", placeholder: "billing@company.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+966 5x xxx xxxx" },
  { key: "company", label: "Company" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
];

/**
 * "Add New Client": a side panel (not a full-screen dialog; the invoice stays visible). Saving creates the customer in
 * Bigcapital through the preview server (POST /api/invoice-bigcapital/customers, mode "create") and selects it.
 */
export function AddClientSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: BigcapitalCustomer, input: ClientInput) => void;
}) {
  const [values, setValues] = React.useState(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValues(EMPTY);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("Client name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { customer } = await createBigcapitalCustomer(values);
      onCreated(customer, values);
      toast.success(`${customer.name} created on the invoices server`, {
        description: `Customer #${customer.id}, now selected`,
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-full border-l shadow-xl sm:max-w-sm"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <form className="flex h-full flex-col" onSubmit={handleSubmit} noValidate>
          <SheetHeader>
            <SheetTitle>Add New Client</SheetTitle>
            <SheetDescription>
              Creates a customer on the invoices server and selects it for this invoice. The invoice stays open beside
              this panel.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4">
            <FieldGroup className="gap-4">
              {FIELDS.map((field) => (
                <Field key={field.key} className="gap-1">
                  <FieldLabel htmlFor={`new-client-${field.key}`} className="text-xs">
                    {field.label}
                    {field.key === "name" ? " *" : ""}
                  </FieldLabel>
                  <Input
                    id={`new-client-${field.key}`}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={values[field.key]}
                    onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                    autoFocus={field.key === "name"}
                  />
                </Field>
              ))}
              <FieldDescription className="text-xs">
                Address details, tax number and payment terms cannot be edited on this page yet.
              </FieldDescription>
              {error ? (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Create client
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
