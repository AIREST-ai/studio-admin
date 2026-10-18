import { NextResponse } from "next/server";

import { InvalidTask, parseSpace, validateChanges } from "@/app/(main)/dashboard/tasks/_board/model";
import { describeTasks } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";

import { createTask, loadBoard, TaskConflictError, TaskNotFoundError, updateTask } from "./store";

// T-244: the Tasks board's own save route (see ./store.ts for the contract). Not /api/studio-preview-state.
// GET ?space=  -> the board.  POST ?space= { changes } -> new task.  PATCH ?space= { id, baseRev, changes } -> saved
// task, or 409 { error, current } when the task was saved by someone else after `baseRev`.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 20_000;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function spaceOf(request: Request) {
  return parseSpace(new URL(request.url).searchParams.get("space"));
}

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new InvalidTask("request too large");
  try {
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new InvalidTask("body is not a JSON object");
  }
}

function answer(error: unknown) {
  if (error instanceof TaskConflictError)
    return NextResponse.json({ error: error.message, current: error.current }, { status: 409, headers });
  if (error instanceof TaskNotFoundError) return fail(404, error.message);
  if (error instanceof InvalidTask) return fail(400, error.message);
  return fail(500, `tasks not saved: ${(error as Error).message}`);
}

export async function GET(request: Request) {
  const space = spaceOf(request);
  if (!space) return fail(400, "bad space name");
  try {
    return NextResponse.json(await loadBoard(space), { headers });
  } catch (error) {
    return fail(500, `saved tasks unreadable: ${(error as Error).message}`);
  }
}

async function post(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const space = spaceOf(request);
  if (!space) return fail(400, "bad space name");
  try {
    const body = await bodyOf(request);
    const task = await createTask(space, validateChanges(body.changes));
    return NextResponse.json({ task }, { status: 201, headers });
  } catch (error) {
    return answer(error);
  }
}

async function patch(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const space = spaceOf(request);
  if (!space) return fail(400, "bad space name");
  try {
    const body = await bodyOf(request);
    if (typeof body.id !== "string") return fail(400, "id must be text");
    if (typeof body.baseRev !== "number" || !Number.isInteger(body.baseRev))
      return fail(400, "baseRev must be a whole number");
    const task = await updateTask(space, body.id, body.baseRev, validateChanges(body.changes));
    return NextResponse.json({ task }, { headers });
  } catch (error) {
    return answer(error);
  }
}

// M129-E: new and changed tasks are logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts).
const audit = {
  area: "task",
  snapshot: async (request: Request) => {
    const space = spaceOf(request);
    return space ? loadBoard(space) : null;
  },
  describe: describeTasks,
};
export const POST = withAudit(audit, post);
export const PATCH = withAudit(audit, patch);
