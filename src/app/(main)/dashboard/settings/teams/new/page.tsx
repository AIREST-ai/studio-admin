import type { Metadata } from "next";

import { TeamWizard } from "../_components/team-wizard";

export const metadata: Metadata = {
  title: "Create new team",
};

export default function Page() {
  return <TeamWizard />;
}
