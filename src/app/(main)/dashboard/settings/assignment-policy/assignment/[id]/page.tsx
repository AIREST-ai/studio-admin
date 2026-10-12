import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { AssignmentPolicyForm } from "../../_components/assignment-policy-form";
import { assignmentPolicies } from "../../_components/data";

export const metadata: Metadata = {
  title: "Assignment policy",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") return <AssignmentPolicyForm />;
  const policy = assignmentPolicies.find((p) => String(p.id) === id);
  if (!policy) notFound();
  return <AssignmentPolicyForm policy={policy} />;
}
