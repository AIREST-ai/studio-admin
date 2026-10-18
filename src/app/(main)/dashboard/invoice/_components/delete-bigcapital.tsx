"use client";

import * as React from "react";

import { Loader2, Trash2 } from "lucide-react";
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

import { deleteBigcapitalCustomer, deleteBigcapitalInvoice } from "./bigcapital-client";

// F-5B (condition 4): delete the Bigcapital invoice or customer this page made, through Bigcapital's API, after a
// confirmation. Bigcapital's own rules decide; when it refuses, its reason is shown and the dialog stays open.
// F-16: the dialogs no longer link to Bigcapital's source or name it; the rule is said in words (sources below).

// Sources (code readers only, F-16 round 2: no address kept): Bigcapital v0.15.43
//  - an invoice with received payments or applied credit notes cannot be deleted; drafts and delivered invoices alike
//    can (packages/server/src/modules/SaleInvoices/commands/DeleteSaleInvoice.service.ts lines 74-77);
//  - a customer with transactions (invoices, payments…) cannot be deleted
//    (packages/server/src/modules/Customers/commands/DeleteCustomer.service.ts lines 54-56).

function ConfirmDelete({
  open,
  onOpenChange,
  title,
  children,
  action,
  run,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  action: string;
  run: () => Promise<void>;
  testId: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await run();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive text-sm"
          >
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>
            {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
            {action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteInvoiceButton({
  invoice,
  onDeleted,
  size = "sm",
  testId = "delete-invoice",
  nameWithNumber = false,
}: {
  invoice: { id: number; number: string };
  onDeleted: () => void;
  size?: "sm" | "default";
  /** F-7: the Invoices list puts one of these on every row, so its buttons carry their own test id. */
  testId?: string;
  /** F-7: in a list row the button's name for assistive tech says which invoice (“Delete invoice INV-00007”). */
  nameWithNumber?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        data-testid={testId}
        aria-label={nameWithNumber ? `Delete invoice ${invoice.number}` : undefined}
      >
        <Trash2 data-icon="inline-start" />
        Delete invoice
      </Button>
      <ConfirmDelete
        open={open}
        onOpenChange={setOpen}
        testId="delete-invoice-dialog"
        title={`Delete invoice ${invoice.number}?`}
        action="Delete invoice"
        run={async () => {
          await deleteBigcapitalInvoice(invoice.id);
          toast.success(`Invoice ${invoice.number} deleted from the invoices server`);
          onDeleted();
        }}
      >
        <p>
          This deletes {invoice.number} and its lines on the invoices server. It cannot be undone from this page. Your
          draft on this page stays.
        </p>
        <p>
          The invoices server refuses when the invoice has received payments or has credit notes applied. Drafts and
          delivered invoices can both be deleted.
        </p>
      </ConfirmDelete>
    </>
  );
}

export function DeleteCustomerButton({
  customer,
  onDeleted,
}: {
  customer: { id: number; name: string };
  onDeleted: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-destructive text-xs hover:text-destructive"
        onClick={() => setOpen(true)}
        data-testid="delete-customer"
      >
        <Trash2 data-icon="inline-start" />
        Delete customer
      </Button>
      <ConfirmDelete
        open={open}
        onOpenChange={setOpen}
        testId="delete-customer-dialog"
        title={`Delete customer #${customer.id} “${customer.name}”?`}
        action="Delete customer"
        run={async () => {
          await deleteBigcapitalCustomer(customer.id);
          toast.success(`Customer #${customer.id} deleted from the invoices server`, {
            description: "The contact in Contacts is not changed.",
          });
          onDeleted();
        }}
      >
        <p>
          This deletes the customer on the invoices server. The contact in Contacts is not changed. It cannot be undone
          from this page.
        </p>
        <p>The invoices server refuses while the customer has invoices or other transactions.</p>
      </ConfirmDelete>
    </>
  );
}
