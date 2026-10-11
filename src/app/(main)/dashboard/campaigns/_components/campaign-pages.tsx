"use client";
import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import {
  Bot,
  ChartNoAxesColumn,
  Globe,
  Megaphone,
  MessageSquareText,
  Plus,
  SlidersVertical,
  Smartphone,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import {
  ConfirmDeleteCampaignDialog,
  LiveChatCampaignDialog,
  SMSCampaignDialog,
  WhatsAppCampaignDialog,
} from "./campaign-dialogs";
import {
  type LiveChatCampaign,
  type OneOffCampaign,
  type OneOffStatus,
  liveChatCampaigns,
  smsCampaigns,
  toneFor,
  whatsappCampaigns,
} from "./data";

const sections = [
  { href: "/dashboard/campaigns/live-chat", label: "Live chat" },
  { href: "/dashboard/campaigns/sms", label: "SMS" },
  { href: "/dashboard/campaigns/whatsapp", label: "WhatsApp" },
];

function SectionNav() {
  const pathname = usePathname();
  return (
    <nav className="inline-flex h-7 items-center rounded-lg bg-muted p-0.5">
      {sections.map((s) => {
        const active =
          pathname === s.href || (s.href.endsWith("live-chat") && pathname === "/dashboard/campaigns");
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "inline-flex h-6 items-center rounded-md px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CampaignLayout({
  title,
  onCreate,
  count,
  children,
}: {
  title: string;
  onCreate: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <div className="grid gap-1.5">
          <CardTitle className="text-xl leading-none">{title}</CardTitle>
          <span className="text-muted-foreground text-sm tabular-nums">
            {count} {count === 1 ? "campaign" : "campaigns"}
          </span>
        </div>
        <CardAction className="col-start-1 row-start-auto flex items-center gap-3 justify-self-start md:col-start-2 md:row-start-1 md:justify-self-end">
          <SectionNav />
          <Button size="sm" onClick={onCreate}>
            <Plus /> Create campaign
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

function CampaignEmptyState({
  icon: Icon,
  title,
  subtitle,
  onCreate,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onCreate: () => void;
}) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{subtitle}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={onCreate}>
          <Plus /> Create campaign
        </Button>
      </EmptyContent>
    </Empty>
  );
}

const oneOffStatus: Record<OneOffStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  processing: {
    label: "Processing",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
};

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-md px-2 font-medium text-xs", className)}>{label}</span>
  );
}

function IconAction({
  label,
  onClick,
  href,
  destructive,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  const button = (
    <Button
      variant={destructive ? "destructive" : "secondary"}
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      asChild={Boolean(href)}
    >
      {href ? <Link href={href}>{children}</Link> : children}
    </Button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CampaignRow({
  title,
  status,
  message,
  details,
  actions,
}: {
  title: string;
  status: React.ReactNode;
  message: string;
  details: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 border-b px-6 py-5 last:border-b-0">
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex items-center gap-3">
          <span className="line-clamp-1 font-medium text-base">{title}</span>
          {status}
        </div>
        <p className="line-clamp-1 text-left text-muted-foreground text-sm" dir="auto">
          {message}
        </p>
        <div className="flex h-6 items-center gap-2 overflow-hidden text-sm">{details}</div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>
    </li>
  );
}

function LiveChatDetails({ campaign }: { campaign: LiveChatCampaign }) {
  const sender = campaign.sender ?? "Bot";
  return (
    <>
      <span className="shrink-0 text-muted-foreground">Sent by</span>
      <span className="flex shrink-0 items-center gap-1.5 font-medium">
        {campaign.sender ? (
          <Avatar className="size-4">
            <AvatarFallback className={cn("text-[8px]", toneFor(campaign.id))}>{getInitials(sender)}</AvatarFallback>
          </Avatar>
        ) : (
          <Bot className="size-3.5" />
        )}
        {sender}
      </span>
      <span className="shrink-0 text-muted-foreground">from</span>
      <span className="flex shrink-0 items-center gap-1.5 font-medium">
        <Globe className="size-3" />
        {campaign.inbox}
      </span>
      <span className="hidden shrink-0 text-muted-foreground lg:inline">· URL:</span>
      <span className="hidden truncate text-muted-foreground lg:inline">{campaign.url}</span>
    </>
  );
}

function OneOffDetails({ campaign, icon: Icon }: { campaign: OneOffCampaign; icon: React.ElementType }) {
  return (
    <>
      <span className="shrink-0 text-muted-foreground">Sent from</span>
      <span className="flex shrink-0 items-center gap-1.5 font-medium">
        <Icon className="size-3" />
        {campaign.inbox}
      </span>
      <span className="shrink-0 text-muted-foreground">on</span>
      <span className="shrink-0 font-medium tabular-nums">{campaign.scheduledAt}</span>
    </>
  );
}

export function LiveChatCampaignsPage({ empty = false }: { empty?: boolean }) {
  const [dialog, setDialog] = React.useState<"create" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = React.useState<LiveChatCampaign | undefined>();
  const rows = empty ? [] : liveChatCampaigns;
  return (
    <>
      <CampaignLayout title="Live chat campaigns" count={rows.length} onCreate={() => setDialog("create")}>
        {rows.length ? (
          <ul>
            {rows.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                title={campaign.title}
                message={campaign.message}
                status={
                  <StatusPill
                    label={campaign.enabled ? "Enabled" : "Disabled"}
                    className={
                      campaign.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }
                  />
                }
                details={<LiveChatDetails campaign={campaign} />}
                actions={
                  <>
                    <IconAction
                      label="Edit"
                      onClick={() => {
                        setSelected(campaign);
                        setDialog("edit");
                      }}
                    >
                      <SlidersVertical />
                    </IconAction>
                    <IconAction
                      label="Delete"
                      destructive
                      onClick={() => {
                        setSelected(campaign);
                        setDialog("delete");
                      }}
                    >
                      <Trash2 />
                    </IconAction>
                  </>
                }
              />
            ))}
          </ul>
        ) : (
          <CampaignEmptyState
            icon={MessageSquareText}
            title="No live chat campaigns are available"
            subtitle="Connect with your customers using proactive messages.  Click 'Create campaign' to get started."
            onCreate={() => setDialog("create")}
          />
        )}
      </CampaignLayout>
      <LiveChatCampaignDialog open={dialog === "create"} onOpenChange={(o) => setDialog(o ? "create" : null)} />
      <LiveChatCampaignDialog
        open={dialog === "edit"}
        campaign={selected}
        onOpenChange={(o) => setDialog(o ? "edit" : null)}
      />
      <ConfirmDeleteCampaignDialog
        open={dialog === "delete"}
        title={selected?.title}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
      />
    </>
  );
}

function OneOffCampaignsPage({
  kind,
  empty,
}: {
  kind: "sms" | "whatsapp";
  empty: boolean;
}) {
  const [dialog, setDialog] = React.useState<"create" | "delete" | null>(null);
  const [selected, setSelected] = React.useState<OneOffCampaign | undefined>();
  const isWhatsApp = kind === "whatsapp";
  const rows = empty ? [] : isWhatsApp ? whatsappCampaigns : smsCampaigns;
  const InboxIcon = isWhatsApp ? MessageSquareText : Smartphone;
  return (
    <>
      <CampaignLayout
        title={isWhatsApp ? "WhatsApp campaigns" : "SMS campaigns"}
        count={rows.length}
        onCreate={() => setDialog("create")}
      >
        {rows.length ? (
          <ul>
            {rows.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                title={campaign.title}
                message={campaign.message}
                status={<StatusPill {...oneOffStatus[campaign.status]} />}
                details={<OneOffDetails campaign={campaign} icon={InboxIcon} />}
                actions={
                  <>
                    {isWhatsApp && campaign.status !== "scheduled" ? (
                      <IconAction label="View analytics" href={`/dashboard/campaigns/whatsapp/${campaign.id}/analytics`}>
                        <ChartNoAxesColumn />
                      </IconAction>
                    ) : null}
                    <IconAction
                      label="Delete"
                      destructive
                      onClick={() => {
                        setSelected(campaign);
                        setDialog("delete");
                      }}
                    >
                      <Trash2 />
                    </IconAction>
                  </>
                }
              />
            ))}
          </ul>
        ) : (
          <CampaignEmptyState
            icon={Megaphone}
            title={isWhatsApp ? "No WhatsApp campaigns are available" : "No SMS campaigns are available"}
            subtitle={`Launch ${isWhatsApp ? "a WhatsApp" : "an SMS"} campaign to reach your customers directly. Send offers or make announcements with ease. Click 'Create campaign' to get started.`}
            onCreate={() => setDialog("create")}
          />
        )}
      </CampaignLayout>
      {isWhatsApp ? (
        <WhatsAppCampaignDialog open={dialog === "create"} onOpenChange={(o) => setDialog(o ? "create" : null)} />
      ) : (
        <SMSCampaignDialog open={dialog === "create"} onOpenChange={(o) => setDialog(o ? "create" : null)} />
      )}
      <ConfirmDeleteCampaignDialog
        open={dialog === "delete"}
        title={selected?.title}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
      />
    </>
  );
}

export function SMSCampaignsPage({ empty = false }: { empty?: boolean }) {
  return <OneOffCampaignsPage kind="sms" empty={empty} />;
}

export function WhatsAppCampaignsPage({ empty = false }: { empty?: boolean }) {
  return <OneOffCampaignsPage kind="whatsapp" empty={empty} />;
}
