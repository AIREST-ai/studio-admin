import type { Metadata } from "next";

import { AutomationSettings } from "./_components/automation-settings";

export const metadata: Metadata = {
  title: "Automation",
  description: "Rules that label, assign and reply to conversations for you.",
};

export default function Page() {
  return <AutomationSettings />;
}
