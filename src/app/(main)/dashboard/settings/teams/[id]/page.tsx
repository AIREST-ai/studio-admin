import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { teams } from "../_components/data";
import { TeamWizard } from "../_components/team-wizard";

export const metadata: Metadata = {
  title: "Edit team",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = teams.find((t) => String(t.id) === id);
  if (!team) notFound();
  return <TeamWizard team={team} />;
}
