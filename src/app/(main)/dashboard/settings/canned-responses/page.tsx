import type { Metadata } from "next";

import { CannedSettings } from "./_components/canned-settings";

export const metadata: Metadata = {
  title: "Canned Responses",
  description: "Pre-written reply templates for quick answers.",
};

export default function Page() {
  return <CannedSettings />;
}
