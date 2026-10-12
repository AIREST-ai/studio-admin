import type { Metadata } from "next";

import { OAuthIntegration } from "../_components/oauth-integration";

export const metadata: Metadata = {
  title: "Shopify",
  description: "Connect Shopify to this account.",
};

export default function Page() {
  return <OAuthIntegration integrationId="shopify" />;
}
