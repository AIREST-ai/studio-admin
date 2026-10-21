import type { Metadata } from "next";

import { BuildAi } from "./_components/build-ai";

export const metadata: Metadata = {
  title: "اربط ذكاءك",
  description: "اربط ذكاءك الخاص عبر API بالإعدادات القياسية.",
};

export default function Page() {
  return <BuildAi />;
}
