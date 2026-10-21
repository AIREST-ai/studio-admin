"use client";
// F-6A (sim2 problem 15, task item 4): "Log out" in both account menus (the header picture and the sidebar footer) did
// nothing. The preview has no session, so it forgets that this browser entered the preview (lib/preview-signin) and
// goes to the login page, which says plainly what happened. "Notifications" opens My Inbox (Chatwoot's notifications
// page, /dashboard/notifications), the page the bell opens.
import type { ReactNode } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Bell, LogOut } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { leavePreview } from "@/lib/preview-signin/client";

export function LogOutMenuItem() {
  const router = useRouter();
  return (
    <DropdownMenuItem
      data-log-out
      onSelect={async () => {
        leavePreview();
        // حارس الدخول (2026-10-19): يمسح الخادم كعكة الجلسة الحقيقية.
        await fetch("/api/studio-auth/logout", { method: "POST" }).catch(() => null);
        router.push("/auth/v2/login?signedOut=1");
      }}
    >
      <LogOut />
      Log out
    </DropdownMenuItem>
  );
}

export function NotificationsMenuItem({ icon = <Bell /> }: { icon?: ReactNode }) {
  return (
    <DropdownMenuItem asChild>
      <Link href="/dashboard/notifications" data-menu-notifications>
        {icon}
        Notifications
      </Link>
    </DropdownMenuItem>
  );
}
