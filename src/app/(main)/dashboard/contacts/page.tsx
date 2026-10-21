import type { Metadata } from "next";

import { UnifiedWorkspaceHub } from "@/app/(main)/dashboard/_components/unified-workspace-hub";

import { ContactsList } from "./_components/contacts-list";

export const metadata: Metadata = {
  title: "جهات الاتصال والعملاء",
  description: "جميع العملاء وجهات الاتصال المرتبطة بالقنوات والفواتير.",
};

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <UnifiedWorkspaceHub defaultTab="contacts" />
      <ContactsList />
    </div>
  );
}
