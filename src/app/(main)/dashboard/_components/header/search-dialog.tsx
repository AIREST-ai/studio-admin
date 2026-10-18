"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import { withLiveLists } from "@/app/(main)/dashboard/_components/sidebar/nav-main";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useCwShared } from "@/lib/cw/store";
import type { NavGroup, NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

type SearchItem = {
  id: string;
  group: string;
  label: string;
  url: string;
  icon?: NavMainItem["icon"];
  disabled?: boolean;
  newTab?: boolean;
};

const sidebarGroupLabels = new Set(sidebarItems.flatMap((group) => (group.label ? [group.label] : [])));

function getSubItemGroup(groupLabel: string | undefined, itemTitle: string) {
  return sidebarGroupLabels.has(itemTitle) ? (groupLabel ?? "Other") : itemTitle;
}

// T-89: the index is built from the live lists (the same ones the sidebar shows), not the starting folders and teams of
// sidebar-items.ts, so a removed team or folder is not offered and a new one is.
const toSearchItems = (groups: readonly NavGroup[]): SearchItem[] =>
  groups.flatMap((group) =>
    group.items.flatMap((item) => {
      if (item.subItems) {
        return item.subItems.map((sub) => ({
          id: sub.id,
          group: getSubItemGroup(group.label, item.title),
          label: sub.title,
          url: sub.url,
          icon: item.icon,
          disabled: sub.disabled,
          newTab: sub.newTab,
        }));
      }
      return [
        {
          id: item.id,
          group: group.label ?? "Other",
          label: item.title,
          url: item.url,
          icon: item.icon,
          disabled: item.disabled,
          newTab: item.newTab,
        },
      ];
    }),
  );

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((item) => item.group))];
  return groups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));
}

// T-89: Fahad: the site search sits at the other end of the header from the Inbox bar and its conversation search, and
// opens differently: a panel under its own button, not a centred dialog. It finds the site's pages only (the sidebar's
// index); messages, contacts and articles are found by the Inbox search (/dashboard/chat/search).
// T-103: Fahad: its place was still bad. As in the local respond reference, the entry is an icon at the bottom of the
// rail, its name on hover like the other rail icons.
// T-117: Fahad 20:41: that removed the site search from the top. It stays in the header on every size (desktop and
// phone), opened from its button or Cmd+J; the message search (phone number, message text) is the box in the Inbox bar
// (sidebar/inbox-message-search.tsx). Two searches, two places, two ways to open them.
// T-123: Fahad 21:21 «اختار القياسي العالمي»: a text field in the header itself, its results drop under it, with ⌘K —
// not a button opening a panel with a second field. ⌘K reaches this field on every page: it is taken on window in the
// capture phase, before the Inbox command bar (chat/_components/cw-dialogs.tsx) and the contacts search
// (contacts/_components/contacts-list.tsx) listen for it on window in the bubble phase.
// T-146 (item 52, Fahad 00:45 «لا أعتقد انه منطقي أن يعطيني كل الخيارات وكل الإعدادات عند الضغط على مربع البحث»): as in
// Chatwoot's SearchInput.vue (v4.18), focusing the empty field lists nothing (Chatwoot shows only up to 3 recent searches
// there); results drop under the field once something is typed. Their box has a clear edge in either theme
// (Chatwoot: border border-n-strong, rounded-xl), not a faint ring that read as cut off («أشبه بمقطوعة»).
// T-285 (Fahad 125.4): on every page the search is a lens only; a click (or ⌘K) opens the field in its place, and
// closing it (Escape, leaving it empty, or picking a page) brings back the lens alone, with no "Search site" box.
export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const folders = useCwStore((s) => s.folders);
  const { tags } = useChatTags();
  const teams = useCwShared((s) => s.teams);
  const inboxes = useCwShared((s) => s.inboxes);
  const segments = useContactsStore((s) => s.segments);
  const searchItems = toSearchItems(withLiveLists(sidebarItems, folders, tags, teams, inboxes, segments));
  const shown = open && query.trim().length > 0;

  // cmdk writes aria-expanded="true" on its input whatever happens; say whether the results are really open.
  React.useEffect(() => {
    inputRef.current?.setAttribute("aria-expanded", String(shown));
  });

  React.useEffect(() => {
    // event.code, so ⌘K works on an Arabic keyboard layout too (as in cw-dialogs.tsx); Alt+K stays the list's.
    const down = (e: KeyboardEvent) => {
      if (e.code !== "KeyK" || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setExpanded(true);
      setOpen(true);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    };
    window.addEventListener("keydown", down, { capture: true });
    return () => window.removeEventListener("keydown", down, { capture: true });
  }, []);

  const close = () => {
    setOpen(false);
    setQuery("");
    setExpanded(false);
  };

  const handleSelect = (item: SearchItem) => {
    if (item.disabled) return;
    close();
    if (item.newTab) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.url);
    }
  };

  const renderGroups = (items: SearchItem[]) =>
    groupBy(items).map(({ group, items: groupItems }, index) => (
      <React.Fragment key={group}>
        {index > 0 && <CommandSeparator />}
        <CommandGroup heading={group}>
          {groupItems.map((item) => (
            <CommandItem
              disabled={item.disabled}
              key={`${group}-${item.id}`}
              value={`${item.group} ${item.label}`}
              onSelect={() => handleSelect(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && <item.icon />}
                <span className="truncate">{item.label}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </React.Fragment>
    ));

  // The results drop under the field in a portal (the sticky header clips what overflows it). The cursor stays in the
  // field: the popover does not take focus, and a click on a result is not let blur the field.
  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search site"
        title="Search (⌘K)"
        data-site-search-trigger
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <Search />
      </Button>
    );
  }

  return (
    <Popover open={shown} onOpenChange={(value) => (value ? setOpen(true) : close())}>
      <Command data-site-search className="size-auto overflow-visible rounded-lg! bg-transparent p-0">
        <PopoverAnchor asChild>
          <InputGroup className="w-36 bg-background sm:w-56 lg:w-72">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <CommandPrimitive.Input
              ref={inputRef}
              data-slot="input-group-control"
              data-site-search-input
              aria-label="Search site"
              placeholder="Search pages…"
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                setOpen(false);
                if (!inputRef.current?.value) setExpanded(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                }
              }}
            />
            <InputGroupAddon align="inline-end" className="hidden sm:flex">
              <Kbd>⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
        </PopoverAnchor>
        <PopoverContent
          data-site-search-results
          role="presentation"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border p-0 shadow-lg ring-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if ((e.target as Element | null)?.closest?.("[data-site-search]")) e.preventDefault();
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            {renderGroups(searchItems)}
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}
