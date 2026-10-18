import { NextResponse } from "next/server";

import { type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { deleteInvoice, getInvoice, invoicePayments } from "@/lib/bigcapital/server";

import { fail, failFrom, headers, sameOrigin } from "../../shared";

// M129-D: one Bigcapital invoice with its received payments (for the Payment tab).
// F-5B: DELETE deletes it in Bigcapital (DELETE /api/sale-invoices/:id). Bigcapital's own rule decides: it refuses an
// invoice with received payments or applied credit notes, and that refusal is answered as 409 with its reason.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "bad invoice id");
  try {
    const [invoice, payments] = await Promise.all([getInvoice(id), invoicePayments(id)]);
    return NextResponse.json({ invoice, payments }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

async function remove(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "bad invoice id");
  try {
    const invoice = await deleteInvoice(id);
    return NextResponse.json({ deleted: true, invoice }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

function describeInvoiceDelete(context: AuditContext<unknown>) {
  const answer = (context.response ?? {}) as { invoice?: { number?: string; total?: string }; error?: string };
  const id = context.params.id ?? "";
  const number = answer.invoice?.number ?? `#${id}`;
  return [
    {
      action: "invoice.delete",
      crud: "d" as const,
      // Q1: a refused delete says "tried to delete", like the other kinds (lib/audit/describe.ts, sales/shared.ts).
      summary: context.status >= 400 ? `tried to delete the invoice ${number}` : `deleted the invoice ${number}`,
      target: { id, name: number, type: "invoice" },
      before: answer.invoice ? { number, total: answer.invoice.total } : undefined,
    },
  ];
}

// M129-E: logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const DELETE = withAudit({ area: "invoice", describe: describeInvoiceDelete }, remove);
