import type { Metadata } from "next";

import { CustomerPathReport } from "../_components/customer-path-report";

export const metadata: Metadata = {
  title: "Customer Path",
};

export default function Page() {
  return <CustomerPathReport />;
}
