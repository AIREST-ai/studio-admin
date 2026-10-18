import type { Metadata } from "next";

import { TeamDetailRoute } from "../_components/team-wizard";

export const metadata: Metadata = {
  title: "Edit team",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamDetailRoute id={id} />;
}
