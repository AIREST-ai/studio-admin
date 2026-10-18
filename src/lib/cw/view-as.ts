"use client";

// F-5A (sim1 persona 2, Fahad 77.5 and 129.2): "View as". The preview has no sign-in, so the account menu lets the
// signed-in sample administrator look at the app as any agent of Settings > Agents, with that agent's role applied the
// way Chatwoot v4.18.0 applies it. Only this browser's view changes (a cookie); nobody is signed in or out, and the
// banner says so (app/(main)/dashboard/_components/view-as.tsx).
//
// The rules, each from Chatwoot v4.18.0 (https://github.com/chatwoot/chatwoot/tree/v4.18.0):
// - A person's permissions (app/models/account_user.rb #permissions, enterprise/app/models/enterprise/account_user.rb):
//   administrator -> ["administrator"]; agent -> ["agent"]; agent with a custom role -> the role's permissions plus
//   "custom_role" (so not "agent").
// - Which conversations they see (app/services/conversations/permission_filter_service.rb and
//   enterprise/app/services/enterprise/conversations/permission_filter_service.rb): an administrator sees all; an agent
//   sees the conversations of the inboxes they are a member of; a custom role sees, within those inboxes, all
//   (conversation_manage), else the unassigned ones and their own (conversation_unassigned_manage), else the ones
//   assigned to them or they take part in (conversation_participating_manage), else none. Teams do not widen or narrow
//   it: Chatwoot filters by inbox membership, not by team.
// - Which pages they open (each route's meta.permissions; the sidebar hides what they cannot open,
//   components-next/sidebar/provider.js isAllowed): see ROUTE_RULES below. Chatwoot sends a person who opens a page they
//   may not to their first allowed page (helper/routeHelpers.js defaultRedirectPage); the preview says why instead.
// - The Mine / Unassigned / All tabs (constants/permissions.js ASSIGNEE_TYPE_TAB_PERMISSIONS).
// - Deleting contacts: administrators only (app/policies/contact_policy.rb #destroy?, and the delete buttons sit in
//   <Policy :permissions="['administrator']"> in components-next/Contacts/Pages/ContactDetails.vue and
//   routes/dashboard/contacts/components/ContactsBulkActionBar.vue, v-if="isAdmin" in conversation/contact/ContactInfo.vue).
import { createContext, use } from "react";

import { type Role, roles as seedRoles } from "@/app/(main)/dashboard/roles/_components/roles-table/data";

import { type Agent, CURRENT_USER_ID, type Inbox, agents as seedAgents } from "./data";
import { permissionsOf } from "./view-as-permissions";

export { parseViewAs, VIEW_AS_COOKIE } from "./view-as-cookie";
// U-1: the rules of permissionsOf live in ./view-as-permissions.ts (a plain module, so the /api/cw gateway can run them
// on the server); re-exported here so every existing import keeps working.
export { permissionsOf };

// F-16 round 2 (Fahad: "I do not want their links, not even hidden ones"): the route files are named by their path in
// the engine's code (v4.18.0) for the code's readers only; no page links to them.
const SOURCE = "engine v4.18.0: ";

export interface Viewer {
  id: number;
  name: string;
  email: string;
  role: "administrator" | "agent";
  customRoleId: number | null;
  /** "Administrator", "Agent" or the custom role's name. */
  roleName: string;
  /** Chatwoot AccountUser#permissions. */
  permissions: string[];
  /** True when this is not the signed-in sample administrator (the banner shows). */
  viewingAs: boolean;
}

/** Chatwoot AccountUser#permissions: see ./view-as-permissions.ts (re-exported above). */

export function viewerOf(agent: Agent, roles: readonly Role[] = seedRoles): Viewer {
  const custom = agent.customRoleId ? roles.find((role) => role.customRoleId === agent.customRoleId) : undefined;
  return {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    role: agent.role,
    customRoleId: agent.customRoleId,
    roleName: agent.role === "administrator" ? "Administrator" : (custom?.name ?? "Agent"),
    permissions: permissionsOf(agent, roles),
    viewingAs: agent.id !== CURRENT_USER_ID,
  };
}

