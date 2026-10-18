import { NextResponse } from "next/server";

import type { AuditChange, AuditContext } from "@/lib/audit/with-audit";
import { withAudit } from "@/lib/audit/with-audit";
import { readInvoicesOverview } from "@/lib/bigcapital/overview";
import { BigcapitalError, getInvoice, markDelivered } from "@/lib/bigcapital/server";
import { ownNames } from "@/lib/own-names";

// F-18a (Fahad 15 Oct 15:20): the Invoices page's view of the whole sales side of the invoices server.
// GET  -> { currency, summary, invoices, estimates, payments, receipts, creditNotes, customers, items, aging, errors }
// POST { action: "deliver", id } -> the server's own "Mark as delivered" for a draft invoice (logged in the audit log).
// The browser never talks to the invoices server: this route does, with the key only the preview server holds.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error: ownNames(error) }, { status, headers });

export async function GET() {
  try {
    const overview = await readInvoicesOverview();
    const errors = Object.fromEntries(Object.entries(overview.errors).map(([k, v]) => [k, ownNames(v)]));
    return NextResponse.json({ ...overview, errors }, { headers });
  } catch (error) {
    if (error instanceof BigcapitalError) return fail(error.status, error.message);
    return fail(500, (error as Error).message || "unexpected error");
  }
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

function describeOverviewAction(context: AuditContext<unknown>): AuditChange[] {
  const body = (context.json ?? {}) as { action?: unknown; id?: unknown };
  const answer = (context.response ?? {}) as { invoice?: { number?: string; id?: number } };
  if (body.action !== "deliver") return [];
  const id = String(answer.invoice?.id ?? body.id ?? "");
  const number = answer.invoice?.number ?? `#${id}`;
  return [
    {
      action: "invoice.deliver",
      crud: "u",
      summary: `marked the invoice ${number} as delivered`,
      target: { id, name: number, type: "invoice" },
      before: { status: "draft" },
      after: { status: "delivered" },
    },
  ];
}

export const POST = withAudit({ area: "invoice", describe: describeOverviewAction }, async (request: Request) => {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  let body: { action?: unknown; id?: unknown } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "body is not JSON");
  }
  const id = typeof body?.id === "number" ? body.id : Number.NaN;
  if (body?.action !== "deliver" || !(id > 0)) return fail(400, "unknown action");
  try {
    await markDelivered(id);
    const invoice = await getInvoice(id);
    return NextResponse.json({ invoice }, { headers });
  } catch (error) {
    if (error instanceof BigcapitalError) return fail(error.status, error.message);
    return fail(500, (error as Error).message || "unexpected error");
  }
});
