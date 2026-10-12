import type { Metadata } from "next";

import { CompaniesTable } from "./_components/companies-table";

export const metadata: Metadata = {
  title: "Companies",
  description: "Businesses your contacts belong to.",
};

export default function Page() {
  return <CompaniesTable />;
}
