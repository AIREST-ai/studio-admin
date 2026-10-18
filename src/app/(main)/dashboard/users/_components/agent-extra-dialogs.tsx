"use client";
// F161: Studio-before row menu items "View profile" and "Manage team" (users-columns.tsx in dd8f5a9), restored by
// Fahad's rule "restore what was removed without a decision". Not in Chatwoot; they work on the page's mock store.
import * as React from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { isChangedElsewhere, notSavedReason } from "./agents-store";
import { availabilityLabels, type UserRow, userStatus } from "./data";

export function ViewProfileDialog({
  agent,
  roleText,
  onOpenChange,
}: {
  agent: UserRow | null;
  roleText: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!agent} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {agent ? (
          <>
            <DialogHeader>
              <DialogTitle className="capitalize">{agent.name}</DialogTitle>
              <DialogDescription>{agent.email}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <span className="text-muted-foreground">Role</span>
              <span>{roleText}</span>
              <span className="text-muted-foreground">Teams</span>
              <span>{agent.teams.length ? agent.teams.join(", ") : "—"}</span>
              <span className="text-muted-foreground">Inboxes</span>
              <span>{agent.inboxes.length ? agent.inboxes.join(", ") : "—"}</span>
              <span className="text-muted-foreground">Availability</span>
              <span>{availabilityLabels[agent.availability]}</span>
              <span className="text-muted-foreground">Status</span>
              <span>{userStatus(agent)}</span>
              <span className="text-muted-foreground">Sign-in</span>
              <span>{agent.provider === "saml" ? "SAML" : "Email"}</span>
              <span className="text-muted-foreground">Joined date</span>
              <span>{agent.joinedDate}</span>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ManageTeamDialog({
  agent,
  teamNames,
  onOpenChange,
  onSave,
}: {
  agent: UserRow | null;
  teamNames: string[];
  onOpenChange: (open: boolean) => void;
  /** F-25: resolves when the preview server saved the teams; rejects with the reason when it did not. */
  onSave: (agentId: number, teams: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  React.useEffect(() => {
    if (agent) {
      setSelected(agent.teams);
      setSaveError("");
    }
  }, [agent]);

  // F-25 (F-24's note, same fault as the agent windows): "Teams updated" only after the preview server saved the teams;
  // until then the button says "Saving…", and when it was not saved the window stays open with the choice and says
  // "Not saved (reason)".
  async function save(target: UserRow) {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave(target.id, selected);
    } catch (error) {
      const reason = notSavedReason(error);
      setSaveError(reason);
      setSaving(false);
      if (!isChangedElsewhere(error))
        toast.error(`Not saved (${reason})`, {
          description: `The teams of ${target.name} were not changed. Your choice is still in this window: try Save again.`,
        });
      return;
    }
    setSaving(false);
    toast.success(`Teams updated for ${target.name}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={!!agent} onOpenChange={(next) => (saving && !next ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        {agent ? (
          <form
            className="grid gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              void save(agent);
            }}
          >
            <DialogHeader>
              <DialogTitle>Manage team</DialogTitle>
              <DialogDescription>Choose the teams {agent.name} belongs to (Settings &gt; Teams).</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              {teamNames.map((t) => (
                <Label key={t} className="flex items-center gap-3 font-normal">
                  <Checkbox
                    checked={selected.includes(t)}
                    onCheckedChange={(value) =>
                      setSelected((list) => (value ? [...list, t] : list.filter((x) => x !== t)))
                    }
                  />
                  {t}
                </Label>
              ))}
            </div>
            {saveError ? (
              <p role="alert" data-agent-save-error="" className="text-destructive text-sm">
                Not saved ({saveError}). The teams were not changed.
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
