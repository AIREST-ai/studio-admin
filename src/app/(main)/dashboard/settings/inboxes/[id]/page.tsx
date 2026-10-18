import type { Metadata } from "next";

import { InboxSettingsRoute } from "../_components/inbox-settings";

export const metadata: Metadata = {
  title: "Inbox settings",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <InboxSettingsRoute id={id} tab={tab} />;
}
