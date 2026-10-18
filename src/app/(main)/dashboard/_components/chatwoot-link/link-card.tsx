"use client";

// L-2 + V-7B: the "Live Engine" card in Settings → Integrations: the switch between
// preview data and the live engine, which sections are linked, and what the server found when it
// last read the live engine (address, version, identity, lastEventAt, or the problem in words).
// Switching asks first and is written in the audit log by the server (POST /api/chatwoot/mode).
// The token never comes here; the server alone reads it.
import * as React from "react";

import { useRouter } from "next/navigation";

import { Link2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  type LinkSection,
  type LinkState,
  type LinkStatus,
  PHASE1_SECTIONS,
  READ_ONLY_TEXT,
} from "@/lib/chatwoot-link-types";

import { useChatwootLink } from "./link-context";
import { useLinkStatus } from "./use-linked";

const SECTION_LABEL: Record<LinkSection, string> = {
  conversations: "Conversations",
  contacts: "Contacts",
  lists: "Lists",
  automation: "Automation",
  reports: "Reports",
  notifications: "Notifications",
  helpCenter: "Help Center",
  campaigns: "Campaigns",
};

function StatusLines({
  status,
  error,
  loading,
}: {
  status: LinkStatus | null;
  error: string | null;
  loading: boolean;
}) {
  if (loading) return <p className="text-muted-foreground text-xs">Checking…</p>;
  if (error) return <p className="text-destructive text-xs">Status not read: {error}</p>;
  if (!status) return null;
  if (status.mode !== "linked")
    return (
      <p className="text-muted-foreground text-xs" data-chatwoot-status="preview">
        Preview: every page shows the preview data, and the server does not call the live engine.
      </p>
    );
  return (
    <dl
      className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs"
      data-chatwoot-status={status.problem?.kind ?? "linked"}
    >
      {status.problem && (
        <>
          <dt className="text-muted-foreground">Problem</dt>
          <dd className="font-medium text-destructive" data-chatwoot-problem={status.problem.kind}>
            {status.problem.message}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Address</dt>
      <dd>{status.target ?? "—"}</dd>
      <dt className="text-muted-foreground">Reached</dt>
      <dd>
        {status.reachable === null ? "not asked" : status.reachable ? `yes, the engine ${status.version ?? "?"}` : "no"}
      </dd>
      <dt className="text-muted-foreground">Identity check</dt>
      <dd>
        {status.identity
          ? `passed: ${status.identity.accountName} (account ${status.identity.accountId}), the engine ${status.identity.version}`
          : "not passed"}
      </dd>
      <dt className="text-muted-foreground">Last event</dt>
      <dd data-chatwoot-last-event={status.lastEventAt ?? "none"}>
        {status.lastEventAt ? new Date(status.lastEventAt).toLocaleString("en-GB") : "none"}
      </dd>
      <dt className="text-muted-foreground">Checked</dt>
      <dd>{status.checkedAt ? new Date(status.checkedAt).toLocaleString("en-GB") : "—"}</dd>
    </dl>
  );
}

export function ChatwootLinkCard() {
  const router = useRouter();
  const { state, setState } = useChatwootLink();
  const status = useLinkStatus();
  const linked = state.mode === "linked" && !state.disabled;
  const [asking, setAsking] = React.useState<"on" | "off" | null>(null);
  const [pick, setPick] = React.useState<Record<string, boolean>>({
    conversations: true,
    contacts: true,
    lists: true,
    automation: true,
    reports: true,
  });
  const [saving, setSaving] = React.useState(false);

  async function save(mode: "preview" | "linked", sections: Record<string, boolean>) {
    setSaving(true);
    try {
      const response = await fetch("/api/chatwoot/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sections, confirm: true }),
      });
      const body = (await response.json().catch(() => null)) as { state?: LinkState; error?: string } | null;
      if (!response.ok || !body?.state)
        throw new Error(body?.error ?? `the preview server answered ${response.status}`);
      setState(body.state);
      router.refresh();
      status.reload();
      toast.success(mode === "linked" ? "Linked to the live engine" : "Link off: preview data again");
    } catch (error) {
      toast.error(`Not switched: ${(error as Error).message}`);
    } finally {
      setSaving(false);
      setAsking(null);
    }
  }

  const picked = PHASE1_SECTIONS.filter((section) => pick[section]);

  return (
    <div className="mx-6 flex flex-col gap-3 rounded-xl border p-4" data-chatwoot-link-card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border">
            <Link2 className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 font-medium">
              Live Engine
              <Badge variant={linked ? "default" : "secondary"}>{linked ? "Linked" : "Preview"}</Badge>
            </span>
            <p className="text-muted-foreground text-sm">
              Read and manage conversations and contacts of the live engine instead of the preview data.{" "}
              {READ_ONLY_TEXT}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="chatwoot-link-switch" className="text-sm">
            {linked ? "Linked" : "Preview"}
          </Label>
          <Switch
            id="chatwoot-link-switch"
            checked={linked}
            disabled={state.disabled || saving}
            onCheckedChange={(on) => setAsking(on ? "on" : "off")}
            aria-label="Link to the live engine"
          />
        </div>
      </div>

      {state.disabled && (
        <p className="text-destructive text-xs">Turned off on this server: every page shows the preview data.</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Sections:</span>
        {PHASE1_SECTIONS.map((section) => (
          <span key={section} className="flex items-center gap-1">
            {SECTION_LABEL[section]}: {linked && state.sections[section] ? "linked" : "preview"}
          </span>
        ))}
        <span className="text-muted-foreground">Notifications: preview data.</span>
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
        <StatusLines status={status.status} error={status.error} loading={status.loading} />
        <div>
          <Button variant="outline" size="xs" onClick={status.reload} disabled={status.loading}>
            <RefreshCw /> Check again
          </Button>
        </div>
      </div>

      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && !saving && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{asking === "on" ? "Link to the live engine?" : "Turn the link off?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {asking === "on"
                ? "The picked sections will connect to the live engine instead of the preview data, for everyone who opens this workspace. The switch is written in the audit log."
                : "Every section goes back to the preview data, exactly as before. The switch is written in the audit log."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {asking === "on" && (
            <div className="flex flex-col gap-2">
              {PHASE1_SECTIONS.map((section) => (
                <Label key={section} className="flex items-center gap-2 font-normal text-sm">
                  <Checkbox
                    checked={Boolean(pick[section])}
                    onCheckedChange={(value) => setPick((current) => ({ ...current, [section]: value === true }))}
                  />
                  {SECTION_LABEL[section]}
                </Label>
              ))}
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <Lock className="size-3" /> {READ_ONLY_TEXT}
              </span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || (asking === "on" && picked.length === 0)}
              onClick={(event) => {
                event.preventDefault();
                void save(
                  asking === "on" ? "linked" : "preview",
                  asking === "on" ? Object.fromEntries(picked.map((section) => [section, true])) : {},
                );
              }}
            >
              {asking === "on" ? "Link" : "Turn off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
