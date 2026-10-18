"use client";

// F-10b (Fahad item 51b: notifications for everything): "Resend invite" is recorded as an event in the preview's
// activity log (POST /api/agent-invite, which logs it through the one audit wrapper). The log's events are the
// notifications, so a Sign-ups notification appears in the bell and in My Inbox. The preview sends no email; the
// request says so and the row menu's own notice (users.tsx) repeats it. Nothing here claims a save that failed.
import { toast } from "sonner";

import { loadFeed } from "@/app/(main)/dashboard/notifications/_components/notifications-store";

import type { UserRow } from "./data";

export async function recordInviteResend(agent: Pick<UserRow, "id" | "name" | "email">): Promise<boolean> {
  try {
    const response = await fetch("/api/agent-invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: agent.id }),
      keepalive: true,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `the preview server answered ${response.status}`);
    }
    // The log takes a moment to list the new event; read the bell's notifications again after that.
    window.setTimeout(() => void loadFeed(), 1500);
    window.setTimeout(() => void loadFeed(), 5000);
    return true;
  } catch (error) {
    toast.error(`Could not record the invite for ${agent.name}`, {
      id: `resend-invite-${agent.id}`,
      description: `${(error as Error).message}. No notification was made.`,
    });
    return false;
  }
}
