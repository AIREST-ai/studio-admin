import type { Metadata } from "next";

import { CampaignComposer } from "../_components/campaign-composer";

export const metadata: Metadata = {
  title: "New campaign",
  description: "Channel, audience, content and timing of a one-off campaign (sending is simulated in the preview).",
};

// M129-C: /new?channel=whatsapp makes a campaign; /new?id=<id> edits a draft or scheduled one.
export default async function Page({ searchParams }: { searchParams: Promise<{ channel?: string; id?: string }> }) {
  const { channel, id } = await searchParams;
  return (
    <CampaignComposer key={id ?? channel ?? "new"} campaignId={id ? Number(id) : undefined} initialChannel={channel} />
  );
}
