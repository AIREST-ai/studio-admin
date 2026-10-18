// U-1: `permissionsOf` moved here, out of ./view-as.ts, without a change to its rules. ./view-as.ts is a client module
// ("use client", React context), and a route handler cannot call a function of a client module (Next.js turns it into a
// client reference on the server). The /api/cw gateway (src/app/api/cw/[...path]/route.ts) needs the same rules on the
// server, so they live in this plain module and ./view-as.ts re-exports them: every existing import keeps working.
import { type Role, roles as seedRoles } from "@/app/(main)/dashboard/roles/_components/roles-table/data";

import type { Agent } from "./data";

/** Chatwoot AccountUser#permissions (with the enterprise custom-role override). */
export function permissionsOf(
  agent: Pick<Agent, "role" | "customRoleId">,
  roles: readonly Role[] = seedRoles,
): string[] {
  if (agent.role === "administrator") return ["administrator"];
  const custom = agent.customRoleId ? roles.find((role) => role.customRoleId === agent.customRoleId) : undefined;
  if (custom) return [...custom.permissions, "custom_role"];
  return ["agent"];
}
