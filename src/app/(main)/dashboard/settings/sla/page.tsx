import type { Metadata } from "next";

import { SlaList } from "./_components/sla-list";

export const metadata: Metadata = {
  title: "SLA",
  description: "Response and resolution time targets for your team.",
};

export default function Page() {
  return <SlaList />;
}
