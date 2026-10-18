import type { Metadata } from "next";

import { TemplateGallery } from "../../settings/automation/_flow/template-gallery";

// T-243 (item 93): the template library. "Use template" opens a new draft in the visual editor (flow/new?template=…).
export const metadata: Metadata = {
  title: "Automation templates",
  description: "Start an automation flow from a ready template.",
};

export default function Page() {
  return <TemplateGallery />;
}
