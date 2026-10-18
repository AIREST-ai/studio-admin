"use client";

import { useCwShared } from "@/lib/cw/store";

import { ConversationsWorkspace } from "./conversations-workspace";
import { ViewNotFound } from "./view-not-found";

// F161: a team or inbox view checks the shared lists (src/lib/cw), so a team or inbox created in Settings opens its
// own (empty) conversation view instead of "not found", and a deleted one says not found.
// T-124: the id comes from the URL still percent-encoded (an Arabic team name), so it is decoded before comparing; the
// saved slug is left as it is.
export function CwViewGuard({ kind, id: rawId }: { kind: "team" | "inbox"; id: string }) {
  const id = decodeSegment(rawId);
  const known = useCwShared((s) =>
    kind === "team" ? s.teams.some((team) => team.slug === id) : s.inboxes.some((inbox) => inbox.slug === id),
  );
  if (!known) return <ViewNotFound kind={kind} />;
  return <ConversationsWorkspace view={{ kind, id }} />;
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
