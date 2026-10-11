"use client";

import { cn } from "cn";
import { Check, CheckCheck, ChevronDown, CircleCheck, Lock } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ButtonGroupSeparator } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { getInitials } from "@/lib/utils";

import {
  type ConversationStatus,
  conversationStatuses,
  type DeliveryState,
  type ExtraMessage,
  noteSendButtonClass,
} from "./chat-thread-state";
import { currentUser } from "./data";

// TEMP marker (Fahad 2026-10-11 «غير لونها للبني فقط لكي اعرفها»): every F144 piece in one brown, #8B5A2B.
// These classes are appended after the original ones; to revert, set every string below to "" (one edit).
export const brown = {
  solid:
    "border-[#8B5A2B] bg-[#8B5A2B] text-white hover:bg-[#8B5A2B]/85 hover:text-white aria-expanded:bg-[#8B5A2B] aria-expanded:text-white dark:border-[#8B5A2B] dark:bg-[#8B5A2B] dark:hover:bg-[#8B5A2B]/85",
  box: "border-[#8B5A2B] bg-[#8B5A2B]/15 dark:border-[#8B5A2B] dark:bg-[#8B5A2B]/25",
  line: "border-[#8B5A2B] dark:border-[#8B5A2B]",
  menu: "ring-[#8B5A2B]",
  icon: "text-[#8B5A2B] dark:text-[#8B5A2B]",
  label: "text-[#8B5A2B] dark:text-foreground",
};

export function StatusMenu({
  status,
  onChange,
}: {
  status: ConversationStatus;
  onChange: (value: ConversationStatus) => void;
}) {
  const current = conversationStatuses.find((item) => item.value === status) ?? conversationStatuses[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("mr-1", brown.solid)}
          aria-label={`Conversation status: ${current.label}`}
          data-conversation-status={status}
        >
          <span aria-hidden="true" className={cn("size-2 rounded-full", current.dot)} />
          <span className="max-sm:hidden">{current.label}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-44", brown.menu)}>
        <DropdownMenuLabel>Conversation status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => {
            const next = conversationStatuses.find((item) => item.value === value);
            if (next) onChange(next.value);
          }}
        >
          {conversationStatuses.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <span aria-hidden="true" className={cn("size-2 rounded-full", item.dot)} />
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DeliveryTicks({ state }: { state: DeliveryState }) {
  const label = state === "sent" ? "Sent" : state === "delivered" ? "Delivered" : "Read";
  const Icon = state === "sent" ? Check : CheckCheck;

  return (
    <span
      data-slot="delivery-status"
      data-delivery={state}
      title={label}
      className={cn(
        "ml-1 inline-flex items-center",
        state === "read" ? cn("text-sky-500 dark:text-sky-400", brown.icon) : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// Split arrow next to the Send button (rendered inside the composer's ButtonGroup).
export function SendMenu({ tone, onSendAndResolve }: { tone: "reply" | "note"; onSendAndResolve: () => void }) {
  return (
    <>
      <ButtonGroupSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <InputGroupButton
            type="button"
            variant="default"
            size="icon-sm"
            aria-label="More send options"
            className={cn(tone === "note" && noteSendButtonClass, brown.solid)}
          >
            <ChevronDown />
          </InputGroupButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className={cn("w-48", brown.menu)}>
          <DropdownMenuItem onSelect={onSendAndResolve}>
            <CircleCheck />
            Send and resolve
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function NoteBubble({ text }: { text: string }) {
  return (
    <div
      data-slot="note-bubble"
      className={cn(
        "w-fit max-w-[80%] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 text-sm leading-relaxed dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
        brown.box,
      )}
    >
      <div
        className={cn("mb-1 flex items-center gap-1.5 font-medium text-amber-700 text-xs dark:text-amber-300", brown.label)}
      >
        <Lock className="size-3" aria-hidden="true" />
        Internal note
      </div>
      {text}
    </div>
  );
}

// Messages sent in this session (and builder B's externalMessages), appended after the sample thread.
export function ExtraMessages({
  items,
  deliveryOf,
}: {
  items: ExtraMessage[];
  deliveryOf: (id: string) => DeliveryState;
}) {
  return (
    <>
      {items.map((message) => (
        <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor>
          <Message align="end" data-note={message.kind === "note" ? "true" : undefined}>
            <MessageAvatar>
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              {message.kind === "note" ? (
                <NoteBubble text={message.text} />
              ) : (
                <BubbleGroup>
                  <Bubble variant="default" align="end">
                    <BubbleContent>{message.text}</BubbleContent>
                  </Bubble>
                </BubbleGroup>
              )}
              <MessageFooter>
                Just now
                {message.kind === "reply" ? <DeliveryTicks state={deliveryOf(message.id)} /> : null}
              </MessageFooter>
            </MessageContent>
          </Message>
        </MessageScrollerItem>
      ))}
    </>
  );
}
