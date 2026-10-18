"use client";
// F161: custom roles live in a module store (zustand, like src/lib/cw/store.ts), and F-26 saves them in the preview
// (/api/settings-preview, list "customRoles") so a role added, edited, reviewed or deleted survives a page reload.
import { create } from "zustand";

import { createSavedList, SAVED_IN_PREVIEW } from "../../settings/_components/settings-preview-client";
import { type Role, roles, systemRoles } from "./roles-table/data";

export { SAVED_IN_PREVIEW };

export type SavedCustomRole = Role & { id: number };

const seedCustomRoles: SavedCustomRole[] = roles
  .filter((r) => r.group === "Custom roles")
  .map((r, i) => ({ ...r, id: r.customRoleId ?? i + 1 }));

export const customRolesStore = createSavedList<SavedCustomRole>("customRoles", seedCustomRoles);

export const useRolesStore = create<{ roles: Role[] }>(() => ({ roles }));

if (typeof window !== "undefined") {
  customRolesStore.subscribe(() => {
    useRolesStore.setState({
      roles: [...systemRoles, ...customRolesStore.get().map(({ id, ...r }) => ({ ...r, customRoleId: id }))],
    });
  });
}

type Updater<T> = T | ((previous: T) => T);

export function setRoles(next: Updater<Role[]>): void {
  useRolesStore.setState((state) => ({ roles: typeof next === "function" ? next(state.roles) : next }));
}

export async function saveCustomRole(role: Role): Promise<void> {
  const id = role.customRoleId ?? customRolesStore.nextId();
  await customRolesStore.save({ ...role, id, customRoleId: id, key: `custom_${id}` });
}

export async function deleteCustomRole(role: Role): Promise<void> {
  const id = role.customRoleId ?? Number(role.key.replace(/^custom_/, ""));
  if (id) await customRolesStore.remove(id);
}
