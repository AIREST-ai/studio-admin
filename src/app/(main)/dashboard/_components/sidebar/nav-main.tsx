"use client";

import { type ReactNode, use, useEffect, useId, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "cn";
import { ChevronRight, type LucideIcon, PlusCircleIcon } from "lucide-react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";

import { type ChatTag, useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import type { Folder } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { openDialog } from "@/app/(main)/dashboard/chat/_components/cw-dialog-store";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { channelNavIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { type Segment, useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Inbox, Team } from "@/lib/cw/data";
import { useCwShared } from "@/lib/cw/store";
import { canOpen, SIGNED_IN_VIEWER, ViewerContext } from "@/lib/cw/view-as";
import { EMPTY_SITE_SECTIONS, publishedSiteSections, withoutHiddenSections } from "@/lib/owner/site-sections";
import { SiteSectionsContext, useSiteSections } from "@/lib/owner/site-sections-context";
import type {
  NavBadge,
  NavGroup,
  NavMainItem,
  NavMainLinkItem,
  NavMainParentItem,
  NavSubItem,
} from "@/navigation/sidebar/sidebar-items";

interface NavMainProps {
  readonly items: readonly NavGroup[];
  // T-58: "footer" lists the footer groups (Settings, Help Center) at the bottom; "content" the rest, in the list.
  readonly placement?: "content" | "footer";
}
interface NavItemProps {
  readonly item: NavMainItem;
  readonly isItemActive: (item: NavMainItem) => boolean;
  readonly isSubItemActive: (url: string) => boolean;
  readonly isSubmenuOpen: (item: NavMainParentItem) => boolean;
  readonly previewOf: (item: NavMainParentItem, all?: boolean) => NavSubItem[];
}

interface NavLinkItemProps {
  readonly item: NavMainLinkItem;
  readonly isActive: boolean;
  readonly showIconFallback: boolean;
  // T-73: in the desktop icon rail the name is for screen readers and the hover/focus tooltip only.
  readonly rail?: boolean;
}

interface NavLinkIconProps {
  readonly item: NavMainLinkItem;
  readonly showFallback: boolean;
}

interface NavDropdownItemProps {
  readonly item: NavMainParentItem;
  readonly isActive: boolean;
  readonly isSubItemActive: (url: string) => boolean;
}

interface NavFlyoutItemProps {
  readonly item: NavMainLinkItem;
  readonly isActive: boolean;
  readonly links: readonly NavSubItem[];
  readonly allLinks: readonly NavSubItem[];
  readonly isSubItemActive: (url: string) => boolean;
}

interface NavMoreItemProps {
  readonly group: NavGroup & { more: NonNullable<NavGroup["more"]> };
  readonly isActive: boolean;
  readonly isSubItemActive: (url: string) => boolean;
}

interface NavCollapsibleItemProps {
  readonly item: NavMainParentItem;
  readonly isActive: boolean;
  readonly defaultOpen: boolean;
  readonly isSubItemActive: (url: string) => boolean;
  // T-75: a button beside the name (Folders and Teams: create), and what shows when the list has no links.
  readonly action?: ReactNode;
  readonly empty?: ReactNode;
  // T-289: the Inbox bar keeps each section open or folded as the person left it (inbox-bar-folds.ts); unset elsewhere.
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

function CollapsedIconFallback({ title }: { title: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs font-medium text-[10px] outline">
      {title.slice(0, 1)}
    </span>
  );
}

export function hasSubItems(item: NavMainItem): item is NavMainParentItem {
  return Boolean(item.subItems?.length);
}

// T-54: a section with its own inner bar (subnav) is one link in the main sidebar, to its first sub item.
export function subnavEntry(item: NavMainParentItem): NavMainLinkItem {
  const { subItems, subnav: _subnav, ...rest } = item;
  return { ...rest, url: subItems[0].url };
}

// T-89: the links of a section's hover preview (Fahad: a short summary, not all it holds): the fixed links named by its
// preview ids, looked up in sidebar-items.ts itself, never in the live lists (folders, teams, channels, contact
// labels and segments), which stay in the inner bar. With no preview ids, all its fixed links.
export function previewLinks(items: readonly NavMainItem[], ids?: readonly string[]): NavSubItem[] {
  const links = items.flatMap((item): NavSubItem[] => (hasSubItems(item) ? item.subItems : [item]));
  if (!ids) return links;
  return ids.flatMap((id) => {
    const parent = items.find((item) => item.id === id);
    return parent && hasSubItems(parent) ? parent.subItems : (links.find((link) => link.id === id) ?? []);
  });
}

// T-73: a group shown as «أخرى» stays below every other group of the list, so a section added later goes above it.
export function moreLast(groups: readonly NavGroup[]): NavGroup[] {
  return [...groups.filter((group) => !group.more), ...groups.filter((group) => group.more)];
}

// T-153: the look of HoverCardContent (components/ui/hover-card.tsx), whose portal cannot be pointed at the drawer.
const PREVIEW_CARD =
  "z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

// T-153: what Tab can stop on, for leaving a preview to the control after its icon.
const TABBABLE = "a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]";

const LABEL_PREFIX = "/dashboard/chat/labels/";
const CONTACT_LABEL_PREFIX = "/dashboard/contacts/labels/";

// F159: the Folders item lists the saved conversation folders (Chatwoot custom views), so a saved folder appears,
// a renamed one updates and a deleted one disappears. The Labels item lists the labels of chat-tags-store, so a
// label added from a conversation ("Add tag…") shows up here too, as in Chatwoot's sidebar. An empty list hides
// the item.
// F161: Teams and Channels list the shared teams and inboxes (src/lib/cw), so a team or inbox created in Settings
// shows up here and a deleted one disappears.
// T-75: the Inbox inner bar passes keepEmpty: Folders and Teams start empty (T-74) and stay listed there with no
// links, beside their create button (section-subnav.tsx).
export const CREATABLE_LISTS: readonly string[] = ["cv-folders", "cv-teams"];

export function withLiveLists(
  groups: readonly NavGroup[],
  folders: Folder[],
  tags: ChatTag[],
  teams: Team[],
  inboxes: Inbox[],
  segments: Segment[],
  { keepEmpty = false }: { keepEmpty?: boolean } = {},
): NavGroup[] {
  // F-5A "View as": only what the person the page is viewed as may open, as Chatwoot's sidebar hides a link whose route
  // the person lacks the permissions for (components-next/sidebar/provider.js isAllowed). An agent's Channels are the
  // inboxes they are a member of (app/policies/inbox_policy.rb Scope: user.assigned_inboxes) and their Teams the teams
  // they belong to (Sidebar.vue teams/getMyTeams). Called while rendering (NavMain, the inner bar, the header search),
  // so the person is read from the page's context.
  const viewer = use(ViewerContext) ?? SIGNED_IN_VIEWER;
  // F-17 (T-91): a section the owner hid in the Owner console (/super_admin) is gone from the sidebar, the inner bars
  // and the header search, as Chatwoot's sidebar drops a link whose feature is off (provider.js isAllowed).
  const siteSections = use(SiteSectionsContext)?.state ?? publishedSiteSections() ?? EMPTY_SITE_SECTIONS;
  const admin = viewer.permissions.includes("administrator");
  const allowed = (url: string | undefined) => !url || canOpen(viewer, url);
  const myTeams = admin ? teams : teams.filter((team) => team.members.includes(viewer.id));
  const myInboxes = admin ? inboxes : inboxes.filter((inbox) => inbox.agents.includes(viewer.id));
  const live = new Map<string, NavSubItem[]>([
    [
      "cv-teams",
      myTeams.map((team) => ({ id: `cv-t-${team.slug}`, title: team.name, url: `/dashboard/chat/teams/${team.slug}` })),
    ],
    [
      "cv-folders",
      folders.map((folder) => ({
        id: `cv-f-${folder.id}`,
        title: folder.name,
        url: `/dashboard/chat/folders/${folder.id}`,
      })),
    ],
    [
      "cv-labels",
      tags.map((tag) => ({
        id: `cv-l-${tag.id}`,
        title: tag.label,
        url: `${LABEL_PREFIX}${encodeURIComponent(tag.id)}`,
      })),
    ],
  ]);
  const visible = groups
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item): NavMainItem[] => {
        // Each inbox under Channels shows its channel icon, the same one as the conversation cards and the channels bar.
        // F161: Contacts lists its saved segments and one "tagged with" link per label after All Contacts and Active,
        // as in Chatwoot's sidebar (Sidebar.vue:596-662).
        if (item.id === "contacts" && hasSubItems(item)) {
          const segmentItems = segments.map((segment) => ({
            id: `ct-s-${segment.id}`,
            title: segment.name,
            url: `/dashboard/contacts/segments/${segment.id}`,
          }));
          const labelItems = tags.map((tag) => ({
            id: `ct-l-${tag.id}`,
            title: tag.label,
            url: `${CONTACT_LABEL_PREFIX}${encodeURIComponent(tag.label)}`,
          }));
          return [{ ...item, subItems: [...item.subItems, ...segmentItems, ...labelItems] }];
        }
        if (item.id === "cv-channels" && hasSubItems(item)) {
          const channelItems = myInboxes.map((inbox) => ({
            id: `cv-c-${inbox.slug}`,
            title: inbox.name,
            url: `/dashboard/chat/channels/${inbox.slug}`,
            icon: channelNavIcon(inbox.slug),
          }));
          return [{ ...item, subItems: channelItems }];
        }
        const subItems = live.get(item.id);
        if (!subItems) return [item];
        if (subItems.length === 0 && !(keepEmpty && CREATABLE_LISTS.includes(item.id))) return [];
        const liveItem: NavMainParentItem = { id: item.id, title: item.title, icon: item.icon, subItems };
        return [liveItem];
      }),
    }))
    .filter((group) => admin || !group.entry || allowed(group.entry.url))
    .map((group) =>
      admin
        ? group
        : {
            ...group,
            items: group.items.flatMap((item): NavMainItem[] => {
              if (!hasSubItems(item)) return allowed(item.url) ? [item] : [];
              const subItems = item.subItems.filter((sub) => allowed(sub.url));
              if (subItems.length === 0 && !(keepEmpty && CREATABLE_LISTS.includes(item.id))) return [];
              return [{ ...item, subItems }];
            }),
          },
    );
  return withoutHiddenSections<NavMainItem, NavGroup>(visible, siteSections);
}

