import { NextResponse } from "next/server";

import { readLinkState } from "@/lib/chatwoot/mode";
import { getLastCwEventAt } from "@/lib/chatwoot/realtime-bus";
import { ChatwootError, chatwootTarget, checkIdentity, problemOf, readVersion } from "@/lib/chatwoot/server";
import type { LinkStatus } from "@/lib/chatwoot-link-types";

import { headers } from "../shared";

// L-2 + V-7B: GET /api/chatwoot/status, read by the "Live Engine" card.
// Preview mode: the switch only, and the live engine is NOT called.
// Linked: address lock, then GET /api (reachable? version 4.18.0?), then the token, then the identity check
// (profile email and account), plus lastEventAt from the realtime webhook bus.
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readLinkState();
  const status: LinkStatus = {
    ...state,
    connected: false,
    target: null,
    reachable: null,
    version: null,
    identity: null,
    problem: null,
    lastEventAt: null,
    checkedAt: null,
  };
  if (state.mode !== "linked" || state.disabled) return NextResponse.json(status, { headers });

  status.checkedAt = new Date().toISOString();
  status.lastEventAt = await getLastCwEventAt();
  try {
    status.target = chatwootTarget().host;
    status.version = await readVersion();
    status.reachable = true;
    status.identity = await checkIdentity(true);
    status.connected = true;
  } catch (error) {
    status.connected = false;
    status.problem = problemOf(error);
    if (error instanceof ChatwootError && error.kind === "unreachable") status.reachable = false;
  }
  return NextResponse.json(status, { headers });
}
