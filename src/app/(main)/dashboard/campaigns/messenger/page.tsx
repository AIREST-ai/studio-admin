import type { Metadata } from "next";

import { CampaignsList } from "../_components/campaigns-list";

export const metadata: Metadata = {
  title: "Messenger campaigns",
  description: "Messages to Messenger customers whose 24-hour window is open.",
};

// M129-C (Fahad 129.3): the messenger campaign page, with the channel's official conditions.
export default function Page() {
  return <CampaignsList tab="messenger" />;
}
