import type { Metadata } from "next";

import { UnifiedWorkspaceHub } from "@/app/(main)/dashboard/_components/unified-workspace-hub";

import { TwentyBoard } from "./_twenty/twenty-board";

export const metadata: Metadata = {
  title: "المهام ومركز الأعمال الموحد",
  description: "إدارة المهام، التقويم، جهات الاتصال، والفواتير في واجهة موحدة نظيفة.",
  alternates: {
    canonical: "/dashboard/tasks",
  },
};

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <UnifiedWorkspaceHub defaultTab="tasks" />
      <div data-content-padding="false">
        <TwentyBoard />
      </div>
    </div>
  );
}
