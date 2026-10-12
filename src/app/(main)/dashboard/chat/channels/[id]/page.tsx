import type { Metadata } from "next";

import { inboxes } from "@/lib/cw/data";

import { CwViewGuard } from "../../_components/cw-view-guard";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: inboxes.find((inbox) => inbox.slug === id)?.name ?? "Inbox conversations" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CwViewGuard kind="inbox" id={id} />;
}
