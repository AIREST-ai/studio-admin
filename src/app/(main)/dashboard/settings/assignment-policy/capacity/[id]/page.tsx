import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { CapacityPolicyForm } from "../../_components/capacity-form";
import { capacityPolicies } from "../../_components/data";

export const metadata: Metadata = {
  title: "Agent capacity policy",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") return <CapacityPolicyForm />;
  const policy = capacityPolicies.find((p) => String(p.id) === id);
  if (!policy) notFound();
  return <CapacityPolicyForm policy={policy} />;
}
