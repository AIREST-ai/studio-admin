"use client";

// F-24 (F-19's note): which macros a person sees, as in Chatwoot v4.18.0.
// - app/models/macro.rb `with_visibility`: the macros list is the global (Public) macros plus the person's own personal
//   (Private) ones (`personal.where(created_by_id: user.id)`); an administrator does not see other people's private
//   macros either. https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/models/macro.rb#L42-L46
// - app/policies/macro_policy.rb `show?` and `execute?`: `@record.global? || author?`, so a private macro opens and runs
//   only for its creator. https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/policies/macro_policy.rb#L10-L28
// "The person" is whom the page is viewed as (View as, ./view-as.ts), the signed-in administrator otherwise.
import type { Macro } from "@/app/(main)/dashboard/settings/macros/_components/data";

import { type Agent, agents as seedAgents } from "./data";
import { useCwShared } from "./store";
import { useViewer, type Viewer } from "./view-as";

/**
 * The creator's agent id (Chatwoot `created_by_id`). Macros saved before F-24 carry only the creator's name, so it is
 * looked up by that name in Settings > Agents, then in the sample agents.
 */
export function macroCreatorId(macro: Macro, agents: readonly Pick<Agent, "id" | "name">[]): number | null {
  if (typeof macro.createdById === "number") return macro.createdById;
  const byName = (list: readonly Pick<Agent, "id" | "name">[]) => list.find((agent) => agent.name === macro.createdBy);
  return (byName(agents) ?? byName(seedAgents))?.id ?? null;
}

/** Chatwoot MacroPolicy#show? / #execute?: a public macro, or a private one the person created. */
export function canSeeMacro(
  macro: Macro,
  viewer: Pick<Viewer, "id">,
  agents: readonly Pick<Agent, "id" | "name">[],
): boolean {
  return macro.visibility === "Public" || macroCreatorId(macro, agents) === viewer.id;
}

/**
 * F-26 (judge F-24 note 1): Chatwoot v4.18.0 app/models/macro.rb#set_visibility sets `visibility = :personal if user.agent?`,
 * so only an administrator may make a macro Public; an agent's macros are always Private.
 */
export function canChoosePublicMacro(viewer: Pick<Viewer, "role">): boolean {
  return viewer.role === "administrator";
}

/**
 * F-26 (judge F-24 note 1): Chatwoot v4.18.0 app/policies/macro_policy.rb `update?` and `destroy?`:
 * `return @account_user.administrator? if @record.global?` else `author?`.
 * A Public macro can be edited or deleted only by an administrator; a Private macro only by its creator.
 */
export function canManageMacro(
  macro: Macro,
  viewer: Pick<Viewer, "id" | "role">,
  agents: readonly Pick<Agent, "id" | "name">[],
): boolean {
  if (macro.visibility === "Public") return viewer.role === "administrator";
  return macroCreatorId(macro, agents) === viewer.id;
}

/** Chatwoot Macro.with_visibility: the macros this person's lists show. */
export function visibleMacros(
  macros: readonly Macro[],
  viewer: Pick<Viewer, "id">,
  agents: readonly Pick<Agent, "id" | "name">[],
): Macro[] {
  return macros.filter((macro) => canSeeMacro(macro, viewer, agents));
}

/** The saved macros (Settings > Macros) the person the page is viewed as may see. */
export function useVisibleMacros(): Macro[] {
  const macros = useCwShared((state) => state.macros);
  const agents = useCwShared((state) => state.agents);
  const viewer = useViewer();
  return visibleMacros(macros, viewer, agents);
}
