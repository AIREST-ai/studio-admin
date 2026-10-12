import type { Metadata } from "next";

import { PoliciesTable } from "../_components/policies-table";

export const metadata: Metadata = {
  title: "Agent capacity",
};

export default function Page() {
  return <PoliciesTable kind="capacity" />;
}
