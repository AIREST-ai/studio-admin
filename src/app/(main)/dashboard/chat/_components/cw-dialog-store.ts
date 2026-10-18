"use client";

// F161: the dialog store and macro runner of the conversations area, apart from the dialogs themselves, so the
// command bar (cw-command-bar.tsx) and the dialogs (cw-dialogs.tsx) no longer import each other.
import { toast } from "sonner";
import { create } from "zustand";

import { getConversationTags, toggleTag } from "@/app/(main)/chat/_components/chat-tags-store";
import { canSeeMacro } from "@/lib/cw/macro-visibility";
import { SIMULATED } from "@/lib/cw/preview-sim";
import { useCwShared } from "@/lib/cw/store";
import { currentViewer } from "@/lib/cw/view-as";

import { conversationAttributeDefs, liveAgents, liveTeams, priorities, requiredOnResolve } from "./cw-data";
import { cw, useCwStore } from "./cw-store";
import {
  changeStatus,
  type KeepOutcome,
  keepMessage,
  type SnoozeKind,
  toggleBlock,
  whenKept,
} from "./sim-thread-persist";

export type CommandPage =
  | "root"
  | "snooze"
  | "assign-agent"
  | "assign-team"
  | "priority"
  | "add-label"
  | "remove-label"
  | "macro";

export type DialogState =
  | { type: "delete-conversation"; ids: number[] }
  | { type: "transcript"; id: number }
  | { type: "snooze"; ids: number[] }
  | { type: "bulk-agent"; ids: number[]; agentId: number | null }
  | { type: "bulk-team"; ids: number[]; teamId: string | null }
  // F-3: `contactId` = opened from that person's Contacts page ("Send message"), even when they have no conversation yet.
  | { type: "new-conversation"; contact?: string; inbox?: string; contactId?: number }
  | { type: "translate"; text: string }
  | { type: "add-canned"; text: string }
  | { type: "macro-preview"; macroId: number; convId: number }
  // F-8: the conversation too, so the delete is kept for that conversation's message (sim-thread-persist.ts).
  | { type: "delete-message"; convId: number; messageId: string }
  | { type: "edit-contact"; convId: number }
  | { type: "merge-contact"; convId: number }
  | { type: "delete-contact"; convId: number }
  | { type: "filter"; folderId?: string }
  | { type: "save-folder" }
  | { type: "delete-folder"; folderId: string }
  | { type: "whatsapp-templates"; onInsert: (text: string) => void }
  | { type: "articles"; onInsert: (text: string) => void }
  | { type: "shortcuts" }
  // F159 panel: Chatwoot command bar (⌘ K); `page` opens it straight on Snooze, Assign agent/team, Priority,
  // Add/Remove label or Execute macro, which is how those dialogs open from other places.
  | { type: "command"; convId?: number; page?: CommandPage }
  | { type: "contact-note"; convId: number }
  // F161: Chatwoot ConversationResolveAttributesModal; `missing` are the required attribute keys still empty.
  | { type: "resolve-attributes"; convId: number; missing: string[] };

export const useDialogStore = create<{ dialog: DialogState | null }>(() => ({ dialog: null }));

export function openDialog(dialog: DialogState) {
  useDialogStore.setState({ dialog });
}

export function closeDialog() {
  useDialogStore.setState({ dialog: null });
}

// F161: Chatwoot checkMissingAttributes (useConversationRequiredAttributes.js): the required conversation attributes
// that are empty, or whose value fails the attribute's regex.
export function missingResolveAttributes(convId: number): string[] {
  const values = useCwStore.getState().conversationAttrs[convId] ?? {};
  return requiredOnResolve
    .filter((attr) => conversationAttributeDefs.some((def) => def.key === attr.key))
    .filter(({ key, regex }) => {
      const value = (values[key] ?? "").trim();
      return value === "" || (regex !== undefined && !regex.test(value));
    })
    .map((attr) => attr.key);
}

// F161: Resolve one conversation the Chatwoot way (ResolveAction.vue, ChatList.vue, commandbar.vue): when required
// attributes are missing the "Resolve conversation" dialog opens instead, and it resolves after they are filled.
// Returns true when the conversation was resolved right away.
export function resolveConversation(convId: number): boolean {
  const missing = missingResolveAttributes(convId);
  if (missing.length > 0) {
    openDialog({ type: "resolve-attributes", convId, missing });
    return false;
  }
  // F-5A: kept in the preview; the toast ("Conversation status changed", simulated) comes once it is saved.
  void changeStatus([convId], "resolved");
  return true;
}

// F-5A (sim1 8.14d: "Refund approved" said it ran, but its billing label was not kept): Chatwoot's macro add_label /
// remove_label (app/services/action_service.rb) work on the account's labels by name. The label goes on the conversation
// through the same tags store the label picker uses, which the panel edits keep (sim-panel-persist.ts).
// F-8: also returns the names that match no label, so the macro can say which were not added or removed.
function labelIdsOf(value: string): { ids: string[]; missing: string[] } {
  const labels = useCwShared.getState().labels;
  const ids: string[] = [];
  const missing: string[] = [];
  for (const name of value
    .split(",")
    .map((each) => each.trim())
    .filter(Boolean)) {
    const label = labels.find((each) => each.title.toLowerCase() === name.toLowerCase());
    if (label) ids.push(label.id);
    else missing.push(name);
  }
  return { ids, missing };
}

