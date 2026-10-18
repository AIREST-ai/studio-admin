"use client";

import { useState } from "react";

import { Layers } from "lucide-react";

import { ChannelIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCwShared } from "@/lib/cw/store";

import { pickedChannels, showAllChannels, toggleChannel, useChannelChoice } from "./chat-channel-select-store";

// T-97 (Fahad 2026-10-13 20:01): a button above the conversations lists every connected channel (the live inboxes of
// Settings > Inboxes, not a fixed list), each with a check mark; only the checked channels show in the list. Built for
// many channels: a search box and a scrolling list. The choice is kept in this browser (chat-channel-select-store.ts).

// The conversation icons key phone calls as "phone"; the inbox list keys them as "voice".
const iconKey = (channel: string) => (channel === "voice" ? "phone" : channel);

export function ChatChannelPicker() {
  const [open, setOpen] = useState(false);
  const inboxes = useCwShared((state) => state.inboxes);
  const ids = inboxes.map((inbox) => inbox.slug);
  const picked = pickedChannels(useChannelChoice(), ids);
  const label = picked ? `${picked.length} of ${ids.length} channels` : "All channels";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              data-slot="channel-picker-trigger"
              aria-label={`Channels: ${label}`}
              className="relative"
            >
              <Layers />
              {picked && (
                <Badge className="pointer-events-none absolute -top-1 -right-1 h-3.5 min-w-3.5 px-1 text-[9px] tabular-nums">
                  {picked.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{`Channels: ${label}`}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-0" data-slot="channel-picker">
        <Command>
          <CommandInput placeholder="Search channels" />
          <CommandList className="max-h-72">
            <CommandEmpty>No channel found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all channels"
                data-slot="channel-option"
                data-channel="all"
                data-picked={picked === null}
                onSelect={showAllChannels}
              >
                <Checkbox checked={picked === null} tabIndex={-1} className="pointer-events-none" />
                <Layers />
                <span className="flex-1">All channels</span>
                <span className="text-muted-foreground text-xs tabular-nums">{ids.length}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Connected channels">
              {inboxes.map((inbox) => {
                const checked = picked === null || picked.includes(inbox.slug);
                return (
                  <CommandItem
                    key={inbox.slug}
                    value={`${inbox.name} ${inbox.channelType} ${inbox.identifier} ${inbox.slug}`}
                    data-slot="channel-option"
                    data-channel={inbox.slug}
                    data-picked={checked}
                    onSelect={() => toggleChannel(inbox.slug, ids)}
                  >
                    <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                    <ChannelIcon channel={iconKey(inbox.channel)} />
                    <span className="min-w-0 flex-1">
                      <span dir="auto" className="block truncate">
                        {inbox.name}
                      </span>
                      <span dir="auto" className="block truncate text-muted-foreground text-xs">
                        {inbox.identifier}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
