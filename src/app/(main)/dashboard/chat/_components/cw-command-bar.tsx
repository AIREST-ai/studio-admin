"use client";

// Chatwoot v4.18 command bar (⌘ K, routes/dashboard/commands/commandbar.vue with useConversationHotKeys and
// useGoToCommandHotKeys): "Search or jump to". With a conversation open it offers the conversation actions —
// resolve/reopen, mute/unmute, send transcript, snooze (presets + Custom...), assign agent, assign team, priority,
// add/remove label, execute macro — then the "Go to" pages. Each action with choices opens its own page, which is
// also how the Assign agent, Add label and Snooze dialogs are opened from elsewhere (openDialog with `page`).
import { useState } from "react";

import { useRouter } from "next/navigation";

import { addHours, addMonths, format, startOfMonth } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Clock,
  Flag,
  Play,
  RotateCcw,
  Share,
  Tag,
  UserRound,
  UsersRound,
  Volume1,
  VolumeOff,
} from "lucide-react";
import { toast } from "sonner";

import { toggleTag, useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import { agents, macros, priorities, teams } from "./cw-data";
import { openDialog, runMacro } from "./cw-dialogs";
import { cw, useCwStore } from "./cw-store";
import { AgentAvatar, PriorityIcon } from "./cw-ui";

export type CommandPage =
  | "root"
  | "snooze"
  | "assign-agent"
  | "assign-team"
  | "priority"
  | "add-label"
  | "remove-label"
  | "macro";

const pageTitles: Record<Exclude<CommandPage, "root">, string> = {
  snooze: "Snooze Conversation",
  "assign-agent": "Change Assignee",
  "assign-team": "Change Team",
  priority: "Change Priority",
  "add-label": "Add label to the conversation",
  "remove-label": "Remove label from the conversation",
  macro: "Execute Macro",
};

const goTo: { label: string; href: string }[] = [
  { label: "Go to Conversation Dashboard", href: "/dashboard/chat" },
  { label: "Go to Contacts Dashboard", href: "/dashboard/contacts" },
  { label: "Go to Captain", href: "/dashboard/captain" },
  { label: "Go to Calls Dashboard", href: "/dashboard/calls" },
  { label: "Go to Campaigns", href: "/dashboard/campaigns" },
  { label: "Go to Help Center", href: "/dashboard/help-center" },
  { label: "Go to Reports Overview", href: "/dashboard/reports/overview" },
  { label: "Go to Conversation Reports", href: "/dashboard/reports/conversations" },
  { label: "Go to Agent Reports", href: "/dashboard/reports/agents" },
  { label: "Go to Label Reports", href: "/dashboard/reports/labels" },
  { label: "Go to Inbox Reports", href: "/dashboard/reports/inboxes" },
  { label: "Go to Team Reports", href: "/dashboard/reports/teams" },
  { label: "Go to CSAT Reports", href: "/dashboard/reports/csat" },
  { label: "Go to Bot Reports", href: "/dashboard/reports/bot" },
  { label: "Go to SLA Reports", href: "/dashboard/reports/sla" },
  { label: "Go to Agent Settings", href: "/dashboard/users" },
  { label: "Go to Team Settings", href: "/dashboard/settings/teams" },
  { label: "Go to Inbox Settings", href: "/dashboard/settings/inboxes" },
  { label: "Go to Templates", href: "/dashboard/settings/templates" },
  { label: "Go to Label Settings", href: "/dashboard/settings/labels" },
  { label: "Go to Custom Attributes", href: "/dashboard/settings/attributes" },
  { label: "Go to Automation", href: "/dashboard/settings/automation" },
  { label: "Go to Macros", href: "/dashboard/settings/macros" },
  { label: "Go to Canned Response Settings", href: "/dashboard/settings/canned-responses" },
  { label: "Go to SLA Settings", href: "/dashboard/settings/sla" },
  { label: "Go to Application Settings", href: "/dashboard/settings/integrations" },
  { label: "Go to Data", href: "/dashboard/settings/data" },
  { label: "Go to Audit Logs", href: "/dashboard/settings/audit-logs" },
  { label: "Go to Billing", href: "/dashboard/settings/billing" },
  { label: "Go to Account Settings", href: "/dashboard/settings/account" },
  { label: "Go to Profile Settings", href: "/dashboard/settings/profile" },
];

// Chatwoot snoozeHelpers.js: an hour from now, tomorrow 9 AM, next week Monday 9 AM, the 1st of next month 9 AM.
function snoozePresets(): { label: string; display: string | null; custom?: boolean }[] {
  const now = new Date();
  return [
    { label: "Until next reply", display: "Snoozed until next reply" },
    { label: "Until an hour from now", display: `Snoozed until ${format(addHours(now, 1), "h:mm a")}` },
    { label: "Until tomorrow", display: "Snoozed until tomorrow" },
    { label: "Until next week", display: "Snoozed until next week" },
    {
      label: "Until next month",
      display: `Snoozed until ${format(startOfMonth(addMonths(now, 1)), "MMM d")}, 9:00 AM`,
    },
    { label: "Custom...", display: null, custom: true },
  ];
}

export function CommandBarDialog({
  convId,
  initialPage = "root",
  onOpenChange,
}: {
  convId?: number;
  initialPage?: CommandPage;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [page, setPage] = useState<CommandPage>(initialPage);
  const [search, setSearch] = useState("");
  const meta = useCwStore((s) => (convId ? s.meta[convId] : undefined));
  const muted = useCwStore((s) => (convId ? Boolean(s.muted[convId]) : false));
  const { tags, byConv } = useChatTags();
  const convTags = convId ? (byConv[String(convId)] ?? []) : [];
  const hasConversation = Boolean(convId && meta);

  const close = () => onOpenChange(false);
  const open = (next: CommandPage) => {
    setPage(next);
    setSearch("");
  };
  const done = (message: string) => {
    toast.success(message);
    close();
  };

  return (
    <CommandDialog
      open
      onOpenChange={onOpenChange}
      title="Command bar"
      description="Search or jump to"
      className="sm:max-w-xl"
    >
      <Command
        onKeyDown={(event) => {
          if (event.key === "Backspace" && !search && page !== "root" && initialPage === "root") {
            event.preventDefault();
            open("root");
          }
        }}
      >
        {page !== "root" && (
          <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground text-xs">
            {initialPage === "root" && (
              <button
                type="button"
                aria-label="Back"
                className="rounded-sm p-0.5 hover:bg-muted"
                onClick={() => open("root")}
              >
                <ArrowLeft className="size-3.5" />
              </button>
            )}
            <span className="font-medium text-foreground">{pageTitles[page]}</span>
            {convId && <span>· Conversation #{convId}</span>}
          </div>
        )}
        <CommandInput
          placeholder={
            page === "snooze" ? "Type a time e.g. tomorrow, 2 hours, next friday, jan 15..." : "Search or jump to"
          }
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[22rem]">
          <CommandEmpty>No results found</CommandEmpty>

          {page === "root" && hasConversation && convId && meta && (
            <>
              <CommandGroup heading="Conversation">
                {meta.status === "resolved" ? (
                  <CommandItem
                    onSelect={() => {
                      cw.setStatus([convId], "open");
                      done("Conversation status changed");
                    }}
                  >
                    <RotateCcw /> Reopen conversation
                  </CommandItem>
                ) : (
                  <CommandItem
                    onSelect={() => {
                      cw.setStatus([convId], "resolved");
                      done("Conversation status changed");
                    }}
                  >
                    <CircleCheck /> Resolve conversation
                  </CommandItem>
                )}
                <CommandItem
                  onSelect={() => {
                    cw.toggleMute(convId);
                    done(
                      muted
                        ? "This contact is unblocked successfully."
                        : "This contact is blocked successfully. You will not be notified of any future conversations.",
                    );
                  }}
                >
                  {muted ? <Volume1 /> : <VolumeOff />}
                  {muted ? "Unmute conversation" : "Mute conversation"}
                </CommandItem>
                <CommandItem onSelect={() => openDialog({ type: "transcript", id: convId })}>
                  <Share /> Send an email transcript
                </CommandItem>
                <CommandItem onSelect={() => open("snooze")}>
                  <Clock /> Snooze Conversation <ArrowRight className="ms-auto" />
                </CommandItem>
                <CommandItem onSelect={() => open("assign-agent")}>
                  <UserRound /> Assign an agent <ArrowRight className="ms-auto" />
                </CommandItem>
                <CommandItem onSelect={() => open("assign-team")}>
                  <UsersRound /> Assign a team <ArrowRight className="ms-auto" />
                </CommandItem>
                <CommandItem onSelect={() => open("priority")}>
                  <Flag /> Assign priority <ArrowRight className="ms-auto" />
                </CommandItem>
                <CommandItem onSelect={() => open("add-label")}>
                  <Tag /> Add label to the conversation <ArrowRight className="ms-auto" />
                </CommandItem>
                {convTags.length > 0 && (
                  <CommandItem onSelect={() => open("remove-label")}>
                    <Tag /> Remove label from the conversation <ArrowRight className="ms-auto" />
                  </CommandItem>
                )}
                <CommandItem onSelect={() => open("macro")}>
                  <Play /> Execute a macro <ArrowRight className="ms-auto" />
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {page === "root" && (
            <CommandGroup heading="General">
              {goTo.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    close();
                    router.push(item.href);
                  }}
                >
                  <ArrowRight /> {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {page === "snooze" && convId && (
            <CommandGroup heading="Snooze Conversation">
              {snoozePresets().map((option) => (
                <CommandItem
                  key={option.label}
                  onSelect={() => {
                    if (option.custom) {
                      openDialog({ type: "snooze", ids: [convId] });
                      return;
                    }
                    cw.setStatus([convId], "snoozed", option.display);
                    done("Conversation status changed");
                  }}
                >
                  <Clock /> {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {page === "assign-agent" && convId && meta && (
            <CommandGroup heading="Change Assignee">
              <CommandItem
                value="none"
                onSelect={() => {
                  cw.assignAgent([convId], null);
                  done("Conversation unassigned successfully");
                }}
              >
                <UserRound className="text-muted-foreground" /> None
                {meta.assigneeId === null && <Check className="ms-auto" />}
              </CommandItem>
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={agent.name}
                  onSelect={() => {
                    cw.assignAgent([convId], agent.id);
                    done(`Assigned to ${agent.name}`);
                  }}
                >
                  <AgentAvatar id={agent.id} size="sm" showStatus /> {agent.name}
                  {meta.assigneeId === agent.id && <Check className="ms-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {page === "assign-team" && convId && meta && (
            <CommandGroup heading="Change Team">
              <CommandItem
                value="none"
                onSelect={() => {
                  cw.assignTeam([convId], null);
                  done("Conversation team changed");
                }}
              >
                <UsersRound className="text-muted-foreground" /> None
                {meta.teamId === null && <Check className="ms-auto" />}
              </CommandItem>
              {teams.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => {
                    cw.assignTeam([convId], team.id);
                    done(`Assigned to ${team.name}`);
                  }}
                >
                  <UsersRound className="text-muted-foreground" /> {team.name}
                  {meta.teamId === team.id && <Check className="ms-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {page === "priority" && convId && meta && (
            <CommandGroup heading="Change Priority">
              {priorities.map((priority) => (
                <CommandItem
                  key={priority.value}
                  value={priority.label}
                  onSelect={() => {
                    cw.setPriority([convId], priority.value);
                    done(`Changed priority of conversation id ${convId} to ${priority.value}`);
                  }}
                >
                  {priority.value === "none" ? <span className="size-4" /> : <PriorityIcon priority={priority.value} />}
                  {priority.label}
                  {meta.priority === priority.value && <Check className="ms-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {page === "add-label" && convId && (
            <CommandGroup heading="Add label to the conversation">
              {tags
                .filter((tag) => !convTags.includes(tag.id))
                .map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.label}
                    onSelect={() => {
                      toggleTag(String(convId), tag.id);
                      done("Labels added successfully");
                    }}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} /> {tag.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          )}

          {page === "remove-label" && convId && (
            <CommandGroup heading="Remove label from the conversation">
              {tags
                .filter((tag) => convTags.includes(tag.id))
                .map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.label}
                    onSelect={() => {
                      toggleTag(String(convId), tag.id);
                      done("Labels removed successfully");
                    }}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} /> {tag.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          )}

          {page === "macro" && convId && (
            <CommandGroup heading="Execute Macro">
              {macros.map((macro) => (
                <CommandItem
                  key={macro.id}
                  value={macro.name}
                  onSelect={() => {
                    runMacro(macro.id, convId);
                    close();
                  }}
                >
                  <Play /> {macro.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
