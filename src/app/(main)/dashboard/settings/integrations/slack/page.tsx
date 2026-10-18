import type { Metadata } from "next";

import { SlackPage, type SlackState } from "../_components/slack-page";

export const metadata: Metadata = {
  title: "Slack",
};

const states: SlackState[] = ["disconnected", "select", "expired", "active"];

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  // F-6A: with no ?state=, the page starts not connected and shows what is saved (slack-page.tsx).
  const initial = states.find((s) => s === state) ?? "disconnected";
  return <SlackPage key={initial} initialState={initial} />;
}
