import type { Metadata } from "next";

import { EvaluatorSettings } from "./_components/evaluator-settings";

export const metadata: Metadata = {
  title: "مقيّم الذكاء",
  description: "إعدادات مقيّم الذكاء موظفاً.",
};

export default function Page() {
  return <EvaluatorSettings />;
}
