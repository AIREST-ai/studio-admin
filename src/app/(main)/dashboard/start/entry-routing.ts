export function landingFor(input: {
  role: "administrator" | "agent";
  savedSummary: boolean;
  hasInboxes?: boolean;
  isNew?: boolean;
}) {
  if (input.role === "agent") return "/dashboard/chat";
  if (!input.isNew && (input.savedSummary || input.hasInboxes)) return "/dashboard/reports/summary";
  return "/dashboard/start";
}
