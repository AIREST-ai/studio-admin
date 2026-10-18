import { NextResponse } from "next/server";

import { describeGeneralSettings } from "@/lib/audit/describe";
import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { syncOrganizationName } from "@/lib/bigcapital/server";
import { ownNames } from "@/lib/own-names";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// T-225 (Fahad 77.12/77.26): the General Settings account name and site language, saved on the preview machine's disk
// so they survive a reload and a server restart. Chatwoot saves them with PATCH /api/v1/accounts/:id; this preview has
// no Chatwoot account, so it keeps its own small file beside studio-preview-state.json (that file and its sections
// belong to lib/cw/persistence/file-store.ts and are not touched here). Preview only: one file, last write wins.
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), ".preview-state", "account-general-settings.json");
const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

interface GeneralSettings {
  name: string;
  language: string;
  savedAt: string;
}

// Chatwoot locale codes look like "en", "pt_BR", "zh_CN" (account-page.tsx languages).
const LOCALE = /^[a-z]{2,3}(_[A-Z]{2})?$/;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** `null` when nothing was saved yet. A damaged file throws instead of silently resetting. */
async function read(): Promise<GeneralSettings | null> {
  let text: string;
  try {
    text = await readFile(FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const saved = JSON.parse(text) as Partial<GeneralSettings>;
  if (typeof saved.name !== "string" || typeof saved.language !== "string" || typeof saved.savedAt !== "string")
    throw new Error("account settings file is damaged");
  return { name: saved.name, language: saved.language, savedAt: saved.savedAt };
}

export async function GET() {
  try {
    return NextResponse.json({ settings: await read() }, { headers });
  } catch (error) {
    return fail(500, `saved settings unreadable: ${(error as Error).message}`);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  let body: { name?: unknown; language?: unknown } | null;
  try {
    body = (await request.json()) as { name?: unknown; language?: unknown } | null;
  } catch {
    return fail(400, "body is not JSON");
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 255) return fail(400, "name must be 1-255 characters");
  const language = body?.language;
  if (typeof language !== "string" || !LOCALE.test(language)) return fail(400, "language is not a locale code");
  const settings: GeneralSettings = { name, language, savedAt: new Date().toISOString() };
  try {
    // atomic: temp file + rename, so a crash never leaves half a file
    await mkdir(path.dirname(FILE), { recursive: true });
    const temp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(settings));
    await rename(temp, FILE);
  } catch (error) {
    return fail(500, `not saved: ${(error as Error).message}`);
  }
  // F-21: the account name is the seller name on invoice PDFs: it is written to the invoices server's organization
  // profile too. The settings are saved either way; a failure there is answered (and logged) beside them.
  let invoiceOrganization: { before: string; after: string; changed: boolean } | { error: string };
  try {
    invoiceOrganization = await syncOrganizationName();
  } catch (error) {
    invoiceOrganization = { error: ownNames((error as Error).message) || "not reachable" };
  }
  return NextResponse.json({ settings, invoiceOrganization }, { headers });
}

/** F-21: the invoices server's organization name, written from General Settings (logged as its own change). */
function describeInvoiceOrganization(context: AuditContext<Record<string, unknown> | null>): AuditChange[] {
  const answer = (context.response ?? {}) as {
    invoiceOrganization?: { before?: string; after?: string; changed?: boolean; error?: string };
  };
  const sync = answer.invoiceOrganization;
  if (!sync || (!sync.error && !sync.changed)) return [];
  if (sync.error)
    return [
      {
        action: "invoice_business.update",
        crud: "u",
        summary: `saved the account name, but the invoices organization name was not updated (${sync.error})`,
        target: { id: "organization", name: "organization", type: "organization" },
      },
    ];
  return [
    {
      action: "invoice_business.update",
      crud: "u",
      summary: `set the invoices organization name to "${sync.after}" from General Settings (printed on invoice PDFs)`,
      target: { id: "organization", name: sync.after ?? "organization", type: "organization" },
      before: { name: sync.before },
      after: { name: sync.after },
    },
  ];
}

// M129-E: the save is logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
export const PUT = withAudit(
  {
    area: "account_settings",
    snapshot: async () => (await read()) as unknown as Record<string, unknown> | null,
    describe: (context) => [...describeGeneralSettings(context), ...describeInvoiceOrganization(context)],
  },
  put,
);
