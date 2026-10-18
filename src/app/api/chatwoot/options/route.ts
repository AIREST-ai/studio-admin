import { NextResponse } from "next/server";

import { toOptions } from "@/lib/chatwoot/map";
import { readAccountLabels, readAgents, readTeams } from "@/lib/chatwoot/server";
import type { LinkedOptionsBody } from "@/lib/chatwoot-link-types";

import { failFrom, gate, headers } from "../shared";

// L-3 phase 2: GET /api/chatwoot/options = the agents, teams and account labels of the test copy, names and ids only,
// for the assign and label pickers of a linked conversation (GET /agents, /teams, /labels).
export const dynamic = "force-dynamic";

export async function GET() {
  const closed = await gate("conversations");
  if (closed) return closed;
  try {
    const [agents, teams, labels] = await Promise.all([readAgents(), readTeams(), readAccountLabels()]);
    const body: LinkedOptionsBody = toOptions(agents, teams, labels);
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
