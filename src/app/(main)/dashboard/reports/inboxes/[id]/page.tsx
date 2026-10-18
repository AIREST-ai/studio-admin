import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { EntityDetail } from "../../_components/entity-reports";
import { entities } from "../../_components/entity-summary-data";

export const metadata: Metadata = {
  title: "Inbox report",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = entities.inboxes.find((r) => r.id === id);
  if (!row) notFound();
  return <EntityDetail kind="inboxes" row={row} />;
}
