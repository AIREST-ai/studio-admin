"use client";

// T-75: the create dialogs of the Inbox bar's Folders and Teams (sidebar/section-subnav.tsx). Folders start empty and
// teams too (T-74, Fahad: the admin creates them from scratch), so each list keeps its create button.
import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { teamsStore } from "@/app/(main)/dashboard/settings/teams/_components/teams-store";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FilterDialog } from "./cw-dialogs";

export type InboxCreateKind = "folder" | "team";

type Open = { onOpenChange: (open: boolean) => void };

export function InboxCreateDialog({ kind, onOpenChange }: Open & { kind: InboxCreateKind }) {
  if (kind === "folder") return <FilterDialog create onOpenChange={onOpenChange} />;
  return <CreateTeamDialog onOpenChange={onOpenChange} />;
}

// The first step of Settings > Teams > Create (team-wizard.tsx), saved to the same shared teams store, so the team is in
// Settings, the assignment pickers and this list at once. Agents are added from the team's Settings page.
function CreateTeamDialog({ onOpenChange }: Open) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [autoAssign, setAutoAssign] = useState(true);
  const [error, setError] = useState(false);

  const submit = () => {
    const title = name.trim();
    if (!title) {
      setError(true);
      return;
    }
    const id = teamsStore.nextId();
    // Same slug as the wizard (the team's view URL); a taken one gets the id, so two teams never share a view.
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9؀-ۿ]+/g, "-")
        .replace(/^-|-$/g, "") || `team-${id}`;
    const slug = teamsStore.get().some((team) => team.slug === base) ? `${base}-${id}` : base;
    teamsStore.save({ id, name: title, slug, description: description.trim(), icon: "", autoAssign, members: [] });
    toast.success("Team created successfully.");
    onOpenChange(false);
    router.push(`/dashboard/chat/teams/${slug}`);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Teams group agents by what they handle. Add agents to it later in{" "}
            <Link href="/dashboard/settings/teams" className="underline underline-offset-2">
              Settings &gt; Teams
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="inbox-team-name">Team name</Label>
            <Input
              id="inbox-team-name"
              placeholder="Example: Sales, Customer Support"
              value={name}
              aria-invalid={error || undefined}
              onChange={(event) => {
                setName(event.target.value);
                setError(false);
              }}
            />
            {error && <p className="text-destructive text-xs">Team name is required.</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inbox-team-description">Team Description</Label>
            <Textarea
              id="inbox-team-description"
              placeholder="Short description about this team."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="inbox-team-auto-assign"
              checked={autoAssign}
              onCheckedChange={(checked) => setAutoAssign(checked === true)}
            />
            <Label htmlFor="inbox-team-auto-assign" className="font-normal">
              Allow auto assign for this team.
            </Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit}>Create team</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
