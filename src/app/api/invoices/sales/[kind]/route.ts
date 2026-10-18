import { NextResponse } from "next/server";

import { withAudit } from "@/lib/audit/with-audit";
import {
  createCreditNote,
  createCustomerRecord,
  createEstimate,
  createItemRecord,
  createReceipt,
  readSalesOptions,
  recordPayment,
} from "@/lib/bigcapital/sales";

import {
  describeCreate,
  fail,
  failFrom,
  headers,
  isKind,
  readCreditNote,
  readCustomerFields,
  readEstimate,
  readItemFields,
  readPayment,
  readReceipt,
  sameOrigin,
} from "../shared";

// F-21: the Invoices page writes to the invoices server through this route (the browser never talks to it, and the key
// stays on the preview server). GET /api/invoices/sales/options -> what the forms pick from (deposit and income
// accounts, tax rates, today). POST /api/invoices/sales/{payments|estimates|receipts|credit-notes|customers|items}
// -> creates one record with the server's own API; its rules decide and its refusal is answered with its reason.
// Every POST is logged in the audit log (lib/audit/with-audit.ts), failures included.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ kind: string }> };

export async function GET(_request: Request, context: Context) {
  const { kind } = await context.params;
  if (kind !== "options") return fail(404, "unknown list");
  try {
    return NextResponse.json({ options: await readSalesOptions() }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

async function post(request: Request, context: Context) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const { kind } = await context.params;
  if (!isKind(kind)) return fail(404, "unknown record kind");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return fail(400, "body is not JSON");
  try {
    switch (kind) {
      case "payments": {
        const input = readPayment(body);
        if (typeof input === "string") return fail(400, input);
        return NextResponse.json(await recordPayment(input), { headers });
      }
      case "estimates": {
        const input = readEstimate(body);
        if (typeof input === "string") return fail(400, input);
        return NextResponse.json(await createEstimate(input), { headers });
      }
      case "receipts": {
        const input = readReceipt(body);
        if (typeof input === "string") return fail(400, input);
        return NextResponse.json(await createReceipt(input), { headers });
      }
      case "credit-notes": {
        const input = readCreditNote(body);
        if (typeof input === "string") return fail(400, input);
        return NextResponse.json(await createCreditNote(input), { headers });
      }
      case "customers": {
        const input = readCustomerFields(body);
        if (typeof input === "string") return fail(400, input);
        return NextResponse.json(await createCustomerRecord(input), { headers });
      }
      case "items": {
        const input = readItemFields(body);
        if (typeof input === "string") return fail(400, input);
        return NextResponse.json(await createItemRecord(input), { headers });
      }
    }
    return fail(404, "unknown record kind");
  } catch (error) {
    return failFrom(error);
  }
}

export const POST = withAudit<unknown, Context>({ area: "invoice_sales", describe: describeCreate }, post);
