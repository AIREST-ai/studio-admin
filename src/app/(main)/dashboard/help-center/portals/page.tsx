import type { Metadata } from "next";

import { PortalsList } from "../_components/portals-list";

export const metadata: Metadata = {
  title: "Portals · Help Center",
};

// ?state=empty shows Chatwoot's portal empty state (what a new account sees before its first portal).
export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <PortalsList forceEmpty={state === "empty"} />;
}
