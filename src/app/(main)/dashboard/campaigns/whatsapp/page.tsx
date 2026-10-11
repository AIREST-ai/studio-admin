import type { Metadata } from "next";

import { WhatsAppCampaignsPage } from "../_components/campaign-pages";

export const metadata: Metadata = {
  title: "WhatsApp campaigns",
  description: "One-off WhatsApp template campaigns sent to customer labels.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  const { empty } = await searchParams;
  return <WhatsAppCampaignsPage empty={empty !== undefined} />;
}
