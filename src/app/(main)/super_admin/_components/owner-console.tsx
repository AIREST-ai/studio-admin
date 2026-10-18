"use client";

// F-17 (T-91, Fahad 13 Oct «من لوحة تحكمي أنا للموقع كله», «تخفى لدي في لوحة تحكم الادارة»): the owner shows or hides
// each big section of the site for everyone. One row per section with its switch, as each account's features in
// Chatwoot's Super Admin Console (enterprise/app/views/fields/account_features_field/_form.html.erb: a grid of
// name + on / off box). A switch saves at once (PUT /api/owner-console) over the revision this page read; when another
// tab or device saved first, nothing is written and the page says so (409), as every other preview save (F-3).
import { useState } from "react";

import Link from "next/link";

import { format } from "date-fns";
import { Eye, Info, Lock } from "lucide-react";
import { toast } from "sonner";

import { setViewAs } from "@/app/(main)/dashboard/_components/view-as";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SIGNED_IN_VIEWER } from "@/lib/cw/view-as";
import { isShown, SITE_SECTIONS, type SiteSection, type SiteSectionsState } from "@/lib/owner/site-sections";
import { useSiteSections, useSiteSectionsControl } from "@/lib/owner/site-sections-context";

const when = (iso: string) => format(new Date(iso), "d MMM yyyy, HH:mm");

async function save(id: string, shown: boolean, baseRev: number) {
  const response = await fetch("/api/owner-console", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, shown, baseRev }),
  });
  const body = (await response.json().catch(() => null)) as (SiteSectionsState & { error?: string }) | null;
  return { status: response.status, body };
}

export function OwnerConsole() {
  const state = useSiteSections();
  const control = useSiteSectionsControl();
  const [busy, setBusy] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [last, setLast] = useState<string>("");
  const shownCount = SITE_SECTIONS.filter((section) => isShown(state, section.id)).length;

  async function toggle(section: SiteSection, shown: boolean) {
    if (busy || stale) return;
    setBusy(section.id);
    try {
      const { status, body } = await save(section.id, shown, state.rev);
      if (status === 200 && body) {
        control?.accept(body);
        const line = `${section.title} ${shown ? "shown" : "hidden"} for the whole site. Saved in the preview, revision ${body.rev}.`;
        setLast(line);
        toast.success(`${section.title} ${shown ? "shown" : "hidden"} for the whole site`, {
          id: "owner-console-saved",
          description: `Saved in the preview, revision ${body.rev}.`,
        });
        return;
      }
      if (status === 409) {
        setStale(true);
        setLast("Not saved: the sections were changed in another tab or device.");
        toast.error("Not saved: changed in another tab or device", {
          id: "owner-console-not-saved",
          description: "Reload the page to see the latest version, then make the change again.",
          duration: Number.POSITIVE_INFINITY,
          action: { label: "Reload", onClick: () => window.location.reload() },
        });
        return;
      }
      const reason = body?.error ?? `the preview server answered ${status}`;
      setLast(`Not saved: ${reason}.`);
      toast.error("Not saved in the preview", { id: "owner-console-not-saved", description: reason });
    } catch (error) {
      setLast(`Not saved: ${(error as Error).message}.`);
      toast.error("Not saved in the preview", {
        id: "owner-console-not-saved",
        description: (error as Error).message,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl leading-none tracking-tight">Owner console</h1>
        <p className="text-muted-foreground text-sm">
          Show or hide the site&apos;s sections for everyone. A hidden section leaves the sidebar, the menus, the search
          and the settings links, and its pages say the owner hid it. Its pages and data are kept.
        </p>
      </header>

      <Alert
        data-owner-console-preview
        className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50"
      >
        <Info aria-hidden="true" />
        <AlertTitle>Preview: no sign-in, any visitor of this preview can open it</AlertTitle>
        <AlertDescription className="text-amber-950/80 dark:text-amber-50/80">
          In the engine only a super admin can open its Super Admin Console. This preview has no sign-in, like the rest
          of the preview. Staff viewing the preview as another agent (View as) are not offered this console.
        </AlertDescription>
      </Alert>

      <section aria-labelledby="site-sections-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="grid gap-0.5">
            <h2 id="site-sections-title" className="font-semibold text-lg">
              Site sections
            </h2>
            <p className="text-muted-foreground text-xs" data-owner-console-rev={state.rev}>
              {shownCount} of {SITE_SECTIONS.length} shown · Revision {state.rev}
              {state.savedAt ? (
                <span suppressHydrationWarning> · last saved {when(state.savedAt)}</span>
              ) : (
                " · no change yet, every section follows its default"
              )}
            </p>
          </div>
          {stale && (
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          )}
        </div>
        <p role="status" aria-live="polite" data-owner-console-status className="min-h-4 text-xs">
          {last}
        </p>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {SITE_SECTIONS.map((section) => {
            const shown = isShown(state, section.id);
            const override = state.overrides.find((item) => item.id === section.id);
            const switchId = `site-section-${section.id}`;
            return (
              <li
                key={section.id}
                data-site-section-row={section.id}
                data-shown={shown ? "true" : "false"}
                className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 shadow-xs"
              >
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={switchId} className="font-medium text-sm">
                      {section.title}
                    </label>
                    <Badge variant={shown ? "secondary" : "outline"} className="font-normal">
                      {shown ? "Shown" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{section.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {override ? (
                      <span suppressHydrationWarning>
                        Changed by {override.by} · {when(override.changedAt)}
                      </span>
                    ) : (
                      <>
                        Default: {section.defaultShown ? "shown" : "hidden"}
                        {section.defaultFrom === "features.ts" ? " (src/config/features.ts)" : ""}
                      </>
                    )}
                    {section.chatwootFlag && (
                      <>
                        {" · "}
                        <span>The engine feature {section.chatwootFlag.name}</span>
                      </>
                    )}
                  </p>
                </div>
                <Switch
                  id={switchId}
                  data-section-switch={section.id}
                  checked={shown}
                  disabled={busy !== null || stale}
                  aria-label={`Show ${section.title} for the whole site`}
                  onCheckedChange={(checked) => void toggle(section, checked)}
                />
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground text-xs">
          Inbox (conversations) and Settings always stay: they are where the team works and where the owner manages the
          site. Every change is written to the activity log (Settings &gt; Audit Logs) and shows in the bell under
          Changes.
        </p>
      </section>
    </div>
  );
}

/** A browser viewing the preview as another agent: the console is the owner's, so it is not opened for them. */
export function OwnerConsoleDenied({ name, role }: { name: string; role: string }) {
  return (
    <div data-owner-console-denied className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
      <Lock className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="font-semibold text-xl">The Owner console is for the site owner</h1>
      <p className="text-muted-foreground text-sm">
        This browser views the preview as {name} ({role}). In the engine only a super admin opens the Super Admin
        Console, so staff are not given this page.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard/chat">Go to Inbox</Link>
        </Button>
        <Button variant="outline" onClick={() => setViewAs(null)}>
          <Eye />
          View as {SIGNED_IN_VIEWER.name} ({SIGNED_IN_VIEWER.roleName})
        </Button>
      </div>
    </div>
  );
}
