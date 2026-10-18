"use client";

// L-2 (plan r1-chatwoot-link/خطة.md 2.2): the "Preview" / "Linked" switch in the browser. The dashboard layout reads
// .preview-state/chatwoot-link.json on the server and hands it here, so a linked section renders linked from the
// first byte (no flash of preview data shown as linked, phase 1 conditions 4 and 6) and preview mode renders exactly
// as before with no request at all. The card's switch updates it here and refreshes the server render.
import * as React from "react";

import { disableLinkedStoreAdapter, enableLinkedStoreAdapter } from "@/lib/chatwoot/store-adapter";
import type { LinkSection, LinkState } from "@/lib/chatwoot-link-types";
import { linkedSession, setLinkedSession } from "@/lib/cw/persistence/client";

const PREVIEW: LinkState = {
  mode: "preview",
  sections: {
    conversations: false,
    contacts: false,
    lists: false,
    automation: false,
    reports: false,
    notifications: false,
  },
  changedAt: null,
  disabled: false,
};

const LinkContext = React.createContext<{ state: LinkState; setState: (state: LinkState) => void }>({
  state: PREVIEW,
  setState: () => undefined,
});

function isStoreAdapterActive(state: LinkState): boolean {
  return (
    !state.disabled &&
    state.mode === "linked" &&
    (state.sections.conversations === true ||
      state.sections.contacts === true ||
      state.sections.lists === true ||
      state.sections.automation === true ||
      state.sections.reports === true)
  );
}

export function ChatwootLinkProvider({ initial, children }: { initial: LinkState; children: React.ReactNode }) {
  const [state, setState] = React.useState(() => {
    if (typeof window !== "undefined") {
      setLinkedSession(isStoreAdapterActive(initial));
    }
    return initial;
  });
  // A server render after router.refresh() brings the saved switch (also one changed in another browser).
  // React's "adjust state when a prop changes" pattern (react.dev/learn/you-might-not-need-an-effect).
  const [given, setGiven] = React.useState(initial);
  if (given !== initial) {
    setGiven(initial);
    setState(initial);
  }

  const adapterShouldRun = isStoreAdapterActive(state);
  if (typeof window !== "undefined" && linkedSession() !== adapterShouldRun) {
    setLinkedSession(adapterShouldRun);
  }

  React.useEffect(() => {
    if (adapterShouldRun) {
      void enableLinkedStoreAdapter();
    } else {
      disableLinkedStoreAdapter();
    }
  }, [adapterShouldRun]);

  const value = React.useMemo(() => ({ state, setState }), [state]);
  return <LinkContext.Provider value={value}>{children}</LinkContext.Provider>;
}

export function useChatwootLink() {
  return React.useContext(LinkContext);
}

/**
 * True when this section still uses the Phase-1 read-only Linked* view.
 * U-2 & U-3 (item 159): conversations, contacts, lists, automation and reports render the full Studio UI backed by the unified adapter.
 */
export function useSectionLinked(section: LinkSection): boolean {
  const { state } = useChatwootLink();
  if (
    section === "conversations" ||
    section === "contacts" ||
    section === "lists" ||
    section === "automation" ||
    section === "reports"
  ) {
    return false;
  }
  return !state.disabled && state.mode === "linked" && state.sections[section] === true;
}
