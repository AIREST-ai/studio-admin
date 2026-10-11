import type { Metadata } from "next";

import { OverviewReport } from "../_components/overview-report";

export const metadata: Metadata = {
  title: "Overview",
};

export default function Page() {
  return <OverviewReport />;
}
