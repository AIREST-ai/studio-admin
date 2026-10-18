"use client";

import * as React from "react";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { fetchInvoiceDetail, type InvoiceDetail, type OverviewCustomer, type OverviewItem } from "./overview-client";
import {
  type CustomerFields,
  createCreditNote,
  createCustomer,
  createEstimate,
  createItem,
  createReceipt,
  editCustomer,
  editItem,
  fetchSalesOptions,
  type ItemFields,
  readCustomer,
  readItem,
  recordPayment,
  type SalesOptions,
} from "./sales-client";

// F-21 (Fahad 15 Oct: "I want a system of my own"; 129.4 "a complete invoicing system"): the forms that write to the
// invoices server from inside the Invoices page: record a payment, new estimate / sales receipt / credit note, and
// customers and products & services (new and edit). Side panels without a dark overlay, so the list stays visible
// (129.4: a pop-up that does not cover the screen). The server's own rules decide; its refusal is shown word for word
// and nothing is said to be saved unless the server answered with the saved record.

const money = (value: number, sign: string) =>
  `${value < 0 ? "-" : ""}${sign}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))}`;

/** The invoice statuses the server reports after a payment (lib/bigcapital/server.ts toInvoice). */
export const PAID_STATUS: Record<string, string> = {
  paid: "Paid",
  "partially-paid": "Partially paid",
  overdue: "Overdue",
  delivered: "Unpaid",
  draft: "Draft",
};

function useOptions(open: boolean) {
  const [options, setOptions] = React.useState<SalesOptions | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open || options) return;
    let live = true;
    fetchSalesOptions()
      .then((o) => live && setOptions(o))
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [open, options]);
  return { options, error };
}

function ErrorBox({ text, testId }: { text: string | null; testId: string }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive text-sm"
      data-testid={testId}
    >
      {text}
    </p>
  );
}

