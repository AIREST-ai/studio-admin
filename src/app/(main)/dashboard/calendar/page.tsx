import type { Metadata } from "next";

import { UnifiedWorkspaceHub } from "@/app/(main)/dashboard/_components/unified-workspace-hub";
import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { APP_CONFIG } from "@/config/app-config";

import { Calendar } from "./_components/calendar";

export const metadata: Metadata = {
  title: `التقويم والمواعيد · ${APP_CONFIG.name}`,
  description: "جدول مواعيد الفريق، الاجتماعات، وتواريخ استحقاق المهام.",
  alternates: {
    canonical: "/dashboard/calendar",
  },
};

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <UnifiedWorkspaceHub defaultTab="calendar" />
      <PageHeading title="التقويم والمواعيد" subtitle="مواعيد الفريق، المتابعات المجدولة، وتواريخ استحقاق المهام." />
      <Calendar />
    </div>
  );
}
