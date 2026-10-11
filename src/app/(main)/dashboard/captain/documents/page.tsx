import type { Metadata } from "next";

import { DocumentsList } from "../_components/documents";

export const metadata: Metadata = {
  title: "Documents",
  description: "Knowledge sources used by Captain.",
};

export default function Page() {
  return <DocumentsList />;
}
