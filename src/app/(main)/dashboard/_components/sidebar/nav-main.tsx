"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import { ChevronRight, MailIcon, PlusCircleIcon } from "lucide-react";

import { type ChatTag, useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import type { Folder } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { channelNavIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
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
}
interface NavItemProps {
  readonly item: NavMainItem;
  readonly isItemActive: (item: NavMainItem) => boolean;
  readonly isSubItemActive: (url: string) => boolean;
  readonly isSubmenuOpen: (item: NavMainParentItem) => boolean;
}

interface NavLinkItemProps {
  readonly item: NavMainLinkItem;
  readonly isActive: boolean;
  readonly showIconFallback: boolean;
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

interface NavCollapsibleItemProps {
  readonly item: NavMainParentItem;
  readonly isActive: boolean;
  readonly defaultOpen: boolean;
  readonly isSubItemActive: (url: string) => boolean;
}

function CollapsedIconFallback({ title }: { title: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs font-medium text-[10px] outline">
      {title.slice(0, 1)}
    </span>
  );
}

function hasSubItems(item: NavMainItem): item is NavMainParentItem {
  return Boolean(item.subItems?.length);
}

const LABEL_PREFIX = "/dashboard/chat/labels/";

// F159: the Folders item lists the saved conversation folders (Chatwoot custom views), so a saved folder appears,
// a renamed one updates and a deleted one disappears. The Labels item lists the labels of chat-tags-store, so a
// label added from a conversation ("Add tag…") shows up here too, as in Chatwoot's sidebar. An empty list hides
// the item.
function withLiveLists(groups: readonly NavGroup[], folders: Folder[], tags: ChatTag[]): NavGroup[] {
  const live = new Map<string, NavSubItem[]>([
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
  return groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item): NavMainItem[] => {
      // Each inbox under Channels shows its channel icon, the same one as the conversation cards and the channels bar.
      if (item.id === "cv-channels" && hasSubItems(item)) {
        const channelItems = item.subItems.map((sub) => ({
          ...sub,
          icon: sub.icon ?? channelNavIcon(sub.id.replace(/^cv-c-/, "")),
        }));
        return [{ ...item, subItems: channelItems }];
      }
      const subItems = live.get(item.id);
      if (!subItems) return [item];
      if (subItems.length === 0) return [];
      const liveItem: NavMainParentItem = { id: item.id, title: item.title, icon: item.icon, subItems };
      return [liveItem];
    }),
  }));
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
function pageOwner(groups: readonly NavGroup[], path: string): { item: string | null; url: string | null } {
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

export function NavMain({ items: baseItems }: NavMainProps) {
  const path = usePathname();
  const folders = useCwStore((s) => s.folders);
  const { tags } = useChatTags();
  const items = withLiveLists(baseItems, folders, tags);
  const owner = pageOwner(items, path);

  const isItemActive = (item: NavMainItem) => {
    if (hasSubItems(item)) {
      return item.id === owner.item;
    }

    return path === item.url;
  };

  const isSubItemActive = (url: string) => {
    return path === url;
  };

  const isSubmenuOpen = (item: NavMainParentItem) => {
    return item.id === owner.item;
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <SidebarMenuButton
                tooltip="Quick Create"
                className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <PlusCircleIcon />
                <span>Quick Create</span>
              </SidebarMenuButton>
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:opacity-0"
                variant="outline"
              >
                <MailIcon />
                <span className="sr-only">Inbox</span>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {items.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label && (
            <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isItemActive={isItemActive}
                  isSubItemActive={isSubItemActive}
                  isSubmenuOpen={isSubmenuOpen}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function NavItem({ item, isItemActive, isSubItemActive, isSubmenuOpen }: NavItemProps) {
  const { state, isMobile } = useSidebar();
  const isCollapsedDesktop = state === "collapsed" && !isMobile;

  if (!hasSubItems(item)) {
    return <NavLinkItem item={item} isActive={isItemActive(item)} showIconFallback={isCollapsedDesktop} />;
  }

  if (isCollapsedDesktop) {
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

function NavLinkItem({ item, isActive, showIconFallback }: NavLinkItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild aria-disabled={item.disabled} tooltip={item.title} isActive={isActive}>
        <Link
          prefetch={false}
          href={item.url}
          target={item.newTab ? "_blank" : undefined}
          rel={item.newTab ? "noreferrer" : undefined}
        >
          <NavLinkIcon item={item} showFallback={showIconFallback} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      <NavItemBadge badge={item.badge} />
    </SidebarMenuItem>
  );
}

function NavLinkIcon({ item, showFallback }: NavLinkIconProps) {
  const Icon = item.icon;

  if (Icon) {
    return <Icon />;
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
            <span>{item.title}</span>
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

function NavCollapsibleItem({ item, isActive, defaultOpen, isSubItemActive }: NavCollapsibleItemProps) {
  const Icon = item.icon;

  return (
    <Collapsible asChild defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive} disabled={item.disabled}>
            {Icon && <Icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <NavItemBadge badge={item.badge} />

        <CollapsibleContent>
          <SidebarMenuSub>
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
  if (!url.startsWith(LABEL_PREFIX)) return null;
  const id = decodeURIComponent(url.slice(LABEL_PREFIX.length));
  const tag = tags.find((item) => item.id === id);
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