const signedIn = seedAgents.find((agent) => agent.id === CURRENT_USER_ID) ?? seedAgents[0];
/** The signed-in sample administrator (Arham Khan): what every page shows when nobody is chosen. */
export const SIGNED_IN_VIEWER: Viewer = viewerOf(signedIn);

// ---- pages --------------------------------------------------------------------------------------------------------

const ROLES = ["agent", "administrator"];
const CONVERSATION_PERMISSIONS = [
  "conversation_manage",
  "conversation_unassigned_manage",
  "conversation_participating_manage",
];

export interface RouteRule {
  /** Paths it covers (the first rule that matches wins). */
  match: (path: string) => boolean;
  /** Any one of these lets a person open the page (Chatwoot hasPermissions). */
  permissions: string[];
  /** The Chatwoot route file the permissions come from. */
  source: string;
}

const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(`${prefix}/`);
const settingsRoutes = `${SOURCE}app/javascript/dashboard/routes/dashboard/settings/`;

export const ROUTE_RULES: RouteRule[] = [
  {
    match: under("/dashboard/settings/profile"),
    permissions: ["administrator", "agent", "custom_role"],
    source: `${settingsRoutes}profile/profile.routes.js`,
  },
  {
    match: under("/dashboard/settings/macros"),
    permissions: [...ROLES, ...CONVERSATION_PERMISSIONS],
    source: `${settingsRoutes}macros/macros.routes.js`,
  },
  {
    match: under("/dashboard/settings/canned-responses"),
    permissions: [...ROLES, ...CONVERSATION_PERMISSIONS],
    source: `${settingsRoutes}canned/canned.routes.js`,
  },
  {
    match: (path) => path === "/dashboard/settings",
    permissions: [...ROLES, ...CONVERSATION_PERMISSIONS],
    source: `${settingsRoutes}settings.routes.js`,
  },
  // Every other settings page (general, agents, teams, inboxes, labels, attributes, automation, bots, integrations,
  // audit logs, custom roles, SLA, security, billing, templates, agent assignment, …) is for administrators.
  {
    match: under("/dashboard/settings"),
    permissions: ["administrator"],
    source: `${settingsRoutes}agents/agent.routes.js`,
  },
  {
    match: under("/dashboard/users"),
    permissions: ["administrator"],
    source: `${settingsRoutes}agents/agent.routes.js`,
  },
  {
    match: under("/dashboard/roles"),
    permissions: ["administrator"],
    source: `${settingsRoutes}customRoles/customRole.routes.js`,
  },
  {
    match: under("/dashboard/automation"),
    permissions: ["administrator"],
    source: `${settingsRoutes}automation/automation.routes.js`,
  },
  {
    match: under("/dashboard/reports"),
    permissions: ["administrator", "report_manage"],
    source: `${settingsRoutes}reports/reports.routes.js`,
  },
  // F-9 (sim3 persona 2: Priya, an agent, opened Invoice while every other administrator page was closed to her):
  // invoices are billing records, and Chatwoot opens its billing pages to administrators only. Chatwoot has no
  // invoice page, so its Billing route is the nearest rule.
  {
    match: under("/dashboard/invoice"),
    permissions: ["administrator"],
    source: `${settingsRoutes}billing/billing.routes.js`,
  },
  {
    match: under("/dashboard/campaigns"),
    permissions: ["administrator"],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/campaigns/campaigns.routes.js`,
  },
  {
    match: under("/dashboard/contacts"),
    permissions: ["administrator", "agent", "contact_manage"],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/contacts/routes.js`,
  },
  {
    match: under("/dashboard/help-center/settings"),
    permissions: ["administrator", "knowledge_base_manage"],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/helpcenter/helpcenter.routes.js`,
  },
  {
    match: under("/dashboard/help-center"),
    permissions: ["administrator", "agent", "knowledge_base_manage"],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/helpcenter/helpcenter.routes.js`,
  },
  {
    // Settings > Captain (the workspace's AI models and features), not the Captain section's assistants.
    match: under("/dashboard/captain/captain-settings"),
    permissions: ["administrator"],
    source: `${settingsRoutes}captain/captain.routes.js`,
  },
  {
    match: under("/dashboard/captain"),
    permissions: ["administrator", "agent"],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/captain/captain.routes.js`,
  },
  {
    match: under("/dashboard/chat"),
    permissions: [...ROLES, ...CONVERSATION_PERMISSIONS],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/conversation/conversation.routes.js`,
  },
  {
    match: under("/dashboard/calls"),
    permissions: [...ROLES, ...CONVERSATION_PERMISSIONS],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/calls/routes.js`,
  },
  {
    match: under("/dashboard/notifications"),
    permissions: [...ROLES, ...CONVERSATION_PERMISSIONS],
    source: `${SOURCE}app/javascript/dashboard/routes/dashboard/inbox/routes.js`,
  },
];

/** The rule of a page, or null for the Studio pages Chatwoot has no counterpart of (calendar, tasks, invoice, …). */
export function routeRule(url: string): RouteRule | null {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return ROUTE_RULES.find((rule) => rule.match(path)) ?? null;
}

/** Chatwoot routeIsAccessibleFor: a page with no rule is open to everyone. */
export function canOpen(viewer: Viewer, url: string): boolean {
  const rule = routeRule(url);
  return !rule || rule.permissions.some((permission) => viewer.permissions.includes(permission));
}

// ---- conversations ------------------------------------------------------------------------------------------------

const has = (viewer: Viewer, permission: string) => viewer.permissions.includes(permission);

/** Chatwoot Conversations::PermissionFilterService (+ the enterprise custom-role filter). */
export function canSeeConversation(
  viewer: Viewer,
  conversation: { channel: string },
  meta: { assigneeId: number | null; participants: number[] } | undefined,
  inboxes: readonly Pick<Inbox, "slug" | "agents">[],
): boolean {
  if (has(viewer, "administrator")) return true;
  const inbox = inboxes.find((item) => item.slug === conversation.channel);
  if (!inbox?.agents.includes(viewer.id)) return false;
  if (!viewer.customRoleId || !has(viewer, "custom_role")) return true;
  if (has(viewer, "conversation_manage")) return true;
  const mine = meta?.assigneeId === viewer.id;
  if (has(viewer, "conversation_unassigned_manage")) return mine || meta?.assigneeId === null;
  if (has(viewer, "conversation_participating_manage")) return mine || Boolean(meta?.participants.includes(viewer.id));
  return false;
}

export type AssigneeTabKey = "me" | "unassigned" | "all";

/** Chatwoot ASSIGNEE_TYPE_TAB_PERMISSIONS: the Mine / Unassigned / All tabs a person gets. */
export function assigneeTabsFor(viewer: Viewer): AssigneeTabKey[] {
  const tabs: Record<AssigneeTabKey, string[]> = {
    me: [...ROLES, ...CONVERSATION_PERMISSIONS],
    unassigned: [...ROLES, "conversation_manage", "conversation_unassigned_manage"],
    all: [...ROLES, "conversation_manage", "conversation_participating_manage"],
  };
  return (Object.keys(tabs) as AssigneeTabKey[]).filter((tab) => tabs[tab].some((p) => has(viewer, p)));
}

/** Chatwoot ContactPolicy#destroy?: administrators only. */
export const canDeleteContacts = (viewer: Viewer) => has(viewer, "administrator");

// ---- who is viewing -----------------------------------------------------------------------------------------------

/** Set by ViewAsProvider (app/(main)/dashboard/_components/view-as.tsx) for the server render and the page. */
export const ViewerContext = createContext<Viewer | null>(null);

// In the browser only: the person the page is viewed as, for code that runs outside rendering (a reply's sender, a
// status change's author). Never set on the server, where several requests share this module.
let browserViewer: Viewer | null = null;
export function setBrowserViewer(viewer: Viewer) {
  if (typeof window !== "undefined") browserViewer = viewer;
}

/** In a component or hook: the person the page is viewed as. */
export function useViewer(): Viewer {
  return use(ViewerContext) ?? SIGNED_IN_VIEWER;
}

/** Outside rendering (event handlers, store actions): the person the page is viewed as. */
export function currentViewer(): Viewer {
  return browserViewer ?? SIGNED_IN_VIEWER;
}
