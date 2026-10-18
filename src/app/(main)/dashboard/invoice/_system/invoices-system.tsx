"use client";

import * as React from "react";

import { Banknote, Download, FilePlus2, Loader2, RefreshCw, Truck } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { INVOICES_REREAD_EVENT } from "../_components/bigcapital-bar";
import type { InvoiceFormValues } from "../_components/data";
import { DeleteInvoiceButton } from "../_components/delete-bigcapital";
import { InvoiceSheet } from "./invoice-sheet";
import {
  fetchInvoicesOverview,
  INVOICE_STATES,
  type InvoiceState,
  type InvoicesOverview,
  type Money,
  markInvoiceDelivered,
  type OverviewInvoice,
  showDate,
} from "./overview-client";
import { RecordPaymentSheet } from "./sales-forms";
import {
  CreditNotesSection,
  CustomersSection,
  DataTable,
  dueLine,
  EstimatesSection,
  ItemsSection,
  matches,
  PaymentsSection,
  ReceiptsSection,
  ReportsSection,
  SearchBox,
} from "./system-tables";

// F-18a (Fahad 15 Oct 15:20: "the invoices ... I found it almost the same as before"): the Invoices page opens on the
// invoicing system itself: its real totals on top, its main sections as tabs (invoices, estimates, payments received,
// sales receipts, credit notes, customers, products & services, reports), and the full invoice list with every status
// and a count for each. All of it is read live from the invoices server by /api/invoices/overview. The invoice editor
// that was the whole page before is the "New invoice" tab (children), kept mounted so a draft is never lost.

export type SystemTab =
  | "invoices"
  | "estimates"
  | "payments"
  | "receipts"
  | "credit-notes"
  | "customers"
  | "items"
  | "reports"
  | "new";

const TAB_KEYS: SystemTab[] = [
  "invoices",
  "estimates",
  "payments",
  "receipts",
  "credit-notes",
  "customers",
  "items",
  "reports",
  "new",
];

export const isSystemTab = (value: string | null): value is SystemTab =>
  value !== null && (TAB_KEYS as string[]).includes(value);

type StateFilter = "all" | InvoiceState;

