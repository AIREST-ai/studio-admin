"use client";
// F161 settings-a: one inboxes list for the Inboxes list, the add-inbox wizard and the inbox settings page.
// F161 foundation: backed by the shared inboxes (src/lib/cw/store.ts), so the sidebar Channels list and Conversations
// see a created, edited or deleted inbox.
import * as React from "react";

import type { Inbox } from "@/lib/cw/data";
import { cwListStore, setCwList, useCwShared, whenListsSaved } from "@/lib/cw/store";

import { useListStore } from "../../_components/list-store";
import type { Agent } from "./data";

export const inboxesStore = cwListStore("inboxes");
export const useInboxes = () => useListStore(inboxesStore);

// T-223: an inbox's own settings (Settings tab, Business Hours, CSAT) are kept on the inbox row as `config`, so they
// are saved to the preview server's disk with the shared inboxes list and come back after a reload. Preview only:
// nothing here reaches Chatwoot. A section that was never saved is absent, and the page shows its defaults.
export interface InboxProfileSettings {
  /** A small data: URL image, or null for the initials. */
  avatar: string | null;
  color: string;
  websiteDomain: string;
  welcomeHeading: string;
  welcomeTagline: string;
  replyTime: string;
  helpCenter: string;
  greetingEnabled: boolean;
  greetingMessage: string;
  emailCollect: boolean;
  allowMessagesAfterResolved: boolean;
  continuityViaEmail: boolean;
  lockToSingleConversation: boolean;
  /** Labels of the ticked "Widget features" boxes. */
  widgetFeatures: string[];
  // T-223 round 2: widget bubble and sender name. Optional, so an inbox saved before them reads the defaults.
  bubblePosition?: string;
  bubbleType?: string;
  launcherTitle?: string;
  senderNameType?: string;
  senderBusinessName?: string;
}

export interface DayHours {
  day: string;
  open: boolean;
  allDay: boolean;
  from: string;
  to: string;
}

export interface BusinessHoursSettings {
  enabled: boolean;
  message: string;
  timezone: string;
  days: DayHours[];
}

export interface CsatSettings {
  enabled: boolean;
  display: string;
  message: string;
  buttonText: string;
  language: string;
  ruleOperator: string;
  ruleLabels: string[];
}

export interface InboxConfig {
  profile?: InboxProfileSettings;
  businessHours?: BusinessHoursSettings;
  csat?: CsatSettings;
}

export const inboxConfig = (inbox: Inbox): InboxConfig => (inbox as Inbox & { config?: InboxConfig }).config ?? {};

/** Saves one settings section of an inbox (and, with `patch`, its own fields such as the name) in one write. */
export function saveInboxConfig<K extends keyof InboxConfig>(
  id: number,
  section: K,
  value: NonNullable<InboxConfig[K]>,
  patch: Partial<Inbox> = {},
): Promise<void> {
  const saved = whenSaved();
  setCwList("inboxes", (list) =>
    list.map((inbox) =>
      inbox.id === id ? { ...inbox, ...patch, config: { ...inboxConfig(inbox), [section]: value } } : inbox,
    ),
  );
  return saved;
}

/**
 * Resolves when the preview server has answered the next save, rejects with its reason when it failed, so a
 * page says "updated" only after the disk has the change. F-6B: only a conflict on the inboxes list itself rejects.
 */
export function whenSaved(timeoutMs = 15000): Promise<void> {
  return whenListsSaved(["inboxes"], timeoutMs);
}

/**
 * F-6B (sim2 problem 5): the agents an inbox or team picker offers, from the live shared agents list (Settings >
 * Agents), so an agent invited there can be added at once; `./data` agents is only the seed.
 */
export function useAgentRoster(): Agent[] {
  const list = useCwShared((state) => state.agents);
  return React.useMemo(
    () =>
      list.map((agent) => ({
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role === "administrator" ? "Administrator" : "Agent",
      })),
    [list],
  );
}
