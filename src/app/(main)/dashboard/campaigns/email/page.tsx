import type { Metadata } from "next";

import { CampaignsList } from "../_components/campaigns-list";

export const metadata: Metadata = {
  title: "Email campaigns",
  description: "Why email inboxes have no campaigns, with the engine's source.",
};

// M129-C (Fahad 129.3): the email campaign page, with the channel's official conditions.
export default function Page() {
  return <CampaignsList tab="email" />;
}
