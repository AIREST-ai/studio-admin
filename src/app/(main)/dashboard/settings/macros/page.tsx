import type { Metadata } from "next";

import { MacrosSettings } from "./_components/macros-settings";

export const metadata: Metadata = {
  title: "Macros",
  description: "Saved sets of actions agents run in one click.",
};

export default function Page() {
  return <MacrosSettings />;
}
