import type { Metadata } from "next";

import { StartRouter } from "./start-router";

export const metadata: Metadata = { title: "فتح مساحة العمل" };

export default function Page() {
  return <StartRouter />;
}
