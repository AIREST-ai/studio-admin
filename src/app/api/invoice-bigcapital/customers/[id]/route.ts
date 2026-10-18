import { NextResponse } from "next/server";

import { type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { deleteCustomer } from "@/lib/bigcapital/server";

import { fail, failFrom, headers, sameOrigin } from "../../shared";

// F-5B (condition 4): DELETE deletes the Bigcapital customer (DELETE /api/customers/:id). Bigcapital keeps a customer
// that has transactions; that refusal is answered as 409 with the invoices that block it. The Studio contact the
// customer was made from is not touched.
export const dynamic = "force-dynamic";

async function remove(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "bad customer id");
  try {
    const customer = await deleteCustomer(id);
    return NextResponse.json({ deleted: true, customer }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

function describeCustomerDelete(context: AuditContext<unknown>) {
  const answer = (context.response ?? {}) as { customer?: { id?: number; name?: string } };
  const id = context.params.id ?? "";
  const name = answer.customer?.name ?? `#${id}`;
  return [
    {
      action: "invoice_customer.delete",
      crud: "d" as const,
      summary: `deleted the invoice customer ${name}`,
      target: { id, name, type: "customer" },
    },
  ];
}

// M129-E: logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const DELETE = withAudit({ area: "invoice_customer", describe: describeCustomerDelete }, remove);
