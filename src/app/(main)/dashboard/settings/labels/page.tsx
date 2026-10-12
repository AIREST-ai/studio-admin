import type { Metadata } from "next";

import { LabelsList } from "./_components/labels-list";

export const metadata: Metadata = {
  title: "Labels",
  description: "Categorize and prioritize conversations and leads.",
};

export default function Page() {
  return <LabelsList />;
}
