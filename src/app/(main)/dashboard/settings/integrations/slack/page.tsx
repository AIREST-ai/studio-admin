import type { Metadata } from "next";

import { SlackPage, type SlackState } from "../_components/slack-page";

export const metadata: Metadata = {
  title: "Slack",
};

const states: SlackState[] = ["disconnected", "select", "expired", "active"];

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const initial = states.find((s) => s === state) ?? "active";
  return <SlackPage key={initial} initialState={initial} />;
}
