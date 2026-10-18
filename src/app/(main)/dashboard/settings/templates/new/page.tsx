import type { Metadata } from "next";

import { TemplateBuilder } from "../_components/template-builder";

export const metadata: Metadata = {
  title: "New WhatsApp template",
  description: "Write a WhatsApp template, check Meta's rules and submit it for approval (simulated in the preview).",
};

// M129-C: /new makes a template; /new?id=<id> opens a saved draft (or a submitted template, read-only).
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <TemplateBuilder key={id ?? "new"} templateId={id} />;
}
