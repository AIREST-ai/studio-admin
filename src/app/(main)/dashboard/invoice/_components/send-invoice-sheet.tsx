"use client";

import * as React from "react";

import { CheckCircle2, Download, Info, Loader2, Send } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import {
  type BigcapitalInvoice,
  bigcapitalPdfUrl,
  createBigcapitalInvoice,
  type InvoiceMail,
  listBigcapitalItemNames,
  STATUS_LABELS,
  sendBigcapitalInvoice,
} from "./bigcapital-client";
import {
  formatInvoiceMoney,
  getInvoiceDiscount,
  getInvoiceTaxOption,
  getInvoiceTotal,
  type InvoiceFormValues,
  taxLineLabel,
} from "./data";
import { DeleteInvoiceButton } from "./delete-bigcapital";

/**
 * "Send Invoice": a side panel beside the invoice. Two real Bigcapital steps and one simulated one, each labelled:
 *  1. the invoice is created in Bigcapital (POST /api/invoice-bigcapital/invoices -> Bigcapital /sale-invoices);
 *  2. Bigcapital marks it delivered and supplies the email it would send (its own subject and message);
 *  3. the email itself is simulated: this install has no mail server, so nothing is emailed.
 */
export function SendInvoiceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { control, getValues, setValue } = useFormContext<InvoiceFormValues>();
  const [busy, setBusy] = React.useState<"create" | "send" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [invoice, setInvoice] = React.useState<BigcapitalInvoice | null>(null);
  const [mail, setMail] = React.useState<InvoiceMail | null>(null);
  const values = useWatch({ control }) as InvoiceFormValues;
  const linked = values.bigcapital ?? null;
  // F-5B (condition 3): what "Create" will add to Bigcapital besides the invoice, said before and after.
  const [catalogue, setCatalogue] = React.useState<{ items: string[]; discountItem: string } | null>(null);
  const [catalogueError, setCatalogueError] = React.useState<string | null>(null);
  const [createdNote, setCreatedNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setMail(null);
      setInvoice(null);
      setCreatedNote(null);
      setCatalogueError(null);
      listBigcapitalItemNames()
        .then(setCatalogue)
        .catch((err: Error) => setCatalogueError(err.message));
    }
  }, [open]);

  const known = new Set((catalogue?.items ?? []).map((name) => name.trim().toLowerCase()));
  const lineNames = [
    ...new Set(
      (values.items ?? [])
        .filter((item) => item.description?.trim() || item.unitPrice)
        .map((item) => item.description.trim().slice(0, 190) || "Service"),
    ),
  ];
  const newItems = lineNames.filter((name) => !known.has(name.toLowerCase()));
  const discount = getInvoiceDiscount(values);
  const needDiscountItem = discount > 0 && catalogue && !known.has(catalogue.discountItem.toLowerCase());
  const tax = getInvoiceTaxOption(values);

  function remember(next: BigcapitalInvoice) {
    setInvoice(next);
    setValue(
      "bigcapital",
      { id: next.id, number: next.number, status: next.status, delivered: next.delivered },
      { shouldDirty: true },
    );
  }

  async function create(): Promise<BigcapitalInvoice | null> {
    const current = getValues();
    if (!current.to.bigcapitalCustomerId) {
      setError(
        "Choose the client from the list (Billed To) first, so it is linked to a customer on the invoices server.",
      );
      return null;
    }
    setBusy("create");
    setError(null);
    try {
      const result = await createBigcapitalInvoice(current);
      const created = result.invoice;
      remember(created);
      const notes = [
        result.createdItems.length
          ? `New catalogue items: ${result.createdItems.map((name) => `“${name}”`).join(", ")}.`
          : "No catalogue item was created (all lines reused existing items).",
        result.organizationChanged.length
          ? `Organization profile updated: ${result.organizationChanged.join(", ")}.`
          : "Organization profile unchanged.",
        "No tax rate was created.",
      ];
      setCreatedNote(notes.join(" "));
      toast.success(`Invoice ${created.number} created on the invoices server`, { description: notes.join(" ") });
      return created;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const target = invoice ?? (linked ? { id: linked.id } : await create());
    if (!target) return;
    setBusy("send");
    setError(null);
    try {
      const result = await sendBigcapitalInvoice(target.id);
      remember(result.invoice);
      setMail(result.mail);
      toast.success(`Invoice ${result.invoice.number} marked delivered on the invoices server`, {
        description: "Email simulated: nothing was emailed (no mail server connected).",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const shown = invoice ?? (linked ? { ...linked, total: "", due: "" } : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-full border-l shadow-xl data-[side=right]:sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Send Invoice</SheetTitle>
          <SheetDescription>
            To {values.to.name || "no client yet"}
            {values.to.email ? ` <${values.to.email}>` : ""} ·{" "}
            {formatInvoiceMoney(getInvoiceTotal(values), values.currency)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 text-sm">
          <ol className="flex flex-col gap-3">
            <Step
              n={1}
              done={Boolean(shown)}
              title="Create the invoice on the invoices server"
              detail={
                shown ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      {shown.number}
                      {"total" in shown && shown.total ? ` · ${shown.total}` : ""}
                    </span>
                    <Badge variant="secondary">
                      {STATUS_LABELS[shown.status as BigcapitalInvoice["status"]] ?? shown.status}
                    </Badge>
                  </span>
                ) : (
                  "Real: saved on the invoices server with its client, items, tax, discount and language."
                )
              }
            />
            {!shown ? (
              <li className="ms-9 rounded-md border bg-muted/40 p-2 text-xs" data-testid="create-plan">
                <p className="font-medium">Creating it also changes the invoices server:</p>
                <ul className="mt-1 list-disc ps-4 text-muted-foreground">
                  <li data-testid="plan-items">
                    {catalogueError
                      ? `Catalogue items: could not check (${catalogueError}).`
                      : !catalogue
                        ? "Catalogue items: checking…"
                        : newItems.length || needDiscountItem
                          ? `New catalogue items (the invoices server needs one per line): ${[
                              ...newItems,
                              ...(needDiscountItem ? [catalogue.discountItem] : []),
                            ]
                              .map((name) => `“${name}”`)
                              .join(", ")}.`
                          : "No new catalogue items: every line reuses an existing item."}
                  </li>
                  <li>
                    Seller: the Business tab’s name, address, phone and tax number are written to the invoices server’s
                    organization profile (only what differs). It is printed on every invoice PDF.
                  </li>
                  <li>
                    Tax: <bdi>{taxLineLabel(tax)}</bdi>
                    {tax.bigcapitalId
                      ? ", an existing tax rate on the invoices server. No tax rate is created."
                      : ". No tax rate is created."}
                  </li>
                  {discount > 0 ? (
                    <li>Discount: its own line with the invoice tax, so the lines add up to the total.</li>
                  ) : null}
                </ul>
              </li>
            ) : null}
            <Step
              n={2}
              done={Boolean(mail)}
              title="Mark as delivered on the invoices server"
              detail="Real: the invoices server’s own “Mark as delivered”."
            />
            <Step
              n={3}
              done={Boolean(mail)}
              title="Email the client (simulated)"
              detail="Simulated: no mail server is connected, so nothing is emailed."
            />
          </ol>

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
              {error}
            </p>
          ) : null}

          {mail ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3" data-testid="simulated-email">
              <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                <Info className="size-4" />
                Preview — simulated email. Nothing was emailed.
              </p>
              <p className="text-muted-foreground text-xs">The email the invoices server would send:</p>
              <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">To</dt>
                <dd>{mail.to.join(", ") || "No email on the client"}</dd>
                <dt className="text-muted-foreground">Subject</dt>
                <dd>{mail.subject}</dd>
                <dt className="text-muted-foreground">Attach</dt>
                <dd>{mail.attachInvoice ? "Invoice PDF" : "No attachment"}</dd>
              </dl>
              <Separator />
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed" dir="auto">
                {mail.message}
              </pre>
            </div>
          ) : null}

          {createdNote ? (
            <p className="rounded-md border p-2 text-xs" data-testid="created-note">
              {createdNote}
            </p>
          ) : null}

          {shown ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={bigcapitalPdfUrl(shown.id)} download>
                  <Download data-icon="inline-start" />
                  Invoice PDF
                </a>
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => void create()}>
                Create again from this draft
              </Button>
              <DeleteInvoiceButton
                invoice={{ id: shown.id, number: shown.number }}
                onDeleted={() => {
                  setInvoice(null);
                  setMail(null);
                  setCreatedNote(null);
                  setValue("bigcapital", null, { shouldDirty: true });
                }}
              />
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Edits made here after the invoice is created are not copied to it. To change it, delete it and create it
            again.
          </p>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          {!shown ? (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void create()}>
              {busy === "create" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Create only
            </Button>
          ) : null}
          <Button type="button" disabled={busy !== null} onClick={() => void send()}>
            {busy === "send" ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            {shown ? "Send (simulated email)" : "Create and send"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Step({ n, done, title, detail }: { n: number; done: boolean; title: string; detail: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={
          done
            ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            : "flex size-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground text-xs"
        }
      >
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{detail}</span>
      </span>
    </li>
  );
}
