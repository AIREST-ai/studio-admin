import { NextResponse } from "next/server";

import { listDeletedTasks, restoreTask } from "@/lib/twenty/extras";

import { fail, failFrom, headers, isId, readJson, sameOrigin } from "../shared";

// F-18b: the Tasks page's "Deleted" tab, inside the page (no link to the tasks server's own app).
// GET -> { tasks }: the deleted tasks, newest first.   PATCH { id } -> { restored }: that task is back on the board.
// The tasks server is called from the Next.js server only (src/lib/twenty/extras.ts).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await listDeletedTasks() }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<{ id?: unknown }>(request);
  if (!isId(body?.id)) return fail(400, "id is required");
  try {
    return NextResponse.json({ restored: await restoreTask(body.id) }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
