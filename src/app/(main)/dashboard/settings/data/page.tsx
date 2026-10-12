import type { Metadata } from "next";

import { DataPage } from "./_components/data-page";

export const metadata: Metadata = {
  title: "Data",
};

export default function Page() {
  return <DataPage />;
}
