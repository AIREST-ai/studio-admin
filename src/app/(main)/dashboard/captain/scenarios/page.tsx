import type { Metadata } from "next";

import { ScenariosList } from "../_components/scenarios";

export const metadata: Metadata = {
  title: "Scenarios",
  description: "Scenarios that guide Captain's behavior.",
};

export default function Page() {
  return <ScenariosList />;
}
