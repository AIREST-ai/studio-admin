"use client";
// م137 round 2 (Fahad 137, judge M137: detail pages had two headers, a path or a back link): every Settings detail page
// shows the same path above its title, as Teams, Agent Assignment and Inboxes already do (PolicyBreadcrumb's look);
// no back button beside it.
import Link from "next/link";

import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function SettingsBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-settings-breadcrumb
      className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm"
    >
      {items.map((item, index) => (
        <span key={item.href ?? item.label} className="flex items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3.5" /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
