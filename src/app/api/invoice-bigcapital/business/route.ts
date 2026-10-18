import { NextResponse } from "next/server";

import { type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { getOrganization, saveOrganization } from "@/lib/bigcapital/server";

import { fail, failFrom, headers, readJson, sameOrigin, str } from "../shared";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// F-5B (conditions 1 and 2): the saved issuer ("Business" tab) that every new invoice starts from.
//  - name, address, phone and tax number live in Bigcapital's organization profile (PUT /api/organization), the
//    seller block its invoice PDF prints;
//  - email, website, "issued by" and the payment account are not part of that profile (UpdateOrganizationDto), so
//    they are kept in one small file on the preview machine, beside account-general-settings.json (the preview state
//    file studio-preview-state.json is not touched).
// GET -> { business: { organization, extra } }. PUT { name, addressLines, phone, taxId, email, website, issuerName,
// paymentAccountName, routingNumber } -> the same, plus { changed } (what changed in Bigcapital).
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), ".preview-state", "invoice-business.json");

interface BusinessExtra {
  email: string;
  website: string;
  issuerName: string;
  paymentAccountName: string;
  routingNumber: string;
  savedAt: string | null;
}

const EMPTY_EXTRA: BusinessExtra = {
  email: "",
  website: "",
  issuerName: "",
  paymentAccountName: "",
  routingNumber: "",
  savedAt: null,
};

async function readExtra(): Promise<BusinessExtra> {
  let text: string;
  try {
    text = await readFile(FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_EXTRA;
    throw error;
  }
  const saved = JSON.parse(text) as Partial<BusinessExtra>;
  return {
    email: str(saved.email, 160),
    website: str(saved.website, 160),
    issuerName: str(saved.issuerName, 120),
    paymentAccountName: str(saved.paymentAccountName, 120),
    routingNumber: str(saved.routingNumber, 60),
    savedAt: typeof saved.savedAt === "string" ? saved.savedAt : null,
  };
}

async function writeExtra(extra: BusinessExtra) {
  // atomic: temp file + rename, so a crash never leaves half a file
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(extra));
  await rename(temp, FILE);
}

export async function GET() {
  try {
    const [organization, extra] = await Promise.all([getOrganization(), readExtra()]);
    return NextResponse.json({ business: { organization, extra } }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return fail(400, "body is not JSON");
  const email = str(body.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "email is not valid");
  const lines = Array.isArray(body.addressLines) ? body.addressLines.slice(0, 6).map((line) => str(line, 120)) : [];
  try {
    const { organization, changed } = await saveOrganization({
      name: str(body.name, 120),
      addressLines: lines,
      phone: str(body.phone, 40),
      taxNumber: str(body.taxId, 40),
    });
    const extra: BusinessExtra = {
      email,
      website: str(body.website, 160),
      issuerName: str(body.issuerName, 120),
      paymentAccountName: str(body.paymentAccountName, 120),
      routingNumber: str(body.routingNumber, 60),
      savedAt: new Date().toISOString(),
    };
    await writeExtra(extra);
    return NextResponse.json({ business: { organization, extra }, changed }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

function describeBusiness(context: AuditContext<unknown>) {
  const answer = (context.response ?? {}) as { changed?: string[]; business?: { organization?: { name?: string } } };
  const name = answer.business?.organization?.name ?? "business";
  return [
    {
      action: "invoice_business.update",
      crud: "u" as const,
      summary: `saved the invoice business details${answer.changed?.length ? ` (invoices server: ${answer.changed.join(", ")})` : ""}`,
      target: { id: "organization", name, type: "organization" },
      after: answer.business,
    },
  ];
}

// M129-E: logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const PUT = withAudit({ area: "invoice_business", describe: describeBusiness }, put);
