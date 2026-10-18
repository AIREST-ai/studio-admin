import { NextResponse } from "next/server";

import { taskFromMessage } from "@/lib/twenty/server";

import { fail, failFrom, headers, isId, readJson, sameOrigin, str } from "../shared";

// M129-F (Fahad 129.6 "can a message become a task?"): POST { message, conversation, contact, title, assigneeId }
// creates a Twenty task holding the message text, the conversation link and the contact, and links the contact as
// a Twenty Person. The pattern of Zendesk -> Jira "Create issue" and Front -> Asana "Create task".
// F-8 (sim3 8.12b, 11.1c): conversation.channelType and conversation.orderNumber fill the task's Channel and Order
// number fields, and agentName names a site agent (kept in the task's "Studio agent" field, lib/twenty/server.ts).
// The answer says what each field got (`fields`), including what could not be set.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const body = await readJson<Record<string, Record<string, unknown> | unknown>>(request);
  const message = (body?.message ?? {}) as Record<string, unknown>;
  const conversation = (body?.conversation ?? {}) as Record<string, unknown>;
  const contact = (body?.contact ?? {}) as Record<string, unknown>;
  const messageText = str(message.text, 5000);
  const conversationId = Number(conversation.id);
  if (!messageText) return fail(400, "the message has no text");
  if (!Number.isInteger(conversationId) || conversationId < 1) return fail(400, "conversation id is required");
  const origin = request.headers.get("origin") ?? `http://${request.headers.get("host")}`;
  const title = str(body?.title, 300) || messageText.split("\n")[0].slice(0, 120);
  if (body?.assigneeId !== null && body?.assigneeId !== undefined && !isId(body.assigneeId))
    return fail(400, "assigneeId is not valid");
  try {
    const result = await taskFromMessage({
      title,
      assigneeId: (body?.assigneeId as string | null | undefined) ?? null,
      messageText,
      sender: str(message.sender, 120) || "Customer",
      time: str(message.time, 40),
      conversationId,
      conversationUrl: `${origin}/dashboard/chat/conversations/${conversationId}`,
      channel: str(conversation.channel, 40) || "chat",
      channelType: str(conversation.channelType, 40),
      orderNumber: str(conversation.orderNumber, 120),
      agentName: str(body?.agentName, 120),
      contact: {
        name: str(contact.name, 120),
        email: str(contact.email, 160),
        phone: str(contact.phone, 40),
        company: str(contact.company, 120),
      },
    });
    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    return failFrom(error);
  }
}
