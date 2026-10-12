import type { Metadata } from "next";

import { WhatsAppCampaignAnalytics } from "../../../_components/whatsapp-analytics";

export const metadata: Metadata = {
  title: "Campaign analytics",
  description: "Delivery analytics for a WhatsApp campaign.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WhatsAppCampaignAnalytics id={Number(id)} />;
}
