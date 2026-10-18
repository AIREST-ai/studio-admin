import { auditCsv, csvResponse } from "@/lib/audit/csv";
import { filtersOfSavedExport } from "@/lib/audit/query";
import { listSavedExports, RetracedError } from "@/lib/audit/retraced";
import { ownNames } from "@/lib/own-names";

// F-22: a saved export, exported again: its saved filters (kept by the audit log server, ../route.ts) run on the log
// as it is now, through the same CSV as "Export CSV" (lib/audit/csv.ts). The file is named after the export, as the
// audit log server names its own rendered exports (src/models/saved_export/render.ts: the name, spaces as "_").
// Read-only.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const fail = (status: number, error: string) =>
  Response.json({ error: ownNames(error) }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  try {
    const saved = (await listSavedExports()).find((item) => item.id === id);
    if (!saved) return fail(404, "There is no saved export with this id");
    const filters = filtersOfSavedExport(saved.body);
    if (!filters) return fail(422, "This saved export was not made on this page, so its filters cannot be read here");
    const csv = await auditCsv(new URLSearchParams(filters));
    return csvResponse(csv, saved.name);
  } catch (error) {
    const status = error instanceof RetracedError ? error.status : 500;
    return fail(status, (error as Error).message);
  }
}
