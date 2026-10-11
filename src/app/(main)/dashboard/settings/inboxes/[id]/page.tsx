import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { inboxes } from "../_components/data";
import { InboxSettings } from "../_components/inbox-settings";

export const metadata: Metadata = {
  title: "Inbox settings",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inbox = inboxes.find((i) => String(i.id) === id);
  if (!inbox) notFound();
  return <InboxSettings inbox={inbox} />;
}
