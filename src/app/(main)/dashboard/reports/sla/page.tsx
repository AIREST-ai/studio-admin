import type { Metadata } from "next";

import { SlaReport } from "../_components/sla-report";

export const metadata: Metadata = {
  title: "SLA Reports",
};

export default function Page() {
  return <SlaReport />;
}
