// Campaign status badges. Chatwoot colours: active (Enabled, Scheduled, Running) = teal, inactive (Disabled,
// Completed) = grey. M129-C adds Draft (grey, dashed) and Failed (red), and Chatwoot's "Processing" is "Running".
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";

const teal = "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400";
const grey = "border-border bg-muted/50 text-muted-foreground";

export const statusTone: Record<string, { label: string; badge: string; dot: string }> = {
  enabled: { label: "Enabled", badge: teal, dot: "bg-teal-500" },
  disabled: { label: "Disabled", badge: grey, dot: "bg-muted-foreground" },
  draft: { label: "Draft", badge: cn(grey, "border-dashed"), dot: "bg-muted-foreground/60" },
  scheduled: { label: "Scheduled", badge: teal, dot: "bg-teal-500" },
  running: { label: "Running", badge: teal, dot: "animate-pulse bg-teal-500" },
  completed: { label: "Completed", badge: grey, dot: "bg-muted-foreground" },
  failed: { label: "Failed", badge: "border-destructive/20 bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

export function CampaignStatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? statusTone.completed;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border px-2 py-1 font-medium", tone.badge)}
      data-campaign-status={status}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </Badge>
  );
}
