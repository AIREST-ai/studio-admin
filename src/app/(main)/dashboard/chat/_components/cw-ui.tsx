"use client";

// Small Studio-styled pieces shared by the conversation list, the conversation pane and the contact panel.
import { forwardRef, type ReactNode } from "react";

import { cn } from "cn";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Clock,
  Equal,
  type LucideIcon,
  type LucideProps,
  Mail,
  MessageCircle,
  Phone,
  UserRound,
  UsersRound,
} from "lucide-react";
import { type SimpleIcon as SimpleIconData, siFacebook, siInstagram, siWhatsapp } from "simple-icons";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { SimpleIcon } from "@/components/simple-icon";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import {
  type ConversationMeta,
  type CwStatus,
  type Priority,
  priorities,
  useLiveAgents,
  useLiveTeams,
} from "./cw-data";

const brandIcons = { whatsapp: siWhatsapp, instagram: siInstagram, facebook: siFacebook } as const;

export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  if (channel in brandIcons) {
    return (
      <span className={cn("inline-flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5", className)}>
        <SimpleIcon icon={brandIcons[channel as keyof typeof brandIcons]} />
      </span>
    );
  }
  const Icon = channel === "email" ? Mail : channel === "phone" ? Phone : MessageCircle;
  return <Icon className={cn("size-3.5 shrink-0", className)} />;
}

// F159: the same channel icons as a sidebar icon (Chatwoot Sidebar.vue gives every inbox leaf its ChannelIcon). The
// brand marks are drawn in currentColor so the sidebar colours them like its other icons.
function brandNavIcon(icon: SimpleIconData): LucideIcon {
  const BrandIcon = forwardRef<SVGSVGElement, LucideProps>(({ className }, ref) => (
    <svg ref={ref} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={cn("lucide", className)}>
      <path d={icon.path} />
    </svg>
  ));
  BrandIcon.displayName = `${icon.title}Icon`;
  return BrandIcon;
}

const brandNavIcons: Record<keyof typeof brandIcons, LucideIcon> = {
  whatsapp: brandNavIcon(siWhatsapp),
  instagram: brandNavIcon(siInstagram),
  facebook: brandNavIcon(siFacebook),
};

export function channelNavIcon(channel: string): LucideIcon {
  if (channel in brandNavIcons) return brandNavIcons[channel as keyof typeof brandNavIcons];
  if (channel === "email") return Mail;
  if (channel === "phone") return Phone;
  return MessageCircle;
}

const priorityTone: Record<Priority, string> = {
  none: "text-muted-foreground",
  low: "text-muted-foreground!",
  medium: "text-amber-600! dark:text-amber-400!",
  high: "text-orange-600! dark:text-orange-400!",
  urgent: "text-destructive!",
};

const priorityMark: Record<Exclude<Priority, "none">, LucideIcon> = {
  urgent: ChevronsUp,
  high: ChevronUp,
  medium: Equal,
  low: ChevronDown,
};

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === "none") return null;
  const label = priorities.find((p) => p.value === priority)?.label;
  // Item 102: not the signal bars, which read as phone signal. T-285 (Fahad 124.6): the flags that replaced them read
  // as alarming, so the priority uses the standard priority arrows of Jira (Highest ⇈, High ↑, Medium =, Low ↓):
  // the direction says the level and the colour backs it up. The colour is marked important, and the path inherits
  // it, so a highlighted menu row (whose **: rule paints every descendant white) does not turn the mark white.
  const Mark = priorityMark[priority];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span data-priority={priority} className={cn("inline-flex", priorityTone[priority], className)}>
          <Mark
            className={cn("size-4 **:text-inherit!", priorityTone[priority])}
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <span className="sr-only">{label} priority</span>
        </span>
      </TooltipTrigger>
      {/* F-13 (Fahad 124.1, «مربع الشرح الأبيض أكبر من اللازم»): the white box (a tooltip is white in the dark theme)
          held a title and a sentence set side by side as narrow columns, over the card it explains. Chatwoot's priority
          mark says only the level (CardPriorityIcon.vue, tooltipContent: https://github.com/chatwoot/chatwoot/blob/develop/app/javascript/dashboard/components-next/Conversation/ConversationCard/CardPriorityIcon.vue),
          and NN/g: "lengthy content is no longer a 'tip', so keep it brief" (https://www.nngroup.com/articles/tooltip-guidelines/). */}
      <TooltipContent>{label} priority</TooltipContent>
    </Tooltip>
  );
}

