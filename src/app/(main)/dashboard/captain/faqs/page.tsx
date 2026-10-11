import type { Metadata } from "next";

import { FaqsPage } from "../_components/faqs";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Approved FAQs and FAQ suggestions for Captain.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <FaqsPage initialTab={tab === "pending" ? "pending" : "approved"} />;
}
