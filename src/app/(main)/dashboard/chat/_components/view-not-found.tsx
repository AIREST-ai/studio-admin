import Link from "next/link";

import { FolderX, Inbox, type LucideIcon, Tag, UsersRound } from "lucide-react";

import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// F159: an unknown folder, team, inbox or label id (/dashboard/chat/folders/nope) says so inside the dashboard with the
// way back to All Conversations. It is rendered by the page itself (status 200) instead of Next's notFound():
// the 404 shell is client-rendered in dev, so the theme boot script never runs (light page, "1 Issue" badge).
const copy: Record<
  "folder" | "team" | "inbox" | "label",
  { icon: LucideIcon; title: string; subtitle: string; empty: string; hint: string }
> = {
  folder: {
    icon: FolderX,
    title: "Folder not found",
    subtitle: "This folder does not exist or has been deleted.",
    empty: "There is no folder at this address",
    hint: "Saved folders are listed under Folders in the sidebar. Open one from there, or go back to all conversations.",
  },
  team: {
    icon: UsersRound,
    title: "Team not found",
    subtitle: "This team does not exist or has been deleted.",
    empty: "There is no team at this address",
    hint: "Your teams are listed under Teams in the sidebar. Open one from there, or go back to all conversations.",
  },
  inbox: {
    icon: Inbox,
    title: "Inbox not found",
    subtitle: "This inbox does not exist or has been deleted.",
    empty: "There is no inbox at this address",
    hint: "Your inboxes are listed under Channels in the sidebar. Open one from there, or go back to all conversations.",
  },
  // Labels live in client state (new ones can be added), so the workspace renders this one on the client.
  label: {
    icon: Tag,
    title: "Label not found",
    subtitle: "This label does not exist or has been deleted.",
    empty: "There is no label at this address",
    hint: "Your labels are listed under Labels in the sidebar. Open one from there, or go back to all conversations.",
  },
};

export function ViewNotFound({ kind }: { kind: keyof typeof copy }) {
  const { icon: Icon, title, subtitle, empty, hint } = copy[kind];
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title={title} subtitle={subtitle} />
      <Card className="py-12">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon />
            </EmptyMedia>
            <EmptyTitle>{empty}</EmptyTitle>
            <EmptyDescription>{hint}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/dashboard/chat" prefetch={false}>
                Back to conversations
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </div>
  );
}
