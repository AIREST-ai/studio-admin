import type { Metadata } from "next";

import { AuditLogsList } from "./_components/audit-logs-list";

export const metadata: Metadata = {
  title: "Audit Logs",
};

export default function Page() {
  return <AuditLogsList />;
}
