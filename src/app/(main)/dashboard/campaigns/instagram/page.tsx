import type { Metadata } from "next";

import { CampaignsList } from "../_components/campaigns-list";

export const metadata: Metadata = {
  title: "Instagram campaigns",
  description: "Messages to Instagram customers whose 24-hour window is open.",
};

// M129-C (Fahad 129.3): the instagram campaign page, with the channel's official conditions.
export default function Page() {
  return <CampaignsList tab="instagram" />;
}
