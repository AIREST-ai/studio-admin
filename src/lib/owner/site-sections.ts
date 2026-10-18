// F-17 (T-91, Fahad 13 Oct 14:35 «يحول لي… من لوحة تحكمي أنا للموقع كله», 15:28 «هذه [E-commerce] تخفى لدي في لوحة
// تحكم الادارة»): the site's big sections the owner shows or hides for the whole site from the Owner console
// (/super_admin), above the defaults of src/config/features.ts.
//
// The standard is Chatwoot's Super Admin Console (https://github.com/chatwoot/chatwoot/tree/v4.18.0):
// - it lives at /super_admin, apart from the account's own settings (config/routes.rb `namespace :super_admin`), and the
//   profile menu links to it for a super admin only (components-next/sidebar/SidebarProfileMenu.vue "Super Admin
//   Console", show: currentUser.type === 'SuperAdmin', link '/super_admin', target _blank);
// - each account's "features" are a list of names with an on / off box (enterprise/app/views/fields/
//   account_features_field/_form.html.erb);
// - a feature that is off disappears from the sidebar: each route names its feature flag (meta.featureFlag) and the
//   sidebar shows a link only when that flag is on (components-next/sidebar/provider.js isAllowed -> shouldShow).
// `chatwootFlag` names the flag of each section's routes in Chatwoot (dashboard/featureFlags.js), where there is one.
//
// Pure module (no server imports): the console, the sidebar, the search, the page guard and the API all use it.
import { FEATURES } from "@/config/features";

// F-16 round 2 (Fahad: "I do not want their links, not even hidden ones"): the engine's route file of each flag, by
// its path in the engine's code (v4.18.0), for the code's readers only; the console shows the flag name, no link.
const CW = "engine v4.18.0: app/javascript/dashboard/routes/dashboard/";

export interface SiteSection {
  id: string;
  title: string;
  /** What disappears when it is hidden, in one line. */
  description: string;
  /** URL prefixes that belong to the section (a page under one of them is the section's). */
  paths: string[];
  /** Shown unless the owner changed it: src/config/features.ts for the two it holds, otherwise shown. */
  defaultShown: boolean;
  /** Where the default comes from. */
  defaultFrom: "features.ts" | "always";
  /** The Chatwoot feature flag of the same section, with the route file that names it. */
  chatwootFlag?: { name: string; source: string };
}

export const SITE_SECTIONS: readonly SiteSection[] = [
  {
    id: "my-inbox",
    title: "My Inbox",
    description: "The personal notifications page, its menu entries and the header bell.",
    paths: ["/dashboard/notifications"],
    defaultShown: FEATURES.notifications,
    defaultFrom: "features.ts",
  },
  {
    id: "captain",
    title: "Captain",
    description: "The AI assistant pages and Settings > Captain.",
    paths: ["/dashboard/captain"],
    defaultShown: true,
    defaultFrom: "always",
    chatwootFlag: { name: "captain_integration", source: `${CW}captain/captain.routes.js` },
  },
  {
    id: "contacts",
    title: "Contacts",
    description: "The contacts list, segments and contact pages.",
    paths: ["/dashboard/contacts"],
    defaultShown: true,
    defaultFrom: "always",
    chatwootFlag: { name: "crm", source: `${CW}contacts/routes.js` },
  },
  {
    id: "reports",
    title: "Reports",
    description: "Every report, from Customer Path to Bot.",
    paths: ["/dashboard/reports"],
    defaultShown: true,
    defaultFrom: "always",
    chatwootFlag: { name: "reports", source: `${CW}settings/reports/reports.routes.js` },
  },
  {
    id: "automation",
    title: "Automation",
    description: "Automation rules and the visual flow editor.",
    paths: ["/dashboard/automation", "/dashboard/settings/automation"],
    defaultShown: true,
    defaultFrom: "always",
    chatwootFlag: { name: "automations", source: `${CW}settings/automation/automation.routes.js` },
  },
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Live chat, SMS, WhatsApp and the other channel campaigns.",
    paths: ["/dashboard/campaigns"],
    defaultShown: true,
    defaultFrom: "always",
    chatwootFlag: { name: "campaigns", source: `${CW}campaigns/campaigns.routes.js` },
  },
  {
    id: "help-center",
    title: "Help Center",
    description: "Articles, categories, locales and portal settings.",
    paths: ["/dashboard/help-center"],
    defaultShown: true,
    defaultFrom: "always",
    chatwootFlag: { name: "help_center", source: `${CW}helpcenter/helpcenter.routes.js` },
  },
  {
    id: "comments",
    title: "Comments",
    description: "The social posts, reels and public/private comment replies inside the Inbox.",
    paths: ["/dashboard/comments"],
    defaultShown: true,
    defaultFrom: "always",
  },
  {
    id: "calls",
    title: "Calls",
    description: "The calls list inside the Inbox.",
    paths: ["/dashboard/calls"],
    defaultShown: true,
    defaultFrom: "always",
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    description: "The store overview dashboard.",
    paths: ["/dashboard/ecommerce"],
    defaultShown: FEATURES.ecommerce,
    defaultFrom: "features.ts",
  },
  {
    id: "calendar",
    title: "Calendar",
    description: "The shared calendar (More menu).",
    paths: ["/dashboard/calendar"],
    defaultShown: true,
    defaultFrom: "always",
  },
  {
    id: "kanban",
    title: "Kanban",
    description: "The Dodge board (More menu).",
    paths: ["/dashboard/kanban"],
    defaultShown: true,
    defaultFrom: "always",
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "The tasks board (More menu).",
    paths: ["/dashboard/tasks"],
    defaultShown: true,
    defaultFrom: "always",
  },
  {
    id: "invoices",
    title: "Invoices",
    description: "Invoices and their clients (More menu).",
    paths: ["/dashboard/invoice"],
    defaultShown: true,
    defaultFrom: "always",
  },
  {
    id: "sample-sign-in",
    title: "Sample sign-in pages",
    description: "Login and Register samples under More > Authentication.",
    paths: ["/auth"],
    defaultShown: true,
    defaultFrom: "always",
  },
];

