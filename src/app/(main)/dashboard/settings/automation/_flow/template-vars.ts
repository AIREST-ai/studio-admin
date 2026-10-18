// F-3 item 6: "Send an approved message template" fills the template's variables from the contact's fields, the same
// way a WhatsApp campaign does (campaigns/_components/broadcast.ts FIELD_OPTIONS / fillFor, M129-C): each {{n}} takes a
// contact field (with a fallback when the contact has none) or a fixed text. The step keeps the choice in
// `action.variables` (saved with the flow; the save keeps fields it does not check, file-store.ts validateAutomation).
// WhatsApp refuses a template message whose parameters do not match the template (error 132000, "Number of
// parameters does not match the expected number of params"), so every {{n}} needs a value.
// Source: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
import {
  FIELD_OPTIONS,
  fillFor,
  type VariableSource,
  variableValue,
} from "@/app/(main)/dashboard/campaigns/_components/broadcast";

import type { Action } from "./catalog";

export { FIELD_OPTIONS, type VariableSource };

export type TemplateVariables = Record<string, VariableSource>;
export type TemplateAction = Action & { variables?: TemplateVariables };

/** The variable numbers of a template body, in order: "Hi {{1}}, order {{2}}" → ["1", "2"]. */
export function variableKeys(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b).map(String);
}

/** What a newly picked template starts with: {{1}} is the contact's first name (Chatwoot's own convention). */
export function defaultVariables(body: string): TemplateVariables {
  const keys = variableKeys(body);
  return keys.includes("1") ? { "1": { kind: "field", field: "first_name", fallback: "there" } } : {};
}

const hasValue = (source: VariableSource | undefined) =>
  !!source && (source.kind === "text" ? !!source.value.trim() : !!source.field);

/** The {{n}} of `body` that have no value yet (no field chosen, or an empty text). */
export function missingVariables(body: string, variables: TemplateVariables | undefined): string[] {
  return variableKeys(body).filter((key) => !hasValue(variables?.[key]));
}

/** The contact's fields as a template reads them (FIELD_OPTIONS keys), from the run's contact. */
export function contactFieldsFor(
  fields: Partial<Record<string, string>>,
  contact: { email?: string | null; phone_number?: string | null; country_code?: string | null },
): Record<string, string> {
  const name = (fields.name ?? "").replace(/\s*\(made-up contact\)\s*$/, "").trim();
  const known = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Record<
    string,
    string
  >;
  return {
    ...known,
    name,
    first_name: fields.first_name ?? name.split(/\s+/)[0] ?? "",
    phone: fields.phone ?? contact.phone_number ?? "",
    email: fields.email ?? contact.email ?? "",
    country: fields.country ?? contact.country_code ?? "",
  };
}

/** The text the contact receives, every {{n}} filled; a {{n}} with no value stays as it is. */
export function fillTemplate(body: string, variables: TemplateVariables | undefined, fields: Record<string, string>) {
  return fillFor(body, variables, { fields });
}

/** "{{1}} = First name (Sara)" lines, for the dry run. */
export function variableLines(body: string, variables: TemplateVariables | undefined, fields: Record<string, string>) {
  return variableKeys(body).map((key) => {
    const source = variables?.[key];
    if (!source) return `{{${key}}} has no value`;
    const value = variableValue(source, { fields });
    if (source.kind === "text") return `{{${key}}} = “${value}”`;
    const label = FIELD_OPTIONS.find((f) => f.value === source.field)?.label ?? source.field;
    return `{{${key}}} = ${label} (“${value}”${fields[source.field]?.trim() ? "" : ", the fallback"})`;
  });
}
