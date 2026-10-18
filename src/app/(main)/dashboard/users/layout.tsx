import type { ReactNode } from "react";

import { SectionShell } from "@/app/(main)/dashboard/_components/sidebar/section-subnav";

// T-54: Users & Roles is under Settings, so its page shows the Settings inner bar.
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <SectionShell>{children}</SectionShell>;
}
