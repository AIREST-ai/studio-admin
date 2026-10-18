import { NextResponse } from "next/server";

import { ownNames } from "@/lib/own-names";
import { type TaskInput, TwentyError } from "@/lib/twenty/server";

// M129-F: helpers shared by the /api/tasks-twenty routes (the preview's bridge to the local Twenty install).
export const headers = { "Cache-Control": "no-store" };

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

export function failFrom(error: unknown) {
  // F-16: errors reach the page in the product's words, never naming the system behind it (lib/own-names.ts).
  if (error instanceof TwentyError) return fail(error.status, ownNames(error.message));
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

const ID = /^[0-9a-f-]{36}$/i;
export const isId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

/** Only the fields the page may write; anything else is refused, not ignored. */
export function taskInputFrom(raw: unknown, creating: boolean): TaskInput | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "task must be an object";
  const record = raw as Record<string, unknown>;
  const allowed = ["title", "status", "assigneeId", "dueAt", "body", "position", "custom"];
  const extra = Object.keys(record).filter((key) => !allowed.includes(key));
  if (extra.length) return `unknown fields: ${extra.join(", ")}`;
  const input: TaskInput = {};
  if ("title" in record || creating) {
    const title = str(record.title, 300);
    if (!title) return "title is required";
    input.title = title;
  }
  if ("status" in record) {
    if (typeof record.status !== "string" || !/^[A-Z0-9_]{1,63}$/.test(record.status)) return "status is not valid";
    input.status = record.status;
  }
  if ("assigneeId" in record) {
    if (record.assigneeId !== null && !isId(record.assigneeId)) return "assigneeId is not valid";
    input.assigneeId = record.assigneeId as string | null;
  }
  if ("dueAt" in record) {
    if (record.dueAt !== null && (typeof record.dueAt !== "string" || Number.isNaN(Date.parse(record.dueAt))))
      return "dueAt must be a date or null";
    input.dueAt = record.dueAt as string | null;
  }
  if ("body" in record) input.body = str(record.body, 20_000);
  if ("position" in record) {
    if (typeof record.position !== "number" || !Number.isFinite(record.position)) return "position must be a number";
    input.position = record.position;
  }
  if ("custom" in record) {
    if (!record.custom || typeof record.custom !== "object" || Array.isArray(record.custom))
      return "custom must be an object";
    const custom: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(record.custom as Record<string, unknown>)) {
      if (!/^[a-z][A-Za-z0-9]{0,62}$/.test(name)) return `custom field ${name} is not valid`;
      if (value !== null && !["string", "number", "boolean"].includes(typeof value))
        return `custom field ${name} has a bad value`;
      custom[name] = typeof value === "string" ? value.slice(0, 2000) : value;
    }
    input.custom = custom;
  }
  return input;
}
