import type { Metadata } from "next";

import { SecuritySettings } from "./_components/security-settings";

export const metadata: Metadata = {
  title: "Security",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ paywall?: string }> }) {
  const { paywall } = await searchParams;
  return <SecuritySettings paywall={paywall === "1"} />;
}
