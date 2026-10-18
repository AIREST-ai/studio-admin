// M129-E: browser side for the few actions that live only in the browser and have no save route of their own
// (see CLIENT_ACTIONS in ./describe.ts). They are sent to POST /api/audit-log, which records them through the same
// server wrapper as every other change. Resolves false when the preview server did not accept the record.
export type ClientAuditAction = "contact.block" | "contact.unblock";

export async function recordClientAction(
  action: ClientAuditAction,
  target: { id: string | number; name: string },
): Promise<boolean> {
  try {
    const response = await fetch("/api/audit-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, target }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
