import type { Metadata } from "next";

import { PolicyList } from "../_components/policy-list";

export const metadata: Metadata = {
  title: "Assignment policy",
};

export default function Page() {
  return <PolicyList kind="assignment" />;
}
