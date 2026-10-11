"use client";

import { cn } from "cn";
import {
  AlarmClock,
  ArrowLeft,
  Copy,
  Flag,
  Link,
  MoreHorizontal,
  Paperclip,
  PhoneCall,
  Send,
  Smile,
  Sparkles,
  Tag,
  Type,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { TagChips, TagPicker, tagConvId } from "./chat-tags";
import { brown, DeliveryTicks, ExtraMessages, SendMenu, StatusMenu } from "./chat-thread-extras";
import { type ExtraMessage, noteSendButtonClass, useThreadExtras } from "./chat-thread-state";
import { type Message as ChatMessage, type Contact, currentUser } from "./data";

interface ChatThreadProps {
  contact: Contact;
  messages: ChatMessage[];
  onOpenContact?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
  externalMessages?: ExtraMessage[];
}

export function ChatThread({
  contact,
  messages,
  onOpenContact,
  onBack,
  showBackButton,
  className,
  externalMessages,
}: ChatThreadProps) {
  const extras = useThreadExtras(contact.email || contact.name, externalMessages);
  const [composerTab, setComposerTab] = useState("reply");
  const isNote = composerTab === "note";
  const convId = tagConvId(contact);

  return (
    <div className={cn("flex h-full flex-col py-3", className)}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Back to conversations"
                onClick={onBack}
              >
                <ArrowLeft />
              </Button>
            )}
            <Avatar className="size-8">
              <AvatarFallback className="bg-background text-foreground">{getInitials(contact.name)}</AvatarFallback>
              <AvatarBadge className="bg-green-600 dark:bg-green-800" />
            </Avatar>
            <div>
              <div className="font-medium text-sm">{contact.name}</div>
              <div className="text-muted-foreground text-xs leading-3">{contact.role}</div>
              <TagChips convId={convId} className="mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <StatusMenu status={extras.status} onChange={extras.setStatus} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Call">
                  <PhoneCall />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Call</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TagPicker convId={convId}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Tag">
                    <Tag />
                  </Button>
                </TooltipTrigger>
              </TagPicker>
              <TooltipContent>Tag</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Snooze">
                  <AlarmClock />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Snooze</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={onOpenContact}>
                    <UserRound />
                    View profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy />
                    Copy email
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Flag />
                    Mark priority
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive">Block contact</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Separator />
      </div>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-6 px-2 py-8">
              <Marker variant="separator">
                <MarkerContent>May 6, 2026</MarkerContent>
              </Marker>

              {messages.map((message, index) => {
                const isOutbound = message.align === "end";
                const reactionAlign = isOutbound ? "start" : "end";
                const senderName = isOutbound ? currentUser.name : contact.name;

                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={String(message.id)}
                    scrollAnchor={message.align === "end"}
                  >
                    <Message align={message.align}>
                      <MessageAvatar>
                        <Avatar>
                          <AvatarFallback
                            className={cn(
                              "bg-muted text-foreground text-xs",
                              isOutbound && "bg-primary text-primary-foreground",
                            )}
                          >
                            {getInitials(senderName)}
                          </AvatarFallback>
                        </Avatar>
                      </MessageAvatar>

                      <MessageContent>
                        <BubbleGroup>
                          <Bubble variant={isOutbound ? "default" : "muted"} align={message.align}>
                            <BubbleContent>{message.text}</BubbleContent>
                            {message.reaction ? (
                              <BubbleReactions aria-label={`Reaction: ${message.reaction}`} align={reactionAlign}>
                                <span>{message.reaction}</span>
                              </BubbleReactions>
                            ) : null}
                          </Bubble>
                        </BubbleGroup>
                        <MessageFooter>
                          {message.time}
                          {isOutbound ? (
                            // Fake delivery state: read once the customer has replied after it.
                            <DeliveryTicks
                              state={messages.slice(index + 1).some((m) => m.align === "start") ? "read" : "delivered"}
                            />
                          ) : null}
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}
              <ExtraMessages items={extras.items} deliveryOf={extras.deliveryOf} />
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="px-2" data-slot="chat-composer" data-mode={composerTab}>
        <Tabs
          value={composerTab}
          onValueChange={setComposerTab}
          className={cn(
            "gap-0 rounded-md border transition-colors",
            isNote && "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/15",
            isNote && brown.box,
          )}
        >
          <TabsList
            variant="line"
            className={cn(
              "w-full justify-start gap-2 border-b px-3 **:data-[slot=tabs-trigger]:border-x-0 **:data-[slot=tabs-trigger]:px-6 group-data-horizontal/tabs:h-10",
              isNote && "border-amber-300 dark:border-amber-500/40",
              isNote && brown.line,
            )}
          >
            <TabsTrigger value="reply" className="flex-none px-1">
              Reply
            </TabsTrigger>
            <TabsTrigger value="note" className="flex-none px-1">
              Internal note
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reply" className="m-0">
            <MessageComposer
              placeholder="Type your message..."
              onSend={(text) => extras.sendMessage(text, "reply")}
              onSendAndResolve={(text) => extras.sendAndResolve(text, "reply")}
            />
          </TabsContent>
          <TabsContent value="note" className="m-0">
            <MessageComposer
              placeholder="Write an internal note..."
              tone="note"
              onSend={(text) => extras.sendMessage(text, "note")}
              onSendAndResolve={(text) => extras.sendAndResolve(text, "note")}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MessageComposer({
  placeholder,
  tone = "reply",
  onSend,
  onSendAndResolve,
}: {
  placeholder: string;
  tone?: "reply" | "note";
  onSend?: (text: string) => void;
  onSendAndResolve?: (text: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onSend?.(value);
        setValue("");
      }}
    >
      <InputGroup className="border-0 bg-transparent shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot][aria-invalid=true]]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot][aria-invalid=true]]:ring-0 dark:bg-transparent dark:has-[[data-slot][aria-invalid=true]]:ring-0">
        <InputGroupTextarea
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-14 px-3 py-2.5 text-sm ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:aria-invalid:ring-0"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton aria-label="Format" type="button" size="icon-sm">
            <Type />
          </InputGroupButton>
          <InputGroupButton aria-label="Emoji" type="button" size="icon-sm">
            <Smile />
          </InputGroupButton>
          <InputGroupButton aria-label="Attach file" type="button" size="icon-sm">
            <Paperclip />
          </InputGroupButton>
          <InputGroupButton aria-label="Insert link" type="button" size="icon-sm">
            <Link />
          </InputGroupButton>
          <InputGroupButton aria-label="AI assist" type="button" size="icon-sm" variant="outline">
            <Sparkles />
          </InputGroupButton>
          <ButtonGroup className="ml-auto">
            <InputGroupButton
              type="submit"
              variant="default"
              size="sm"
              className={cn("h-8 px-3", tone === "note" && noteSendButtonClass, brown.solid)}
            >
              <Send />
              <span>Send</span>
            </InputGroupButton>
            <SendMenu
              tone={tone}
              onSendAndResolve={() => {
                onSendAndResolve?.(value);
                setValue("");
              }}
            />
          </ButtonGroup>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
