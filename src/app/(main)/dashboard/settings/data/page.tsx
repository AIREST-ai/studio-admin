import type { Metadata } from "next";

import { DataImports } from "./_components/data-imports";

export const metadata: Metadata = {
  title: "Data",
};

export default function Page() {
  return <DataImports />;
}
