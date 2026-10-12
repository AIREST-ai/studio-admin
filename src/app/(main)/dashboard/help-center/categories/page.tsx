import type { Metadata } from "next";

import { CategoriesList } from "../_components/categories-list";
import { PortalGate } from "../_components/portal-title";

export const metadata: Metadata = {
  title: "Categories · Help Center",
};

export default function Page() {
  return (
    <PortalGate>
      <CategoriesList />
    </PortalGate>
  );
}
