// F159 settings-b: one set of names for Automation, Macros, SLA and Workflow.
// F161: taken from the shared layer (src/lib/cw/data.ts), the same agents, teams, inboxes and labels as every page.
import { agents, inboxes, labels, teams } from "@/lib/cw/data";

export const agentNames = agents.map((agent) => agent.name);
export const teamNames = teams.map((team) => team.name);
export const inboxNames = inboxes.map((inbox) => inbox.name);
export const labelNames = labels.map((label) => label.title);
export const priorityNames = ["None", "Low", "Medium", "High", "Urgent"];
export const statusNames = ["Open", "Pending", "Snoozed", "Resolved"];
export const languageNames = ["Arabic (ar)", "English (en)", "French (fr)", "Hindi (hi)", "Urdu (ur)"];
export const countryNames = ["Qatar", "United Arab Emirates", "Saudi Arabia", "Kuwait", "Bahrain", "Oman", "India"];
export const slaNames = ["Enterprise P0", "Enterprise P1", "VIP Doha", "Refund 24h", "Standard"];
