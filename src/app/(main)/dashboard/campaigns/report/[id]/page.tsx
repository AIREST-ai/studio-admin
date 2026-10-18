import type { Metadata } from "next";

import { CampaignReport } from "../../_components/campaign-report";

export const metadata: Metadata = {
  title: "Campaign report",
  description: "Status, simulated delivery numbers and recipients of a campaign.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignReport id={Number(id)} />;
}
