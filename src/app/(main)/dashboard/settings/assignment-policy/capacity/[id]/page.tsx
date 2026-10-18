import type { Metadata } from "next";

import { CapacityPolicyRoute } from "../../_components/policy-routes";

export const metadata: Metadata = {
  title: "Agent capacity policy",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CapacityPolicyRoute id={id} />;
}
