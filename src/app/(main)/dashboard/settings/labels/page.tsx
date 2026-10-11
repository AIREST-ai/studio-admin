import type { Metadata } from "next";

import { LabelsSettings } from "./_components/labels-settings";

export const metadata: Metadata = {
  title: "Labels",
  description: "Categorize and prioritize conversations and leads.",
};

export default function Page() {
  return <LabelsSettings />;
}
