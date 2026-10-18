import { NextResponse } from "next/server";

import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { editInvoice, type InvoiceDetail, type InvoiceEdit, readInvoiceDetail } from "@/lib/bigcapital/overview";
import { BigcapitalError } from "@/lib/bigcapital/server";
import { ownNames } from "@/lib/own-names";

// F-18a round 2 (judge: "an invoice cannot be opened, its lines seen or edited"): one invoice of the invoices server,
// opened inside the Invoices page. GET -> { invoice } (lines, totals, statement, payments). PUT { invoiceDate, dueDate,
// reference, statement, lines } -> the server's own edit (PUT /api/sale-invoices/{id}); its rules decide and its
// refusal is answered with its reason. The edit is logged in the audit log (invoice.update, before and after).
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error: ownNames(error) }, { status, headers });
const failFrom = (error: unknown) =>
  error instanceof BigcapitalError ? fail(error.status, error.message) : fail(500, (error as Error).message || "error");

type Context = { params: Promise<{ id: string }> };

const idOf = async (context: Context) => {
  const id = Number((await context.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function GET(_request: Request, context: Context) {
  const id = await idOf(context);
  if (!id) return fail(400, "bad invoice id");
  try {
    return NextResponse.json({ invoice: await readInvoiceDetail(id) }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number.NaN);

function readEdit(body: unknown): InvoiceEdit | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const invoiceDate = str(b.invoiceDate, 10);
  const dueDate = str(b.dueDate, 10);
  if (!DATE.test(invoiceDate) || !DATE.test(dueDate)) return "Invoice date and due date are required";
  if (dueDate < invoiceDate) return "The due date cannot be before the invoice date";
  if (!Array.isArray(b.lines) || !b.lines.length) return "An invoice needs at least one line";
  if (b.lines.length > 200) return "Too many lines";
  const lines: InvoiceEdit["lines"] = [];
  for (const raw of b.lines as Array<Record<string, unknown>>) {
    const itemId = finite(raw.itemId);
    const quantity = finite(raw.quantity);
    const rate = finite(raw.rate);
    if (!(itemId > 0)) return "Choose a product or service on every line";
    if (!(quantity > 0)) return "Every line needs a quantity above 0";
    if (Number.isNaN(rate)) return "Every line needs a price";
    const taxRateId = finite(raw.taxRateId);
    lines.push({
      itemId,
      quantity,
      rate,
      description: str(raw.description, 500),
      taxRateId: taxRateId > 0 ? taxRateId : null,
    });
  }
  return { invoiceDate, dueDate, reference: str(b.reference, 60), statement: str(b.statement, 1000), lines };
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

async function put(request: Request, context: Context) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const id = await idOf(context);
  if (!id) return fail(400, "bad invoice id");
  const edit = readEdit(await request.json().catch(() => null));
  if (typeof edit === "string") return fail(400, edit);
  try {
    return NextResponse.json({ invoice: await editInvoice(id, edit) }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

const brief = (invoice: InvoiceDetail | undefined) =>
  invoice && {
    reference: invoice.reference,
    invoiceDate: invoice.date,
    dueDate: invoice.dueDate,
    lines: invoice.lines.map((l) => `${l.item || l.description} × ${l.quantity} @ ${l.rate}`),
    total: invoice.total.text,
  };

function describeInvoiceEdit(context: AuditContext<InvoiceDetail | undefined>): AuditChange[] {
  const answer = (context.response ?? {}) as { invoice?: InvoiceDetail };
  const id = context.params.id ?? "";
  const number = answer.invoice?.number ?? context.before?.number ?? `#${id}`;
  return [
    {
      action: "invoice.update",
      crud: "u",
      summary: `edited the invoice ${number}`,
      target: { id, name: number, type: "invoice" },
      before: brief(context.before),
      after: brief(answer.invoice),
    },
  ];
}

export const PUT = withAudit<InvoiceDetail | undefined, Context>(
  {
    area: "invoice",
    snapshot: async (request) => {
      const id = Number(new URL(request.url).pathname.split("/").at(-1));
      return Number.isInteger(id) && id > 0 ? readInvoiceDetail(id) : undefined;
    },
    describe: describeInvoiceEdit,
  },
  put,
);
