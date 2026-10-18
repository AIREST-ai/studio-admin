import { NextResponse } from "next/server";

import { describeInvoice } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";
import { createInvoice, listInvoicesPage, saveOrganization } from "@/lib/bigcapital/server";

import { fail, failFrom, headers, readJson, sameOrigin, str } from "../shared";

// M129-D: POST the invoice drafted on /dashboard/invoice -> a real Bigcapital sale invoice (draft, not delivered).
// F-5B: the tax is a Bigcapital tax rate id (nothing is created for it), the discount goes in as its own line, and the
// issuer from the Business tab is first written to Bigcapital's organization profile, which its PDF prints as the
// seller. The answer says what else was created or changed: { invoice, createdItems, organizationChanged }.
export const dynamic = "force-dynamic";

interface Body {
  customerId?: unknown;
  referenceNumber?: unknown;
  issuedDate?: unknown;
  dueDate?: unknown;
  language?: unknown;
  taxRateId?: unknown;
  discount?: { amount?: unknown; label?: unknown } | null;
  issuer?: { name?: unknown; addressLines?: unknown; phone?: unknown; taxNumber?: unknown } | null;
  items?: Array<{ description?: unknown; quantity?: unknown; unitPrice?: unknown }>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<Body>(request);
  if (!body) return fail(400, "body is not JSON");
  const customerId = num(body.customerId);
  if (!(customerId > 0)) return fail(400, "Choose a client first");
  const issuedDate = str(body.issuedDate, 10);
  const dueDate = str(body.dueDate, 10);
  if (!DATE.test(issuedDate) || !DATE.test(dueDate)) return fail(400, "Issued and due dates are required");
  if (!Array.isArray(body.items) || body.items.length > 200) return fail(400, "items are required");
  const taxRateId = num(body.taxRateId);
  const discountAmount = num(body.discount?.amount);
  if (discountAmount < 0) return fail(400, "discount cannot be negative");
  try {
    let organizationChanged: string[] = [];
    if (body.issuer && typeof body.issuer === "object") {
      const lines = Array.isArray(body.issuer.addressLines) ? body.issuer.addressLines : [];
      const saved = await saveOrganization({
        name: str(body.issuer.name, 120),
        addressLines: lines.slice(0, 6).map((line) => str(line, 120)),
        phone: str(body.issuer.phone, 40),
        taxNumber: str(body.issuer.taxNumber, 40),
      });
      organizationChanged = saved.changed;
    }
    const { invoice, createdItems } = await createInvoice({
      customerId,
      referenceNumber: str(body.referenceNumber, 60),
      issuedDate,
      dueDate,
      language: body.language === "ar" ? "ar" : "en",
      taxRateId: taxRateId > 0 ? taxRateId : null,
      discount: discountAmount > 0 ? { amount: discountAmount, label: str(body.discount?.label, 120) } : null,
      items: body.items.map((item) => ({
        description: str(item.description, 500),
        quantity: num(item.quantity),
        unitPrice: num(item.unitPrice),
      })),
    });
    return NextResponse.json({ invoice, createdItems, organizationChanged }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

// F-7: GET ?page=1&pageSize=5 -> { invoices, page, pageSize, total }: the Invoices list on /dashboard/invoice, read
// from Bigcapital by this server (newest first). Nothing is written, so it is not audited.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.floor(Number(searchParams.get("page") ?? 1));
  const pageSize = Math.floor(Number(searchParams.get("pageSize") ?? 10));
  if (!(page >= 1 && page <= 10_000)) return fail(400, "bad page");
  if (!(pageSize >= 1 && pageSize <= 100)) return fail(400, "bad pageSize (1 to 100)");
  try {
    return NextResponse.json(await listInvoicesPage(page, pageSize), { headers });
  } catch (error) {
    return failFrom(error);
  }
}

// M129-E: logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const POST = withAudit({ area: "invoice", describe: describeInvoice }, post);
