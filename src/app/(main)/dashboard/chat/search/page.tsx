import type { Metadata } from "next";

import { SearchView } from "../_components/search-view";

export const metadata: Metadata = {
  title: "Search",
};

// Chatwoot's search screen (modules/search/SearchView.vue), opened from the conversation list search box.
export default function Page() {
  return <SearchView />;
}