function Labeled({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SidePanel({
  open,
  onOpenChange,
  busy,
  title,
  description,
  testId,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  title: React.ReactNode;
  description: React.ReactNode;
  testId: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !busy && onOpenChange(next)} modal={false}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-[560px]"
        data-testid={testId}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">{children}</div>
        <SheetFooter className="flex-row flex-wrap justify-end border-t py-3">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---- delete with a confirmation ---------------------------------------------------------------------------------

export function ConfirmDeleteButton({
  label,
  title,
  children,
  run,
  testId,
  ariaLabel,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  run: () => Promise<void>;
  testId: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await run();
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={ariaLabel}
        title={ariaLabel}
        data-testid={testId}
      >
        <Trash2 data-icon="inline-start" />
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent data-testid="confirm-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">{children}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorBox text={error} testId="confirm-delete-error" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void confirm()}
              data-testid="confirm-delete"
            >
              {busy ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {label}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---- record a payment ------------------------------------------------------------------------------------------

export function RecordPaymentSheet({
  invoiceId,
  onOpenChange,
  onSaved,
}: {
  invoiceId: number | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const open = invoiceId !== null;
  const { options, error: optionsError } = useOptions(open);
  const [invoice, setInvoice] = React.useState<InvoiceDetail | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setInvoice(null);
    setLoadError(null);
    setError(null);
    setReference("");
    if (!invoiceId) return;
    let live = true;
    fetchInvoiceDetail(invoiceId)
      .then((detail) => {
        if (!live) return;
        setInvoice(detail);
        setAmount(String(detail.due.amount));
      })
      .catch((err: Error) => live && setLoadError(err.message));
    return () => {
      live = false;
    };
  }, [invoiceId]);

  React.useEffect(() => {
    if (options && !date) setDate(options.today);
  }, [options, date]);

  const sign = invoice?.currency.sign ?? options?.currency.sign ?? "SR";

  async function save() {
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      const result = await recordPayment({
        invoiceId: invoice.id,
        amount: Number.parseFloat(amount),
        date,
        depositAccountId: Number(account),
        reference: reference.trim(),
      });
      const status = PAID_STATUS[result.invoice.status] ?? result.invoice.status;
      toast.success(`Payment ${result.payment?.number ?? ""} recorded on ${result.invoice.number}`.replace("  ", " "), {
        description: `${result.invoice.number} is now ${status}. Balance due ${result.invoice.due}.`,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      testId="payment-sheet"
      title={`Record payment${invoice ? ` · ${invoice.number}` : ""}`}
      description={
        invoice ? <bdi>{invoice.customer}</bdi> : loadError ? "Could not open this invoice." : "Reading the invoice…"
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || !invoice || !account || !date}
            data-testid="payment-save"
          >
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Save payment
          </Button>
        </>
      }
    >
      <ErrorBox text={loadError ?? optionsError} testId="payment-load-error" />
      {invoice ? (
        <>
          <dl className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm" data-testid="payment-invoice">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Total</dt>
              <dd className="tabular-nums">{invoice.total.text}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Paid</dt>
              <dd className="tabular-nums">{invoice.paid.text}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Balance due</dt>
              <dd className="font-medium tabular-nums" data-testid="payment-due">
                {invoice.due.text}
              </dd>
            </div>
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <Labeled id="payment-amount" label={`Amount received (${sign})`}>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="payment-amount"
              />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto w-fit p-0 text-xs"
                onClick={() => setAmount(String(invoice.due.amount))}
                data-testid="payment-full"
              >
                Receive the full amount ({invoice.due.text})
              </Button>
            </Labeled>
            <Labeled id="payment-date" label="Payment date">
              <Input
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="payment-date"
              />
            </Labeled>
            <Labeled id="payment-account" label="Deposit to" className="col-span-2">
              <NativeSelect
                id="payment-account"
                className="w-full"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                data-testid="payment-account"
              >
                <NativeSelectOption value="">Choose the account the money went to</NativeSelectOption>
                {(options?.depositAccounts ?? []).map((a) => (
                  <NativeSelectOption key={a.id} value={String(a.id)}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Labeled>
            <Labeled id="payment-reference" label="Reference (optional)" className="col-span-2">
              <Input
                id="payment-reference"
                value={reference}
                maxLength={60}
                onChange={(e) => setReference(e.target.value)}
                data-testid="payment-reference"
              />
            </Labeled>
          </div>
          <p className="text-muted-foreground text-xs">
            Pay part of the balance or all of it. The invoices server numbers the payment, refuses an amount above the
            balance due or a draft invoice, and sets the invoice to Partially paid or Paid.
          </p>
        </>
      ) : null}
      <ErrorBox text={error} testId="payment-error" />
    </SidePanel>
  );
}

// ---- lines of an estimate, a receipt or a credit note ------------------------------------------------------------

interface LineDraft {
  key: number;
  itemId: string;
  description: string;
  quantity: string;
  rate: string;
  taxRateId: string;
}

let lineKey = 0;
const newLine = (): LineDraft => ({
  key: ++lineKey,
  itemId: "",
  description: "",
  quantity: "1",
  rate: "",
  taxRateId: "",
});

function LinesEditor({
  lines,
  setLines,
  items,
  options,
}: {
  lines: LineDraft[];
  setLines: React.Dispatch<React.SetStateAction<LineDraft[]>>;
  items: OverviewItem[];
  options: SalesOptions | null;
}) {
  const sellable = items.filter((i) => i.active);
  const sign = options?.currency.sign ?? "SR";
  const set = (key: number, patch: Partial<LineDraft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const subtotal = lines.reduce(
    (sum, l) => sum + (Number.parseFloat(l.quantity) || 0) * (Number.parseFloat(l.rate) || 0),
    0,
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Lines</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLines((all) => [...all, newLine()])}
          data-testid="doc-add-line"
        >
          <Plus data-icon="inline-start" />
          Add line
        </Button>
      </div>
      {lines.map((l, index) => (
        <div key={l.key} className="flex flex-col gap-2 rounded-lg border p-2" data-testid="doc-line">
          <div className="flex items-center gap-2">
            <NativeSelect
              className="min-w-0 flex-1"
              value={l.itemId}
              aria-label={`Product or service, line ${index + 1}`}
              onChange={(e) => {
                const item = sellable.find((i) => String(i.id) === e.target.value);
                set(l.key, {
                  itemId: e.target.value,
                  ...(item && (!l.rate || l.rate === "0") ? { rate: String(item.sellPrice.amount) } : {}),
                });
              }}
              data-testid="doc-line-item"
            >
              <NativeSelectOption value="">Choose a product or service</NativeSelectOption>
              {sellable.map((i) => (
                <NativeSelectOption key={i.id} value={String(i.id)}>
                  {i.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={lines.length <= 1}
              aria-label={`Remove line ${index + 1}`}
              title="Remove line"
              onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}
            >
              <Trash2 />
            </Button>
          </div>
          <Input
            value={l.description}
            placeholder="Description (optional)"
            aria-label={`Description, line ${index + 1}`}
            onChange={(e) => set(l.key, { description: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Quantity</span>
              <Input
                type="number"
                min="0"
                step="any"
                value={l.quantity}
                aria-label={`Quantity, line ${index + 1}`}
                onChange={(e) => set(l.key, { quantity: e.target.value })}
                data-testid="doc-line-qty"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Price ({sign})</span>
              <Input
                type="number"
                min="0"
                step="any"
                value={l.rate}
                aria-label={`Price, line ${index + 1}`}
                onChange={(e) => set(l.key, { rate: e.target.value })}
                data-testid="doc-line-rate"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-muted-foreground text-xs">Tax</span>
              <NativeSelect
                className="w-full"
                value={l.taxRateId}
                aria-label={`Tax, line ${index + 1}`}
                onChange={(e) => set(l.key, { taxRateId: e.target.value })}
                data-testid="doc-line-tax"
              >
                <NativeSelectOption value="">No tax</NativeSelectOption>
                {(options?.taxRates ?? []).map((t) => (
                  <NativeSelectOption key={t.id} value={String(t.id)}>
                    {t.name} {t.rate}%
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>
      ))}
      <p className="text-right text-muted-foreground text-xs" data-testid="doc-subtotal">
        Subtotal before tax: <span className="tabular-nums">{money(subtotal, sign)}</span>
      </p>
    </div>
  );
}

const linesOut = (lines: LineDraft[]) =>
  lines.map((l) => ({
    itemId: Number(l.itemId),
    description: l.description.trim(),
    quantity: Number.parseFloat(l.quantity),
    rate: Number.parseFloat(l.rate || "0"),
    taxRateId: l.taxRateId ? Number(l.taxRateId) : null,
  }));

// ---- new estimate, sales receipt or credit note -----------------------------------------------------------------

export type DocKind = "estimates" | "receipts" | "credit-notes";

const DOC: Record<
  DocKind,
  { title: string; description: string; draft: string; final: string; dateLabel: string; noteLabel: string }
> = {
  estimates: {
    title: "New estimate",
    description:
      "A quote for a customer. Deliver it when it is sent, and convert it to an invoice when it is accepted.",
    draft: "Save as draft",
    final: "Save and deliver",
    dateLabel: "Estimate date",
    noteLabel: "Note to the customer (optional)",
  },
  receipts: {
    title: "New sales receipt",
    description:
      "A sale paid on the spot: the receipt is the invoice and the payment in one. A closed receipt is posted to the accounts.",
    draft: "Save as draft",
    final: "Save and close",
    dateLabel: "Receipt date",
    noteLabel: "Message on the receipt (optional)",
  },
  "credit-notes": {
    title: "New credit note",
    description:
      "A return or a refund: it lowers what the customer owes. An open credit note can be applied to invoices.",
    draft: "Save as draft",
    final: "Save and open",
    dateLabel: "Credit note date",
    noteLabel: "Note (optional)",
  },
};

export function DocumentSheet({
  kind,
  open,
  onOpenChange,
  customers,
  items,
  onSaved,
}: {
  kind: DocKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: OverviewCustomer[];
  items: OverviewItem[];
  onSaved: () => void;
}) {
  const text = DOC[kind];
  const { options, error: optionsError } = useOptions(open);
  const [customerId, setCustomerId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [lines, setLines] = React.useState<LineDraft[]>(() => [newLine()]);
  const [saving, setSaving] = React.useState<"draft" | "final" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCustomerId("");
    setAccount("");
    setReference("");
    setNote("");
    setLines([newLine()]);
    setError(null);
    setDate("");
    setExpiry("");
  }, [open]);

  React.useEffect(() => {
    // the server's own web app starts these forms on today's date (estimate expiry too)
    if (open && options && !date) {
      setDate(options.today);
      setExpiry(options.today);
    }
  }, [open, options, date]);

  async function save(final: boolean) {
    setSaving(final ? "final" : "draft");
    setError(null);
    try {
      const common = { customerId: Number(customerId), reference: reference.trim(), lines: linesOut(lines) };
      let done: string;
      if (kind === "estimates") {
        const { estimate } = await createEstimate({
          ...common,
          estimateDate: date,
          expirationDate: expiry,
          note: note.trim(),
          deliver: final,
        });
        done = `Estimate ${estimate.number} saved${final ? " and delivered" : " as a draft"} (${estimate.total})`;
      } else if (kind === "receipts") {
        const { receipt } = await createReceipt({
          ...common,
          depositAccountId: Number(account),
          receiptDate: date,
          message: note.trim(),
          close: final,
        });
        done = `Sales receipt ${receipt.number} saved${final ? " and closed" : " as a draft"} (${receipt.total})`;
      } else {
        const { creditNote } = await createCreditNote({
          ...common,
          creditNoteDate: date,
          note: note.trim(),
          open: final,
        });
        done = `Credit note ${creditNote.number} saved${final ? " and open" : " as a draft"} (${creditNote.total})`;
      }
      toast.success(done, { description: "Saved on the invoices server." });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  const ready =
    Boolean(customerId) &&
    Boolean(date) &&
    (kind !== "receipts" || Boolean(account)) &&
    lines.every((l) => l.itemId && Number.parseFloat(l.quantity) > 0);

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      busy={saving !== null}
      testId={`doc-sheet-${kind}`}
      title={text.title}
      description={text.description}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving !== null}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void save(false)}
            disabled={saving !== null || !ready}
            data-testid="doc-save-draft"
          >
            {saving === "draft" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {text.draft}
          </Button>
          <Button
            type="button"
            onClick={() => void save(true)}
            disabled={saving !== null || !ready}
            data-testid="doc-save-final"
          >
            {saving === "final" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {text.final}
          </Button>
        </>
      }
    >
      <ErrorBox text={optionsError} testId="doc-load-error" />
      <div className="grid grid-cols-2 gap-3">
        <Labeled id="doc-customer" label="Customer" className="col-span-2">
          <NativeSelect
            id="doc-customer"
            className="w-full"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            data-testid="doc-customer"
          >
            <NativeSelectOption value="">Choose a customer</NativeSelectOption>
            {customers.map((c) => (
              <NativeSelectOption key={c.id} value={String(c.id)}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Labeled>
        <Labeled id="doc-date" label={text.dateLabel}>
          <Input
            id="doc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="doc-date"
          />
        </Labeled>
        {kind === "estimates" ? (
          <Labeled id="doc-expiry" label="Expiry date">
            <Input
              id="doc-expiry"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              data-testid="doc-expiry"
            />
          </Labeled>
        ) : (
          <Labeled id="doc-reference" label="Reference (optional)">
            <Input
              id="doc-reference"
              value={reference}
              maxLength={60}
              onChange={(e) => setReference(e.target.value)}
              data-testid="doc-reference"
            />
          </Labeled>
        )}
        {kind === "estimates" ? (
          <Labeled id="doc-reference" label="Reference (optional)" className="col-span-2">
            <Input
              id="doc-reference"
              value={reference}
              maxLength={60}
              onChange={(e) => setReference(e.target.value)}
              data-testid="doc-reference"
            />
          </Labeled>
        ) : null}
        {kind === "receipts" ? (
          <Labeled id="doc-account" label="Deposit to" className="col-span-2">
            <NativeSelect
              id="doc-account"
              className="w-full"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              data-testid="doc-account"
            >
              <NativeSelectOption value="">Choose the account the money went to</NativeSelectOption>
              {(options?.depositAccounts ?? []).map((a) => (
                <NativeSelectOption key={a.id} value={String(a.id)}>
                  {a.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Labeled>
        ) : null}
      </div>
      <LinesEditor lines={lines} setLines={setLines} items={items} options={options} />
      <Labeled id="doc-note" label={text.noteLabel}>
        <Textarea
          id="doc-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="doc-note"
        />
      </Labeled>
      <ErrorBox text={error} testId="doc-error" />
    </SidePanel>
  );
}

// ---- customers: new and edit ------------------------------------------------------------------------------------

const EMPTY_CUSTOMER: CustomerFields = {
  name: "",
  company: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  address: "",
};

export function CustomerSheet({
  open,
  customerId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null = a new customer */
  customerId: number | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [fields, setFields] = React.useState<CustomerFields>(EMPTY_CUSTOMER);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setFields(EMPTY_CUSTOMER);
    if (!customerId) return;
    let live = true;
    setLoading(true);
    readCustomer(customerId)
      .then((c) => {
        if (!live) return;
        setFields({
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone,
          country: c.country,
          city: c.city,
          address: c.address,
        });
      })
      .catch((err: Error) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open, customerId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { customer } = customerId ? await editCustomer(customerId, fields) : await createCustomer(fields);
      toast.success(customerId ? `Customer ${customer.name} saved` : `Customer ${customer.name} added`, {
        description: "Saved on the invoices server.",
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const input = (key: keyof CustomerFields, label: string, type = "text", span = false) => (
    <Labeled id={`customer-${key}`} label={label} className={span ? "col-span-2" : undefined}>
      <Input
        id={`customer-${key}`}
        type={type}
        value={fields[key]}
        onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
        disabled={loading}
        data-testid={`customer-${key}`}
      />
    </Labeled>
  );

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      testId="customer-sheet"
      title={customerId ? "Edit customer" : "New customer"}
      description={
        customerId
          ? "Changes are saved on the invoices server and show on new invoices and PDFs."
          : "A customer you can invoice, quote or give a receipt to."
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !fields.name.trim()}
            data-testid="customer-save"
          >
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {customerId ? "Save changes" : "Add customer"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Reading the customer…
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {input("name", "Display name", "text", true)}
        {input("company", "Company (optional)", "text", true)}
        {input("email", "Email", "email")}
        {input("phone", "Phone", "tel")}
        {input("country", "Country")}
        {input("city", "City")}
        {input("address", "Address", "text", true)}
      </div>
      <ErrorBox text={error} testId="customer-error" />
    </SidePanel>
  );
}

// ---- products & services: new and edit --------------------------------------------------------------------------

interface ItemDraft {
  name: string;
  type: "service" | "non-inventory";
  code: string;
  sellPrice: string;
  sellAccountId: string;
  sellTaxRateId: string;
  description: string;
}

const EMPTY_ITEM: ItemDraft = {
  name: "",
  type: "service",
  code: "",
  sellPrice: "",
  sellAccountId: "",
  sellTaxRateId: "",
  description: "",
};

export function ItemSheet({
  open,
  itemId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null = a new product or service */
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { options, error: optionsError } = useOptions(open);
  const [draft, setDraft] = React.useState<ItemDraft>(EMPTY_ITEM);
  const [inventory, setInventory] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(EMPTY_ITEM);
    setInventory(false);
    if (!itemId) return;
    let live = true;
    setLoading(true);
    readItem(itemId)
      .then((item) => {
        if (!live) return;
        setInventory(item.type === "inventory");
        setDraft({
          name: item.name,
          type: item.type === "non-inventory" ? "non-inventory" : "service",
          code: item.code,
          sellPrice: String(item.sellPrice),
          sellAccountId: item.sellAccountId ? String(item.sellAccountId) : "",
          sellTaxRateId: item.sellTaxRateId ? String(item.sellTaxRateId) : "",
          description: item.description,
        });
      })
      .catch((err: Error) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open, itemId]);

  React.useEffect(() => {
    // A new item's sales go to the income account the page already uses for invoice lines (the one named "service",
    // lib/bigcapital/server.ts ensureLineItems); the user can pick another.
    if (!open || itemId || !options || draft.sellAccountId) return;
    const income =
      options.incomeAccounts.find((a) => a.type === "income" && /service/i.test(a.name)) ?? options.incomeAccounts[0];
    if (income) setDraft((d) => ({ ...d, sellAccountId: String(income.id) }));
  }, [open, itemId, options, draft.sellAccountId]);

  async function save() {
    setSaving(true);
    setError(null);
    const body: ItemFields = {
      name: draft.name.trim(),
      type: draft.type,
      code: draft.code.trim(),
      sellPrice: Number.parseFloat(draft.sellPrice || "0"),
      sellAccountId: Number(draft.sellAccountId),
      sellTaxRateId: draft.sellTaxRateId ? Number(draft.sellTaxRateId) : null,
      description: draft.description.trim(),
    };
    try {
      const { item } = itemId ? await editItem(itemId, body) : await createItem(body);
      toast.success(itemId ? `${item.name} saved` : `${item.name} added to products & services`, {
        description: "Saved on the invoices server.",
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const sign = options?.currency.sign ?? "SR";
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      testId="item-sheet"
      title={itemId ? "Edit product or service" : "New product or service"}
      description="What an invoice, estimate, receipt or credit note line is picked from."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !draft.name.trim() || !draft.sellAccountId}
            data-testid="item-save"
          >
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {itemId ? "Save changes" : "Add"}
          </Button>
        </>
      }
    >
      <ErrorBox text={optionsError} testId="item-load-error" />
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Reading the product or service…
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Labeled id="item-name" label="Name" className="col-span-2">
          <Input
            id="item-name"
            value={draft.name}
            maxLength={190}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            data-testid="item-name"
          />
        </Labeled>
        <Labeled id="item-type" label="Type">
          {inventory ? (
            <span className="flex h-8 items-center text-sm">Inventory (kept as it is)</span>
          ) : (
            <NativeSelect
              id="item-type"
              className="w-full"
              value={draft.type}
              onChange={(e) =>
                setDraft((d) => ({ ...d, type: e.target.value === "non-inventory" ? "non-inventory" : "service" }))
              }
              data-testid="item-type"
            >
              <NativeSelectOption value="service">Service</NativeSelectOption>
              <NativeSelectOption value="non-inventory">Non-inventory product</NativeSelectOption>
            </NativeSelect>
          )}
        </Labeled>
        <Labeled id="item-code" label="Code / SKU (optional)">
          <Input
            id="item-code"
            value={draft.code}
            maxLength={60}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
            data-testid="item-code"
          />
        </Labeled>
        <Labeled id="item-price" label={`Sell price (${sign})`}>
          <Input
            id="item-price"
            type="number"
            min="0"
            step="0.01"
            value={draft.sellPrice}
            onChange={(e) => setDraft((d) => ({ ...d, sellPrice: e.target.value }))}
            data-testid="item-price"
          />
        </Labeled>
        <Labeled id="item-tax" label="Sales tax">
          <NativeSelect
            id="item-tax"
            className="w-full"
            value={draft.sellTaxRateId}
            onChange={(e) => setDraft((d) => ({ ...d, sellTaxRateId: e.target.value }))}
            data-testid="item-tax"
          >
            <NativeSelectOption value="">No tax</NativeSelectOption>
            {(options?.taxRates ?? []).map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)}>
                {t.name} {t.rate}%
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Labeled>
        <Labeled id="item-account" label="Income account" className="col-span-2">
          <NativeSelect
            id="item-account"
            className="w-full"
            value={draft.sellAccountId}
            onChange={(e) => setDraft((d) => ({ ...d, sellAccountId: e.target.value }))}
            data-testid="item-account"
          >
            <NativeSelectOption value="">Choose the account sales go to</NativeSelectOption>
            {(options?.incomeAccounts ?? []).map((a) => (
              <NativeSelectOption key={a.id} value={String(a.id)}>
                {a.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Labeled>
        <Labeled id="item-description" label="Description on sales (optional)" className="col-span-2">
          <Textarea
            id="item-description"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            data-testid="item-description"
          />
        </Labeled>
      </div>
      <ErrorBox text={error} testId="item-error" />
    </SidePanel>
  );
}
