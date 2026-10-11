import type { Metadata } from "next";

import { PolicyList } from "../_components/policy-list";

export const metadata: Metadata = {
  title: "Agent capacity",
};

export default function Page() {
  return <PolicyList kind="capacity" />;
}
