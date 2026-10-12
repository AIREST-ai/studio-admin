import type { Metadata } from "next";

import { CallsTable } from "./_components/calls-table";

export const metadata: Metadata = {
  title: "Calls",
  description: "Every voice call your team made or received, with recordings.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams;
  return <CallsTable setup={setup !== undefined} />;
}
