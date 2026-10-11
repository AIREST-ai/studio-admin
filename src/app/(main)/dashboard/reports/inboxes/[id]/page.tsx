import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { entities } from "../../_components/data";
import { EntityDetail } from "../../_components/entity-reports";

export const metadata: Metadata = {
  title: "Inbox report",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = entities.inboxes.find((r) => r.id === id);
  if (!row) notFound();
  return <EntityDetail kind="inboxes" row={row} />;
}
