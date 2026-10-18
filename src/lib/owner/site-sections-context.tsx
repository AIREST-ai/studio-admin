"use client";

// F-17 (T-91): the owner's site sections in the browser. The (main) layout reads them on the server for every page
// load, so a hidden section is already gone from the first byte (no flash); this provider keeps them, takes the newer
// copy after a save in the Owner console, and reads them again when the tab comes back to the front (a change made in
// another tab or device). The sidebar, inner bars, header search and menus read them (nav-main.tsx withLiveLists),
// and a page of a hidden section shows SectionHiddenNotice instead of its content (dashboard/_components/view-as.tsx).
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useViewer } from "@/lib/cw/view-as";

import {
  EMPTY_SITE_SECTIONS,
  hiddenSectionOfUrl,
  isShown,
  publishedSiteSections,
  publishSiteSections,
  type SiteSection,
  type SiteSectionsState,
} from "./site-sections";

interface SiteSectionsValue {
  state: SiteSectionsState;
  /** Takes a copy read from the server (a save's answer, a new read); an older revision is ignored. */
  accept: (next: SiteSectionsState) => void;
  refresh: () => Promise<void>;
}

export const SiteSectionsContext = createContext<SiteSectionsValue | null>(null);

/** The owner's site sections, in any client component under the (main) layout. A render that cannot reach the
 *  provider (a second copy of this module in the dev server) uses the copy the (main) layout left (site-sections.ts
 *  publishedSiteSections), so it still hides what is hidden instead of showing everything. */
export function useSiteSections(): SiteSectionsState {
  return use(SiteSectionsContext)?.state ?? publishedSiteSections() ?? EMPTY_SITE_SECTIONS;
}

export function useSiteSectionsControl(): SiteSectionsValue | null {
  return use(SiteSectionsContext);
}

/** False when the owner (or the default) hides this section. */
export function useSectionShown(id: string): boolean {
  return isShown(useSiteSections(), id);
}

/** The hidden section a page belongs to, or undefined. */
export function useHiddenSection(url: string): SiteSection | undefined {
  return hiddenSectionOfUrl(useSiteSections(), url);
}

export function SiteSectionsProvider({ initial, children }: { initial: SiteSectionsState; children: ReactNode }) {
  const [state, setState] = useState(initial);
  const accept = useCallback(
    (next: SiteSectionsState) => setState((current) => (next.rev >= current.rev ? next : current)),
    [],
  );
  // A newer server read (a refresh of this page's server parts) wins.
  useEffect(() => accept(initial), [initial, accept]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/owner-console", { cache: "no-store" });
      if (response.ok) accept((await response.json()) as SiteSectionsState);
    } catch {
      // offline or the server restarting: keep what this page has
    }
  }, [accept]);
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [refresh]);
  useEffect(() => publishSiteSections(state), [state]);
  const value = useMemo(() => ({ state, accept, refresh }), [state, accept, refresh]);
  return (
    <SiteSectionsContext value={value}>
      <OutsideDashboardGate>{children}</OutsideDashboardGate>
    </SiteSectionsContext>
  );
}

/** Pages outside the dashboard (the sample sign-in pages): the whole page is the notice when their section is hidden. */
function OutsideDashboardGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const hidden = useHiddenSection(path);
  if (!hidden || path.startsWith("/dashboard") || path.startsWith("/super_admin")) return children;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <SectionHiddenNotice section={hidden} />
    </main>
  );
}

/**
 * What a direct visit to a hidden section's page shows (with a 200 page, not an error): who hid it and that it is
 * kept. The Owner console link is offered to the owner only, not while viewing the preview as another agent.
 */
export function SectionHiddenNotice({ section }: { section: SiteSection }) {
  const viewer = useViewer();
  return (
    <div
      data-site-section-hidden={section.id}
      className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center"
    >
      <EyeOff className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="font-semibold text-xl">{section.title} is hidden by the site owner</h1>
      <p className="text-muted-foreground text-sm">
        The owner turned this section off for the whole site in the Owner console. Its pages and saved data are kept,
        and it comes back as soon as the owner shows it again.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard/chat">Go to Inbox</Link>
        </Button>
        {!viewer.viewingAs && (
          <Button asChild variant="outline">
            <Link href="/super_admin">Open Owner console</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
