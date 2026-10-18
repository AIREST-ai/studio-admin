"use client";
// F159: Chatwoot v4.18 customRoles/component/CustomRoleModal.vue + delete modal, in Studio dialogs.
// Texts from i18n/locale/en/customRole.json; permission rule from CustomRoleModal.vue watch().
import * as React from "react";

import { cn } from "cn";
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
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { SAVED_IN_PREVIEW } from "./roles-store";
import {
  AVAILABLE_CUSTOM_ROLE_PERMISSIONS,
  CONVERSATION_PARTICIPATING_PERMISSIONS,
  CONVERSATION_UNASSIGNED_PERMISSIONS,
  customRole,
  MANAGE_ALL_CONVERSATION_PERMISSIONS,
  type Permission,
  permissionLabels,
  type Role,
} from "./roles-table/data";

/** Chatwoot rule: checking "Manage all conversations" adds unassigned + participating; unchecking it removes only itself. */
export function togglePermission(current: Permission[], permission: Permission, checked: boolean): Permission[] {
  if (!checked) return current.filter((p) => p !== permission);
  const next = new Set([...current, permission]);
  if (permission === MANAGE_ALL_CONVERSATION_PERMISSIONS) {
    next.add(CONVERSATION_UNASSIGNED_PERMISSIONS);
    next.add(CONVERSATION_PARTICIPATING_PERMISSIONS);
  }
  return AVAILABLE_CUSTOM_ROLE_PERMISSIONS.filter((p) => next.has(p));
}

export type CustomRoleDialogState = { mode: "add" } | { mode: "edit"; role: Role } | null;

export function CustomRoleDialog({
  state,
  onOpenChange,
  roles,
  onSubmit,
}: {
  state: CustomRoleDialogState;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  onSubmit: (role: Role) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [touched, setTouched] = React.useState({ name: false, description: false, permissions: false });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setName(state.role.name);
      setDescription(state.role.description);
      setPermissions(state.role.permissions);
    } else {
      setName("");
      setDescription("");
      setPermissions([]);
    }
    setTouched({ name: false, description: false, permissions: false });
    setSaving(false);
    setSaveError(null);
  }, [state]);

  const isEdit = state?.mode === "edit";
  const nameInvalid = name.trim().length < 2;
  const descriptionInvalid = !description.trim();
  const permissionsInvalid = permissions.length < 1;
  const invalid = nameInvalid || descriptionInvalid || permissionsInvalid;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ name: true, description: true, permissions: true });
    if (invalid || !state || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (state.mode === "edit") {
        await onSubmit({ ...state.role, name: name.trim(), description: description.trim(), permissions });
        toast.success("Custom role updated successfully.", { description: SAVED_IN_PREVIEW });
      } else {
        const nextId = Math.max(0, ...roles.map((r) => r.customRoleId ?? 0)) + 1;
        await onSubmit(customRole(nextId, name.trim(), description.trim(), permissions));
        toast.success("Custom role added successfully.", { description: SAVED_IN_PREVIEW });
      }
      onOpenChange(false);
    } catch (error) {
      const msg = (error as Error).message;
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!state} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit custom role" : "Add custom role"}</DialogTitle>
            <DialogDescription>
              Custom roles allows you to create roles with specific permissions and access levels to suit the
              requirements of the organization.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={touched.name && nameInvalid}>
              <FieldLabel htmlFor="custom-role-name">Name</FieldLabel>
              <Input
                id="custom-role-name"
                autoFocus
                placeholder="Please enter a name."
                value={name}
                aria-invalid={touched.name && nameInvalid}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
              {touched.name && nameInvalid ? <FieldError>Name is required.</FieldError> : null}
            </Field>
            <Field data-invalid={touched.description && descriptionInvalid}>
              <FieldLabel htmlFor="custom-role-description">Description</FieldLabel>
              <Textarea
                id="custom-role-description"
                rows={3}
                placeholder="Please enter a description."
                value={description}
                aria-invalid={touched.description && descriptionInvalid}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, description: true }))}
              />
              {touched.description && descriptionInvalid ? <FieldError>Description is required.</FieldError> : null}
            </Field>
            <FieldSet data-invalid={touched.permissions && permissionsInvalid}>
              <FieldLegend
                variant="label"
                className={cn(touched.permissions && permissionsInvalid && "text-destructive")}
              >
                Permissions
              </FieldLegend>
              <div className="flex flex-col gap-2.5">
                {AVAILABLE_CUSTOM_ROLE_PERMISSIONS.map((permission) => (
                  <Field key={permission} orientation="horizontal">
                    <Checkbox
                      id={`perm-${permission}`}
                      checked={permissions.includes(permission)}
                      onCheckedChange={(value) => {
                        setPermissions((current) => togglePermission(current, permission, !!value));
                        setTouched((t) => ({ ...t, permissions: true }));
                      }}
                    />
                    <FieldLabel htmlFor={`perm-${permission}`} className="font-normal">
                      {permissionLabels[permission]}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
              {touched.permissions && permissionsInvalid ? <FieldError>Permissions are required.</FieldError> : null}
            </FieldSet>
          </FieldGroup>
          {saveError ? (
            <p role="alert" data-role-save-error="" className="text-destructive text-sm">
              {saveError}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={invalid || saving}>
              {saving ? "Saving…" : isEdit ? "Update" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCustomRoleDialog({
  role,
  onOpenChange,
  onConfirm,
}: {
  role: Role | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (role: Role) => Promise<void>;
}) {
  return (
    <AlertDialog open={!!role} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
          <AlertDialogDescription>Are you sure to delete {role?.name} ?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, keep {role?.name}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (!role) return;
              void onConfirm(role).then(
                () => toast.success("Custom role deleted successfully.", { description: SAVED_IN_PREVIEW }),
                (error: Error) => toast.error(error.message),
              );
            }}
          >
            Yes, delete {role?.name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
