"use client";
// T-39: the report Download buttons save a local CSV of what the report shows (the preview's sample data), the same
// Blob + <a download> way as the contacts and agents exports. No network, nothing sent anywhere.
import { format } from "date-fns";
import { toast } from "sonner";

export type CsvValue = string | number | null | undefined;

export interface ReportFile {
  filename: string;
  // Title, period and filters, one "Name,Value" line each, above the table.
  meta: [string, CsvValue][];
  header: string[];
  rows: CsvValue[][];
}

// Text a spreadsheet would run as a formula (= + - @, tab, carriage return) gets a leading ' so it stays text; the
// "--" no-data mark stays as it is (dashes alone are no formula).
export function csvCell(value: CsvValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) && !/^-+$/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// UTF-8 BOM first so Arabic names open correctly in Excel.
export function toCsv(rows: CsvValue[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export const sampleSource: [string, CsvValue] = ["Source", "Sample data (preview)"];

export function reportFilename(title: string, from: Date, to: Date) {
  const name = title
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${name}-${format(from, "yyyy-MM-dd")}-to-${format(to, "yyyy-MM-dd")}.csv`;
}

export function downloadReport(file: ReportFile) {
  const csv = toCsv([...file.meta, [], file.header, ...file.rows]);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked once the click has handed the file to the browser.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  toast.success(`Downloaded ${file.filename} (${file.rows.length} rows)`);
}
