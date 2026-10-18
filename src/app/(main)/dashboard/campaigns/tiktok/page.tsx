import type { Metadata } from "next";

import { CampaignsList } from "../_components/campaigns-list";

export const metadata: Metadata = {
  title: "TikTok campaigns",
  description: "Why TikTok has no campaigns, with TikTok's source.",
};

// M129-C (Fahad 129.3): the tiktok campaign page, with the channel's official conditions.
export default function Page() {
  return <CampaignsList tab="tiktok" />;
}
