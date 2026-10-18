import { NextResponse } from "next/server";

import { DISCOUNT_ITEM_NAME, listItemNames } from "@/lib/bigcapital/server";

import { failFrom, headers } from "../shared";

// F-5B (condition 3): the names of Bigcapital's catalogue items, so the Send panel can say before "Create" which
// invoice lines will become new catalogue items. GET -> { items, discountItem }.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ items: await listItemNames(), discountItem: DISCOUNT_ITEM_NAME }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}