// Pages under /dashboard/chat listed under their own sidebar item, by the URL segment after /dashboard/chat/.
const CHAT_SECTION_ITEMS: Record<string, string> = {
  folders: "cv-folders",
  teams: "cv-teams",
  channels: "cv-channels",
  labels: "cv-labels",
};

// The item and sub link that own the current page: the longest URL equal to it or above it ("/dashboard/chat" for
// "/dashboard/chat/search"). Only that link's parent is marked, so /dashboard/chat/labels/vip marks Labels alone
// and not Conversations as well. A page of a folder, team, channel or label that is not in the list (a deleted
// folder, a mistyped label) belongs to its own item (Folders, Teams, Channels or Labels) with no sub link marked,
// not to All Conversations.
export function pageOwner(groups: readonly NavGroup[], path: string): { item: string | null; url: string | null } {
  // F159 final pass: a plain link item for this exact page (Search) owns it, so its parent group is not marked too.
  // F161: and the pages below it (/dashboard/calls/…, /dashboard/notifications/…).
  for (const group of groups) {
    for (const item of group.items) {
      if (!hasSubItems(item) && item.url === path) return { item: item.id, url: item.url };
    }
  }
  for (const group of groups) {
    for (const item of group.items) {
      if (!hasSubItems(item) && item.url !== "/dashboard/chat" && path.startsWith(`${item.url}/`)) {
        return { item: item.id, url: item.url };
      }
    }
  }
  let best: { item: string; url: string } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      for (const sub of item.subItems ?? []) {
        const owns = path === sub.url || path.startsWith(`${sub.url}/`);
        if (owns && (best === null || sub.url.length > best.url.length)) best = { item: item.id, url: sub.url };
      }
    }
  }
  const section = /^\/dashboard\/chat\/([^/]+)/.exec(path)?.[1];
  const sectionItem = section ? CHAT_SECTION_ITEMS[section] : undefined;
  if (sectionItem && best?.item !== sectionItem) return { item: sectionItem, url: null };
  return best ?? { item: null, url: null };
}

