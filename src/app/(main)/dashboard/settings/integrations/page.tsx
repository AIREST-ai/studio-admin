import type { Metadata } from "next";

import { IntegrationsIndex } from "./_components/integrations-index";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect your favourite tools and services.",
};

export default function Page() {
  return <IntegrationsIndex />;
}
