import type { Metadata } from "next";

import { T } from "./_components/data";
import { SmartSetup } from "./_components/smart-setup";

export const metadata: Metadata = {
  title: T.title,
  description: T.subtitle,
};

export default function Page() {
  return <SmartSetup />;
}
