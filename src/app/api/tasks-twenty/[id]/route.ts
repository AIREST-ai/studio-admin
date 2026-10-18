import { NextResponse } from "next/server";

import { deleteTask } from "@/lib/twenty/server";

import { fail, failFrom, headers, isId, sameOrigin } from "../shared";

// F-5B (sim1 problem 8): DELETE /api/tasks-twenty/<id> moves that Twenty task to Twenty's deleted records (soft
// delete, restorable in Twenty) and answers only after Twenty confirmed it and the record reads back as deleted.
// The browser calls this route; Twenty is called from the Next.js server (src/lib/twenty/server.ts deleteTask).
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const { id } = await params;
  if (!isId(id)) return fail(400, "id is not valid");
  try {
    return NextResponse.json({ deleted: await deleteTask(id), mode: "soft" }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
