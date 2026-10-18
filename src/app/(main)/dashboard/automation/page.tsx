import type { Metadata } from "next";

import { AutomationList } from "../settings/automation/_components/automation-list";

// T-234 (item 88): Automation's own page, opened by its icon under Reports in the main sidebar, no longer in Settings.
// The list and the editor are the same components as before; /dashboard/settings/automation redirects here.
export const metadata: Metadata = {
  title: "Automation",
  description: "Rules that label, assign and reply to conversations for you.",
};

export default function Page() {
  return <AutomationList />;
}
