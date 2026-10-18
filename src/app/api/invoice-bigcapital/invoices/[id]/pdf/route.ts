import { bcPdf, getInvoice } from "@/lib/bigcapital/server";

import { fail, failFrom } from "../../../shared";

// M129-D: the invoice PDF exactly as Bigcapital renders it (its template, logo and labels), passed through.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "bad invoice id");
  try {
    const [pdf, invoice] = await Promise.all([bcPdf(`/sale-invoices/${id}`), getInvoice(id)]);
    const name = `${invoice.number || `invoice-${id}`}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failFrom(error);
  }
}
