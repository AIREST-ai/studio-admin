"use client";
// Studio look, copied from users/_components/users-columns.tsx + users/_components/data.tsx (statusMeta)
// and default/_components/metric-cards.tsx, so Contacts reads as the same product.
import type { ReactNode } from "react";

import { cn } from "cn";
import { Check, Clock, X } from "lucide-react";

import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";

import type { Contact } from "./data";

export type ContactStatus = "Active" | "Idle" | "Inactive" | "Blocked";

export function contactStatus(contact: Contact): ContactStatus {
  if (contact.lastActivityMinutes < 24 * 60) return "Active";
  if (contact.lastActivityMinutes < 7 * 24 * 60) return "Idle";
  return "Inactive";
}

export const statusMeta: Record<ContactStatus, { badgeClass: string; dotClass: string }> = {
  Active: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  Idle: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  Inactive: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  Blocked: {
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
};

export function StatusBadge({ status }: { status: ContactStatus }) {
  const meta = statusMeta[status];
  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {status}
    </Badge>
  );
}

const labelTones: Record<string, string> = {
  vip: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  billing: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  lead: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  partner: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  support: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  education: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  healthcare: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function LabelBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border px-2 py-1 font-medium",
        labelTones[label] ?? "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </Badge>
  );
}

const avatarTones = [
  "[&_[data-slot=avatar-fallback]]:bg-amber-100 [&_[data-slot=avatar-fallback]]:text-amber-700 after:border-amber-200 dark:[&_[data-slot=avatar-fallback]]:bg-amber-500/15 dark:[&_[data-slot=avatar-fallback]]:text-amber-300 dark:after:border-amber-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-orange-100 [&_[data-slot=avatar-fallback]]:text-orange-700 after:border-orange-200 dark:[&_[data-slot=avatar-fallback]]:bg-orange-500/15 dark:[&_[data-slot=avatar-fallback]]:text-orange-300 dark:after:border-orange-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-rose-100 [&_[data-slot=avatar-fallback]]:text-rose-700 after:border-rose-200 dark:[&_[data-slot=avatar-fallback]]:bg-rose-500/15 dark:[&_[data-slot=avatar-fallback]]:text-rose-300 dark:after:border-rose-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-pink-100 [&_[data-slot=avatar-fallback]]:text-pink-700 after:border-pink-200 dark:[&_[data-slot=avatar-fallback]]:bg-pink-500/15 dark:[&_[data-slot=avatar-fallback]]:text-pink-300 dark:after:border-pink-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-fuchsia-100 [&_[data-slot=avatar-fallback]]:text-fuchsia-700 after:border-fuchsia-200 dark:[&_[data-slot=avatar-fallback]]:bg-fuchsia-500/15 dark:[&_[data-slot=avatar-fallback]]:text-fuchsia-300 dark:after:border-fuchsia-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-purple-100 [&_[data-slot=avatar-fallback]]:text-purple-700 after:border-purple-200 dark:[&_[data-slot=avatar-fallback]]:bg-purple-500/15 dark:[&_[data-slot=avatar-fallback]]:text-purple-300 dark:after:border-purple-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-violet-100 [&_[data-slot=avatar-fallback]]:text-violet-700 after:border-violet-200 dark:[&_[data-slot=avatar-fallback]]:bg-violet-500/15 dark:[&_[data-slot=avatar-fallback]]:text-violet-300 dark:after:border-violet-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-indigo-100 [&_[data-slot=avatar-fallback]]:text-indigo-700 after:border-indigo-200 dark:[&_[data-slot=avatar-fallback]]:bg-indigo-500/15 dark:[&_[data-slot=avatar-fallback]]:text-indigo-300 dark:after:border-indigo-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-sky-100 [&_[data-slot=avatar-fallback]]:text-sky-700 after:border-sky-200 dark:[&_[data-slot=avatar-fallback]]:bg-sky-500/15 dark:[&_[data-slot=avatar-fallback]]:text-sky-300 dark:after:border-sky-500/20",
  "[&_[data-slot=avatar-fallback]]:bg-emerald-100 [&_[data-slot=avatar-fallback]]:text-emerald-700 after:border-emerald-200 dark:[&_[data-slot=avatar-fallback]]:bg-emerald-500/15 dark:[&_[data-slot=avatar-fallback]]:text-emerald-300 dark:after:border-emerald-500/20",
];

function getLastActiveBadge(minutes: number) {
  if (minutes < 60) return { className: "bg-green-600 text-green-950 [&>svg]:text-white", icon: Check };
  if (minutes < 4 * 60) return { className: "bg-amber-500 text-amber-950", icon: Clock };
  if (minutes < 7 * 24 * 60) return { className: "bg-destructive", icon: null };
  return { className: "bg-muted-foreground text-muted", icon: X };
}

export function ContactAvatar({
  contact,
  size = "lg",
  className,
}: {
  contact: Contact;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const badge = getLastActiveBadge(contact.lastActivityMinutes);
  const BadgeIcon = badge.icon;
  return (
    <Avatar size={size} className={cn("font-medium", avatarTones[contact.name.length % avatarTones.length], className)}>
      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
      <AvatarBadge className={badge.className}>{BadgeIcon ? <BadgeIcon /> : null}</AvatarBadge>
    </Avatar>
  );
}

export function PageHeading({ title, subtitle }: { title: ReactNode; subtitle: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{subtitle}</p>
    </div>
  );
}
