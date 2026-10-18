// F-18a: the browser side of /api/invoices/overview (the invoices server's sales data, read by the Next.js server).
import type {
  InvoiceDetail,
  InvoiceEdit,
  InvoiceState,
  InvoicesOverview,
  OverviewCreditNote,
  OverviewEstimate,
  OverviewReceipt,
} from "@/lib/bigcapital/overview";

export type {
  AgingRow,
  InvoiceDetail,
  InvoiceEdit,
  InvoiceState,
  InvoicesOverview,
  Money,
  OverviewCreditNote,
  OverviewCustomer,
  OverviewEstimate,
  OverviewInvoice,
  OverviewItem,
  OverviewPayment,
  OverviewReceipt,
} from "@/lib/bigcapital/overview";

export async function fetchInvoicesOverview(): Promise<InvoicesOverview> {
  const response = await fetch("/api/invoices/overview", { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as (InvoicesOverview & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? `Could not read the invoices server (${response.status})`);
  return body;
}

/** Round 2: one invoice with its lines, totals and payments (GET /api/invoices/{id}). */
export async function fetchInvoiceDetail(id: number): Promise<InvoiceDetail> {
  const response = await fetch(`/api/invoices/${id}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { invoice?: InvoiceDetail; error?: string } | null;
  if (!response.ok || !body?.invoice) throw new Error(body?.error ?? `Could not open the invoice (${response.status})`);
  return body.invoice;
}

/** Round 2: saves an edit on the invoices server (PUT /api/invoices/{id}); its refusal comes back as the error. */
export async function saveInvoiceEdit(id: number, edit: InvoiceEdit): Promise<InvoiceDetail> {
  const response = await fetch(`/api/invoices/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edit),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { invoice?: InvoiceDetail; error?: string } | null;
  if (!response.ok || !body?.invoice) throw new Error(body?.error ?? `The invoice was not saved (${response.status})`);
  return body.invoice;
}

export async function markInvoiceDelivered(id: number): Promise<void> {
  const response = await fetch("/api/invoices/overview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deliver", id }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
}

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

/** The invoice statuses of the invoices server (SaleInvoice.meta.ts), in its own order. */
export const INVOICE_STATES: Array<{ key: InvoiceState; label: string; variant: BadgeVariant }> = [
  { key: "draft", label: "Draft", variant: "secondary" },
  { key: "unpaid", label: "Unpaid", variant: "outline" },
  { key: "overdue", label: "Overdue", variant: "destructive" },
  { key: "partially-paid", label: "Partially paid", variant: "secondary" },
  { key: "paid", label: "Paid", variant: "default" },
];

export const ESTIMATE_STATES: Record<OverviewEstimate["state"], { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "secondary" },
  delivered: { label: "Delivered", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
  converted: { label: "Converted to invoice", variant: "default" },
};

export const RECEIPT_STATES: Record<OverviewReceipt["state"], { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "secondary" },
  closed: { label: "Closed", variant: "default" },
};

export const CREDIT_STATES: Record<OverviewCreditNote["state"], { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "secondary" },
  open: { label: "Open", variant: "outline" },
  closed: { label: "Closed", variant: "default" },
};

/** "2026-10-15" -> "Oct 15, 2026" (the list's dates, in English like the rest of the page). */
export function showDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Days from today (local) to a YYYY-MM-DD day: negative when it has passed. */
export function daysUntil(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
}
