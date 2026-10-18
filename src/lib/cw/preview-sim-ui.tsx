"use client";

// M129-A (Fahad 129.2): the small pieces every simulated button shares: the honest "Preview — simulated" mark, the
// sample-file download and the CSV download built from the preview's own data.
import { cn } from "cn";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { SIMULATED } from "./preview-sim";

export function SimBadge({ className, label = SIMULATED }: { className?: string; label?: string }) {
  return (
    <span
      data-sim-badge=""
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/40 border-dashed bg-amber-500/10 px-1.5 py-px font-medium text-[10px] text-amber-700 leading-4 dark:text-amber-300",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

// The sample attachments of the inbox, each with a real sample file made for this preview (api/preview-sim/sample).
const SAMPLE_FILES = new Set([
  "readiness-probe-logs.png",
  "export-timeout.png",
  "transfer-confirmation.jpg",
  "bank-statement-oct.pdf",
  "report-export-june.csv",
  "crash-after-splash.mp4",
  "voicemail-0847.m4a",
  // M129-A round 2: the two documents of conversation #24.
  "resignation-notice.pdf",
  "hr-confirmation.pdf",
]);

export const hasSampleFile = (name: string) => SAMPLE_FILES.has(name);

function save(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Downloads the sample file of an inbox attachment. Every sample attachment has one (checked by the M129-A checks);
 * a file attached on this page keeps only its name, and the message says just that, without guessing which it is.
 */
export function downloadSample(name: string) {
  if (!hasSampleFile(name)) {
    toast.info(`${name}: no file to download`, {
      description: `${SIMULATED}. The preview has no copy of this file: files attached on this page keep only their name.`,
    });
    return;
  }
  save(`/api/preview-sim/sample?name=${encodeURIComponent(name)}`, name);
  toast.success(`Downloading ${name}`, {
    description: `${SIMULATED}: a sample file made for this preview, not the customer's original.`,
  });
}

/** Downloads a file uploaded in the preview (macro attachments). */
export function downloadUpload(id: string, name: string) {
  save(`/api/preview-sim/upload?id=${encodeURIComponent(id)}`, name);
}

// Chatwoot writes its CSV exports with CSVSafe, which puts a ' before a cell starting with - = + @ % | or a line
// break/tab, so a spreadsheet does not run it as a formula (https://github.com/zvory/csv-safe, lib/csv-safe.rb), and
// adds a UTF-8 BOM so Excel reads Arabic correctly (app/jobs/account/contacts_export_job.rb, Chatwoot v4.18.0).
function safeCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const text = /^\s*[-=+@%|\r\t\n]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
}

/** Builds the CSV in the browser from the preview's data and downloads it (nothing is sent anywhere). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([`﻿${toCsv(rows)}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  save(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  toast.success(`Downloading ${filename}`, {
    description: `${SIMULATED}: ${rows.length - 1} rows from the preview's sample data.`,
  });
}
