"use client";
// F-6B (sim2 problems 4 and 5): keeps the pickers' names (settings-data.ts pickerNames) equal to the live shared lists
// of this page (src/lib/cw/store.ts: agents, teams, inboxes, labels) and the saved SLA policies (Settings > SLA), so
// an agent invited in Agents, a team made in Teams, a label or an SLA added in Settings can be picked at once in
// Automation, Macros, Conversation Workflow and Agent Assignment.
import * as React from "react";

import { useCwShared } from "@/lib/cw/store";

import { loadSlaPolicies, useSlaPolicies } from "../../sla/_components/sla-store";
import {
  type PickerNames,
  pickerNames,
  pickerNamesVersion,
  setPickerNames,
  subscribePickerNames,
} from "./settings-data";

function sync() {
  const lists = useCwShared.getState();
  setPickerNames({
    agents: lists.agents.map((agent) => agent.name),
    teams: lists.teams.map((team) => team.name),
    inboxes: lists.inboxes.map((inbox) => inbox.name),
    labels: lists.labels.map((label) => label.title),
    slas: useSlaPolicies.getState().policies.map((policy) => policy.name),
  });
}

let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  sync();
  useCwShared.subscribe(sync);
  useSlaPolicies.subscribe(sync);
  void loadSlaPolicies();
}

/**
 * The live names; the component draws again when any of them changes. The first draw after a page load uses the
 * names the server drew with (no hydration mismatch); the live ones follow right after.
 */
export function useLivePickerNames(): PickerNames {
  React.useEffect(start, []);
  React.useSyncExternalStore(subscribePickerNames, pickerNamesVersion, () => 0);
  return pickerNames();
}
