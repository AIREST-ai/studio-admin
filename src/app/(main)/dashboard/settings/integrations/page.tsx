import type { Metadata } from "next";

import { IntegrationsList } from "./_components/integrations-list";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect your favourite tools and services.",
};

export default function Page() {
  return <IntegrationsList />;
}
