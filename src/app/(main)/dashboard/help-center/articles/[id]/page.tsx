import type { Metadata } from "next";

import { ArticleEditor } from "../../_components/article-editor";

export const metadata: Metadata = {
  title: "Edit article · Help Center",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticleEditor articleId={Number(id)} />;
}
