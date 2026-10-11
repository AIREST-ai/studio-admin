import type { Metadata } from "next";

import { BillingSettings } from "./_components/billing-settings";

export const metadata: Metadata = {
  title: "Billing",
};

export default function Page() {
  return <BillingSettings />;
}
