import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { Invoice } from "./_components/invoice";

// F-9 (sim3 problem 10): the tab shows the page and the product's name, as the sign-in pages do
// ("Login · Studio Admin"), not the template's marketing title "Open Source … with shadcn/ui".
export const metadata: Metadata = {
  title: `Invoice · ${APP_CONFIG.name}`,
  description: "Create, review and save customer invoices on the invoices server.",
  alternates: {
    canonical: "/dashboard/invoice",
  },
};

export default function Page() {
  return <Invoice />;
}
