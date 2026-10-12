import type { Metadata } from "next";

import { ConversationsWorkspace } from "../../_components/conversations-workspace";
import { teams } from "../../_components/cw-data";
import { ViewNotFound } from "../../_components/view-not-found";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: teams.some((team) => team.id === id) ? "Team conversations" : "Team not found" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!teams.some((team) => team.id === id)) return <ViewNotFound kind="team" />;
  return <ConversationsWorkspace view={{ kind: "team", id }} />;
}
