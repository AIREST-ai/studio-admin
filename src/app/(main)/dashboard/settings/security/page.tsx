import type { Metadata } from "next";

import { SecuritySettings } from "./_components/security-settings";

export const metadata: Metadata = {
  title: "Security",
};

export default function Page() {
  return <SecuritySettings />;
}
