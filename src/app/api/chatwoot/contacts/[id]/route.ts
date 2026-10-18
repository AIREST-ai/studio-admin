import { NextResponse } from "next/server";

import { toContact, toConversation, toInboxNames } from "@/lib/chatwoot/map";
import { readContact, readContactConversations, readInboxes } from "@/lib/chatwoot/server";
import type { LinkedContactBody } from "@/lib/chatwoot-link-types";

import { fail, failFrom, gate, headers, positiveId, readOnly } from "../../shared";

// L-2 phase 1: GET /api/chatwoot/contacts/<id> = the contact and its conversations
// (GET /contacts/{id} and GET /contacts/{id}/conversations, the "Conversations" of phase 1 condition 3).
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const closed = await gate("contacts");
  if (closed) return closed;
  const id = positiveId((await params).id);
  if (!id) return fail(400, { error: "contact id is not valid" });
  try {
    const [raw, conversations, inboxes] = await Promise.all([
      readContact(id),
      readContactConversations(id),
      readInboxes(),
    ]);
    const names = toInboxNames(inboxes);
    const body: LinkedContactBody = {
      contact: toContact(raw),
      conversations: conversations.map((each) => toConversation(each, names)),
    };
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export const PATCH = readOnly;
export const PUT = readOnly;
export const DELETE = readOnly;
