// V-18: linked-mode presence heartbeat. Preview keeps `/api/preview-sim/presence` and this route
// answers 409 in preview so the two paths never mix. Studio tabs post who is viewing/typing; the
// handler merges that with Chatwoot typing/presence events already applied from the realtime bus.
import { NextResponse } from "next/server";

import {
  ensureLivePresenceSubscription,
  LIVE_PRESENCE_TTL_MS,
  LIVE_TYPING_TTL_MS,
  leaveStudioPresence,
  othersFor,
  upsertStudioPresence,
} from "@/lib/chatwoot/live-presence";
import { readLinkState } from "@/lib/chatwoot/mode";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

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

const whole = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1e7;

ensureLivePresenceSubscription();

async function requireLinked() {
  const linkState = await readLinkState();
  if (linkState.mode !== "linked" || linkState.disabled) {
    return fail(409, "preview mode");
  }
  return null;
}

export async function GET(request: Request) {
  const blocked = await requireLinked();
  if (blocked) return blocked;
  const url = new URL(request.url);
  const convRaw = url.searchParams.get("conv");
  const conv = convRaw && /^\d{1,7}$/.test(convRaw) ? Number.parseInt(convRaw, 10) : NaN;
  if (!Number.isInteger(conv) || conv < 0) return fail(400, "conv must be a whole number");
  const agentRaw = url.searchParams.get("agentId");
  const agentId = agentRaw && /^\d{1,7}$/.test(agentRaw) ? Number.parseInt(agentRaw, 10) : -1;
  return NextResponse.json(
    {
      others: othersFor(conv, agentId),
      ttlMs: LIVE_PRESENCE_TTL_MS,
      typingTtlMs: LIVE_TYPING_TTL_MS,
      source: "linked",
    },
    { headers },
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const blocked = await requireLinked();
  if (blocked) return blocked;
  const raw = await request.text();
  if (raw.length > 2000) return fail(413, "request too large");
  let parsed: Record<string, unknown> | null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown> | null;
  } catch {
    return fail(400, "body is not JSON");
  }
  const body = parsed ?? {};
  const { tab, conv, agentId, name } = body;
  if (typeof tab !== "string" || !/^[a-z0-9-]{6,64}$/.test(tab)) return fail(400, "tab must be an id");
  if (body.leave === true) {
    if (whole(conv)) leaveStudioPresence(tab, conv as number);
    return NextResponse.json({ others: [], source: "linked" }, { headers });
  }
  if (!whole(conv) || !whole(agentId)) return fail(400, "conv and agentId must be whole numbers");
  if (typeof name !== "string" || !name.trim() || name.length > 200) return fail(400, "name is required");
  const others = upsertStudioPresence({
    tab,
    conv: conv as number,
    agentId: agentId as number,
    name: name.trim(),
    typing: body.typing === true,
  });
  return NextResponse.json(
    {
      others,
      ttlMs: LIVE_PRESENCE_TTL_MS,
      typingTtlMs: LIVE_TYPING_TTL_MS,
      source: "linked",
    },
    { headers },
  );
}
