import type { Metadata } from "next";

import { CaptainOverview } from "./_components/overview";

export const metadata: Metadata = {
  title: "Captain",
  description: "Captain assistant overview.",
};

export default function Page() {
  return <CaptainOverview />;
}
