"use client";

import * as React from "react";

import { Banknote, Loader2, RefreshCw } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { RecordPaymentSheet } from "../_system/sales-forms";
import { type BigcapitalInvoice, getBigcapitalInvoice, STATUS_LABELS } from "./bigcapital-client";
import type { InvoiceFormValues } from "./data";
import { DeleteInvoiceButton } from "./delete-bigcapital";

/**
 * M129-D: the Payment tab has its own panel (it used to repeat the Invoice fields). Two parts:
 *  - the payment details printed on the invoice (they were not editable anywhere before);
 *  - the payment state of the Bigcapital invoice made from this draft. Payments are recorded in Bigcapital itself.
 * F-16: no links out to Bigcapital's web app; recording a payment is said to be unavailable here, honestly.
 * F-21: recording a payment is now available here too ("Record payment", the same panel as the Invoices list).
 */
export function InvoicePayment() {
  const { control, register, setValue } = useFormContext<InvoiceFormValues>();
  const linked = useWatch({ control, name: "bigcapital" });
  const [state, setState] = React.useState<{
    invoice: BigcapitalInvoice;
    payments: Array<{ id: number; payment_amount_formatted?: string; date?: string }>;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);

  const load = React.useCallback(() => {
    if (!linked?.id) return;
    setLoading(true);
    setError(null);
    getBigcapitalInvoice(linked.id)
      .then(setState)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // Reload when "Send Invoice" changes the linked invoice (created, then marked delivered).
  }, [linked?.id, linked?.delivered, linked?.status]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4" data-testid="payment-panel">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium tracking-tight">Payment Details</h2>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="payment-account-name">
                Payment account
              </FieldLabel>
              <Input id="payment-account-name" {...register("from.paymentAccountName")} />
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="payment-routing-number">
                Routing number
              </FieldLabel>
              <Input id="payment-routing-number" {...register("from.routingNumber")} />
            </Field>
          </div>
          <FieldDescription className="text-xs">Printed in the payment block of the invoice.</FieldDescription>
        </FieldGroup>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium tracking-tight">Payment Status</h2>
          {linked?.id ? (
            <Button type="button" variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Refresh
            </Button>
          ) : null}
        </div>

        {!linked?.id ? (
          <p className="text-muted-foreground text-sm">
            Not on the invoices server yet. “Send Invoice” creates it there; its payments then show here.
          </p>
        ) : error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : state ? (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Invoice" value={state.invoice.number} />
              <Stat
                label="Status"
                value={<Badge variant="secondary">{STATUS_LABELS[state.invoice.status] ?? state.invoice.status}</Badge>}
              />
              <Stat
                label="Paid"
                value={
                  state.invoice.paid
                    ? state.invoice.paid.startsWith("SR")
                      ? state.invoice.paid
                      : `SR${state.invoice.paid}`
                    : "SR0.00"
                }
              />
              <Stat label="Due" value={state.invoice.due} />
            </dl>
            {state.payments.length ? (
              <ul className="text-sm">
                {state.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between border-b py-1.5 last:border-0">
                    <span>{payment.date ?? "Payment"}</span>
                    <span>{payment.payment_amount_formatted}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No payment recorded yet.</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {linked?.id && state && ["delivered", "overdue", "partially-paid"].includes(state.invoice.status) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaying(true)}
              data-testid="payment-record"
            >
              <Banknote data-icon="inline-start" />
              Record payment
            </Button>
          ) : linked?.id && state?.invoice.status === "draft" ? (
            <p className="text-muted-foreground text-xs" data-testid="payment-record-draft">
              A payment can be recorded once the invoice is delivered (the invoices server takes payments on delivered
              invoices only).
            </p>
          ) : null}
          {linked?.id ? (
            // F-5B (condition 4): delete the linked Bigcapital invoice (Bigcapital refuses one with payments).
            <DeleteInvoiceButton
              invoice={{ id: linked.id, number: state?.invoice.number ?? linked.number }}
              onDeleted={() => {
                setState(null);
                setValue("bigcapital", null, { shouldDirty: true });
              }}
            />
          ) : null}
        </div>
      </section>
      <RecordPaymentSheet
        invoiceId={paying && linked?.id ? linked.id : null}
        onOpenChange={(open) => {
          if (!open) setPaying(false);
        }}
        onSaved={load}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
