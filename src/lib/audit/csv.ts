// F-22: the Audit Logs CSV, shared by "Export CSV" (app/api/audit-log/export) and a saved export exported again
// (app/api/audit-log/exports/[id]). Moved here unchanged from the F-18a export route: the events that match the
// filters (section, action, actor, created/changed/deleted, failed, dates, text, sort), read through the audit log
// server's own search, every row through shapeAuditEvent (the product's words), at most 10,000 rows. Cells that start
// with = + - @ get a leading ' so a spreadsheet does not run them as formulas (OWASP "CSV Injection",
// https://owasp.org/www-community/attacks/CSV_Injection). Values are quoted as RFC 4180 says.
import { searchAuditPage, shapeAuditEvent } from "./query";

const MAX_ROWS = 10_000;
const PAGE = 500;

function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLUMNS = [
  "Time (UTC)",
  "Actor",
  "Actor role",
  "Action",
  "Activity",
  "Target type",
  "Target",
  "Result",
  "IP address",
  "Before",
  "After",
  "Request",
  "Event ID",
];

/** The CSV text for these filters, and its number of rows. Throws what the audit log client throws. */
export async function auditCsv(params: URLSearchParams): Promise<{ text: string; rows: number }> {
  const sortOrder = params.get("sort") === "oldest" ? "asc" : "desc";
  const lines = [COLUMNS.map(cell).join(",")];
  let total = 0;
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await searchAuditPage(params, offset, PAGE, sortOrder);
    total = page.total;
    for (const raw of page.events) {
      const e = shapeAuditEvent(raw);
      lines.push(
        [
          e.time,
          e.actor.name,
          e.actor.role ?? "",
          e.action,
          e.description,
          e.target?.type ?? "",
          e.target?.name ?? e.target?.id ?? "",
          e.result,
          e.ip ?? "",
          e.before ?? "",
          e.after ?? "",
          e.route ?? "",
          e.id,
        ]
          .map(cell)
          .join(","),
      );
    }
    if (page.events.length < PAGE || offset + PAGE >= total) break;
  }
  return { text: `﻿${lines.join("\r\n")}\r\n`, rows: lines.length - 1 };
}

/** The file download for a CSV text; `fileBase` is made safe for a file name (letters, digits, . _ -). */
export function csvResponse(csv: { text: string; rows: number }, fileBase: string): Response {
  const safe =
    fileBase
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "audit-log";
  return new Response(csv.text, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}.csv"`,
      "Cache-Control": "no-store",
      "X-Rows": String(csv.rows),
    },
  });
}
