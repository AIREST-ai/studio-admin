import { NextResponse } from "next/server";

import { createTask, readBoard, updateTask } from "@/lib/twenty/server";

import { fail, failFrom, headers, isId, readJson, sameOrigin, taskInputFrom } from "./shared";

// M129-F (Fahad 129.6): the Tasks page's tasks, read from and written to the local Twenty (server side only).
// GET -> the board: statuses (board columns + sections), members, card fields, tasks.
// POST { task } -> a new Twenty task.   PATCH { id, task } -> the Twenty task with those changes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readBoard(), { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<{ task?: unknown }>(request);
  const input = taskInputFrom(body?.task, true);
  if (typeof input === "string") return fail(400, input);
  try {
    return NextResponse.json({ task: await createTask(input) }, { status: 201, headers });
  } catch (error) {
    return failFrom(error);
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<{ id?: unknown; task?: unknown }>(request);
  if (!isId(body?.id)) return fail(400, "id is required");
  const input = taskInputFrom(body?.task, false);
  if (typeof input === "string") return fail(400, input);
  try {
    return NextResponse.json({ task: await updateTask(body.id, input) }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
