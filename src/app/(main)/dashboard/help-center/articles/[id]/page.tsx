import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { ArticleEditor } from "../../_components/article-editor";
import { articles, translatedArticles } from "../../_components/data";

export const metadata: Metadata = {
  title: "Edit article · Help Center",
};

const seedIds = [...articles, ...translatedArticles].map((article) => article.id);
const lastSeedId = Math.max(...seedIds);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const articleId = Number(id);
  // Unknown ids show the not-found page instead of a blank editor. Ids above the mock data belong to articles
  // created in this browser session (mock store, at most a few hundred), so the editor checks those on the client.
  const unknownSeed = articleId <= lastSeedId && !seedIds.includes(articleId);
  if (!Number.isInteger(articleId) || unknownSeed || articleId > lastSeedId + 500) {
    notFound();
  }
  return <ArticleEditor articleId={articleId} />;
}
