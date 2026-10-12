import type { Metadata } from "next";

import { MacrosList } from "./_components/macros-list";

export const metadata: Metadata = {
  title: "Macros",
  description: "Saved sets of actions agents run in one click.",
};

export default function Page() {
  return <MacrosList />;
}
