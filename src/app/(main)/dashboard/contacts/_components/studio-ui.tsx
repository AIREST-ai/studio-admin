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

// One label list for the whole account, as in Chatwoot: the same five labels as the inbox (chat-tags-store.ts).
const labelTones: Record<string, string> = {
  vip: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  billing: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  lead: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  partner: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  support: "border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400",
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

// Initials colours, one per hue, written out in full so Tailwind finds the classes.
const avatarTones = {
  red: "[&_[data-slot=avatar-fallback]]:bg-red-100 [&_[data-slot=avatar-fallback]]:text-red-700 after:border-red-200 dark:[&_[data-slot=avatar-fallback]]:bg-red-500/15 dark:[&_[data-slot=avatar-fallback]]:text-red-300 dark:after:border-red-500/20",
  orange:
    "[&_[data-slot=avatar-fallback]]:bg-orange-100 [&_[data-slot=avatar-fallback]]:text-orange-700 after:border-orange-200 dark:[&_[data-slot=avatar-fallback]]:bg-orange-500/15 dark:[&_[data-slot=avatar-fallback]]:text-orange-300 dark:after:border-orange-500/20",
  amber:
    "[&_[data-slot=avatar-fallback]]:bg-amber-100 [&_[data-slot=avatar-fallback]]:text-amber-700 after:border-amber-200 dark:[&_[data-slot=avatar-fallback]]:bg-amber-500/15 dark:[&_[data-slot=avatar-fallback]]:text-amber-300 dark:after:border-amber-500/20",
  yellow:
    "[&_[data-slot=avatar-fallback]]:bg-yellow-100 [&_[data-slot=avatar-fallback]]:text-yellow-700 after:border-yellow-200 dark:[&_[data-slot=avatar-fallback]]:bg-yellow-500/15 dark:[&_[data-slot=avatar-fallback]]:text-yellow-300 dark:after:border-yellow-500/20",
  lime: "[&_[data-slot=avatar-fallback]]:bg-lime-100 [&_[data-slot=avatar-fallback]]:text-lime-700 after:border-lime-200 dark:[&_[data-slot=avatar-fallback]]:bg-lime-500/15 dark:[&_[data-slot=avatar-fallback]]:text-lime-300 dark:after:border-lime-500/20",
  green:
    "[&_[data-slot=avatar-fallback]]:bg-green-100 [&_[data-slot=avatar-fallback]]:text-green-700 after:border-green-200 dark:[&_[data-slot=avatar-fallback]]:bg-green-500/15 dark:[&_[data-slot=avatar-fallback]]:text-green-300 dark:after:border-green-500/20",
  emerald:
    "[&_[data-slot=avatar-fallback]]:bg-emerald-100 [&_[data-slot=avatar-fallback]]:text-emerald-700 after:border-emerald-200 dark:[&_[data-slot=avatar-fallback]]:bg-emerald-500/15 dark:[&_[data-slot=avatar-fallback]]:text-emerald-300 dark:after:border-emerald-500/20",
  teal: "[&_[data-slot=avatar-fallback]]:bg-teal-100 [&_[data-slot=avatar-fallback]]:text-teal-700 after:border-teal-200 dark:[&_[data-slot=avatar-fallback]]:bg-teal-500/15 dark:[&_[data-slot=avatar-fallback]]:text-teal-300 dark:after:border-teal-500/20",
  cyan: "[&_[data-slot=avatar-fallback]]:bg-cyan-100 [&_[data-slot=avatar-fallback]]:text-cyan-700 after:border-cyan-200 dark:[&_[data-slot=avatar-fallback]]:bg-cyan-500/15 dark:[&_[data-slot=avatar-fallback]]:text-cyan-300 dark:after:border-cyan-500/20",
  sky: "[&_[data-slot=avatar-fallback]]:bg-sky-100 [&_[data-slot=avatar-fallback]]:text-sky-700 after:border-sky-200 dark:[&_[data-slot=avatar-fallback]]:bg-sky-500/15 dark:[&_[data-slot=avatar-fallback]]:text-sky-300 dark:after:border-sky-500/20",
  blue: "[&_[data-slot=avatar-fallback]]:bg-blue-100 [&_[data-slot=avatar-fallback]]:text-blue-700 after:border-blue-200 dark:[&_[data-slot=avatar-fallback]]:bg-blue-500/15 dark:[&_[data-slot=avatar-fallback]]:text-blue-300 dark:after:border-blue-500/20",
  indigo:
    "[&_[data-slot=avatar-fallback]]:bg-indigo-100 [&_[data-slot=avatar-fallback]]:text-indigo-700 after:border-indigo-200 dark:[&_[data-slot=avatar-fallback]]:bg-indigo-500/15 dark:[&_[data-slot=avatar-fallback]]:text-indigo-300 dark:after:border-indigo-500/20",
  violet:
    "[&_[data-slot=avatar-fallback]]:bg-violet-100 [&_[data-slot=avatar-fallback]]:text-violet-700 after:border-violet-200 dark:[&_[data-slot=avatar-fallback]]:bg-violet-500/15 dark:[&_[data-slot=avatar-fallback]]:text-violet-300 dark:after:border-violet-500/20",
  purple:
    "[&_[data-slot=avatar-fallback]]:bg-purple-100 [&_[data-slot=avatar-fallback]]:text-purple-700 after:border-purple-200 dark:[&_[data-slot=avatar-fallback]]:bg-purple-500/15 dark:[&_[data-slot=avatar-fallback]]:text-purple-300 dark:after:border-purple-500/20",
  fuchsia:
    "[&_[data-slot=avatar-fallback]]:bg-fuchsia-100 [&_[data-slot=avatar-fallback]]:text-fuchsia-700 after:border-fuchsia-200 dark:[&_[data-slot=avatar-fallback]]:bg-fuchsia-500/15 dark:[&_[data-slot=avatar-fallback]]:text-fuchsia-300 dark:after:border-fuchsia-500/20",
  pink: "[&_[data-slot=avatar-fallback]]:bg-pink-100 [&_[data-slot=avatar-fallback]]:text-pink-700 after:border-pink-200 dark:[&_[data-slot=avatar-fallback]]:bg-pink-500/15 dark:[&_[data-slot=avatar-fallback]]:text-pink-300 dark:after:border-pink-500/20",
  rose: "[&_[data-slot=avatar-fallback]]:bg-rose-100 [&_[data-slot=avatar-fallback]]:text-rose-700 after:border-rose-200 dark:[&_[data-slot=avatar-fallback]]:bg-rose-500/15 dark:[&_[data-slot=avatar-fallback]]:text-rose-300 dark:after:border-rose-500/20",
} as const;

type AvatarTone = keyof typeof avatarTones;

// F159: each person of the mock data (the Contacts people and the agents) has a hue of their own, picked so that
// people seen side by side never get close colours: neighbouring rows of the conversation list and of the Contacts
// table, and a customer next to the agent who answers. The same person has the same colour on Contacts, the
// conversations, /chat and the Email view. Other names fall back to a hue from their character codes.
const personTones: Record<string, AvatarTone> = {
  "Noura Al-Thani": "cyan",
  "Khalid Al-Mansoori": "purple",
  "Sarah Mitchell": "orange",
  "Abdullah Al-Qahtani": "blue",
  "Maryam Al-Kuwari": "emerald",
  "James Carter": "red",
  "Fatima Al-Suwaidi": "indigo",
  "Hamad Al-Marri": "yellow",
  "Reem Al-Otaibi": "teal",
  "Daniel Hughes": "pink",
  "Aisha Al-Hajri": "sky",
  "Omar Al-Shehhi": "green",
  "Arham Khan": "lime",
  "Priya Nair": "rose",
  "Yousef Al-Harbi": "fuchsia",
  "Lina Haddad": "violet",
  "Ravi Menon": "amber",
};

const fallbackTones: AvatarTone[] = [
  "sky",
  "rose",
  "emerald",
  "violet",
  "amber",
  "teal",
  "orange",
  "fuchsia",
  "lime",
  "blue",
  "pink",
  "indigo",
];

// Colour class for a person's initials, used by ContactAvatar, the conversations avatars, /chat and /mail.
export function personToneClass(name: string): string {
  const known = personTones[name];
  if (known) return avatarTones[known];
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return avatarTones[fallbackTones[sum % fallbackTones.length]];
}

// The avatar dot follows the Status badge (contactStatus), so a contact marked Active never shows an away dot.
const statusAvatarBadge: Record<ContactStatus, { className: string; icon: typeof Check | null }> = {
  Active: { className: "bg-green-600 text-green-950 [&>svg]:text-white", icon: Check },
  Idle: { className: "bg-amber-500 text-amber-950", icon: Clock },
  Inactive: { className: "bg-muted-foreground text-muted", icon: X },
  Blocked: { className: "bg-destructive", icon: null },
};

export function ContactAvatar({
  contact,
  size = "lg",
  className,
  status,
}: {
  contact: Contact;
  size?: "default" | "sm" | "lg";
  className?: string;
  status?: ContactStatus;
}) {
  const badge = statusAvatarBadge[status ?? contactStatus(contact)];
  const BadgeIcon = badge.icon;
  return (
    <Avatar size={size} className={cn("font-medium", personToneClass(contact.name), className)}>
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
