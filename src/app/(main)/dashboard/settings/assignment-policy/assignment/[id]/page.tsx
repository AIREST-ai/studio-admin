import type { Metadata } from "next";

import { AssignmentPolicyRoute } from "../../_components/policy-routes";

export const metadata: Metadata = {
  title: "Assignment policy",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inboxId?: string }>;
}) {
  const { id } = await params;
  const { inboxId } = await searchParams;
  return <AssignmentPolicyRoute id={id} inboxId={inboxId ? Number(inboxId) : undefined} />;
}
