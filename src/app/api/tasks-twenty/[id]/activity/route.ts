import { NextResponse } from "next/server";

import { taskActivity } from "@/lib/twenty/extras";

import { fail, failFrom, headers, isId } from "../../shared";

// F-18b: one task's History (who changed what and when), Related (the person or company it is about) and Files, read
// from the tasks server by the Next.js server (src/lib/twenty/extras.ts) for the task window. Read only.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) return fail(400, "id is not valid");
  try {
    return NextResponse.json(await taskActivity(id), { headers });
  } catch (error) {
    return failFrom(error);
  }
}
