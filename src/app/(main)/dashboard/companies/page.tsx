import type { Metadata } from "next";

import { CompaniesList } from "./_components/companies-list";

export const metadata: Metadata = {
  title: "Companies",
  description: "Businesses your contacts belong to.",
};

export default function Page() {
  return <CompaniesList />;
}
