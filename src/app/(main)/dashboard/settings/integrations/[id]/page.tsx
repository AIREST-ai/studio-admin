import type { Metadata } from "next";

import { IntegrationHooks } from "../_components/integration-hooks";

export const metadata: Metadata = {
  title: "Integration",
  description: "Configure an integration for this account.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IntegrationHooks integrationId={id} />;
}
