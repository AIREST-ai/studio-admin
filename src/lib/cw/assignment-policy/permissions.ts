// T-70: who may open the trial auto assignment. As in Chatwoot, assignment policy settings are for administrators.
// This reads the sample signed-in agent (CURRENT_USER_ID); the app has no login, so it is a display rule, not access
// protection. Owner-only control needs a real sign-in first.
export function canManageAssignment(agent: { role: "administrator" | "agent" } | undefined): boolean {
  return agent?.role === "administrator";
}
