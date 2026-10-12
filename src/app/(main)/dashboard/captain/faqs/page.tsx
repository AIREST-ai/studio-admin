import type { Metadata } from "next";

import { FaqsPage } from "../_components/faqs";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Captain FAQs for this assistant.",
};

export default function Page() {
  return <FaqsPage />;
}
