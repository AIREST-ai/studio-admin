import { NextResponse } from "next/server";

import { toConversation, toInboxNames } from "@/lib/chatwoot/map";
import { readConversations, readInboxes } from "@/lib/chatwoot/server";
import type { LinkedConversationsBody } from "@/lib/chatwoot-link-types";

import { failFrom, gate, headers, readOnly } from "../shared";

// L-2 phase 1: GET /api/chatwoot/conversations = every conversation of the test copy (status=all), mapped.
// 409 in preview mode or when "conversations" is not linked; the test copy is then not called.
export const dynamic = "force-dynamic";

export async function GET() {
  const closed = await gate("conversations");
  if (closed) return closed;
  try {
    const [{ payload, total }, inboxes] = await Promise.all([readConversations(), readInboxes()]);
    const names = toInboxNames(inboxes);
    const body: LinkedConversationsBody = {
      conversations: payload.map((raw) => toConversation(raw, names)),
      total,
      source: "GET /api/v1/accounts/{account}/conversations?status=all",
    };
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export const POST = readOnly;
