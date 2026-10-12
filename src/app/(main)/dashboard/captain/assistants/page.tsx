import type { Metadata } from "next";

import { AssistantsList } from "../_components/assistants";

export const metadata: Metadata = {
  title: "Assistants",
  description: "Captain assistants in this account.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ create?: string }> }) {
  const { create } = await searchParams;
  return <AssistantsList create={create === "1"} />;
}
