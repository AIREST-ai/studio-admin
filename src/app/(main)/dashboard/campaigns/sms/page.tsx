import type { Metadata } from "next";

import { SMSCampaignsPage } from "../_components/campaign-pages";

export const metadata: Metadata = {
  title: "SMS campaigns",
  description: "One-off SMS campaigns sent to customer labels.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  const { empty } = await searchParams;
  return <SMSCampaignsPage empty={empty !== undefined} />;
}