/** One change the owner made: the section's state when it differs from its default. */
export interface SiteSectionOverride {
  id: string;
  shown: boolean;
  changedAt: string;
  by: string;
}

/** What every page needs: the owner's changes and the revision they were saved at. */
export interface SiteSectionsState {
  rev: number;
  savedAt: string | null;
  overrides: SiteSectionOverride[];
}

export const EMPTY_SITE_SECTIONS: SiteSectionsState = { rev: 0, savedAt: null, overrides: [] };

// The (main) layout leaves the copy it read here (on the server; the provider in the browser), for a render that cannot
// reach the provider's context.
const GLOBAL_KEY = "__studioSiteSections";
type WithSections = typeof globalThis & { [GLOBAL_KEY]?: SiteSectionsState };
export function publishSiteSections(state: SiteSectionsState) {
  (globalThis as WithSections)[GLOBAL_KEY] = state;
}
export const publishedSiteSections = (): SiteSectionsState | undefined => (globalThis as WithSections)[GLOBAL_KEY];

export const sectionById = (id: string) => SITE_SECTIONS.find((section) => section.id === id);

export function isShown(state: SiteSectionsState, id: string): boolean {
  const override = state.overrides.find((item) => item.id === id);
  return override ? override.shown : (sectionById(id)?.defaultShown ?? true);
}

/** The ids of the sections hidden now (owner's change, else the default). */
export function hiddenIds(state: SiteSectionsState): Set<string> {
  return new Set(SITE_SECTIONS.filter((section) => !isShown(state, section.id)).map((section) => section.id));
}

const pathOf = (url: string) => url.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

/** The section a page belongs to, or undefined. */
export function sectionOfUrl(url: string): SiteSection | undefined {
  const path = pathOf(url);
  return SITE_SECTIONS.find((section) =>
    section.paths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  );
}

/** The hidden section a page belongs to, or undefined when the page is shown. */
export function hiddenSectionOfUrl(state: SiteSectionsState, url: string): SiteSection | undefined {
  const section = sectionOfUrl(url);
  return section && !isShown(state, section.id) ? section : undefined;
}

// ---- the sidebar, inner bars, menus and search -------------------------------------------------------------------

interface NavLink {
  url: string;
}
interface NavItemLike {
  url?: string;
  subItems?: NavLink[];
}
interface NavGroupLike<I extends NavItemLike> {
  entry?: NavLink;
  more?: unknown;
  items: I[];
}

/**
 * The navigation without the hidden sections: a link to a hidden section's page goes, an item whose links all go goes,
 * and a group left with no item goes (the More button too when all its pages are hidden). Chatwoot's sidebar does the
 * same for a feature that is off (provider.js isAllowed).
 */
export function withoutHiddenSections<I extends NavItemLike, G extends NavGroupLike<I>>(
  groups: readonly G[],
  state: SiteSectionsState,
): G[] {
  const hidden = hiddenIds(state);
  if (!hidden.size) return [...groups];
  const gone = (url: string | undefined) => {
    if (!url) return false;
    const section = sectionOfUrl(url);
    return Boolean(section && hidden.has(section.id));
  };
  return groups
    .filter((group) => !gone(group.entry?.url))
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item): I[] => {
        if (item.subItems) {
          const subItems = item.subItems.filter((sub) => !gone(sub.url));
          if (item.subItems.length && !subItems.length) return [];
          return [{ ...item, subItems }];
        }
        return gone(item.url) ? [] : [item];
      }),
    }))
    .filter((group) => group.items.length > 0 || Boolean(group.entry));
}
