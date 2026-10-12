import type { Metadata } from "next";

import { FaqSuggestionsPage } from "../../_components/faqs";

export const metadata: Metadata = {
  title: "FAQ suggestions",
  description: "FAQ suggestions Captain grouped from recurring customer questions.",
};

export default function Page() {
  return <FaqSuggestionsPage />;
}
