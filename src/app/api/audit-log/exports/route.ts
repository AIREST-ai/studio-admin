import { NextResponse } from "next/server";

import { cleanFilters, filtersOfSavedExport, savedExportBody } from "@/lib/audit/query";
import { createSavedExport, listSavedExports, RetracedError } from "@/lib/audit/retraced";
import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { ownNames } from "@/lib/own-names";

// F-22 (Fahad 15 Oct: "I mean the whole system … I want my own system"): saved exports of the Audit Logs page, kept
// by the audit log server itself through its saved-export API (lib/audit/retraced.ts createSavedExport/listSavedExports).
// GET -> { exports: [{ id, name, savedAt, filters }] }, newest first.
// POST { name, filters } -> saves the page's current filters under that name (201 { export }). Logged in the audit
// log as audit_log.export_save. The server has no API to delete a saved export, so there is no DELETE here.
// Exporting one again: GET ./[id] (a CSV).
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error: ownNames(error) }, { status, headers });
const failFrom = (error: unknown) =>
  error instanceof RetracedError ? fail(error.status, error.message) : fail(500, (error as Error).message || "error");

export async function GET() {
  try {
    const exports = (await listSavedExports())
      .map((saved) => ({
        id: saved.id,
        name: saved.name,
        savedAt: saved.saved_at ?? null,
        filters: filtersOfSavedExport(saved.body),
      }))
      .filter((saved) => saved.filters);
    return NextResponse.json({ exports }, { headers });
  } catch (error) {
    return failFrom(error);
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

function describeSave(context: AuditContext<undefined>): AuditChange[] {
  const answer = (context.response ?? {}) as { export?: { id: string; name: string; filters: Record<string, string> } };
  const body = (context.json ?? {}) as { name?: unknown; filters?: unknown };
  const name = answer.export?.name ?? (typeof body.name === "string" ? body.name.trim() : "");
  return [
    {
      action: "audit_log.export_save",
      crud: "c",
      summary: `saved the audit log export "${name}"`,
      target: { id: answer.export?.id ?? "saved-export", name: name || "saved export", type: "saved_export" },
      after: { name, filters: answer.export?.filters ?? cleanFilters(body.filters) },
    },
  ];
}

export const POST = withAudit<undefined>({ area: "audit_log_export", describe: describeSave }, async (request) => {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  let body: { name?: unknown; filters?: unknown } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "body is not JSON");
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return fail(400, "Give the export a name");
  if (name.length > 80) return fail(400, "The name is longer than 80 characters");
  const filters = cleanFilters(body?.filters);
  try {
    const saved = await createSavedExport(name, savedExportBody(filters));
    return NextResponse.json(
      { export: { id: saved.id, name: saved.name, savedAt: new Date().toISOString(), filters } },
      { status: 201, headers },
    );
  } catch (error) {
    return failFrom(error);
  }
});
