import { NextResponse } from "next/server";

import { toMessage } from "@/lib/chatwoot/map";
import { readMessages, sendMessage } from "@/lib/chatwoot/server";
import type { LinkedMessageBody, LinkedMessagesBody } from "@/lib/chatwoot-link-types";

import { fail, failFrom, gate, headers, jsonBody, positiveId, writeGate } from "../../../shared";

// L-2 phase 1: GET /api/chatwoot/conversations/<display_id>/messages = every message, oldest first, private notes
// and activity messages included (server.ts readMessages: GET .../messages?after=<last id>).
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const closed = await gate("conversations");
  if (closed) return closed;
  const id = positiveId((await params).id);
  if (!id) return fail(400, { error: "conversation id is not valid" });
  try {
    const body: LinkedMessagesBody = { messages: (await readMessages(id)).map((raw) => toMessage(raw, id)) };
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

// L-3 phase 2: POST {content, private} = a reply (private false) or a private note (private true) in the test copy
// (server.ts sendMessage). The answer is the message Chatwoot created; any failure is its words, never a success.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const closed = await writeGate(request, "conversations");
  if (closed) return closed;
  const id = positiveId((await params).id);
  if (!id) return fail(400, { error: "conversation id is not valid" });
  const input = await jsonBody(request);
  const content = typeof input?.content === "string" ? input.content.trim() : "";
  if (!content) return fail(400, { error: "the message is empty" });
  if (content.length > 10_000) return fail(400, { error: "the message is longer than 10000 characters" });
  try {
    const body: LinkedMessageBody = { message: toMessage(await sendMessage(id, content, input?.private === true), id) };
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
