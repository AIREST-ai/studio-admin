import { NextResponse } from "next/server";

import { describePolicies } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";

import {
  CapacityConflictError,
  InvalidCapacity,
  loadCapacity,
  parseSpace,
  saveCapacity,
  validatePolicies,
} from "./store";

// T-232: the agent capacity policies' own save route (see ./store.ts for the contract). Not /api/studio-preview-state.
// GET ?space=  -> { rev, policies }.  PUT ?space= { baseRev, policies } -> the saved list, or 409 { error, current }
// when the list was saved by someone else after `baseRev`.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 200_000;

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

const spaceOf = (request: Request) => parseSpace(new URL(request.url).searchParams.get("space"));

export async function GET(request: Request) {
  const space = spaceOf(request);
  if (!space) return fail(400, "bad space name");
  try {
    return NextResponse.json(await loadCapacity(space), { headers });
  } catch (error) {
    return fail(500, `saved capacity policies unreadable: ${(error as Error).message}`);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const space = spaceOf(request);
  if (!space) return fail(400, "bad space name");
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) throw new InvalidCapacity("request too large");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch {
      throw new InvalidCapacity("body is not a JSON object");
    }
    if (typeof body.baseRev !== "number" || !Number.isInteger(body.baseRev))
      throw new InvalidCapacity("baseRev must be a whole number");
    return NextResponse.json(await saveCapacity(space, body.baseRev, validatePolicies(body.policies)), { headers });
  } catch (error) {
    if (error instanceof CapacityConflictError)
      return NextResponse.json({ error: error.message, current: error.current }, { status: 409, headers });
    if (error instanceof InvalidCapacity) return fail(400, error.message);
    return fail(500, `capacity policies not saved: ${(error as Error).message}`);
  }
}

// M129-E: every save is logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts), policy by policy.
export const PUT = withAudit(
  {
    area: "capacity_policy",
    snapshot: async (request: Request) => {
      const space = spaceOf(request);
      return space ? loadCapacity(space) : null;
    },
    describe: describePolicies("capacity_policy", "capacity policy"),
  },
  put,
);
