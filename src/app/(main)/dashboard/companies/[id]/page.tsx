import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { CompanyDetails } from "../_components/company-details";
import { companies } from "../_components/data";

export const metadata: Metadata = {
  title: "Company details",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = companies.find((c) => String(c.id) === id);
  if (!company) notFound();
  return <CompanyDetails company={company} />;
}