export function NavMain({ items: baseItems, placement = "content" }: NavMainProps) {
  const path = usePathname();
  const folders = useCwStore((s) => s.folders);
  const { tags } = useChatTags();
  const teams = useCwShared((s) => s.teams);
  const inboxes = useCwShared((s) => s.inboxes);
  const segments = useContactsStore((s) => s.segments);
  const items = withLiveLists(baseItems, folders, tags, teams, inboxes, segments);
  const owner = pageOwner(items, path);
  const { isMobile, setOpenMobile } = useSidebar();
  // T-89: the fixed items of sidebar-items.ts, for the hover previews (previewLinks). F-17: without the hidden sections
  // (Settings' preview drops its Captain link when Captain is hidden).
  const siteSections = useSiteSections();
  const fixedItems = new Map(
    withoutHiddenSections<NavMainItem, NavGroup>(baseItems, siteSections)
      .flatMap((group) => group.items)
      .map((item) => [item.id, item]),
  );
  const previewOf = (item: NavMainParentItem, all = false) => {
    const fixed = fixedItems.get(item.id);
    return previewLinks(fixed && hasSubItems(fixed) ? fixed.subItems : item.subItems, all ? undefined : item.preview);
  };

  // T-54: on phones the main sidebar is a drawer; it closes once a link opens its page.
  // T-89: only when the page changes. The drawer mounts this list each time it opens, and closing it on mount shut the
  // drawer at once, so the header button could not open it on phones or in a narrow frame.
  const shownPath = useRef(path);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each new page only.
  useEffect(() => {
    if (shownPath.current === path) return;
    shownPath.current = path;
    if (isMobile && placement === "content") setOpenMobile(false);
  }, [path]);

  // T-153: the drawer puts focus on its first control when it opens. Radix skips links there (react-focus-scope
  // removeLinks) and landed on «أخرى», past every section; it leaves focus alone once it is inside the drawer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once; the drawer mounts this list each time it opens.
  useEffect(() => {
    if (!isMobile || placement !== "content") return;
    const drawer = document.querySelector<HTMLElement>("[data-mobile=true]");
    if (!drawer || drawer.contains(document.activeElement)) return;
    const first = [...drawer.querySelectorAll<HTMLElement>(TABBABLE)].find(
      (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
    );
    first?.focus();
  }, []);

  const isItemActive = (item: NavMainItem) => {
    if (hasSubItems(item)) {
      return item.id === owner.item;
    }

    return item.id === owner.item;
  };

  // F161: the sub link that owns the page is marked on its sub-pages too (/dashboard/reports/agents/3 marks
  // Reports > Agents), not only on its exact URL.
  const isSubItemActive = (url: string) => {
    return url === owner.url;
  };

  const isSubmenuOpen = (item: NavMainParentItem) => {
    return item.id === owner.item;
  };

  // T-58: the owner is found over all groups, so /dashboard/captain/captain-settings marks Settings, not Captain.
  if (placement === "footer") {
    return (
      <SidebarMenu>
        {items
          .filter((group) => group.footer)
          .flatMap((group) => group.items)
          .map((item) => {
            const entry = hasSubItems(item) ? subnavEntry(item) : item;
            if (hasSubItems(item)) {
              return (
                <NavFlyoutItem
                  key={item.id}
                  item={entry}
                  isActive={isItemActive(item)}
                  links={previewOf(item)}
                  allLinks={previewOf(item, true)}
                  isSubItemActive={isSubItemActive}
                />
              );
            }
            return item.iconOnly ? (
              <NavIconLinkItem key={item.id} item={entry} isActive={isItemActive(item)} />
            ) : (
              <NavLinkItem key={item.id} item={entry} isActive={isItemActive(item)} showIconFallback={false} />
            );
          })}
      </SidebarMenu>
    );
  }

  const listGroups = moreLast(items.filter((group) => !group.footer));

  // T-62: Quick Create moved to the top of the Inbox inner bar (section-subnav.tsx).
  // T-284 (item 125.1, Fahad): Home stays, and My Inbox and Inbox are one rail entry, Inbox. The separate My Inbox rail
  // link (T-153) is gone; My Inbox is listed first inside Inbox (sidebar-items.ts), so on its page Inbox is marked.
  return (
    <>
      {/* T-66: the group headings are gone, so the groups are one list here, with no gap where a heading was. */}
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {listGroups.flatMap((group) => {
              const groupActive = group.items.some((item) => item.id === owner.item);
              // T-73: «أخرى» is one button whose menu lists the group's pages.
              if (group.more) {
                return [
                  <NavMoreItem
                    key={group.more.id}
                    group={{ ...group, more: group.more }}
                    isActive={groupActive}
                    isSubItemActive={isSubItemActive}
                  />,
                ];
              }
              // T-53: a group with an entry (Inbox) is that one link here; its items are in the inner bar of its pages.
              // T-73: in the rail its hover card lists them too.
              if (group.entry) {
                return [
                  <NavFlyoutItem
                    key={group.entry.id}
                    item={group.entry}
                    isActive={groupActive}
                    links={previewLinks(group.items, group.preview)}
                    allLinks={previewLinks(group.items)}
                    isSubItemActive={isSubItemActive}
                  />,
                ];
              }
              return group.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isItemActive={isItemActive}
                  isSubItemActive={isSubItemActive}
                  isSubmenuOpen={isSubmenuOpen}
                  previewOf={previewOf}
                />
              ));
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

// F161: Chatwoot's compose button (Sidebar.vue:1033-1048): opens "New conversation" in Conversations.
// T-62: shown at the top of the Inbox inner bar (section-subnav.tsx), not in the main sidebar.
export function QuickCreateButton() {
  const path = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar();

  return (
    <SidebarMenuButton
      // T-89: no tooltip in the phone sheet; a hidden one still took the first Escape there.
      // T-134: shown past the square Hide Inbox bar button beside it (section-subnav.tsx), which it covered.
      tooltip={isMobile ? undefined : { children: "New conversation", sideOffset: 44 }}
      onClick={() => {
        openDialog({ type: "new-conversation" });
        // T-217 (item 47): the search page has no conversation dialogs (search-view.tsx), so the request waited there
        // until a conversation list opened. Like any page outside the conversations, it goes to the list first.
        const lists = path.startsWith("/dashboard/chat") && !path.startsWith("/dashboard/chat/search");
        if (!lists) router.push("/dashboard/chat");
      }}
      className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
    >
      <PlusCircleIcon />
      <span>Quick Create</span>
    </SidebarMenuButton>
  );
}

function NavItem({ item, isItemActive, isSubItemActive, isSubmenuOpen, previewOf }: NavItemProps) {
  const { isMobile } = useSidebar();
  // T-73: the desktop sidebar is always the icon rail (app-sidebar.tsx), so this no longer follows its open state.
  const rail = !isMobile;

  if (!hasSubItems(item)) {
    return <NavLinkItem item={item} isActive={isItemActive(item)} showIconFallback={rail} rail={rail} />;
  }

  // T-54: its sub items are in the inner bar of its pages, not under it here.
  // T-73: in the rail its hover card lists them as well.
  if (item.subnav) {
    return (
      <NavFlyoutItem
        item={subnavEntry(item)}
        isActive={isItemActive(item)}
        links={previewOf(item)}
        allLinks={previewOf(item, true)}
        isSubItemActive={isSubItemActive}
      />
    );
  }

  if (rail) {
    return <NavDropdownItem item={item} isActive={isItemActive(item)} isSubItemActive={isSubItemActive} />;
  }

  return (
    <NavCollapsibleItem
      item={item}
      isActive={isItemActive(item)}
      defaultOpen={isSubmenuOpen(item)}
      isSubItemActive={isSubItemActive}
    />
  );
}

export function NavLinkItem({ item, isActive, showIconFallback, rail = false }: NavLinkItemProps) {
  return (
    <SidebarMenuItem>
      {/* T-89: the name tooltip in the rail only; the inner bars and the phone drawer show the name itself. */}
      <SidebarMenuButton
        asChild
        aria-disabled={item.disabled}
        tooltip={rail ? item.title : undefined}
        isActive={isActive}
      >
        <Link
          prefetch={false}
          href={item.url}
          target={item.newTab ? "_blank" : undefined}
          rel={item.newTab ? "noreferrer" : undefined}
          aria-current={isActive ? "page" : undefined}
        >
          <NavLinkIcon item={item} showFallback={showIconFallback} />
          {/* T-54: label links listed in an inner bar (Contacts) keep their colour. */}
          <LabelDot url={item.url} />
          <span className={rail ? "sr-only" : undefined}>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      <NavItemBadge badge={item.badge} />
    </SidebarMenuItem>
  );
}

// T-142: primary links stay in the preview; secondary links open from Show more itself.
// Keep the preview mounted while its menu is open, including on keyboard focus and touch.
function NavFlyoutItem({ item, isActive, links, allLinks, isSubItemActive }: NavFlyoutItemProps) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // T-153: on phones the sidebar is a modal drawer that keeps focus inside it; the preview is put in the drawer there,
  // so the keyboard can enter it. Elsewhere it goes to the end of the page as before.
  const [drawer, setDrawer] = useState<HTMLElement | null>(null);
  // T-153: on phones Show more opens its links inside the preview, below it, instead of a menu covering the preview.
  const [expanded, setExpanded] = useState(false);
  const optionsId = useId();
  const options = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLAnchorElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const navigating = useRef<boolean>(false);
  const dismissed = useRef<boolean>(false);
  const restoringFocus = useRef<boolean>(false);
  const { isMobile } = useSidebar();
  const inline = isMobile;
  const Icon = item.icon;
  const shown = new Set(links.map((link) => link.id));
  const extra = allLinks.filter((link) => !shown.has(link.id));
  const channels = links.filter((link) => link.id.startsWith("cv-c-"));
  const primary = links.filter((link) => !link.id.startsWith("cv-c-"));

  // Only one navigation preview may stay open, including between the content and footer lists.
  useEffect(() => {
    const closeOtherPreview = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== item.id) {
        dismissed.current = true;
        navigating.current = true;
        setMoreOpen(false);
        setOpen(false);
      }
    };
    document.addEventListener("studio-navigation-preview", closeOtherPreview);
    return () => document.removeEventListener("studio-navigation-preview", closeOtherPreview);
  }, [item.id]);

  const show = () => {
    dismissed.current = false;
    navigating.current = false;
    document.dispatchEvent(new CustomEvent("studio-navigation-preview", { detail: item.id }));
    setDrawer(trigger.current?.closest<HTMLElement>("[data-mobile=true]") ?? null);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);
  // T-257: a preview left open when its section became the current one must not reappear on leaving it.
  useEffect(() => {
    if (isActive) {
      setMoreOpen(false);
      setOpen(false);
    }
  }, [isActive]);

  const close = () => {
    dismissed.current = true;
    navigating.current = true;
    setMoreOpen(false);
    setOpen(false);
  };
  const expand = () => {
    setExpanded(true);
    requestAnimationFrame(() => {
      const first = options.current?.querySelector<HTMLElement>("a[href]");
      first?.scrollIntoView({ block: "nearest" });
      first?.focus();
    });
  };
  // T-153: Escape in the opened links closes them and focus goes back to Show more, as with its menu elsewhere.
  const collapseToMore = () => {
    setExpanded(false);
    moreTrigger.current?.focus();
  };
  const dismissToIcon = () => {
    close();
    // The restored focus must not immediately reopen the preview.
    restoringFocus.current = true;
    trigger.current?.focus();
    restoringFocus.current = false;
  };
  // T-153: Radix HoverCard takes the preview's links out of the Tab order (tabindex=-1) and portals them to the end
  // of the page, so the keyboard walks them here: Tab from the icon enters the preview, Tab and the arrow keys move
  // through its links to Show more, Tab past the last stop leaves for the control after the icon, and Shift+Tab
  // before the first goes back to the icon.
  const stops = () => [...(content.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? [])];
  const leaveForward = () => {
    const from = trigger.current;
    close();
    if (!from) return;
    const next = [...document.querySelectorAll<HTMLElement>(TABBABLE)].find(
      (el) =>
        el.tabIndex >= 0 &&
        el.getClientRects().length > 0 &&
        !el.closest("[data-slot=hover-card-content]") &&
        Boolean(from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        !from.contains(el),
    );
    next?.focus();
  };
  const row = (link: NavSubItem) => {
    const LinkIcon = link.icon;
    const current = isSubItemActive(link.url);
    return (
      <Button
        key={link.id}
        variant="ghost"
        size="sm"
        asChild
        className={cn("w-full shrink-0 justify-start", current && "bg-accent")}
      >
        <Link
          prefetch={false}
          href={link.url}
          target={link.newTab ? "_blank" : undefined}
          rel={link.newTab ? "noreferrer" : undefined}
          aria-current={current ? "page" : undefined}
          aria-disabled={link.disabled}
          onClick={close}
        >
          {LinkIcon && <LinkIcon data-icon="inline-start" />}
          <NavMarks marks={link.marks} />
          <span className="truncate">{link.title}</span>
        </Link>
      </Button>
    );
  };

  // T-257 (Fahad 13 Oct 18:20): no preview for the section you are already in, only its name; the others keep theirs.
  if (isActive) return <NavLinkItem item={item} isActive showIconFallback rail={!isMobile} />;

  return (
    <SidebarMenuItem data-nav-flyout>
      <HoverCard
        open={open || moreOpen}
        onOpenChange={(value) => {
          if (value) {
            if (!dismissed.current) show();
          } else if (
            !moreOpen &&
            !content.current?.contains(document.activeElement) &&
            document.activeElement !== trigger.current
          ) {
            setOpen(false);
          }
        }}
        openDelay={150}
        closeDelay={200}
      >
        <SidebarMenuButton asChild isActive={isActive}>
          <HoverCardTrigger asChild>
            <Link
              ref={trigger}
              prefetch={false}
              href={item.url}
              aria-current={isActive ? "page" : undefined}
              onPointerEnter={() => {
                dismissed.current = false;
              }}
              onFocus={() => {
                if (!restoringFocus.current) show();
              }}
              onBlur={(event) => {
                if (!content.current?.contains(event.relatedTarget) && !moreOpen) {
                  dismissed.current = false;
                  setOpen(false);
                }
              }}
              onClick={(event) => {
                if (isMobile) {
                  event.preventDefault();
                  show();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  show();
                  requestAnimationFrame(() => content.current?.querySelector<HTMLAnchorElement>("a")?.focus());
                } else if (event.key === "Escape") {
                  dismissToIcon();
                } else if (event.key === "Tab" && !event.shiftKey && (open || moreOpen)) {
                  const first = stops()[0];
                  if (first) {
                    event.preventDefault();
                    first.focus();
                  }
                }
              }}
            >
              {Icon ? <Icon /> : <CollapsedIconFallback title={item.title} />}
              <span className={isMobile ? undefined : "sr-only"}>{item.title}</span>
            </Link>
          </HoverCardTrigger>
        </SidebarMenuButton>
        <HoverCardPrimitive.Portal container={drawer ?? undefined}>
          <HoverCardPrimitive.Content
            ref={content}
            data-slot="hover-card-content"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={12}
            className={cn(
              PREVIEW_CARD,
              "flex max-h-[min(70vh,var(--radix-hover-card-content-available-height))] w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 overflow-hidden p-1",
            )}
            aria-label={`${item.title} navigation`}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              if (expanded) collapseToMore();
              else if (!moreOpen) dismissToIcon();
            }}
            onBlur={(event) => {
              if (event.target instanceof HTMLElement && event.target.closest("[data-nav-more]")) return;
              if (
                !moreOpen &&
                !event.currentTarget.contains(event.relatedTarget) &&
                event.relatedTarget !== trigger.current
              )
                setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.target instanceof HTMLElement && event.target.closest("[data-nav-more]")) return;
              if (event.key === "Escape" && !moreOpen) {
                event.preventDefault();
                if (expanded) collapseToMore();
                else dismissToIcon();
                return;
              }
              // T-153: Show more handles its own Enter, Space and Arrow Down (it opens its menu).
              if (event.defaultPrevented || !["Tab", "ArrowDown", "ArrowUp"].includes(event.key)) return;
              const list = stops();
              const at = list.indexOf(document.activeElement as HTMLElement);
              if (at < 0) return;
              event.preventDefault();
              if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
                (at === 0 ? trigger.current : list[at - 1])?.focus();
              } else if (at < list.length - 1) {
                list[at + 1].focus();
              } else if (event.key === "Tab") {
                leaveForward();
              }
            }}
          >
            <div className="shrink-0 px-2 py-1.5 font-medium text-sm">{item.title}</div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {primary.map(row)}
              {channels.length > 0 && (
                <>
                  <Separator />
                  <div className="px-2 py-1 text-muted-foreground text-xs">Channels</div>
                  {channels.map(row)}
                </>
              )}
              {inline && extra.length > 0 && (
                <>
                  <Separator />
                  <Button
                    ref={moreTrigger}
                    variant="ghost"
                    size="sm"
                    className="w-full shrink-0 justify-start"
                    aria-expanded={expanded}
                    aria-controls={optionsId}
                    onClick={() => (expanded ? setExpanded(false) : expand())}
                  >
                    Show more
                    <ChevronRight
                      className={cn("ms-auto transition-transform", expanded && "rotate-90")}
                      data-icon="inline-end"
                    />
                  </Button>
                  {expanded && (
                    <div ref={options} id={optionsId} data-nav-more-list data-state="open" className="flex flex-col">
                      {extra.map(row)}
                    </div>
                  )}
                </>
              )}
            </div>
            {!inline && extra.length > 0 && (
              <div className="shrink-0">
                <Separator />
                <DropdownMenu
                  modal={false}
                  open={moreOpen}
                  onOpenChange={(value) => {
                    setMoreOpen(value);
                    if (value) {
                      navigating.current = false;
                      setOpen(true);
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button ref={moreTrigger} variant="ghost" size="sm" className="w-full justify-start">
                      Show more
                      <ChevronRight className="ms-auto" data-icon="inline-end" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    data-nav-more
                    // T-153: Escape closes this menu alone and focus returns to Show more (onCloseAutoFocus); a second
                    // Escape closes the preview and returns to the icon.
                    onEscapeKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                    onCloseAutoFocus={(event) => {
                      event.preventDefault();
                      if (!navigating.current) moreTrigger.current?.focus();
                    }}
                    aria-label={`${item.title} more options`}
                    side="right"
                    align="end"
                    sideOffset={8}
                    className="max-h-(--radix-dropdown-menu-content-available-height) w-64 max-w-[calc(100vw-2rem)] overflow-y-auto"
                  >
                    <DropdownMenuGroup>
                      {extra.map((link) => (
                        <DropdownMenuItem key={link.id} asChild disabled={link.disabled}>
                          <Link
                            prefetch={false}
                            href={link.url}
                            target={link.newTab ? "_blank" : undefined}
                            rel={link.newTab ? "noreferrer" : undefined}
                            aria-current={isSubItemActive(link.url) ? "page" : undefined}
                            onClick={close}
                          >
                            {link.icon && <link.icon />}
                            <span className="truncate">{link.title}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
      </HoverCard>
    </SidebarMenuItem>
  );
}

// T-73: «أخرى», the last button of the main list. Hover or focus shows its name; a click, a tap, or Enter/Space/Arrow
// Down opens its pages in a menu for a moment (arrow keys move, Escape closes); a page with links (Authentication)
// opens its own list to the side.
function NavMoreItem({ group, isActive, isSubItemActive }: NavMoreItemProps) {
  const { isMobile } = useSidebar();
  const Icon = group.more.icon;

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={isMobile ? undefined : group.more.title} isActive={isActive}>
            {Icon ? <Icon /> : <CollapsedIconFallback title={group.more.title} />}
            <span className={isMobile ? undefined : "sr-only"}>{group.more.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={12} className="w-52">
          <DropdownMenuGroup>
            {group.items.map((item) => {
              const ItemIcon = item.icon;

              if (!hasSubItems(item)) {
                return <NavMenuLink key={item.id} link={item} isActive={isSubItemActive(item.url)} />;
              }

              return (
                <DropdownMenuSub key={item.id}>
                  <DropdownMenuSubTrigger disabled={item.disabled}>
                    {ItemIcon && <ItemIcon />}
                    <span>{item.title}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {item.subItems.map((subItem) => (
                      <NavMenuLink key={subItem.id} link={subItem} isActive={isSubItemActive(subItem.url)} />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function NavMenuLink({ link, isActive }: { readonly link: NavSubItem; readonly isActive: boolean }) {
  const LinkIcon = link.icon;

  return (
    <DropdownMenuItem asChild disabled={link.disabled}>
      <Link
        prefetch={false}
        href={link.url}
        target={link.newTab ? "_blank" : undefined}
        rel={link.newTab ? "noreferrer" : undefined}
        aria-current={isActive ? "page" : undefined}
        className="flex items-center gap-2"
      >
        {LinkIcon && <LinkIcon />}
        <span>{link.title}</span>
      </Link>
    </DropdownMenuItem>
  );
}

// T-58: an icon-only link (Help Center in the footer). Its name shows in a tooltip on hover or keyboard focus, also
// while the sidebar is open, and is the link's accessible name.
function NavIconLinkItem({ item, isActive }: { readonly item: NavMainLinkItem; readonly isActive: boolean }) {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={{ children: item.title, hidden: false }}
        isActive={isActive}
        className="size-8"
      >
        <Link prefetch={false} href={item.url} aria-current={isActive ? "page" : undefined}>
          {Icon && <Icon />}
          <span className="sr-only">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// T-284 (item 125.2): the small marks right after a link's icon (My Inbox: message and @ beside its bell). Decorative:
// the link's name stays its accessible name.
function NavMarks({ marks }: { readonly marks?: readonly LucideIcon[] }) {
  if (!marks?.length) return null;
  return (
    <span data-nav-marks aria-hidden="true" className="-ms-1 flex shrink-0 items-center gap-1 text-muted-foreground">
      {marks.map((Mark) => (
        <Mark key={Mark.displayName} className="size-3.5" />
      ))}
    </span>
  );
}

function NavLinkIcon({ item, showFallback }: NavLinkIconProps) {
  const Icon = item.icon;

  if (Icon) {
    return (
      <>
        <Icon />
        <NavMarks marks={item.marks} />
      </>
    );
  }

  if (showFallback) {
    return <CollapsedIconFallback title={item.title} />;
  }

  return null;
}

function NavDropdownItem({ item, isActive, isSubItemActive }: NavDropdownItemProps) {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive} disabled={item.disabled}>
            {Icon ? <Icon /> : <CollapsedIconFallback title={item.title} />}
            <span className="sr-only">{item.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-48">
          <DropdownMenuGroup>
            {item.subItems.map((subItem) => {
              const SubIcon = subItem.icon;

              return (
                <DropdownMenuItem key={subItem.id} asChild disabled={subItem.disabled}>
                  <Link
                    prefetch={false}
                    href={subItem.url}
                    target={subItem.newTab ? "_blank" : undefined}
                    rel={subItem.newTab ? "noreferrer" : undefined}
                    aria-current={isSubItemActive(subItem.url) ? "page" : undefined}
                    className="flex items-center gap-2"
                  >
                    {SubIcon && <SubIcon />}
                    <LabelDot url={subItem.url} />
                    <span>{subItem.title}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function NavCollapsibleItem({
  item,
  isActive,
  defaultOpen,
  isSubItemActive,
  action,
  empty,
  open,
  onOpenChange,
}: NavCollapsibleItemProps) {
  const Icon = item.icon;

  return (
    <Collapsible
      asChild
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          {/* T-89: no name tooltip; the inner bars and the phone drawer show the name itself. */}
          <SidebarMenuButton isActive={isActive} disabled={item.disabled} className={action ? "pe-8" : undefined}>
            {Icon && <Icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {action}
        <NavItemBadge badge={item.badge} />

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.subItems.length === 0 && empty}
            {item.subItems.map((subItem) => {
              const SubIcon = subItem.icon;

              return (
                <SidebarMenuSubItem key={subItem.id}>
                  <SidebarMenuSubButton
                    asChild
                    aria-disabled={subItem.disabled}
                    isActive={isSubItemActive(subItem.url)}
                  >
                    <Link
                      prefetch={false}
                      href={subItem.url}
                      target={subItem.newTab ? "_blank" : undefined}
                      rel={subItem.newTab ? "noreferrer" : undefined}
                    >
                      {SubIcon && <SubIcon />}
                      <LabelDot url={subItem.url} />
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// F159: conversation label links (/dashboard/chat/labels/<id>) show the label colour, like Chatwoot's sidebar.
function LabelDot({ url }: { url: string }) {
  const { tags } = useChatTags();
  let tag: ChatTag | undefined;
  if (url.startsWith(LABEL_PREFIX)) {
    const id = decodeURIComponent(url.slice(LABEL_PREFIX.length));
    tag = tags.find((item) => item.id === id);
  } else if (url.startsWith(CONTACT_LABEL_PREFIX)) {
    const title = decodeURIComponent(url.slice(CONTACT_LABEL_PREFIX.length));
    tag = tags.find((item) => item.label === title);
  }
  if (!tag) return null;
  return <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />;
}

function NavItemBadge({ badge }: { badge?: NavBadge }) {
  if (!badge) {
    return null;
  }

  return (
    <SidebarMenuBadge
      className={cn(
        "rounded-sm border capitalize",
        badge === "new" &&
          "border-green-600 text-green-600 peer-hover/menu-button:text-green-600 peer-data-active/menu-button:text-green-600",
        badge === "soon" && "border-muted-foreground text-muted-foreground",
      )}
    >
      {badge}
    </SidebarMenuBadge>
  );
}
