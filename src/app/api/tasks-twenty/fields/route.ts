import { NextResponse } from "next/server";

import { addCustomField, CUSTOM_FIELD_TYPES, type CustomFieldType } from "@/lib/twenty/server";

import { fail, failFrom, headers, readJson, sameOrigin, str } from "../shared";

// M129-F: POST { label, type, options? } adds a custom field to Twenty's Task object (Twenty custom fields:
// https://docs.twenty.com/user-guide/data-model/capabilities/fields) and shows it on the cards.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<{ label?: unknown; type?: unknown; options?: unknown }>(request);
  const label = str(body?.label, 60);
  if (!label) return fail(400, "label is required");
  if (!CUSTOM_FIELD_TYPES.includes(body?.type as CustomFieldType)) return fail(400, "type is not supported");
  const options = Array.isArray(body?.options)
    ? body.options
        .map((o) => str(o, 40))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  if (body?.type === "SELECT" && options.length === 0) return fail(400, "a select field needs at least one option");
  try {
    return NextResponse.json(
      { field: await addCustomField(label, body?.type as CustomFieldType, options) },
      { status: 201, headers },
    );
  } catch (error) {
    return failFrom(error);
  }
}
