import type { ReactNode } from "react";

import { publishSiteSections } from "@/lib/owner/site-sections";
import { SiteSectionsProvider } from "@/lib/owner/site-sections-context";
import { readSiteSectionsSafe } from "@/lib/owner/site-sections-server";

// F-17 (T-91): every page under (main) (the dashboard, the Owner console, the sample sign-in pages) gets the owner's
// site sections read from the preview state on the server, so a hidden section is gone from the first byte.
// Read on each request: a change in the Owner console shows on the next page load in any browser.
export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { error: _error, ...sections } = await readSiteSectionsSafe();
  publishSiteSections(sections);
  return <SiteSectionsProvider initial={sections}>{children}</SiteSectionsProvider>;
}
