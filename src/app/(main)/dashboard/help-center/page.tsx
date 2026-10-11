import type { Metadata } from "next";

import { ArticlesList } from "./_components/articles-list";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Articles in your self-service help center portal.",
};

export default function Page() {
  return <ArticlesList />;
}
