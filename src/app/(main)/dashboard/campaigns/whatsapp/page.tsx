import type { Metadata } from "next";

import { CampaignsList } from "../_components/campaigns-list";

export const metadata: Metadata = {
  title: "WhatsApp campaigns",
  description: "One-off WhatsApp template campaigns sent to customer labels.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  const { empty } = await searchParams;
  return <CampaignsList tab="whatsapp" empty={empty !== undefined} />;
}
