import { NextResponse } from "next/server";

import { describeInvoiceCustomer } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";
import { createCustomer, ensureCustomer, listCustomers } from "@/lib/bigcapital/server";

import { fail, failFrom, headers, readJson, sameOrigin, str } from "../shared";

// M129-D: Bigcapital customers for the invoice client picker.
// GET -> { customers }.
// POST { mode: "ensure", contact } -> the customer with the contact's email (created when missing), { customer, created }.
// POST { mode: "create", contact } -> always a new customer ("Add New Client").
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ customers: await listCustomers() }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<{ mode?: unknown; contact?: Record<string, unknown> }>(request);
  if (!body?.contact) return fail(400, "contact is required");
  const contact = {
    name: str(body.contact.name, 120),
    email: str(body.contact.email, 160),
    phone: str(body.contact.phone, 40),
    company: str(body.contact.company, 120),
    country: str(body.contact.country, 80),
    city: str(body.contact.city, 80),
  };
  if (!contact.name) return fail(400, "name is required");
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return fail(400, "email is not valid");
  try {
    if (body.mode === "create") {
      return NextResponse.json({ customer: await createCustomer(contact), created: true }, { headers });
    }
    return NextResponse.json(await ensureCustomer(contact), { headers });
  } catch (error) {
    return failFrom(error);
  }
}

// M129-E: logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const POST = withAudit({ area: "invoice_customer", describe: describeInvoiceCustomer }, post);
