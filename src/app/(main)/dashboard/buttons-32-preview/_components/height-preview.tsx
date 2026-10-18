"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

// T-229 (Fahad 77.8 «نجرب وارى بعيني نموذج حقيقي لاوافق»): a private sample of the real Tasks and Kanban pages with
// the 28px buttons (Button sizes sm and icon-sm) raised to 32px. Only while this wrapper is on the page, and only
// when 32 is chosen; components/ui/button.tsx and globals.css are untouched, so no other page changes. Buttons are
// found by their group/button class, as a menu trigger (asChild) replaces their data-slot. The page itself and the
// dialogs and menus it opens (rendered outside this wrapper) are reached; the shared header and sidebar are not.
const RAISE_TO_32 = cn(
  "[:where(body:has(&))_:is(&,[role=dialog],[data-radix-popper-content-wrapper])_[class~='group/button'][data-size=sm]]:h-8",
  "[:where(body:has(&))_:is(&,[role=dialog],[data-radix-popper-content-wrapper])_[class~='group/button'][data-size=icon-sm]]:size-8",
);

const PAGES = [
  { href: "/dashboard/buttons-32-preview/tasks", label: "Tasks", original: "/dashboard/tasks" },
  { href: "/dashboard/buttons-32-preview/kanban", label: "Kanban", original: "/dashboard/kanban" },
];

export function HeightPreview({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [height, setHeight] = useState<28 | 32>(32);
  const page = PAGES.find((p) => pathname.startsWith(p.href)) ?? PAGES[0];

  return (
    <div
      data-t229-height={height}
      // a full-bleed page (Kanban) has no padding around it, so the bar keeps its own gap from the edges there
      className={cn(
        "flex flex-col gap-4 has-data-[content-padding=false]:[&>[data-t229-bar]]:m-3",
        height === 32 && RAISE_TO_32,
      )}
    >
      <div
        data-t229-bar
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed px-3 py-2 text-sm"
      >
        <span className="font-medium">نموذج ارتفاع الأزرار — للمعاينة فقط، غير معمَّم</span>
        <fieldset className="m-0 flex items-center gap-1 border-0 p-0">
          <legend className="sr-only">Button height</legend>
          {([28, 32] as const).map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={height === h}
              onClick={() => setHeight(h)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                height === h ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {h === 28 ? "28px (الحالي)" : "32px (النموذج)"}
            </button>
          ))}
        </fieldset>
        <nav className="flex items-center gap-3 text-xs">
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={p === page ? "page" : undefined}
              className={cn("underline-offset-4 hover:underline", p === page && "font-semibold underline")}
            >
              {p.label}
            </Link>
          ))}
          <Link href={page.original} className="text-muted-foreground underline-offset-4 hover:underline">
            الصفحة الأصلية
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
