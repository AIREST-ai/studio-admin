"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { format } from "date-fns/format";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Forward,
  MailOpen,
  Paperclip,
  Pin,
  Reply,
  ReplyAll,
  Send,
  Smile,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";

import { NotSpamBar, ReportSpamItem, StarToggle } from "@/app/(main)/chat/_components/chat-mail-actions";
import { cw } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { SimpleIcon } from "@/components/simple-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadSample, hasSampleFile } from "@/lib/cw/preview-sim-ui";
import { getInitials } from "@/lib/utils";

import type { Mail } from "./data";
import { useMail } from "./use-mail";

interface MailDisplayProps {
  mail: Mail | null;
  onClose?: () => void;
}

export function MailView({ mail, onClose }: MailDisplayProps) {
  const [, setMail] = useMail();

  function handleClose() {
    setMail({ selected: null });
    onClose?.();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-2 py-3">
      <div className="flex items-center">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close message" onClick={handleClose}>
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close message</TooltipContent>
          </Tooltip>
          <Separator className="h-4 data-vertical:self-center" orientation="vertical" />
          <div className="flex items-center gap-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Previous message">
                  <ChevronLeft />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous message</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Next message">
                  <ChevronRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next message</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <StarToggle mail={mail} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Pin thread">
                <Pin />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pin thread</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Archive">
                <Archive />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Reply">
                <Reply />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>
          <Separator className="h-4 data-vertical:self-center" orientation="vertical" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Move to trash">
                <Trash2 className="text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to trash</TooltipContent>
          </Tooltip>
          {/* T-282 (item 123): the overflow menu sits last, at the trailing edge (Gmail, Outlook; Material 3 app bars). */}
          <Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More actions">
                    <EllipsisVertical />
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <ReplyAll />
                    Reply all
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Forward />
                    Forward
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <MailOpen />
                    Mark as unread
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Tag />
                    Add label
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <ReportSpamItem mail={mail} />
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Separator />

      <div className="flex min-h-0 flex-1 flex-col">
        {mail ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <NotSpamBar mail={mail} />
            <div className="space-y-1.5">
              <div className="font-medium leading-none">{mail.subject}</div>

              <div className="text-muted-foreground text-xs leading-none">
                {format(new Date(mail.receivedAt), "EEE, d MMM yyyy, h:mm a")}
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Avatar className={cn("size-9 shrink-0 font-medium", personToneClass(mail.from.name))}>
                <AvatarFallback className="text-xs">{getInitials(mail.from.name)}</AvatarFallback>
              </Avatar>

              <div className="flex h-full flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="text-xs">{mail.from.name}</div>
                  <Separator className="h-3 data-vertical:self-center" orientation="vertical" />
                  <div className="text-muted-foreground text-xs">{mail.from.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground text-xs">
                    To: <span className="text-foreground">{mail.to.map((recipient) => recipient.name).join(", ")}</span>
                  </div>

                  {mail.cc?.length ? (
                    <div className="text-muted-foreground text-xs">
                      Cc:{" "}
                      <span className="text-foreground">{mail.cc.map((recipient) => recipient.name).join(", ")}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <Separator />

            {mail.attachments?.length ? (
              <>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "group p-0 font-normal text-muted-foreground",
                        "hover:bg-transparent hover:text-muted-foreground dark:hover:bg-transparent",
                        "data-[state=open]:bg-transparent data-[state=open]:text-muted-foreground",
                      )}
                    >
                      Attachments ({mail.attachments.length})
                      <ChevronDown className="group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="flex flex-wrap gap-2">
                      {mail.attachments.map((attachment) => (
                        // M129-A round 2: an attachment of a Support Email conversation downloads its sample file
                        // (lib/cw/preview-sim-ui.tsx); the template mails of /mail keep their plain chips.
                        <Button
                          size="xs"
                          variant="secondary"
                          key={attachment.id}
                          aria-label={hasSampleFile(attachment.name) ? `Download ${attachment.name}` : undefined}
                          onClick={hasSampleFile(attachment.name) ? () => downloadSample(attachment.name) : undefined}
                        >
                          <SimpleIcon icon={attachment.icon} className="size-3 fill-current" />
                          <span className="font-normal">{attachment.name}</span>
                          <span className="font-normal text-muted-foreground">{attachment.size}</span>
                        </Button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator className="my-2" />
              </>
            ) : null}

            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-sm">
              {mail.body}
              <MailReplies mailId={mail.id} />
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <Separator />
              <MailReplyBox mail={mail} />
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground text-sm">No email selected</div>
        )}
      </div>
    </div>
  );
}

// Replies typed under a mail. A mail that is a Support Email conversation ("cw-<id>") also adds the reply to that
// conversation's thread on /dashboard/chat (cw-store send), so both views show it. Nothing leaves the browser.
const useMailReplies = create<{ replies: Record<string, { text: string; at: string }[]> }>(() => ({ replies: {} }));

function conversationIdOf(mailId: string): number | null {
  const match = /^cw-(\d+)$/.exec(mailId);
  return match ? Number(match[1]) : null;
}

function MailReplies({ mailId }: { mailId: string }) {
  const replies = useMailReplies((s) => s.replies[mailId]);
  if (!replies?.length) return null;
  return (
    <div className="mt-4 flex flex-col gap-2">
      {replies.map((reply, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: replies are only appended
        <div key={index} className="rounded-md border bg-muted/40 p-3">
          <div className="mb-1 text-muted-foreground text-xs">You replied · {reply.at}</div>
          {reply.text}
        </div>
      ))}
    </div>
  );
}

function MailReplyBox({ mail }: { mail: Mail }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const conversationId = conversationIdOf(mail.id);

  function send() {
    const body = text.trim();
    if (!body) {
      toast.error("Message can not be empty");
      return;
    }
    useMailReplies.setState((s) => ({
      replies: { ...s.replies, [mail.id]: [...(s.replies[mail.id] ?? []), { text: body, at: "Just now" }] },
    }));
    setText("");
    if (conversationId !== null) {
      cw.send(conversationId, { kind: "outgoing", text: body });
      toast.success(`Reply added to conversation #${conversationId}`, {
        action: { label: "View", onClick: () => router.push(`/dashboard/chat?conversation=${conversationId}`) },
      });
    } else {
      toast.success(`Reply to ${mail.from.name} saved under the mail`);
    }
  }

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <Reply />
      </InputGroupAddon>
      <InputGroupInput
        className="text-xs"
        placeholder={`Reply ${mail.from.name}...`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <InputGroupAddon className="gap-1" align="inline-end">
        <InputGroupButton variant="ghost" aria-label="Emoji">
          <Smile />
        </InputGroupButton>
        <InputGroupButton variant="ghost" aria-label="Attach file">
          <Paperclip />
        </InputGroupButton>
        <InputGroupButton variant="ghost" aria-label="Send" onClick={send}>
          <Send />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
