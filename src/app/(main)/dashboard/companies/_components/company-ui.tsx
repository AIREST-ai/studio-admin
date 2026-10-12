"use client";
import { cn } from "cn";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { companyDisplayName } from "./company-data";

// Company logo placeholder: square initials (Chatwoot Avatar with the company name), coloured like the Contacts avatars.
export function CompanyAvatar({
  company,
  size = "lg",
  className,
}: {
  company: { name: string };
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const name = companyDisplayName(company);
  return (
    <Avatar size={size} className={cn("rounded-lg font-medium after:rounded-lg", personToneClass(name), className)}>
      <AvatarFallback className="rounded-lg">{getInitials(name).slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}

const industryTones: Record<string, string> = {
  Telecom: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  Banking: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Education: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Healthcare: "border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400",
  Logistics: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Aviation: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  Energy: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

export function IndustryBadge({ industry }: { industry: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border px-2 py-1 font-medium",
        industryTones[industry] ?? "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {industry}
    </Badge>
  );
}
