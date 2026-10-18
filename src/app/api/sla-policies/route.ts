import { NextResponse } from "next/server";

import { describePolicies } from "@/lib/audit/describe";
import { withAudit } from "@/lib/audit/with-audit";

import { InvalidSla, loadSlas, parseSpace, SlaConflictError, saveSlas, validateSlas } from "./store";

// T-261: the SLA policies' own save route (see ./store.ts for the contract). Not /api/studio-preview-state.
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
    return NextResponse.json(await loadSlas(space), { headers });
  } catch (error) {
    return fail(500, `saved SLA policies unreadable: ${(error as Error).message}`);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const space = spaceOf(request);
  if (!space) return fail(400, "bad space name");
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) throw new InvalidSla("request too large");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch {
      throw new InvalidSla("body is not a JSON object");
    }
    if (typeof body.baseRev !== "number" || !Number.isInteger(body.baseRev))
      throw new InvalidSla("baseRev must be a whole number");
    return NextResponse.json(await saveSlas(space, body.baseRev, validateSlas(body.policies)), { headers });
  } catch (error) {
    if (error instanceof SlaConflictError)
      return NextResponse.json({ error: error.message, current: error.current }, { status: 409, headers });
    if (error instanceof InvalidSla) return fail(400, error.message);
    return fail(500, `SLA policies not saved: ${(error as Error).message}`);
  }
}

// M129-E: every save is logged to Retraced through the one audit wrapper (lib/audit/with-audit.ts), policy by policy.
export const PUT = withAudit(
  {
    area: "sla_policy",
    snapshot: async (request: Request) => {
      const space = spaceOf(request);
      return space ? loadSlas(space) : null;
    },
    describe: describePolicies("sla_policy", "SLA policy"),
  },
  put,
);
