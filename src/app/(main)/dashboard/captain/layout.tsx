import type { ReactNode } from "react";

import { SectionShell } from "@/app/(main)/dashboard/_components/sidebar/section-subnav";

// T-54: the section's pages show its links in an inner bar beside the main sidebar.
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <SectionShell>{children}</SectionShell>;
}
