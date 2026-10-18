import { NextResponse } from "next/server";

import { withAudit } from "@/lib/audit/with-audit";
import {
  convertEstimate,
  deleteCreditNote,
  deleteCustomerRecord,
  deleteEstimate,
  deleteItemRecord,
  deletePayment,
  deleteReceipt,
  deliverEstimate,
  editCustomerRecord,
  editItemRecord,
  readCustomer,
  readItem,
} from "@/lib/bigcapital/sales";

import {
  describeRecord,
  fail,
  failFrom,
  headers,
  isKind,
  readCustomerFields,
  readItemFields,
  sameOrigin,
} from "../../shared";

// F-21: one record of the invoices server's sales side, from the Invoices page.
//   GET    customers/{id}, items/{id}                        -> the record, for the edit form
//   PUT    customers/{id}, items/{id}                        -> the server's own edit
//   DELETE payments|estimates|receipts|credit-notes|customers|items/{id} -> the server's own delete (it refuses what
//          its rules keep, e.g. a used customer or item, a converted estimate; the reason is answered as 409)
//   POST   estimates/{id} { action: "deliver" | "convert" }   -> "Mark as delivered", "Convert to invoice"
// Every write is logged in the audit log, failures included.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ kind: string; id: string }> };

async function paramsOf(context: Context) {
  const { kind, id } = await context.params;
  const n = Number(id);
  return { kind, id: Number.isInteger(n) && n > 0 ? n : 0 };
}

export async function GET(_request: Request, context: Context) {
  const { kind, id } = await paramsOf(context);
  if (!id) return fail(400, "bad id");
  try {
    if (kind === "customers") return NextResponse.json({ customer: await readCustomer(id) }, { headers });
    if (kind === "items") return NextResponse.json({ item: await readItem(id) }, { headers });
    return fail(404, "unknown record kind");
  } catch (error) {
    return failFrom(error);
  }
}

async function put(request: Request, context: Context) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const { kind, id } = await paramsOf(context);
  if (!id) return fail(400, "bad id");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return fail(400, "body is not JSON");
  try {
    if (kind === "customers") {
      const input = readCustomerFields(body);
      if (typeof input === "string") return fail(400, input);
      return NextResponse.json(await editCustomerRecord(id, input), { headers });
    }
    if (kind === "items") {
      const input = readItemFields(body);
      if (typeof input === "string") return fail(400, input);
      return NextResponse.json(await editItemRecord(id, input), { headers });
    }
    return fail(404, "this record cannot be edited here");
  } catch (error) {
    return failFrom(error);
  }
}

async function remove(request: Request, context: Context) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const { kind, id } = await paramsOf(context);
  if (!id) return fail(400, "bad id");
  if (!isKind(kind)) return fail(404, "unknown record kind");
  try {
    switch (kind) {
      case "payments":
        return NextResponse.json(await deletePayment(id), { headers });
      case "estimates":
        return NextResponse.json(await deleteEstimate(id), { headers });
      case "receipts":
        return NextResponse.json(await deleteReceipt(id), { headers });
      case "credit-notes":
        return NextResponse.json(await deleteCreditNote(id), { headers });
      case "customers":
        return NextResponse.json(await deleteCustomerRecord(id), { headers });
      case "items":
        return NextResponse.json(await deleteItemRecord(id), { headers });
    }
    return fail(404, "unknown record kind");
  } catch (error) {
    return failFrom(error);
  }
}

async function post(request: Request, context: Context) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const { kind, id } = await paramsOf(context);
  if (!id) return fail(400, "bad id");
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (kind !== "estimates") return fail(404, "no action for this record kind");
  try {
    if (body?.action === "deliver") return NextResponse.json(await deliverEstimate(id), { headers });
    if (body?.action === "convert") return NextResponse.json(await convertEstimate(id), { headers });
    return fail(400, "unknown action");
  } catch (error) {
    return failFrom(error);
  }
}

const spec = { area: "invoice_sales", describe: describeRecord };
export const PUT = withAudit<unknown, Context>(spec, put);
export const DELETE = withAudit<unknown, Context>(spec, remove);
export const POST = withAudit<unknown, Context>(spec, post);
