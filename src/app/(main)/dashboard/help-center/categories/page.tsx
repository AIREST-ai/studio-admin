import type { Metadata } from "next";

import { CategoriesList } from "../_components/categories-list";

export const metadata: Metadata = {
  title: "Categories · Help Center",
};

export default function Page() {
  return <CategoriesList />;
}
