"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { type BigcapitalInvoice, bigcapitalPdfUrl, listBigcapitalInvoices, STATUS_LABELS } from "./bigcapital-client";
import type { InvoiceFormValues } from "./data";
import { DeleteInvoiceButton } from "./delete-bigcapital";

// F-7 (Fahad 129.4, "a full invoice system"): the invoices Bigcapital already holds, listed on the invoice page.
// They are read by the Next.js server (GET /api/invoice-bigcapital/invoices), so the list is what Bigcapital has now,
// not what this browser remembers. Each row: open it in Bigcapital, download its PDF (Bigcapital's own rendering) and
// delete it with the same confirmation dialog and the same Bigcapital rule as the Delete invoice button elsewhere on
// the page (delete-bigcapital.tsx): Bigcapital refuses an invoice that has received payments.

const PAGE_SIZE = 5;

const STATUS_VARIANTS: Record<BigcapitalInvoice["status"], "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  delivered: "outline",
  overdue: "destructive",
  "partially-paid": "secondary",
  paid: "default",
};

/** Bigcapital sends dates as "2026-10-15T00:00:00.000Z"; the list shows the day. */
const day = (value: string) => value.slice(0, 10);

export function InvoiceList() {
  const { control, getValues, setValue } = useFormContext<InvoiceFormValues>();
  // The draft's own Bigcapital invoice: when "Send Invoice" creates, delivers or deletes it, the list reloads.
  const linked = useWatch({ control, name: "bigcapital" });
  const [page, setPage] = React.useState(1);
  // The rows shown, with the page they belong to (the range text and the buttons follow the rows, not the click).
  const [data, setData] = React.useState<{ invoices: BigcapitalInvoice[]; total: number; page: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const request = React.useRef(0);

  const load = React.useCallback(() => {
    const mine = ++request.current;
    setLoading(true);
    listBigcapitalInvoices(page, PAGE_SIZE)
      .then((result) => {
        if (mine !== request.current) return;
        if (!result.invoices.length && page > 1) {
          // The last row of the last page was deleted: go back one page.
          setPage(page - 1);
          return;
        }
        setData({ invoices: result.invoices, total: result.total, page });
        setError(null);
      })
      .catch((err: Error) => {
        if (mine === request.current) setError(err.message);
      })
      .finally(() => {
        if (mine === request.current) setLoading(false);
      });
  }, [page]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the linked invoice is not read here, its change is the signal to reload.
  React.useEffect(() => {
    load();
  }, [load, linked?.id, linked?.status, linked?.delivered]);

  const total = data?.total ?? 0;
  const shownPage = data?.page ?? 1;
  let countText = "Reading the invoices server…";
  if (data) countText = `${total} on the invoices server`;
  else if (error) countText = "Could not read the invoices server";
  const first = total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(shownPage * PAGE_SIZE, total);

  function goTo(next: number) {
    setLoading(true);
    setPage(next);
  }

  function handleDeleted(id: number) {
    // The page's draft pointed at this invoice: it no longer exists in Bigcapital.
    if (getValues("bigcapital")?.id === id) setValue("bigcapital", null, { shouldDirty: true });
    load();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" data-testid="invoice-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-medium text-lg leading-none tracking-tight">Invoices</h2>
          <p className="text-muted-foreground text-xs" data-testid="invoice-list-count">
            {countText}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          data-testid="invoice-list-refresh"
        >
          {loading ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive text-sm"
        >
          {error}
        </p>
      ) : null}

      {data && data.invoices.length === 0 && !error ? (
        <p className="py-4 text-center text-muted-foreground text-sm" data-testid="invoice-list-empty">
          No invoices on the invoices server yet. Send one from the form below and it will be listed here.
        </p>
      ) : null}

      {data && data.invoices.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full table-fixed text-sm" data-testid="invoice-table">
            <thead className="bg-muted/40 text-left text-muted-foreground text-xs">
              <tr className="border-b">
                <th scope="col" className="w-[12%] px-3 py-2 font-medium xl:w-[15%]">
                  Number
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Client
                </th>
                <th scope="col" className="w-[15%] px-3 py-2 text-right font-medium xl:w-[16%]">
                  Amount
                </th>
                <th scope="col" className="w-[13%] px-3 py-2 font-medium xl:w-[14%]">
                  Status
                </th>
                <th scope="col" className="w-[13%] px-3 py-2 font-medium xl:w-[14%]">
                  Date
                </th>
                <th scope="col" className="w-[200px] px-3 py-2 text-right font-medium xl:w-[236px]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                  data-testid="invoice-row"
                  data-invoice-id={invoice.id}
                  data-invoice-number={invoice.number}
                >
                  <td className="truncate px-3 py-2 font-medium" title={invoice.reference || undefined}>
                    {invoice.number}
                  </td>
                  <td className="truncate px-3 py-2" title={invoice.customerName}>
                    <bdi>{invoice.customerName || "—"}</bdi>
                  </td>
                  <td className="truncate px-3 py-2 text-right tabular-nums" data-testid="invoice-amount">
                    {invoice.total}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANTS[invoice.status]} data-testid="invoice-status">
                      {STATUS_LABELS[invoice.status] ?? invoice.status}
                    </Badge>
                  </td>
                  <td className="truncate px-3 py-2 tabular-nums" title={`Due ${day(invoice.dueDate)}`}>
                    {day(invoice.date)}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" className="max-xl:px-1.5">
                        <a
                          href={bigcapitalPdfUrl(invoice.id)}
                          download
                          aria-label={`Download PDF of ${invoice.number}`}
                          title="Download PDF (the invoices server’s own PDF)"
                          data-testid="invoice-pdf"
                        >
                          <Download data-icon="inline-start" />
                          <span className="max-xl:sr-only">PDF</span>
                        </a>
                      </Button>
                      <DeleteInvoiceButton
                        invoice={{ id: invoice.id, number: invoice.number }}
                        onDeleted={() => handleDeleted(invoice.id)}
                        testId="list-delete-invoice"
                        nameWithNumber
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
          <span data-testid="invoice-list-range">
            {first}–{last} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={shownPage <= 1 || loading}
              onClick={() => goTo(shownPage - 1)}
              data-testid="invoice-list-prev"
            >
              <ChevronLeft data-icon="inline-start" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={last >= total || loading}
              onClick={() => goTo(shownPage + 1)}
              data-testid="invoice-list-next"
            >
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
