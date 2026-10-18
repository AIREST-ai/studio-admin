"use client";

// T-285 (Fahad 125.8): the Contacts bar starts with All contacts, then the channels in a clear row, one link per
// channel type of the connected inboxes (Settings > Inboxes, in their order), the same grouping as the list's
// ?channel=<type> pick. The channel links sit at the same level as All contacts (no nesting). Segments and labels
// follow, as before (nav-main.tsx withLiveLists).
import { usePathname, useSearchParams } from "next/navigation";

import { NavLinkItem } from "@/app/(main)/dashboard/_components/sidebar/nav-main";
import { channelNavIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { useCwShared } from "@/lib/cw/store";
import type { NavMainLinkItem } from "@/navigation/sidebar/sidebar-items";

export function ContactsChannelsNav({ allContacts }: { allContacts: NavMainLinkItem }) {
  const path = usePathname();
  const channel = useSearchParams().get("channel");
  const inboxes = useCwShared((state) => state.inboxes);
  const types: { type: string; slug: string }[] = [];
  for (const inbox of inboxes) {
    if (!types.some((t) => t.type === inbox.channelType)) types.push({ type: inbox.channelType, slug: inbox.slug });
  }
  const onList = path === allContacts.url;
  return (
    <>
      <NavLinkItem
        item={{ ...allContacts, title: "All contacts" }}
        isActive={onList && !channel}
        showIconFallback={false}
      />
      {types.map(({ type, slug }) => (
        <NavLinkItem
          key={type}
          item={{
            id: `ct-ch-${type}`,
            title: type,
            url: `${allContacts.url}?channel=${encodeURIComponent(type)}`,
            icon: channelNavIcon(slug),
          }}
          isActive={onList && channel === type}
          showIconFallback={false}
        />
      ))}
    </>
  );
}
