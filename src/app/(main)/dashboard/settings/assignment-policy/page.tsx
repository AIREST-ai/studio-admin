import type { Metadata } from "next";

import { PolicyIndex } from "./_components/policy-index";

export const metadata: Metadata = {
  title: "Agent Assignment",
  description: "Policies that route conversations and manage agent workload.",
};

export default function Page() {
  return <PolicyIndex />;
}