export const statusTone: Record<CwStatus, { badge: string; dot: string; label: string }> = {
  open: {
    label: "Open",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  snoozed: {
    label: "Snoozed",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Resolved",
    badge: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  closed: { label: "Closed", badge: "border-border bg-muted/50 text-muted-foreground", dot: "bg-zinc-400" },
};

export function StatusPill({ status, className }: { status: CwStatus; className?: string }) {
  const tone = statusTone[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border px-2 py-0.5 font-medium", tone.badge, className)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </Badge>
  );
}

// T-99: plain words instead of Chatwoot's FRT / NRT / RT codes; the hover names the code and the target the badge
// is counted from (cw-data.ts slaFor, which makes FRT and NRT only; T-134: the target is the Settings > SLA policy's). T-118 row 2: "Reply due in" for both, as "Next
// reply due in" pushed Labels to a third header row at 1024; first or next is said on hover.
const slaWords = {
  FRT: {
    name: "First response time",
    due: "Reply due in",
    missed: "Reply overdue by",
  },
  NRT: {
    name: "Next response time",
    due: "Reply due in",
    missed: "Reply overdue by",
  },
  RT: {
    name: "Resolution time",
    due: "Resolution due in",
    missed: "Resolution overdue by",
  },
} as const;

export function SlaBadge({ sla, className }: { sla: ConversationMeta["sla"]; className?: string }) {
  if (!sla) return null;
  const missed = sla.state === "missed";
  const words = slaWords[sla.kind];
  const hours = sla.target / 60;
  const target = sla.target % 60 === 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : `${sla.target} minutes`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          // T-99: keep the badge's own data-slot (the tooltip trigger would replace it).
          data-slot="badge"
          className={cn(
            "gap-1 border px-1.5 py-0 font-medium text-[10px]",
            missed
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
            className,
          )}
        >
          <Clock className="size-3" />
          {missed ? words.missed : words.due} {sla.time}
        </Badge>
      </TooltipTrigger>
      {/* F-13 (Fahad 124.1): one short line, the code and the policy's target (see PriorityIcon); the badge itself
          already says what is due. Chatwoot's SLA label has no hover box at all (SLACardLabel.vue:
          https://github.com/chatwoot/chatwoot/blob/develop/app/javascript/dashboard/components-next/Conversation/Sla/SLACardLabel.vue). */}
      <TooltipContent>
        {words.name} ({sla.kind}){sla.kind !== "RT" ? ` · ${sla.policy} SLA: ${target}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

// A contact: coloured initials. T-268: green dot only when online is true (a Website widget heartbeat, see
// isPersonOnline); null or false shows nothing, as Chatwoot's CardAvatar shows no dot for offline contacts.
export function PersonAvatar({
  name,
  size = "default",
  online,
  className,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  online?: boolean | null;
  className?: string;
}) {
  return (
    <Avatar size={size} className={cn("shrink-0 font-medium", personToneClass(name), className)}>
      <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
      {online === true ? (
        <AvatarBadge data-presence="online" aria-label="Online" className={availabilityDot.online} />
      ) : null}
    </Avatar>
  );
}

// The bot (CSAT survey, automation and Captain messages): a coloured avatar like every person, with the bot mark
// instead of initials, so it is not the only grey avatar in a thread.
export function BotAvatar({ size = "default", className }: { size?: "sm" | "default" | "lg"; className?: string }) {
  return (
    <Avatar size={size} className={cn("shrink-0 font-medium", personToneClass("Captain Bot"), className)}>
      <AvatarFallback className="text-xs">
        <Bot className={size === "sm" ? "size-3" : "size-4"} aria-hidden="true" />
        <span className="sr-only">Bot</span>
      </AvatarFallback>
    </Avatar>
  );
}

const availabilityDot = {
  online: "bg-green-600 dark:bg-green-700",
  busy: "bg-amber-500",
  offline: "bg-muted-foreground",
};

export function AgentAvatar({
  id,
  name,
  size = "sm",
  showStatus = false,
  className,
}: {
  id?: number | null;
  name?: string | null;
  size?: "sm" | "default" | "lg";
  showStatus?: boolean;
  className?: string;
}) {
  const agent = useLiveAgents().find((a) => a.id === id);
  const label = agent?.name ?? name ?? "";
  return (
    <Avatar size={size} className={cn("shrink-0 font-medium", label && personToneClass(label), className)}>
      <AvatarFallback className="text-[10px]">
        {label ? getInitials(label) : <UserRound className="size-3" />}
      </AvatarFallback>
      {showStatus && agent ? <AvatarBadge className={availabilityDot[agent.availability]} /> : null}
    </Avatar>
  );
}

function PickerShell({
  children,
  trigger,
  placeholder,
  align = "end",
}: {
  children: ReactNode;
  trigger: ReactNode;
  placeholder: string;
  align?: "start" | "end";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-60 p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results found</CommandEmpty>
            {children}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AgentPicker({
  value,
  onChange,
  trigger,
  align,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  trigger: ReactNode;
  align?: "start" | "end";
}) {
  const agents = useLiveAgents();
  return (
    <PickerShell trigger={trigger} placeholder="Search" align={align}>
      <CommandGroup heading="Select Agent">
        <CommandItem value="none" onSelect={() => onChange(null)}>
          <UserRound className="text-muted-foreground" />
          None
          {value === null && <Check className="ms-auto" />}
        </CommandItem>
        {agents.map((agent) => (
          <CommandItem key={agent.id} value={agent.name} onSelect={() => onChange(agent.id)}>
            <AgentAvatar id={agent.id} size="sm" showStatus />
            <span className="truncate">{agent.name}</span>
            {value === agent.id && <Check className="ms-auto" />}
          </CommandItem>
        ))}
      </CommandGroup>
    </PickerShell>
  );
}

export function TeamPicker({
  value,
  onChange,
  trigger,
  align,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  trigger: ReactNode;
  align?: "start" | "end";
}) {
  const teams = useLiveTeams();
  return (
    <PickerShell trigger={trigger} placeholder="Search" align={align}>
      <CommandGroup heading="Assigned Team">
        <CommandItem value="none" onSelect={() => onChange(null)}>
          <UsersRound className="text-muted-foreground" />
          None
          {value === null && <Check className="ms-auto" />}
        </CommandItem>
        {teams.map((team) => (
          <CommandItem key={team.id} value={team.name} onSelect={() => onChange(team.id)}>
            <UsersRound className="text-muted-foreground" />
            {team.name}
            {value === team.id && <Check className="ms-auto" />}
          </CommandItem>
        ))}
      </CommandGroup>
    </PickerShell>
  );
}

export function PriorityPicker({
  value,
  onChange,
  trigger,
  align,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
  trigger: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <PickerShell trigger={trigger} placeholder="Select priority" align={align}>
      <CommandGroup heading="Priority">
        {priorities.map((priority) => (
          <CommandItem key={priority.value} value={priority.label} onSelect={() => onChange(priority.value)}>
            {priority.value === "none" ? <span className="size-3.5" /> : <PriorityIcon priority={priority.value} />}
            {priority.label}
            {value === priority.value && <Check className="ms-auto" />}
          </CommandItem>
        ))}
      </CommandGroup>
    </PickerShell>
  );
}
