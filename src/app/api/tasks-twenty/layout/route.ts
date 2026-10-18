import { NextResponse } from "next/server";

import { setCardField } from "@/lib/twenty/server";

import { fail, failFrom, headers, isId, readJson, sameOrigin } from "../shared";

// M129-F: the card design. PATCH { fieldId, visible } shows or hides a Task field on the cards; it is the field's
// visibility in the Twenty board view, so it stays after a reload and Twenty's own Kanban shows the same card.
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<{ fieldId?: unknown; visible?: unknown }>(request);
  if (!isId(body?.fieldId) || typeof body?.visible !== "boolean") return fail(400, "fieldId and visible are required");
  try {
    await setCardField(body.fieldId, body.visible);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
