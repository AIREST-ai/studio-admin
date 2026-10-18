import { NextResponse } from "next/server";

import { toConversation, toInboxNames } from "@/lib/chatwoot/map";
import {
  assignAgent,
  assignTeam,
  readConversation,
  readInboxes,
  readLabels,
  setStatus,
  writeLabels,
} from "@/lib/chatwoot/server";
import type { LinkedConversationBody, LinkedStatus } from "@/lib/chatwoot-link-types";

import { fail, failFrom, gate, headers, jsonBody, positiveId, readOnly, writeGate } from "../../shared";

// L-2 phase 1: GET /api/chatwoot/conversations/<display_id> (GET /api/v1/accounts/{a}/conversations/{id}).
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const closed = await gate("conversations");
  if (closed) return closed;
  const id = positiveId((await params).id);
  if (!id) return fail(400, { error: "conversation id is not valid" });
  try {
    const [raw, inboxes] = await Promise.all([readConversation(id), readInboxes()]);
    const body: LinkedConversationBody = { conversation: toConversation(raw, toInboxNames(inboxes)) };
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

const STATUSES: LinkedStatus[] = ["open", "resolved", "pending", "snoozed"];
function idOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}
/** A list of label names ([] when absent), or null when it is not one. */
function labelList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((label) => typeof label === "string" && label.trim() && label.length <= 255)) return null;
  return (value as string[]).map((label) => label.trim());
}

// L-3 phase 2: POST one action on the conversation in the test copy, then answer the conversation read again from it
// (so the page shows what Chatwoot kept, not what was asked):
//   {action:"status", status: open|resolved|pending|snoozed}   -> toggle_status
//   {action:"assign", assigneeId: <agent id> | null}           -> assignments (null = nobody)
//   {action:"team", teamId: <team id> | null}                  -> assignments (null = no team)
//   {action:"labels", add?: [..], remove?: [..]}               -> labels: the current list is read first and the
//      whole new list is sent, because Chatwoot's POST labels replaces the list (adding one keeps the others).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const closed = await writeGate(request, "conversations");
  if (closed) return closed;
  const id = positiveId((await params).id);
  if (!id) return fail(400, { error: "conversation id is not valid" });
  const input = await jsonBody(request);
  try {
    switch (input?.action) {
      case "status": {
        const status = input.status as LinkedStatus;
        if (!STATUSES.includes(status))
          return fail(400, { error: "status must be open, resolved, pending or snoozed" });
        await setStatus(id, status);
        break;
      }
      case "assign": {
        const assigneeId = idOrNull(input.assigneeId);
        if (assigneeId === undefined) return fail(400, { error: "assigneeId must be an agent id or null" });
        await assignAgent(id, assigneeId);
        break;
      }
      case "team": {
        const teamId = idOrNull(input.teamId);
        if (teamId === undefined) return fail(400, { error: "teamId must be a team id or null" });
        await assignTeam(id, teamId);
        break;
      }
      case "labels": {
        const add = labelList(input.add);
        const remove = labelList(input.remove);
        if (!add || !remove || (!add.length && !remove.length))
          return fail(400, { error: "labels needs add or remove, lists of label names" });
        const current = await readLabels(id);
        const next = [
          ...current.filter((label) => !remove.includes(label)),
          ...add.filter((l) => !current.includes(l)),
        ];
        await writeLabels(id, next);
        break;
      }
      default:
        return fail(400, { error: "action must be status, assign, team or labels" });
    }
    const [raw, inboxes] = await Promise.all([readConversation(id), readInboxes()]);
    const body: LinkedConversationBody = { conversation: toConversation(raw, toInboxNames(inboxes)) };
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export const PATCH = readOnly;
export const PUT = readOnly;
export const DELETE = readOnly;
