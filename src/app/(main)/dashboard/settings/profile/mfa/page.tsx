import type { Metadata } from "next";

import { MfaSettings } from "../_components/mfa-settings";

export const metadata: Metadata = {
  title: "Two-Factor Authentication",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <MfaSettings key={state ?? "disabled"} initialEnabled={state === "enabled"} />;
}
