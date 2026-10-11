import type { Metadata } from "next";

import { LiveChatCampaignsPage } from "../_components/campaign-pages";

export const metadata: Metadata = {
  title: "Live chat campaigns",
  description: "Proactive messages shown to visitors on your website.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  const { empty } = await searchParams;
  return <LiveChatCampaignsPage empty={empty !== undefined} />;
}
