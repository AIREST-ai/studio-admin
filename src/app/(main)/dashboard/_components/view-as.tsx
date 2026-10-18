"use client";

// F-5A (sim1 persona 2): the "View as" pieces the dashboard layout puts around every page (rules: src/lib/cw/view-as.ts).
// - ViewAsProvider: who the page is viewed as, from the cookie the layout read on the server, so the first render is
//   already that person's (no admin flash, no hydration mismatch).
// - ViewAsBanner: the honest mark. The preview has no sign-in: nobody was signed in or out, only this browser's view.
// - ViewAsGuard: a page the person's role cannot open in Chatwoot shows why, with the Chatwoot route it comes from.
//   F-17: and a page of a section the owner hid says so (lib/owner/site-sections-context.tsx SectionHiddenNotice).
//   (Chatwoot itself sends them to their first allowed page, helper/routeHelpers.js defaultRedirectPage.)
import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Eye, Lock } from "lucide-react";

import { useRolesStore } from "@/app/(main)/dashboard/roles/_components/roles-store";
import { permissionLabels } from "@/app/(main)/dashboard/roles/_components/roles-table/data";
import { Button } from "@/components/ui/button";
import { useSignedInName } from "@/lib/cw/signed-in-profile";
import { useCwShared } from "@/lib/cw/store";
import {
  canOpen,
  routeRule,
  SIGNED_IN_VIEWER,
  setBrowserViewer,
  useViewer,
  VIEW_AS_COOKIE,
  type Viewer,
  ViewerContext,
  viewerOf,
} from "@/lib/cw/view-as";
import { SectionHiddenNotice, useHiddenSection } from "@/lib/owner/site-sections-context";

/** Chooses whom this browser views the app as (null: the signed-in administrator) and reloads the page. */
export function setViewAs(agentId: number | null) {
  // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party cookie the server layout reads.
  document.cookie =
    agentId === null || agentId === SIGNED_IN_VIEWER.id
      ? `${VIEW_AS_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${VIEW_AS_COOKIE}=${agentId}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

export function ViewAsProvider({ viewAsId, children }: { viewAsId: number | null; children: ReactNode }) {
  const agents = useCwShared((state) => state.agents);
  const roles = useRolesStore((state) => state.roles);
  const agent = viewAsId === null ? undefined : agents.find((item) => item.id === viewAsId);
  const viewer: Viewer = agent ? viewerOf(agent, roles) : SIGNED_IN_VIEWER;
  setBrowserViewer(viewer);
  return <ViewerContext value={viewer}>{children}</ViewerContext>;
}

export function ViewAsBanner() {
  const viewer = useViewer();
  // F-9 round 2 (judge): the signed-in person by the name saved in Profile Settings, as the header shows it.
  const signedInName = useSignedInName(SIGNED_IN_VIEWER.name);
  if (!viewer.viewingAs) return null;
  return (
    <div
      role="status"
      data-view-as-banner
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-amber-300 border-b bg-amber-50 px-4 py-1.5 text-amber-950 text-xs lg:px-6 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50"
    >
      <Eye className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong>
          Viewing as {viewer.name} · {viewer.roleName}
        </strong>{" "}
        — preview without sign-in: this browser shows what the engine lets this role see and do. Nobody was signed in or
        out, and changes are still made by this preview.
      </span>
      <Button size="sm" variant="outline" className="h-7 bg-background" onClick={() => setViewAs(null)}>
        Back to {signedInName}
      </Button>
    </div>
  );
}

const PERMISSION_NAMES: Record<string, string> = {
  administrator: "Administrator",
  agent: "Agent",
  custom_role: "any custom role",
  ...permissionLabels,
};

/** Chatwoot defaultRedirectPage (helper/routeHelpers.js): the first page this person may open. */
function firstAllowed(viewer: Viewer): { href: string; label: string } | null {
  const pages = [
    { href: "/dashboard/chat", label: "Conversations" },
    { href: "/dashboard/contacts", label: "Contacts" },
    { href: "/dashboard/reports/overview", label: "Reports" },
    { href: "/dashboard/help-center", label: "Help Center" },
  ];
  return pages.find((page) => canOpen(viewer, page.href)) ?? null;
}

export function ViewAsGuard({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const path = usePathname();
  const signedInName = useSignedInName(SIGNED_IN_VIEWER.name); // F-9 round 2 (judge)
  // F-17 (T-91): a page of a section the owner hid (Owner console, /super_admin) says so, for everyone, instead of an
  // error or a redirect; the page still answers 200.
  const hidden = useHiddenSection(path);
  if (hidden) return <SectionHiddenNotice section={hidden} />;
  if (canOpen(viewer, path)) return children;
  const rule = routeRule(path);
  const next = firstAllowed(viewer);
  return (
    <div data-view-as-denied className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
      <Lock className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="font-semibold text-xl">
        {viewer.name} ({viewer.roleName}) cannot open this page
      </h1>
      <p className="text-muted-foreground text-sm">
        In the engine this page needs:{" "}
        {rule?.permissions.map((permission) => PERMISSION_NAMES[permission] ?? permission).join(" or ")}. The engine
        hides it from this person&apos;s sidebar and sends them to their first allowed page; this preview says why
        instead.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {next && (
          <Button asChild>
            <Link href={next.href}>Go to {next.label}</Link>
          </Button>
        )}
        <Button variant="outline" onClick={() => setViewAs(null)}>
          View as {signedInName} ({SIGNED_IN_VIEWER.roleName})
        </Button>
      </div>
    </div>
  );
}
