import type { Metadata } from "next";

import { PoliciesTable } from "../_components/policies-table";

export const metadata: Metadata = {
  title: "Assignment policy",
};

export default function Page() {
  return <PoliciesTable kind="assignment" />;
}
