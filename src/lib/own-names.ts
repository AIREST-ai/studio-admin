// F-16 (Fahad, 15 Oct 15:05: "why do you mention their names?"): the pages never name the ready-made systems behind
// them (Twenty, Bigcapital, Davis, Retraced, CalDAV). New text is written without them; this maps the text that was
// already stored with those names (activity log descriptions, service checks) to the product's own words when it is
// shown. Only the vendor names change; the meaning of each line stays as it was recorded. Twenty and Davis are also
// ordinary words and surnames ("Emily Davis"), so they are only replaced in the phrases this app itself wrote.

import { PRODUCT_NAME } from "@/config/app-config";

const RULES: Array<[RegExp, string]> = [
  // F-23 (round 2): the system actor of the events logged before 15 Oct 17:50 (now `${PRODUCT_NAME} preview server`,
  // app/api/notifications-feed/route.ts); the audit log server cannot change an event, so it is mapped when shown.
  [/\bStudio preview server\b/g, `${PRODUCT_NAME} preview server`],
  // the service names the notifications check recorded (lib/notifications/feed.ts SERVICES)
  [/\bRetraced \(Audit Logs\)/g, "Audit log"],
  [/\bBigcapital \(Invoices\)/g, "Invoices"],
  [/\bTwenty \(Tasks\)/g, "Tasks"],
  [/\bDavis \(Calendar\)/g, "Calendar"],
  [/\bRetraced \d+(\.\d+)*/g, "Audit log server"],
  // activity log summaries (lib/audit/describe.ts, app/api/invoice-bigcapital/*)
  [/\bthe Bigcapital invoice\b/g, "the invoice"],
  [/\bthe Bigcapital customer\b/g, "the invoice customer"],
  [/\bto Bigcapital customer\b/g, "to invoice customer"],
  [/\((Bigcapital|Twenty|Davis): /g, "("],
  [/\b(?:in|on) Bigcapital\b/g, "on the invoices server"],
  [/\b(?:in|on) Twenty\b/g, "on the tasks server"],
  [/\b(?:in|on) Davis\b/g, "on the calendar server"],
  [/\b(to|from|into) Bigcapital\b/g, "$1 the invoices server"],
  [/\b(to|from|into) Twenty\b/g, "$1 the tasks server"],
  [/\b(to|from|into) Davis\b/g, "$1 the calendar server"],
  // error texts of the servers' clients ("Twenty is not reachable at …", "Davis: HTTP 500")
  [/\bTwenty(?= (is|answered|has|did|refused)\b)/g, "The tasks server"],
  [/\bDavis(?= (is|answered|has|did|refused|free\/busy)\b)/g, "The calendar server"],
  [/\bTwenty's\b/g, "The tasks server's"],
  [/\bRetraced(?= (is|answered|did|search)\b)/g, "The audit log server"],
  [/\bBigcapital(?= (is|answered|has|did|refused|refuses)\b)/g, "The invoices server"],
  [/\bDavis:/g, "Calendar server:"],
  // names that are never ordinary words here
  [/\bBigcapital\b/g, "invoices server"],
  [/\bRetraced\b/g, "audit log server"],
  [/\bCalDAV\b/gi, "calendar"],
  // addresses of those servers (ports 3490, 3495, 3497, 3499 on this Mac): not shown
  [/ ?(at |in )?https?:\/\/[^\s)]+:(3490|3495|3497|3499)\b[^\s)]*/g, ""],
];

/** The text as shown to the user: the systems behind the pages named by what they do. */
export function ownNames(text: string): string;
export function ownNames(text: string | null): string | null;
export function ownNames(text: string | null | undefined): string | null | undefined;
export function ownNames(text: string | null | undefined) {
  if (!text) return text;
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out;
}
