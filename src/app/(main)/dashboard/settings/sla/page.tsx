import type { Metadata } from "next";

import { SlaSettings } from "./_components/sla-settings";

export const metadata: Metadata = {
  title: "Service Level Agreements",
  description: "Response and resolution time targets for your team.",
};

export default function Page() {
  return <SlaSettings />;
}
