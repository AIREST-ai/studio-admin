import { NextResponse } from "next/server";

import { describeInvoiceSend } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";
import { getInvoice, invoiceMail, markDelivered } from "@/lib/bigcapital/server";

import { fail, failFrom, headers, sameOrigin } from "../../../shared";

// M129-D: "Send Invoice". Real part: Bigcapital marks the invoice delivered (its own deliver endpoint) and supplies
// the email it would send. Simulated part: the email itself. This Bigcapital has no mail server, and Bigcapital's
// POST /sale-invoices/:id/mail is never called, so nothing leaves this machine.
export const dynamic = "force-dynamic";

async function post(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "bad invoice id");
  try {
    const mail = await invoiceMail(id);
    await markDelivered(id);
    const invoice = await getInvoice(id);
    return NextResponse.json(
      {
        invoice,
        mail,
        emailSimulated: true,
        note: "Simulated email: no mail server is connected, so nothing was emailed. The invoices server marked the invoice as delivered.",
      },
      { headers },
    );
  } catch (error) {
    return failFrom(error);
  }
}

// M129-E: logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const POST = withAudit({ area: "invoice", describe: describeInvoiceSend }, post);
