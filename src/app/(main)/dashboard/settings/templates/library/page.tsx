import type { Metadata } from "next";

import { PRODUCT_NAME } from "@/config/app-config";

import { TemplateLibrary } from "../_components/template-library";

export const metadata: Metadata = {
  title: "Template library",
  description: `Ready-made WhatsApp templates from Meta's Template Library and ${PRODUCT_NAME}, copied to a draft in one click.`,
};

export default function Page() {
  return <TemplateLibrary />;
}
