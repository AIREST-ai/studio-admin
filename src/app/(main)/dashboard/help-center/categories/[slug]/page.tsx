import type { Metadata } from "next";

import { ArticlesList } from "../../_components/articles-list";

export const metadata: Metadata = {
  title: "Category articles · Help Center",
};

// Chatwoot portals_categories_articles_index: the articles of one category, with Edit category and New article.
// The slug is checked on the client, so categories created in this session open too.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticlesList categorySlug={slug} />;
}
