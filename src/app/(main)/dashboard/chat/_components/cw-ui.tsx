"use client";

// Small Studio-styled pieces shared by the conversation list, the conversation pane and the contact panel.
import { forwardRef, type ReactNode } from "react";

import { cn } from "cn";
import {
  Bot,
  Check,
  CircleAlert,
  Clock,
  type LucideIcon,
  type LucideProps,
  Mail,
  MessageCircle,
  Phone,
  SignalHigh,
  SignalLow,
  SignalMedium,
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
import { getInitials } from "@/lib/utils";

import { agents, type ConversationMeta, type CwStatus, type Priority, priorities, teams } from "./cw-data";

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
  low: "text-sky-600 dark:text-sky-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  urgent: "text-destructive",
};

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === "none") return null;
  const Icon =
    priority === "urgent"
      ? CircleAlert
      : priority === "high"
        ? SignalHigh
        : priority === "medium"
          ? SignalMedium
          : SignalLow;
  const label = priorities.find((p) => p.value === priority)?.label;
  return (
    <span title={`Priority: ${label}`} className={cn("inline-flex", priorityTone[priority], className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Priority {label}</span>
    </span>
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

export function SlaBadge({ sla, className }: { sla: ConversationMeta["sla"]; className?: string }) {
  if (!sla) return null;
  const missed = sla.state === "missed";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border px-1.5 py-0 font-medium text-[10px]",
        missed
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <Clock className="size-3" />
      {sla.kind} {missed ? "missed" : "due"} {sla.time}
    </Badge>
  );
}

// A contact or teammate: coloured initials, with the green dot when online.
export function PersonAvatar({
  name,
  size = "default",
  online = false,
  className,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  online?: boolean;
  className?: string;
}) {
  return (
    <Avatar size={size} className={cn("shrink-0 font-medium", personToneClass(name), className)}>
      <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
      {online && <AvatarBadge className="bg-green-600 dark:bg-green-800" />}
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
  const agent = agents.find((a) => a.id === id);
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
