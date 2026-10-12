import type { Metadata } from "next";

import { ConversationsWorkspace } from "../../_components/conversations-workspace";

export const metadata: Metadata = {
  title: "Label conversations",
};

// Labels are the Studio chat tags (local state, new ones can be added), so any id is accepted.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationsWorkspace view={{ kind: "label", id: decodeURIComponent(id) }} />;
}