function SummaryCard({
  label,
  money,
  note,
  tone,
  onClick,
  testId,
  failed,
  onRetry,
}: {
  label: string;
  money: Money & { count: number };
  note: string;
  tone?: "danger";
  onClick: () => void;
  testId: string;
  /** Round 3: the list this number comes from was not read (e.g. "Too Many Requests"): no number is shown. */
  failed?: boolean;
  onRetry: () => void;
}) {
  if (failed)
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex min-w-0 flex-col gap-1 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-left transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        data-testid={testId}
        data-state="error"
      >
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-medium text-base text-destructive leading-tight" data-testid={`${testId}-amount`}>
          Couldn’t load
        </span>
        <span
          className="line-clamp-2 break-words text-muted-foreground text-xs leading-snug"
          data-testid={`${testId}-note`}
        >
          Not read from the invoices server. Retry
        </span>
      </button>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      data-testid={testId}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={`truncate font-medium text-xl tabular-nums leading-tight xl:text-2xl ${tone === "danger" && money.amount > 0 ? "text-destructive" : ""}`}
        data-testid={`${testId}-amount`}
      >
        {money.text}
      </span>
      {/* round 3: the note wraps to two lines at 1024 instead of being cut with "…" */}
      <span
        className="line-clamp-2 break-words text-muted-foreground text-xs leading-snug"
        data-testid={`${testId}-note`}
      >
        {note}
      </span>
    </button>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function InvoicesSection({
  rows,
  filter,
  onFilter,
  onChanged,
  onOpen,
  onPay,
}: {
  rows: OverviewInvoice[];
  filter: StateFilter;
  onFilter: (filter: StateFilter) => void;
  onChanged: (deletedId?: number) => void;
  onOpen: (id: number) => void;
  /** F-21: opens "Record payment" for an invoice that is owed (unpaid, overdue or partially paid). */
  onPay: (id: number) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState<number | null>(null);
  const counts = React.useMemo(() => {
    const out: Record<string, number> = { all: rows.length };
    for (const state of INVOICE_STATES) out[state.key] = rows.filter((r) => r.state === state.key).length;
    return out;
  }, [rows]);
  const shown = rows.filter(
    (r) => (filter === "all" || r.state === filter) && matches(query, r.number, r.customer, r.reference),
  );
  const filters: Array<{ key: StateFilter; label: string }> = [
    { key: "all", label: "All" },
    ...INVOICE_STATES.map((s) => ({ key: s.key as StateFilter, label: s.label })),
  ];

  async function deliver(invoice: OverviewInvoice) {
    setBusy(invoice.id);
    try {
      await markInvoiceDelivered(invoice.id);
      toast.success(`${invoice.number} marked as delivered`);
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3" data-testid="section-invoices">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Invoice status">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => onFilter(f.key)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                filter === f.key ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
              }`}
              data-testid={`invoice-filter-${f.key}`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${filter === f.key ? "bg-background/20" : "bg-muted text-muted-foreground"}`}
                data-testid={`invoice-filter-${f.key}-count`}
              >
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search number, customer or reference"
          testId="invoices-search"
        />
      </div>
      <DataTable
        key={filter}
        rows={shown}
        testId="invoices-table"
        empty={
          rows.length
            ? "No invoice with this status or search."
            : "No invoices on the invoices server yet. Create one in the New invoice tab."
        }
        onRowClick={(r) => onOpen(r.id)}
        rowTitle="Open the invoice"
        columns={[
          {
            key: "number",
            header: "Invoice",
            className: "w-[12%] xl:w-[11%]",
            cell: (r) => (
              <div className="flex min-w-0 flex-col" title={r.reference || undefined}>
                <button
                  type="button"
                  className="truncate text-left font-medium underline-offset-4 hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(r.id);
                  }}
                  aria-label={`Open invoice ${r.number}`}
                  data-testid="invoice-open"
                >
                  {r.number}
                </button>
                {r.reference ? <bdi className="truncate text-muted-foreground text-xs">{r.reference}</bdi> : null}
              </div>
            ),
          },
          { key: "customer", header: "Customer", cell: (r) => <bdi className="truncate">{r.customer || "—"}</bdi> },
          { key: "date", header: "Date", className: "w-[10%] max-xl:hidden", cell: (r) => showDate(r.date) },
          {
            key: "due",
            header: "Due date",
            className: "w-[14%] xl:w-[13%]",
            cell: (r) => (
              <div className="flex min-w-0 flex-col">
                <span>{showDate(r.dueDate)}</span>
                {dueLine(r.dueDate, r.state) ? (
                  <span
                    className={`truncate text-xs ${r.state === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {dueLine(r.dueDate, r.state)}
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            key: "total",
            header: "Amount",
            className: "w-[11%] text-right max-xl:hidden",
            cell: (r) => <span className="tabular-nums">{r.total.text}</span>,
          },
          {
            key: "balance",
            header: "Balance due",
            className: "w-[13%] text-right xl:w-[11%]",
            cell: (r) => (
              <span className="tabular-nums" data-testid="invoice-balance">
                {r.due.text}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            className: "w-[11%] xl:w-[10%]",
            cell: (r) => {
              const state = INVOICE_STATES.find((s) => s.key === r.state);
              return (
                <Badge variant={state?.variant ?? "outline"} data-testid="invoice-state">
                  {state?.label ?? r.state}
                </Badge>
              );
            },
          },
          {
            key: "actions",
            header: "Actions",
            className: "w-[296px] text-right xl:w-[340px]",
            cell: (r) => (
              // Round 2: the buttons keep their own clicks (the row opens the invoice), and Deliver and PDF are
              // written out at every width.
              // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: only stops the row's click.
              <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                {r.state === "draft" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => deliver(r)}
                    aria-label={`Mark ${r.number} as delivered`}
                    title="Mark as delivered (the invoice is final and counts as owed)"
                    data-testid="invoice-deliver"
                  >
                    {busy === r.id ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : (
                      <Truck data-icon="inline-start" />
                    )}
                    Deliver
                  </Button>
                ) : null}
                {r.state === "unpaid" || r.state === "overdue" || r.state === "partially-paid" ? (
                  // F-21: record a payment, full or partial, on the invoices server
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onPay(r.id)}
                    aria-label={`Record a payment on ${r.number}`}
                    title="Record payment (full or partial)"
                    data-testid="invoice-record-payment"
                  >
                    <Banknote data-icon="inline-start" />
                    <span className="xl:hidden">Payment</span>
                    <span className="max-xl:hidden">Record payment</span>
                  </Button>
                ) : null}
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`/api/invoices/${r.id}/pdf`}
                    download
                    aria-label={`Download PDF of ${r.number}`}
                    title="Download PDF"
                    data-testid="invoice-row-pdf"
                  >
                    <Download data-icon="inline-start" />
                    PDF
                  </a>
                </Button>
                <DeleteInvoiceButton
                  invoice={{ id: r.id, number: r.number }}
                  onDeleted={() => onChanged(r.id)}
                  testId="invoice-row-delete"
                  nameWithNumber
                />
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

export function InvoicesSystem({
  tab,
  onTabChange,
  children,
}: {
  tab: SystemTab;
  onTabChange: (tab: SystemTab) => void;
  /** The "New invoice" tab: the invoice editor. */
  children: React.ReactNode;
}) {
  const { control, getValues, setValue } = useFormContext<InvoiceFormValues>();
  // The editor's own invoice: when "Send Invoice" creates or delivers it, the lists are read again.
  const linked = useWatch({ control, name: "bigcapital" });
  const [data, setData] = React.useState<InvoicesOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<StateFilter>("all");
  // Round 2: the invoice opened in the side panel (null = closed).
  const [openId, setOpenId] = React.useState<number | null>(null);
  // F-21: the invoice "Record payment" is open for (null = closed).
  const [payId, setPayId] = React.useState<number | null>(null);
  const request = React.useRef(0);

  const load = React.useCallback(() => {
    const mine = ++request.current;
    setLoading(true);
    fetchInvoicesOverview()
      .then((overview) => {
        if (mine !== request.current) return;
        setData(overview);
        setError(null);
        // Q1: after the first read, every re-read follows a change (or Refresh): the bar above takes the new count.
        if (mine > 1 && !overview.errors.invoices)
          window.dispatchEvent(new CustomEvent(INVOICES_REREAD_EVENT, { detail: overview.invoices.length }));
      })
      .catch((err: Error) => {
        if (mine === request.current) setError(err.message);
      })
      .finally(() => {
        if (mine === request.current) setLoading(false);
      });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the linked invoice is not read, its change is the signal.
  React.useEffect(() => {
    load();
  }, [load, linked?.id, linked?.status, linked?.delivered]);

  function changed(deletedId?: number) {
    if (deletedId && getValues("bigcapital")?.id === deletedId) setValue("bigcapital", null, { shouldDirty: true });
    load();
  }

  function openInvoices(next: StateFilter) {
    setFilter(next);
    onTabChange("invoices");
  }

  const s = data?.summary;
  // Round 3: a section the invoices server did not answer for (data.errors) shows "Couldn't load — Retry", never an
  // empty list or a zero total that would look real.
  const failed = (name: string) => Boolean(data?.errors?.[name]);
  const count = (rows: unknown[] | undefined, testId: string, name: string) =>
    failed(name) ? (
      <span
        className="rounded-full bg-destructive/10 px-1.5 text-destructive text-xs"
        title="Couldn’t load"
        data-testid={testId}
      >
        !
      </span>
    ) : rows ? (
      <span className="rounded-full bg-muted px-1.5 text-muted-foreground text-xs tabular-nums" data-testid={testId}>
        {rows.length}
      </span>
    ) : null;
  const retryBox = (message: string, testId: string) => (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm"
      data-testid={testId}
    >
      <span>Couldn’t load {message}. Nothing is shown instead of a wrong number.</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={load}
        disabled={loading}
        data-testid={`${testId}-retry`}
      >
        {loading ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <RefreshCw data-icon="inline-start" />
        )}
        Retry
      </Button>
    </div>
  );
  /** The section's list, or "Couldn't load — Retry" when the invoices server did not answer for it. */
  const section = (name: string, what: string, body: React.ReactNode) =>
    failed(name)
      ? retryBox(`${what} from the invoices server (${data?.errors?.[name]})`, `section-error-${name}`)
      : body;

  return (
    <div className="flex flex-col gap-4" data-testid="invoices-system">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="invoice-summary">
        {s ? (
          <>
            <SummaryCard
              label="Outstanding"
              money={s.outstanding}
              note={`${plural(s.outstanding.count, "unpaid invoice")} owed to you`}
              onClick={() => openInvoices("unpaid")}
              testId="summary-outstanding"
              failed={failed("invoices")}
              onRetry={load}
            />
            <SummaryCard
              label="Overdue"
              money={s.overdue}
              tone="danger"
              note={
                s.overdue.count
                  ? `${plural(s.overdue.count, "invoice")} past the due date`
                  : "Nothing past its due date"
              }
              onClick={() => openInvoices("overdue")}
              testId="summary-overdue"
              failed={failed("invoices")}
              onRetry={load}
            />
            <SummaryCard
              label="Received (last 30 days)"
              money={s.paidLast30}
              note={plural(s.paidLast30.count, "payment")}
              onClick={() => onTabChange("payments")}
              testId="summary-received"
              failed={failed("payments")}
              onRetry={load}
            />
            <SummaryCard
              label="Drafts"
              money={s.drafts}
              note={`${plural(s.drafts.count, "draft")} not delivered yet`}
              onClick={() => openInvoices("draft")}
              testId="summary-drafts"
              failed={failed("invoices")}
              onRetry={load}
            />
            <SummaryCard
              label="Open estimates"
              money={s.openEstimates}
              note={`${plural(s.openEstimates.count, "estimate")} awaiting an answer`}
              onClick={() => onTabChange("estimates")}
              testId="summary-estimates"
              failed={failed("estimates")}
              onRetry={load}
            />
          </>
        ) : (
          <div className="col-span-full" data-testid="summary-loading">
            {error ? (
              retryBox(`the invoices server (${error})`, "overview-error")
            ) : (
              <div className="rounded-xl border bg-card p-4 text-muted-foreground text-sm">
                Reading the invoices server…
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as SystemTab)} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b">
          <TabsList
            variant="line"
            className="flex-wrap justify-start gap-0 p-0 group-data-horizontal/tabs:h-auto"
            aria-label="Invoices sections"
          >
            <TabsTrigger value="invoices" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-invoices">
              Invoices
              {count(data?.invoices, "tab-count-invoices", "invoices")}
            </TabsTrigger>
            <TabsTrigger value="estimates" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-estimates">
              Estimates
              {count(data?.estimates, "tab-count-estimates", "estimates")}
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-payments">
              <span className="xl:hidden">Payments</span>
              <span className="max-xl:hidden">Payments received</span>
              {count(data?.payments, "tab-count-payments", "payments")}
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-receipts">
              Receipts
              {count(data?.receipts, "tab-count-receipts", "receipts")}
            </TabsTrigger>
            <TabsTrigger value="credit-notes" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-credit-notes">
              Credit notes
              {count(data?.creditNotes, "tab-count-creditNotes", "creditNotes")}
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-customers">
              Customers
              {count(data?.customers, "tab-count-customers", "customers")}
            </TabsTrigger>
            <TabsTrigger value="items" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-items">
              <span className="xl:hidden">Products</span>
              <span className="max-xl:hidden">Products & services</span>
              {count(data?.items, "tab-count-items", "items")}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-reports">
              Reports
            </TabsTrigger>
            <TabsTrigger value="new" className="flex-none px-2 py-2 xl:px-3" data-testid="tab-new">
              <FilePlus2 data-icon="inline-start" />
              New invoice
            </TabsTrigger>
          </TabsList>
          {tab !== "new" ? (
            <div className="ml-auto flex items-center gap-2 pb-1 text-muted-foreground text-xs">
              <span data-testid="overview-read-at">
                {data
                  ? `Read ${new Date(data.readAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                  : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={load}
                disabled={loading}
                data-testid="overview-refresh"
              >
                {loading ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Refresh
              </Button>
            </div>
          ) : null}
        </div>

        {error && data
          ? retryBox(
              `a fresh copy (${error}); the lists below are from ${new Date(data.readAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
              "refresh-error",
            )
          : null}

        <TabsContent value="invoices" className="flex flex-col gap-3">
          {data
            ? section(
                "invoices",
                "the invoices",
                <InvoicesSection
                  rows={data.invoices}
                  filter={filter}
                  onFilter={setFilter}
                  onChanged={changed}
                  onOpen={setOpenId}
                  onPay={setPayId}
                />,
              )
            : null}
        </TabsContent>
        <TabsContent value="estimates" className="flex flex-col gap-3">
          {data
            ? section(
                "estimates",
                "the estimates",
                <EstimatesSection
                  rows={data.estimates}
                  customers={data.customers}
                  items={data.items}
                  onChanged={load}
                />,
              )
            : null}
        </TabsContent>
        <TabsContent value="payments" className="flex flex-col gap-3">
          {data ? section("payments", "the payments", <PaymentsSection rows={data.payments} onChanged={load} />) : null}
        </TabsContent>
        <TabsContent value="receipts" className="flex flex-col gap-3">
          {data
            ? section(
                "receipts",
                "the receipts",
                <ReceiptsSection rows={data.receipts} customers={data.customers} items={data.items} onChanged={load} />,
              )
            : null}
        </TabsContent>
        <TabsContent value="credit-notes" className="flex flex-col gap-3">
          {data
            ? section(
                "creditNotes",
                "the credit notes",
                <CreditNotesSection
                  rows={data.creditNotes}
                  customers={data.customers}
                  items={data.items}
                  onChanged={load}
                />,
              )
            : null}
        </TabsContent>
        <TabsContent value="customers" className="flex flex-col gap-3">
          {data
            ? section("customers", "the customers", <CustomersSection rows={data.customers} onChanged={load} />)
            : null}
        </TabsContent>
        <TabsContent value="items" className="flex flex-col gap-3">
          {data
            ? section("items", "the products and services", <ItemsSection rows={data.items} onChanged={load} />)
            : null}
        </TabsContent>
        <TabsContent value="reports" className="flex flex-col gap-3">
          {data ? section("aging", "the aging report", <ReportsSection aging={data.aging} />) : null}
        </TabsContent>
        <TabsContent value="new" forceMount className="data-[state=inactive]:hidden" data-testid="tab-new-content">
          {children}
        </TabsContent>
      </Tabs>
      <InvoiceSheet
        invoiceId={openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        items={data?.items ?? []}
        onSaved={load}
        onRecordPayment={(id) => {
          setOpenId(null);
          setPayId(id);
        }}
      />
      <RecordPaymentSheet
        invoiceId={payId}
        onOpenChange={(open) => {
          if (!open) setPayId(null);
        }}
        onSaved={load}
      />
    </div>
  );
}
