import { auditCsv, csvResponse } from "@/lib/audit/csv";
import { RetracedError } from "@/lib/audit/retraced";
import { ownNames } from "@/lib/own-names";

// F-18a: "Export CSV" on the Audit Logs page: the events that match the page's filters, as a CSV file (the export the
// audit log system offers in its own viewer: src/models/saved_export/render.ts, csv-stringify). Same filters as
// GET /api/audit-log (section, action, actor, created/changed/deleted, failed, dates, text, sort). Read-only.
// F-22: the CSV itself moved to lib/audit/csv.ts, unchanged, so a saved export (../exports/[id]) gives the same file.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const csv = await auditCsv(params);
    return csvResponse(csv, `audit-log-${new Date().toISOString().slice(0, 10)}`);
  } catch (error) {
    const status = error instanceof RetracedError ? error.status : 500;
    return Response.json(
      { error: ownNames((error as Error).message) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
