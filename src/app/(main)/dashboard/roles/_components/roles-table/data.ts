// F159: Chatwoot v4.18 Custom Roles merged into Studio's Roles table.
// The six permission keys and their labels come from Chatwoot (constants/permissions.js + i18n/en/customRole.json).
// System rows (Administrator, Agent) are Chatwoot's two built-in roles, kept in Studio's grouped table.

export const AVAILABLE_CUSTOM_ROLE_PERMISSIONS = [
  "conversation_manage",
  "conversation_unassigned_manage",
  "conversation_participating_manage",
  "contact_manage",
  "report_manage",
  "knowledge_base_manage",
] as const;

export type Permission = (typeof AVAILABLE_CUSTOM_ROLE_PERMISSIONS)[number];

export const MANAGE_ALL_CONVERSATION_PERMISSIONS: Permission = "conversation_manage";
export const CONVERSATION_UNASSIGNED_PERMISSIONS: Permission = "conversation_unassigned_manage";
export const CONVERSATION_PARTICIPATING_PERMISSIONS: Permission = "conversation_participating_manage";

export const permissionLabels: Record<Permission, string> = {
  conversation_manage: "Manage all conversations",
  conversation_unassigned_manage: "Manage unassigned conversations and those assigned to them",
  conversation_participating_manage: "Manage participating conversations and those assigned to them",
  contact_manage: "Manage contacts",
  report_manage: "Manage reports",
  knowledge_base_manage: "Manage knowledge base",
};

// Short labels for badges in the table and matrix header (full label is in the tooltip/title).
export const permissionShortLabels: Record<Permission, string> = {
  conversation_manage: "All conversations",
  conversation_unassigned_manage: "Unassigned conversations",
  conversation_participating_manage: "Participating conversations",
  contact_manage: "Contacts",
  report_manage: "Reports",
  knowledge_base_manage: "Knowledge base",
};

export type RoleGroup = "System roles" | "Custom roles";

export type Role = {
  /** "administrator" | "agent" for system roles, "custom_<id>" for custom roles */
  key: string;
  customRoleId: number | null;
  name: string;
  description: string;
  group: RoleGroup;
  accessLevel: "Full" | "Scoped";
  permissions: Permission[];
};

export const systemRoles: Role[] = [
  {
    key: "administrator",
    customRoleId: null,
    name: "Administrator",
    description: "Full access to every inbox, conversation, report and account setting.",
    group: "System roles",
    accessLevel: "Full",
    permissions: [...AVAILABLE_CUSTOM_ROLE_PERMISSIONS],
  },
  {
    key: "agent",
    customRoleId: null,
    name: "Agent",
    description: "Views and responds to conversations in the inboxes they are added to.",
    group: "System roles",
    accessLevel: "Scoped",
    permissions: ["conversation_manage", "conversation_unassigned_manage", "conversation_participating_manage", "contact_manage"],
  },
];

export function customRole(
  id: number,
  name: string,
  description: string,
  permissions: Permission[],
): Role {
  return {
    key: `custom_${id}`,
    customRoleId: id,
    name,
    description,
    group: "Custom roles",
    accessLevel: "Scoped",
    permissions,
  };
}

export const roles: Role[] = [
  ...systemRoles,
  customRole(1, "Support Lead", "Oversees the support queue, reassigns conversations and reviews team reports.", [
    "conversation_manage",
    "conversation_unassigned_manage",
    "conversation_participating_manage",
    "contact_manage",
    "report_manage",
  ]),
  customRole(2, "Tier 1 Support", "Picks up new conversations from the unassigned queue and hands off escalations.", [
    "conversation_unassigned_manage",
    "conversation_participating_manage",
  ]),
  customRole(3, "Sales Agent", "Works leads coming in from WhatsApp and the website widget.", [
    "conversation_participating_manage",
    "contact_manage",
  ]),
  customRole(4, "Content Editor", "Writes, updates and publishes help center articles.", ["knowledge_base_manage"]),
  customRole(5, "Reporting Analyst", "Prepares the weekly CSAT, SLA and agent performance reviews.", ["report_manage"]),
];

export function roleKeyOf(user: { role: "administrator" | "agent"; customRoleId: number | null }) {
  return user.customRoleId ? `custom_${user.customRoleId}` : user.role;
}
