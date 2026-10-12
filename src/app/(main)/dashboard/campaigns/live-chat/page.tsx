import type { Metadata } from "next";

import { CampaignsList } from "../_components/campaigns-list";

export const metadata: Metadata = {
  title: "Live chat campaigns",
  description: "Proactive messages shown to visitors on your website.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  const { empty } = await searchParams;
  return <CampaignsList tab="live_chat" empty={empty !== undefined} />;
}
