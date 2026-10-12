import type { Metadata } from "next";

import { AutomationList } from "./_components/automation-list";

export const metadata: Metadata = {
  title: "Automation",
  description: "Rules that label, assign and reply to conversations for you.",
};

export default function Page() {
  return <AutomationList />;
}
