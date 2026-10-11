import type { Metadata } from "next";

import { Playground } from "../_components/playground";

export const metadata: Metadata = {
  title: "Playground",
  description: "Test Captain replies.",
};

export default function Page() {
  return <Playground />;
}
