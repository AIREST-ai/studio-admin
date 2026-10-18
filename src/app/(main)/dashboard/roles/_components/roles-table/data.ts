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
  /** Studio-before columns (kept by Fahad's rule): last review date, owner, review status. Not in Chatwoot. */
  lastReview: string;
  owner: string;
  status: RoleStatus;
};

export type RoleStatus = "Active" | "Needs review";

export function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const systemRoles: Role[] = [
  {
    key: "administrator",
    customRoleId: null,
    name: "Administrator",
    description: "Full access to every inbox, conversation, report and account setting.",
    group: "System roles",
    accessLevel: "Full",
    permissions: [...AVAILABLE_CUSTOM_ROLE_PERMISSIONS],
    lastReview: "Apr 12, 2025",
    owner: "System",
    status: "Active",
  },
  {
    key: "agent",
    customRoleId: null,
    name: "Agent",
    description: "Views and responds to conversations in the inboxes they are added to.",
    group: "System roles",
    accessLevel: "Scoped",
    // Not "Manage all conversations": a Chatwoot agent only works the inboxes they are added to.
    permissions: ["conversation_unassigned_manage", "conversation_participating_manage", "contact_manage"],
    lastReview: "May 1, 2025",
    owner: "System",
    status: "Active",
  },
];

export function customRole(
  id: number,
  name: string,
  description: string,
  permissions: Permission[],
  meta: Partial<Pick<Role, "lastReview" | "owner" | "status">> = {},
): Role {
  return {
    key: `custom_${id}`,
    customRoleId: id,
    name,
    description,
    group: "Custom roles",
    accessLevel: "Scoped",
    permissions,
    lastReview: meta.lastReview ?? todayLabel(),
    owner: meta.owner ?? "Arham Khan",
    status: meta.status ?? "Active",
  };
}

export const roles: Role[] = [
  ...systemRoles,
  customRole(
    1,
    "Support Lead",
    "Oversees the support queue, reassigns conversations and reviews team reports.",
    [
      "conversation_manage",
      "conversation_unassigned_manage",
      "conversation_participating_manage",
      "contact_manage",
      "report_manage",
    ],
    { lastReview: "Sep 2, 2026", owner: "Arham Khan", status: "Needs review" },
  ),
  customRole(
    2,
    "Tier 1 Support",
    "Picks up new conversations from the unassigned queue and hands off escalations.",
    ["conversation_unassigned_manage", "conversation_participating_manage"],
    { lastReview: "Aug 18, 2026", owner: "Priya Nair", status: "Active" },
  ),
  customRole(
    3,
    "Sales Agent",
    "Works leads coming in from WhatsApp and the website widget.",
    ["conversation_participating_manage", "contact_manage"],
    { lastReview: "Jul 27, 2026", owner: "Arham Khan", status: "Needs review" },
  ),
  customRole(4, "Content Editor", "Writes, updates and publishes help center articles.", ["knowledge_base_manage"], {
    lastReview: "Sep 30, 2026",
    owner: "Dana Bakr",
    status: "Active",
  }),
  customRole(
    5,
    "Reporting Analyst",
    "Prepares the weekly CSAT, SLA and agent performance reviews.",
    ["report_manage"],
    { lastReview: "Jun 9, 2026", owner: "Priya Nair", status: "Needs review" },
  ),
];

export function roleKeyOf(user: { role: "administrator" | "agent"; customRoleId: number | null }) {
  return user.customRoleId ? `custom_${user.customRoleId}` : user.role;
}
