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

// F-6B (sim2 problems 4 and 5, Fahad 129.2 "the buttons and how they connect"): the names a picker offers must be the
// live shared lists (an invited agent, a new team, label or SLA), not the seed copies above, which are only the
// starting values. live-picker-names.ts keeps `pickerNames()` in step with the shared lists in the browser; plain data
// here, so the Automation catalog that reads it still loads outside the browser (its tests).
export interface PickerNames {
  agents: string[];
  teams: string[];
  inboxes: string[];
  labels: string[];
  slas: string[];
}

const current: PickerNames = {
  agents: agentNames,
  teams: teamNames,
  inboxes: inboxNames,
  labels: labelNames,
  slas: slaNames,
};
const listeners = new Set<() => void>();
let version = 0;

/** The names each picker offers right now. */
export const pickerNames = (): PickerNames => current;

/** Replaces some of the names (from the live lists) and tells the pickers to draw again. */
export function setPickerNames(next: Partial<PickerNames>): void {
  let changed = false;
  for (const key of Object.keys(next) as (keyof PickerNames)[]) {
    const names = next[key];
    if (!names || JSON.stringify(names) === JSON.stringify(current[key])) continue;
    current[key] = names;
    changed = true;
  }
  if (!changed) return;
  version += 1;
  for (const listener of [...listeners]) listener();
}

export function subscribePickerNames(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const pickerNamesVersion = () => version;
