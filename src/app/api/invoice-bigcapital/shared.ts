import { NextResponse } from "next/server";

import { BigcapitalError } from "@/lib/bigcapital/server";
import { ownNames } from "@/lib/own-names";

// M129-D: helpers shared by the /api/invoice-bigcapital routes (the preview's bridge to the local Bigcapital).
export const headers = { "Cache-Control": "no-store" };

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

export function failFrom(error: unknown) {
  // F-16: errors reach the page in the product's words, never naming the system behind it (lib/own-names.ts).
  if (error instanceof BigcapitalError) return fail(error.status, ownNames(error.message));
  return fail(500, ownNames((error as Error).message) || "unexpected error");
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function readJson<T>(request: Request, maxBytes = 60_000): Promise<T | null> {
  const body = await request.text();
  if (body.length > maxBytes) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export const str = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
