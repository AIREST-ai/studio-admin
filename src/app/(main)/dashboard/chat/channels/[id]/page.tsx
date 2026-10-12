import type { Metadata } from "next";

import { ConversationsWorkspace } from "../../_components/conversations-workspace";
import { inboxes } from "../../_components/cw-data";
import { ViewNotFound } from "../../_components/view-not-found";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: inboxes.some((inbox) => inbox.id === id) ? "Inbox conversations" : "Inbox not found" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!inboxes.some((inbox) => inbox.id === id)) return <ViewNotFound kind="inbox" />;
  return <ConversationsWorkspace view={{ kind: "inbox", id }} />;
}
