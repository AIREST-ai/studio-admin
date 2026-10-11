import type { Metadata } from "next";

import { CsatReport } from "../_components/csat-report";

export const metadata: Metadata = {
  title: "CSAT Reports",
};

export default function Page() {
  return <CsatReport />;
}
