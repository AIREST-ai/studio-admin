import type { Metadata } from "next";

import { CompanyProfile } from "../_components/company-profile";

export const metadata: Metadata = {
  title: "Company details",
};

// The company is read from the client store, so a company added on the list opens too; an unknown id shows
// Chatwoot's "Company not found" state.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <CompanyProfile id={Number(id)} initialTab={tab} />;
}
