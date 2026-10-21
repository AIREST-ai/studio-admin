import type { Metadata } from "next";

import { UnifiedWorkspaceHub } from "@/app/(main)/dashboard/_components/unified-workspace-hub";
import { APP_CONFIG } from "@/config/app-config";

import { Invoice } from "./_components/invoice";

export const metadata: Metadata = {
  title: `الفواتير والمدفوعات · ${APP_CONFIG.name}`,
  description: "إنشاء ومراجعة وحفظ فواتير العملاء في مركز الأعمال الموحد.",
  alternates: {
    canonical: "/dashboard/invoice",
  },
};

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <UnifiedWorkspaceHub defaultTab="invoices" />
      <Invoice />
    </div>
  );
}