function setLabels(convId: number, value: string, on: boolean): string[] {
  const current = getConversationTags()[String(convId)] ?? [];
  const { ids, missing } = labelIdsOf(value);
  for (const id of ids) if (current.includes(id) !== on) toggleTag(String(convId), id);
  return missing;
}

const quoteNames = (names: string[]) => names.map((name) => `“${name}”`).join(", ");

/**
 * F-8 (sim3 8.14e): the team a macro's "Assign a Team" names, by name as the macro editor saves it. "None" (or empty)
 * removes the team, as Chatwoot's assign_team does for an empty or nil id. A team that does not exist is never
 * swapped for another one: Chatwoot skips the action (ActionService#assign_team returns unless the team belongs to the
 * account, https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/services/action_service.rb), and here the macro also
 * says so.
 */
export function macroTeam(
  value: string,
  teams: { id: string; name: string }[] = liveTeams(),
): { kind: "none" } | { kind: "team"; id: string } | { kind: "missing" } {
  const name = value.trim();
  if (!name || name.toLowerCase() === "none") return { kind: "none" };
  const team = teams.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return team ? { kind: "team", id: team.id } : { kind: "missing" };
}

// Macros from Settings > Macros, run on one conversation. F-5A: what they do is kept in the preview like the same
// change made by hand (labels, team, agent and priority by the panel edits; messages, notes and status by
// sim-thread-persist.ts), and nothing reaches Chatwoot or the customer.
// F-8 (sim3 8.14e: "Escalate to Technical" put the conversation in another team and said "Macro executed successfully"):
// an action that cannot be done (a team, agent or label that does not exist, or an action this preview cannot run) is
// skipped, the other actions still run (as Chatwoot's Macros::ExecutionService runs each action on its own), and the
// message names each skipped action instead of saying every action succeeded.
// F-8 (monitor): the macro waits for every save its actions started (the panel edits, each message or note, the status,
// the block) and only then says what happened: "successfully" only when all of them were saved; otherwise it names
// each action whose save failed. Until then it says it is running.
export async function runMacro(macroId: number, convId: number): Promise<void> {
  // F-19: only the macros Settings > Macros saved; one deleted there (this page still showing it) says so.
  const macro = useCwShared.getState().macros.find((m) => m.id === macroId);
  if (!macro) {
    toast.error("Macro not run", {
      description: "This macro is no longer in Settings > Macros (it was deleted), so nothing was changed.",
    });
    return;
  }
  // F-24: another person's private macro does not run (Chatwoot MacroPolicy#execute?: global or its author), whoever
  // the page is viewed as. The lists do not offer it (lib/cw/macro-visibility.ts); this covers a stale page.
  if (!canSeeMacro(macro, currentViewer(), useCwShared.getState().agents)) {
    toast.error("Macro not run", {
      description: "This macro is private: only the agent who created it can run it. Nothing was changed.",
    });
    return;
  }
  const toastId = `macro-${macroId}-${convId}-${Date.now()}`;
  toast.loading(`Running “${macro.name}”…`, { id: toastId, description: "Saving each action in this preview." });
  // F-8 round 2 (judge: with the panel save refused, "Hand over to Sales" said "2 of 3 actions not done … The other
  // action ran and was saved" while nothing was saved): every action has its own result. An action is done only when
  // it was not skipped and every save it took part in was answered; one failed panel save makes each action in it
  // "not done", and "ran and was saved" counts only the actions that are done.
  const total = macro.actions.length;
  const done = macro.actions.map(() => true);
  const reasons: string[] = [];
  const skip = (index: number, reason: string) => {
    done[index] = false;
    reasons.push(reason);
  };
  // the actions whose change goes with the panel edits (one save for all of them, below), by their place in the macro
  const panelActions: number[] = [];
  const saves: { actions: number[]; saved: Promise<KeepOutcome> }[] = [];
  const statusSave = (index: number, saved: Promise<boolean>) =>
    saves.push({
      actions: [index],
      saved: saved.then(
        (ok): KeepOutcome => (ok ? { ok: true } : { ok: false, message: "the status change was not saved" }),
      ),
    });
  for (const [index, action] of macro.actions.entries()) {
    switch (action.action) {
      case "Add a Label":
      case "Remove a Label": {
        const missing = setLabels(convId, action.value, action.action === "Add a Label");
        panelActions.push(index);
        if (missing.length)
          skip(
            index,
            `${action.action}: ${missing.length === 1 ? "the label" : "the labels"} ${quoteNames(missing)} ${missing.length === 1 ? "does" : "do"} not exist, so ${missing.length === 1 ? "it was" : "they were"} not ${action.action === "Add a Label" ? "added" : "removed"}`,
          );
        break;
      }
      case "Assign an Agent": {
        const name = action.value.trim();
        if (!name || name.toLowerCase() === "none") cw.assignAgent([convId], null);
        else if (name.toLowerCase() === "self") cw.assignAgent([convId], currentViewer().id);
        else {
          const agent = liveAgents().find((a) => a.name.toLowerCase() === name.toLowerCase());
          if (!agent) {
            skip(index, `Assign an Agent: the agent “${name}” does not exist, so no agent was assigned`);
            break;
          }
          cw.assignAgent([convId], agent.id);
        }
        panelActions.push(index);
        break;
      }
      case "Assign a Team": {
        const team = macroTeam(action.value);
        if (team.kind === "missing") {
          skip(
            index,
            `Assign a Team: the team “${action.value.trim()}” does not exist, so the conversation was not assigned to a team`,
          );
          break;
        }
        cw.assignTeam([convId], team.kind === "team" ? team.id : null);
        panelActions.push(index);
        break;
      }
      case "Remove Assigned Agent":
        cw.assignAgent([convId], null);
        panelActions.push(index);
        break;
      case "Remove Assigned Team":
        cw.assignTeam([convId], null);
        panelActions.push(index);
        break;
      case "Change Priority":
        cw.setPriority([convId], priorities.find((p) => p.label === action.value)?.value ?? "high");
        panelActions.push(index);
        break;
      case "Send a Message":
      case "Add a Private Note": {
        const id = keepMessage(convId, {
          kind: action.action === "Send a Message" ? "outgoing" : "note",
          text: action.value,
        });
        saves.push({ actions: [index], saved: whenKept(id) });
        break;
      }
      case "Resolve Conversation": {
        // Chatwoot asks for the required attributes first; then the conversation is resolved from that window.
        const missing = missingResolveAttributes(convId);
        if (missing.length) {
          openDialog({ type: "resolve-attributes", convId, missing });
          skip(
            index,
            "Resolve Conversation: required attributes are empty, so the conversation is not resolved yet; it is resolved from the window that opened, once they are filled",
          );
        } else statusSave(index, changeStatus([convId], "resolved", { quiet: true }));
        break;
      }
      case "Snooze Conversation": {
        const kinds: Record<string, SnoozeKind> = { "next week": "next_week", tomorrow: "tomorrow" };
        statusSave(
          index,
          changeStatus([convId], "snoozed", {
            snooze: kinds[action.value.trim().toLowerCase()] ?? "next_reply",
            quiet: true,
          }),
        );
        break;
      }
      case "Mute Conversation":
        // Chatwoot ActionService mute_conversation: conversation.mute! (block the contact, resolve).
        if (!useCwStore.getState().muted[convId]) saves.push({ actions: [index], saved: toggleBlock(convId) });
        break;
      default:
        // Send an Email Transcript, Send Attachment, Send Webhook Event: nothing in this preview runs them.
        skip(index, `${action.action}: this preview does not run it, so nothing was sent`);
        break;
    }
  }
  if (panelActions.length)
    saves.push({
      actions: panelActions,
      // Loaded where the conversations are (the panel edits module, already running there); imported here on demand
      // so the pages that only open dialogs from the sidebar do not start it.
      saved: import("./sim-panel-persist").then(({ savePanelEditsNow }) => savePanelEditsNow()),
    });
  const outcomes = await Promise.all(saves.map(async ({ actions, saved }) => ({ actions, outcome: await saved })));
  for (const { actions, outcome } of outcomes) {
    if (outcome.ok) continue;
    for (const index of actions) done[index] = false;
    const names = [...new Set(actions.map((index) => macro.actions[index].action))];
    reasons.unshift(
      `${names.join(", ")}: not saved in the preview (${outcome.message}), so ${actions.length === 1 ? "it" : "they"} will be gone after a reload`,
    );
  }
  const ran = done.filter(Boolean).length;
  if (ran === total) {
    toast.success("Macro executed successfully", {
      id: toastId,
      description: `${SIMULATED}: every action was applied to this conversation and saved in this preview. Nothing was sent to the customer or changed in the engine.`,
    });
    return;
  }
  const notDone = total - ran;
  const failed = outcomes.some(({ outcome }) => !outcome.ok);
  const show = failed ? toast.error : toast.warning;
  show(
    ran
      ? `Macro executed: ${notDone} of ${total} ${total === 1 ? "action" : "actions"} not done`
      : total === 1
        ? "Macro not done: its one action was not done"
        : `Macro not done: none of its ${total} actions was done`,
    {
      id: toastId,
      duration: 20_000,
      description: `${reasons.join(". ")}. ${
        ran
          ? `The other ${ran === 1 ? "action ran and was" : `${ran} actions ran and were`} saved (${SIMULATED}: in this preview, nothing sent to the customer or changed in the engine).`
          : "Nothing was saved."
      }`,
    },
  );
}
