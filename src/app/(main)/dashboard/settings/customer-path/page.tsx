import type { Metadata } from "next";

import { CustomerPathSettings } from "./_components/customer-path-settings";

export const metadata: Metadata = {
  title: "Customer Path",
  description: "The stages a customer moves through, in order.",
};

export default function Page() {
  return <CustomerPathSettings />;
}
