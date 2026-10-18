"use client";

// L-2 + V-7B: "Linked: Live Engine" in the header, only while a section is linked.
// In preview mode it renders nothing (the header is exactly as before) and asks nothing of the server.
import Link from "next/link";

import { Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LINK_BADGE_TEXT, PHASE1_SECTIONS } from "@/lib/chatwoot-link-types";

import { useChatwootLink } from "./link-context";

export function ChatwootLinkBadge() {
  const { state } = useChatwootLink();
  const linked = PHASE1_SECTIONS.filter(
    (section) => state.mode === "linked" && !state.disabled && state.sections[section],
  );
  if (!linked.length) return null;
  return (
    <Badge variant="outline" className="hidden gap-1 sm:inline-flex" asChild>
      <Link href="/dashboard/settings/integrations" title={`Linked sections: ${linked.join(", ")} (Live Engine)`}>
        <Link2 /> {LINK_BADGE_TEXT}
      </Link>
    </Badge>
  );
}
