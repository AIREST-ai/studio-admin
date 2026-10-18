"use client";

// F161: Studio's profile panel from /chat (chat-profile-details.tsx before F159), restored as the "Profile" tab of
// the contact panel: name and role, the quick icons, and Details / Files / Activity. "View profile" in the
// conversation header opens it.
import { useState } from "react";

import Link from "next/link";

import {
  Building2,
  Calendar,
  CheckCircle2,
  Globe,
  Link as LinkIcon,
  Mail,
  MapPin,
  Monitor,
  MoreHorizontal,
  Phone,
  PhoneCall,
  Tag,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";

import { TagChips } from "@/app/(main)/chat/_components/chat-tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { buildThread, type Conversation, contactIdOf } from "./cw-data";
import { openDialog } from "./cw-dialog-store";
import { useContactOf, useCwStore } from "./cw-store";
import { PersonAvatar } from "./cw-ui";

// Which tab of the contact panel is showing; "View profile" in the header switches it to Profile.
export const usePanelTab = create<{ tab: "contact" | "profile" | "copilot" }>(() => ({ tab: "contact" }));

export function openProfileTab() {
  usePanelTab.setState({ tab: "profile" });
}

function Row({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  const value = typeof children === "string" ? children : null;
  const display = value && value.trim() ? value : "—";
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-muted-foreground text-sm">{label}</span>
      <span className="ms-auto min-w-0 truncate text-end text-sm">{display}</span>
    </div>
  );
}

export function StudioProfile({ conversation, files }: { conversation: Conversation; files: React.ReactNode }) {
  const contact = useContactOf(conversation);
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const [tab, setTab] = useState("details");
  const profileId = contactIdOf(conversation.id);
  const activity = buildThread(conversation, meta).filter((message) => message.kind === "activity");

  const copy = (text: string, done: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(done);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <PersonAvatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium leading-5">{contact.name}</div>
          <div className="truncate text-muted-foreground text-xs">{contact.role}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="icon-sm" variant="ghost" aria-label="Email" asChild>
          <a href={`mailto:${contact.email}`}>
            <Mail className="size-3.5" />
          </a>
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Call" asChild>
          <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>
            <PhoneCall className="size-3.5" />
          </a>
        </Button>
        {/* Studio design button: Studio had no scheduler behind it; it stays without an action. */}
        <Button size="icon-sm" variant="ghost" aria-label="Schedule">
          <Calendar className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Copy link"
          onClick={() =>
            copy(
              `${window.location.origin}/dashboard/chat?conversation=${conversation.id}`,
              "Conversation link copied to clipboard",
            )
          }
        >
          <LinkIcon className="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => copy(contact.email, "Copied to clipboard successfully")}>
              Copy email
            </DropdownMenuItem>
            {profileId !== null && (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/contacts/${profileId}`}>Open in Contacts</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => openDialog({ type: "edit-contact", convId: conversation.id })}>
              Edit contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="w-full justify-between border-b px-0 **:data-[slot=tabs-trigger]:flex-1">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex flex-col gap-4 pt-3">
          <div className="flex flex-col gap-3">
            <Row icon={Mail} label="Email">
              {contact.email}
            </Row>
            <Row icon={Phone} label="Phone">
              {contact.phone}
            </Row>
            <Row icon={Globe} label="Website">
              {contact.website}
            </Row>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            <Row icon={Building2} label="Company">
              {contact.company}
            </Row>
            <Row icon={UserRound} label="Role">
              {contact.role}
            </Row>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground text-sm">Stage</span>
              <Badge variant="secondary" className="ms-auto">
                {contact.status?.trim() || "—"}
              </Badge>
            </div>
            <Row icon={Calendar} label="Qualified since">
              {contact.qualifiedAt}
            </Row>
            <Row icon={Monitor} label="Timezone">
              {contact.timezone}
            </Row>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            <Row icon={MapPin} label="Location">
              {contact.location}
            </Row>
            <div className="flex items-start gap-2">
              <Tag className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground text-sm">Tags</span>
              <TagChips convId={String(conversation.id)} className="ms-auto justify-end" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="files" className="pt-3">
          {files}
        </TabsContent>

        <TabsContent value="activity" className="pt-3">
          {activity.length === 0 ? (
            <p className="text-muted-foreground text-xs">No activity yet</p>
          ) : (
            <ol className="flex flex-col gap-2 border-s ps-3">
              {activity.map((item) => (
                <li key={item.id} className="text-xs">
                  <div>{item.text}</div>
                  <div className="text-muted-foreground">{item.time}</div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
