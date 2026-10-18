import type { Metadata } from "next";

import { OverviewReport } from "../_components/overview-report";

export const metadata: Metadata = {
  title: "Conversations overview",
};

export default function Page() {
  return <OverviewReport />;
}
