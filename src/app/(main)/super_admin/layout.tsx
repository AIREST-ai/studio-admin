import type { ReactNode } from "react";

import Link from "next/link";

import { Castle, LayoutDashboard, ToggleRight } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

// F-17 (T-91): the Owner console has its own frame, apart from the account's dashboard and its Settings, as Chatwoot's
// Super Admin Console at /super_admin has its own navigation with "Super Admin Console" under the product name and an
// "Agent Dashboard" link back (app/views/super_admin/application/_navigation.html.erb, v4.18.0).
export default function OwnerConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <nav
        aria-label="Owner console"
        className="sticky top-0 flex h-screen w-56 shrink-0 flex-col justify-between border-r bg-muted/30"
      >
        <div>
          <div className="flex items-center gap-3 border-b px-4 py-5">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Castle className="size-4" aria-hidden="true" />
            </div>
            <div className="grid leading-tight">
              <span className="font-medium text-sm">{APP_CONFIG.name}</span>
              <span className="text-muted-foreground text-xs">Owner console</span>
            </div>
          </div>
          <ul className="grid gap-1 p-2">
            <li>
              <Link
                href="/super_admin"
                aria-current="page"
                className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-medium text-sm"
              >
                <ToggleRight className="size-4" aria-hidden="true" />
                Site sections
              </Link>
            </li>
          </ul>
        </div>
        <ul className="grid gap-1 border-t p-2">
          <li>
            <Link
              href="/dashboard/default"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Back to dashboard
            </Link>
          </li>
        </ul>
      </nav>
      <main className="min-w-0 flex-1 overflow-x-hidden p-6">{children}</main>
    </div>
  );
}
