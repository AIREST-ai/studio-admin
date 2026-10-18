import { NextResponse } from "next/server";

import { toContact } from "@/lib/chatwoot/map";
import { readContacts } from "@/lib/chatwoot/server";
import type { LinkedContactsBody } from "@/lib/chatwoot-link-types";

import { failFrom, gate, headers, readOnly } from "../shared";

// L-2 phase 1: GET /api/chatwoot/contacts = every contact Chatwoot lists (GET /contacts, all pages).
// Chatwoot lists only contacts with an identifier, an email or a phone number (resolved_contacts).
export const dynamic = "force-dynamic";

export async function GET() {
  const closed = await gate("contacts");
  if (closed) return closed;
  try {
    const { payload, total } = await readContacts();
    const body: LinkedContactsBody = { contacts: payload.map(toContact), total };
    return NextResponse.json(body, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

export const POST = readOnly;
