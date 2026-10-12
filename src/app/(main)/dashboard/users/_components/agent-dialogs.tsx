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
  onAdd: (agent: UserRow) => void;
}) {
  const [name, setName] = React.useState("");
  const [roleKey, setRoleKey] = React.useState("agent");
  const [email, setEmail] = React.useState("");
  const [touched, setTouched] = React.useState({ name: false, email: false });
  const [apiError, setApiError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName("");
      setRoleKey("agent");
      setEmail("");
      setTouched({ name: false, email: false });
      setApiError("");
    }
  }, [open]);

  const nameInvalid = !name.trim();
  const emailInvalid = !EMAIL_RE.test(email.trim());
  const roleInvalid = !roleKey;
  const invalid = nameInvalid || emailInvalid || roleInvalid;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ name: true, email: true });
    if (invalid) return;
    const normalized = email.trim().toLowerCase();
    if (agents.some((agent) => agent.email.toLowerCase() === normalized)) {
      setApiError("Agent email already in use, Please try another email address");
      toast.error("Agent email already in use, Please try another email address");
      return;
    }
    onAdd({
      id: Math.max(0, ...agents.map((a) => a.id)) + 1,
      name: name.trim(),
      email: normalized,
      ...roleFields(roleKey),
      availability: "offline",
      confirmed: false,
      provider: "email",
      team: "Support",
      inboxes: [],
      joinedDate: nowJoinedDate(),
    });
    toast.success("Agent added successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Add agent to your team</DialogTitle>
            <DialogDescription>You can add people who will be able to handle support for your inboxes.</DialogDescription>
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
              <RoleSelect id="add-agent-role" roles={roles} value={roleKey} onChange={setRoleKey} invalid={roleInvalid} />
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
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={invalid}>
              Add Agent
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
  onSave: (agent: UserRow) => void;
}) {
  const [name, setName] = React.useState("");
  const [roleKey, setRoleKey] = React.useState("");
  const [availability, setAvailability] = React.useState<Availability | "">("");

  React.useEffect(() => {
    if (agent) {
      setName(agent.name);
      setRoleKey(roleKeyOf(agent));
      setAvailability(agent.availability);
    }
  }, [agent]);

  const nameInvalid = !name.trim();
  const roleInvalid = !roles.some((r) => r.key === roleKey);
  const availabilityInvalid = !availability;
  const invalid = nameInvalid || roleInvalid || availabilityInvalid;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!agent || invalid || !availability) return;
    onSave({ ...agent, name: name.trim(), ...roleFields(roleKey), availability });
    toast.success("Agent updated successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!agent} onOpenChange={onOpenChange}>
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
              <RoleSelect id="edit-agent-role" roles={roles} value={roleKey} onChange={setRoleKey} invalid={roleInvalid} />
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
                      <SelectItem key={key} value={key} disabled={agent?.availability === key && availability !== key}>
                        {availabilityLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {availabilityInvalid ? <FieldError>Availability is required</FieldError> : null}
            </Field>
          </FieldGroup>
          <DialogFooter className="sm:justify-between">
            <div>
              {agent?.provider !== "saml" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toast.success("An email with reset password instructions has been sent to the agent")}
                >
                  <LockKeyhole data-icon="inline-start" />
                  Reset Password
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={invalid}>
                Edit Agent
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
  onConfirm: (agent: UserRow) => void;
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
              onConfirm(agent);
              toast.success("Agent deleted successfully");
            }}
          >
            Yes, Delete {agent?.name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
