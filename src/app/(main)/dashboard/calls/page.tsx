import type { Metadata } from "next";

import { CallsList } from "./_components/calls-list";

export const metadata: Metadata = {
  title: "Calls",
  description: "Every voice call your team made or received, with recordings.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams;
  return <CallsList setup={setup !== undefined} />;
}
