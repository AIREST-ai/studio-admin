import type { Metadata } from "next";

import { ArticleEditor } from "../../_components/article-editor";

export const metadata: Metadata = {
  title: "New article · Help Center",
};

export default function Page() {
  return <ArticleEditor />;
}
