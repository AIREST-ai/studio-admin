import type { Metadata } from "next";

import { TrialRun } from "../_components/trial-run";

export const metadata: Metadata = {
  title: "Trial assignment",
};

export default function Page() {
  return <TrialRun />;
}
