import type { Metadata } from "next";

import { TeamsList } from "./_components/teams-list";

export const metadata: Metadata = {
  title: "Teams",
  description: "Organize agents into groups.",
};

export default function Page() {
  return <TeamsList />;
}
