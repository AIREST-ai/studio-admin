"use client";
// F159: Chatwoot v4.18 AddAgent.vue, EditAgent.vue and the agents delete modal, in Studio dialogs.
// Texts from i18n/locale/en/agentMgmt.json.
import * as React from "react";

import { LockKeyhole } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { Role } from "../../roles/_components/roles-table/data";
import { roleKeyOf } from "../../roles/_components/roles-table/data";
import { isChangedElsewhere, notSavedReason } from "./agents-store";
import { type Availability, availabilityLabels, nowJoinedDate, type UserRow } from "./data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RoleSelect({
  id,
  roles,
  value,
  onChange,
  invalid,
}: {
  id: string;
  roles: Role[];
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder="Please select a role" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {roles.map((role) => (
            <SelectItem key={role.key} value={role.key}>
              {role.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function roleFields(key: string): Pick<UserRow, "role" | "customRoleId"> {
  if (key.startsWith("custom_")) return { role: "agent", customRoleId: Number(key.slice(7)) };
  return { role: key === "administrator" ? "administrator" : "agent", customRoleId: null };
}

// F-25 (F-24's note: "Agent added/updated successfully" came before the preview server answered): the three windows
// below say "successfully" only after the server saved the change, as the macro editor does (F-24). Until then the
// button says "Saving…"; when the save is refused the window stays open with what was typed and says "Not saved
// (reason)", and the table does not keep the unsaved change (./agents-store.ts).
export function AddAgentDialog({
  open,
  onOpenChange,
  roles,
  agents,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  agents: UserRow[];
  /** Resolves when the preview server saved the new agent; rejects with the reason when it did not. */
  onAdd: (agent: UserRow) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [roleKey, setRoleKey] = React.useState("agent");
  const [email, setEmail] = React.useState("");
  const [touched, setTouched] = React.useState({ name: false, email: false });
  const [apiError, setApiError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName("");
      setRoleKey("agent");
      setEmail("");
      setTouched({ name: false, email: false });
      setApiError("");
      setSaveError("");
    }
  }, [open]);

  const nameInvalid = !name.trim();
  const emailInvalid = !EMAIL_RE.test(email.trim());
  const roleInvalid = !roleKey;
  const invalid = nameInvalid || emailInvalid || roleInvalid;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setTouched({ name: true, email: true });
    if (invalid) return;
    const normalized = email.trim().toLowerCase();
    if (agents.some((agent) => agent.email.toLowerCase() === normalized)) {
      setApiError("Agent email already in use, Please try another email address");
      toast.error("Agent email already in use, Please try another email address");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await onAdd({
        id: Math.max(0, ...agents.map((a) => a.id)) + 1,
        name: name.trim(),
        email: normalized,
        ...roleFields(roleKey),
        availability: "offline",
        confirmed: false,
        provider: "email",
        teams: [],
        inboxes: [],
        joinedDate: nowJoinedDate(),
      });
    } catch (error) {
      const reason = notSavedReason(error);
      setSaveError(reason);
      setSaving(false);
      // A 409 already said "Not saved: changed in another tab or device" (lib/cw/store.ts); anything else is said here.
      if (!isChangedElsewhere(error))
        toast.error(`Not saved (${reason})`, {
          description: "The agent was not added. What you typed is still in this window: try Add Agent again.",
        });
      return;
    }
    setSaving(false);
    toast.success("Agent added successfully");
    onOpenChange(false);
  }

  return (
    // While the server has not answered, the window stays open (closing it would lose the draft the failure keeps).
    <Dialog open={open} onOpenChange={(next) => (saving && !next ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Add agent to your team</DialogTitle>
            <DialogDescription>
              You can add people who will be able to handle support for your inboxes.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={touched.name && nameInvalid}>
              <FieldLabel htmlFor="add-agent-name">Agent Name</FieldLabel>
              <Input
                id="add-agent-name"
                autoFocus
                placeholder="Please enter a name of the agent"
                value={name}
                aria-invalid={touched.name && nameInvalid}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
            </Field>
            <Field data-invalid={roleInvalid}>
              <FieldLabel htmlFor="add-agent-role">Role</FieldLabel>
              <RoleSelect
                id="add-agent-role"
                roles={roles}
                value={roleKey}
                onChange={setRoleKey}
                invalid={roleInvalid}
              />
              {roleInvalid ? <FieldError>Role is required</FieldError> : null}
            </Field>
            <Field data-invalid={(touched.email && emailInvalid) || !!apiError}>
              <FieldLabel htmlFor="add-agent-email">Email Address</FieldLabel>
              <Input
                id="add-agent-email"
                type="email"
                placeholder="Please enter an email address of the agent"
                value={email}
                aria-invalid={(touched.email && emailInvalid) || !!apiError}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setApiError("");
                }}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              />
              {apiError ? <FieldError>{apiError}</FieldError> : null}
            </Field>
          </FieldGroup>
          {saveError ? (
            <p role="alert" data-agent-save-error="" className="text-destructive text-sm">
              Not saved ({saveError}). The agent was not added.
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={invalid || saving} aria-busy={saving || undefined}>
              {saving ? "Saving…" : "Add Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditAgentDialog({
  agent,
  onOpenChange,
  roles,
  onSave,
}: {
  agent: UserRow | null;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  /** Resolves when the preview server saved the change; rejects with the reason when it did not. */
  onSave: (next: UserRow, previous: UserRow) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [roleKey, setRoleKey] = React.useState("");
  const [availability, setAvailability] = React.useState<Availability | "">("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  React.useEffect(() => {
    if (agent) {
      setName(agent.name);
      setRoleKey(roleKeyOf(agent));
      setAvailability(agent.availability);
      setSaveError("");
    }
  }, [agent]);

  const nameInvalid = !name.trim();
  const roleInvalid = !roles.some((r) => r.key === roleKey);
  const availabilityInvalid = !availability;
  const invalid = nameInvalid || roleInvalid || availabilityInvalid;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!agent || invalid || !availability || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave({ ...agent, name: name.trim(), ...roleFields(roleKey), availability }, agent);
    } catch (error) {
      const reason = notSavedReason(error);
      setSaveError(reason);
      setSaving(false);
      if (!isChangedElsewhere(error))
        toast.error(`Not saved (${reason})`, {
          description: "The agent was not updated. Your changes are still in this window: try Edit Agent again.",
        });
      return;
    }
    setSaving(false);
    toast.success("Agent updated successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!agent} onOpenChange={(next) => (saving && !next ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Edit agent - {agent?.name}</DialogTitle>
            <DialogDescription className="sr-only">Change the agent name, role and availability.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={nameInvalid}>
              <FieldLabel htmlFor="edit-agent-name">Agent Name</FieldLabel>
              <Input
                id="edit-agent-name"
                placeholder="Please enter a name of the agent"
                value={name}
                aria-invalid={nameInvalid}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field data-invalid={roleInvalid}>
              <FieldLabel htmlFor="edit-agent-role">Role</FieldLabel>
              <RoleSelect
                id="edit-agent-role"
                roles={roles}
                value={roleKey}
                onChange={setRoleKey}
                invalid={roleInvalid}
              />
              {roleInvalid ? <FieldError>Role is required</FieldError> : null}
            </Field>
            <Field data-invalid={availabilityInvalid}>
              <FieldLabel htmlFor="edit-agent-availability">Availability</FieldLabel>
              <Select value={availability} onValueChange={(v) => setAvailability(v as Availability)}>
                <SelectTrigger id="edit-agent-availability" className="w-full" aria-invalid={availabilityInvalid}>
                  <SelectValue placeholder="Please select an availability status" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {(Object.keys(availabilityLabels) as Availability[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {availabilityLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {availabilityInvalid ? <FieldError>Availability is required</FieldError> : null}
            </Field>
          </FieldGroup>
          {saveError ? (
            <p role="alert" data-agent-save-error="" className="text-destructive text-sm">
              Not saved ({saveError}). The agent was not updated.
            </p>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <div>
              {agent?.provider !== "saml" ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  // F-25: the preview sends no email, so it must not say one was sent (Chatwoot's line is
                  // "An email with reset password instructions has been sent to the agent"). Same as Resend invite.
                  onClick={() =>
                    toast.info(`Reset password email not sent to ${agent?.email}`, {
                      description:
                        "Preview — simulated: this preview sends no email. In the engine, reset password instructions would be emailed to this address.",
                    })
                  }
                >
                  <LockKeyhole data-icon="inline-start" />
                  Reset Password
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={invalid || saving} aria-busy={saving || undefined}>
                {saving ? "Saving…" : "Edit Agent"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAgentDialog({
  agent,
  onOpenChange,
  onConfirm,
}: {
  agent: UserRow | null;
  onOpenChange: (open: boolean) => void;
  /** Resolves when the preview server saved the deletion; rejects with the reason when it did not. */
  onConfirm: (agent: UserRow) => Promise<void>;
}) {
  return (
    <AlertDialog open={!!agent} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
          <AlertDialogDescription>Are you sure to delete {agent?.name}?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, Keep {agent?.name}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (!agent) return;
              // F-25: "deleted successfully" only after the server saved the deletion; until then the toast says it is
              // deleting, and when it was not saved the agent comes back to the list (./agents-store.ts deleteAgent).
              const target = agent;
              const toastId = `agent-delete-${target.id}-${Date.now()}`;
              toast.loading(`Deleting “${target.name}”…`, { id: toastId });
              onConfirm(target).then(
                () => toast.success("Agent deleted successfully", { id: toastId }),
                (error: unknown) => {
                  // A 409 already said "Not saved: changed in another tab or device" (lib/cw/store.ts).
                  if (isChangedElsewhere(error)) toast.dismiss(toastId);
                  else
                    toast.error(`Not saved (${notSavedReason(error)})`, {
                      id: toastId,
                      description: `“${target.name}” was not deleted. It is back in the list.`,
                    });
                },
              );
            }}
          >
            Yes, Delete {agent?.name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
