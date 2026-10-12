"use client";

import { useCwShared } from "@/lib/cw/store";

import { ConversationsWorkspace } from "./conversations-workspace";
import { ViewNotFound } from "./view-not-found";

// F161: a team or inbox view checks the shared lists (src/lib/cw), so a team or inbox created in Settings opens its
// own (empty) conversation view instead of "not found", and a deleted one says not found.
export function CwViewGuard({ kind, id }: { kind: "team" | "inbox"; id: string }) {
  const known = useCwShared((s) =>
    kind === "team" ? s.teams.some((team) => team.slug === id) : s.inboxes.some((inbox) => inbox.slug === id),
  );
  if (!known) return <ViewNotFound kind={kind} />;
  return <ConversationsWorkspace view={{ kind, id }} />;
}
