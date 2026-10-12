import type { Metadata } from "next";

import { teams } from "@/lib/cw/data";

import { CwViewGuard } from "../../_components/cw-view-guard";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: teams.find((team) => team.slug === id)?.name ?? "Team conversations" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CwViewGuard kind="team" id={id} />;
}
