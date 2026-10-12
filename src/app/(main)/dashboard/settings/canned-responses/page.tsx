import type { Metadata } from "next";

import { CannedList } from "./_components/canned-list";

export const metadata: Metadata = {
  title: "Canned Responses",
  description: "Pre-written reply templates for quick answers.",
};

export default function Page() {
  return <CannedList />;
}
