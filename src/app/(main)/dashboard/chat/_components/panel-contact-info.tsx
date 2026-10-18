"use client";

// Chatwoot v4.18 routes/dashboard/conversation/contact/ContactInfo.vue + ContactInfoRow.vue: avatar, name with
// click-to-edit, created-at info and profile link, the contact rows (email, phone, company editable in place; copy
// on email and phone), then the actions New message, View all conversations, Call, Edit, Merge and Delete.
import { type ReactNode, useRef, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  GitMerge,
  History,
  Info,
  Mail,
  MapPin,
  MessageSquarePlus,
  PenLine,
  Phone,
  PhoneCall,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { linkedSession, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
import { canDeleteContacts, useViewer } from "@/lib/cw/view-as";

import { CustomerPath } from "./customer-path";
import { type Conversation, contactIdOf, isPersonOnline } from "./cw-data";
import { openDialog } from "./cw-dialogs";
import { contactKeyOf, cw, useContactOf } from "./cw-store";
import { PersonAvatar } from "./cw-ui";
import { copyToClipboard, previewOnly } from "./panel-attributes";
import { useSimProfileId } from "./sim-actions";
import { getCallChannelInfo, startSimCall } from "./sim-call";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9][\d\s-]{6,17}$/;

// Long emails wrap after "@" instead of being cut with "...", so the whole address stays readable in the panel.
function wrapAtSeparators(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const part of value.split(/(?<=[@/])/)) {
    if (offset > 0) nodes.push(<wbr key={offset} />);
    nodes.push(part);
    offset += part.length;
  }
  return nodes;
}

function IconAction({
  label,
  onClick,
  children,
  className,
  href,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button size="icon-sm" variant="outline" aria-label={label} className={className} asChild>
            <Link href={href}>{children}</Link>
          </Button>
        ) : (
          <Button size="icon-sm" variant="outline" aria-label={label} className={className} onClick={onClick}>
            {children}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function InfoRow({
  icon: Icon,
  title,
  value,
  href,
  copyable,
  onSave,
  validate,
}: {
  icon: typeof Mail;
  title: string;
  value?: string;
  href?: string;
  copyable?: boolean;
  onSave?: (value: string) => void;
  validate?: (value: string) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (editing && onSave) {
    const save = () => {
      const next = draft.trim();
      const problem = next && validate ? validate(next) : null;
      if (problem) {
        setError(problem);
        return;
      }
      if (next !== (value ?? "")) onSave(next);
      setEditing(false);
    };
    return (
      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="flex items-center gap-1.5">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            aria-label={title}
            aria-invalid={Boolean(error)}
            placeholder={title}
            className="h-7 text-sm"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setEditing(false);
              }
            }}
          />
          <Button type="submit" size="icon-xs" aria-label="Save">
            <Check />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Cancel" onClick={() => setEditing(false)}>
            <X />
          </Button>
        </div>
        {error && <span className="ps-5 text-destructive text-xs">{error}</span>}
      </form>
    );
  }

  const text = value ? wrapAtSeparators(value) : "Not Available";
  return (
    <div className="group/row flex min-h-6 items-start gap-2 text-sm" title={title}>
      <Icon className="mt-[3px] size-3.5 shrink-0 text-muted-foreground" />
      {value && href ? (
        <a href={href} className="min-w-0 break-words underline-offset-2 hover:underline">
          {text}
        </a>
      ) : (
        <span className={cn("min-w-0 break-words", !value && "text-muted-foreground")}>{text}</span>
      )}
      <span className="ms-auto flex shrink-0">
        {copyable && value && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Copy ${title.toLowerCase()}`}
            className="opacity-0 group-hover/row:opacity-100"
            onClick={() => copyToClipboard(value)}
          >
            <Copy />
          </Button>
        )}
        {onSave && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit ${title.toLowerCase()}`}
            className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              setDraft(value ?? "");
              setError(null);
              setEditing(true);
            }}
          >
            <PenLine />
          </Button>
        )}
      </span>
    </div>
  );
}

function NameField({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const cancelled = useRef(false);
  if (editing) {
    const save = () => {
      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      const next = draft.trim();
      if (next && next !== name) onSave(next);
      setEditing(false);
    };
    return (
      <Input
        autoFocus
        aria-label="Full Name"
        className="h-7 font-medium"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          // Enter leaves the field and the blur saves once; Escape puts the old name back first.
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            event.stopPropagation();
            cancelled.current = true;
            setDraft(name);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <div className="group/name flex min-w-0 items-center gap-1">
      <button
        type="button"
        title="Click to edit"
        className="min-w-0 truncate text-left font-medium leading-5 hover:text-foreground/80"
        onClick={() => {
          cancelled.current = false;
          setDraft(name);
          setEditing(true);
        }}
      >
        {name}
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Click to edit"
        className="shrink-0 opacity-0 group-hover/name:opacity-100 focus-visible:opacity-100"
        onClick={() => {
          cancelled.current = false;
          setDraft(name);
          setEditing(true);
        }}
      >
        <PenLine />
      </Button>
    </div>
  );
}

export function ContactInfo({ conversation }: { conversation: Conversation }) {
  const viewer = useViewer();
  const contact = useContactOf(conversation);
  const key = contactKeyOf(conversation);
  // M129-A: after a (simulated) merge the conversation belongs to the kept contact, so its profile opens.
  const mergedInto = useSimProfileId(conversation.id);
  const profileId = mergedInto ?? contactIdOf(conversation.id);
  const profileHref = profileId ? `/dashboard/contacts/${profileId}` : "/dashboard/contacts";
  const linkedActive = useLinkedAdapterStatus((s) => s.active);
  const isLinked = linkedActive || linkedSession();
  const callInfo = getCallChannelInfo(conversation, isLinked);
  const save = (patch: Parameters<typeof cw.editContact>[1]) => {
    cw.editContact(key, patch);
    previewOnly("Contact changed");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <PersonAvatar name={contact.name} size="lg" online={isPersonOnline(conversation.id)} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <NameField name={contact.name} onSave={(name) => save({ name })} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 shrink-0 text-muted-foreground" aria-label="Created" />
              </TooltipTrigger>
              <TooltipContent>Created {contact.qualifiedAt}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={profileHref}
                  aria-label="View Profile"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>View Profile</TooltipContent>
            </Tooltip>
          </div>
          {(contact.role || contact.company) && (
            <p className="line-clamp-2 break-words text-muted-foreground text-xs leading-4">
              {[contact.role, contact.company].filter(Boolean).join(" at ")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <InfoRow
          icon={Mail}
          title="Email Address"
          value={contact.email}
          href={contact.email ? `mailto:${contact.email}` : undefined}
          copyable
          onSave={(email) => save({ email })}
          validate={(email) => (EMAIL_RE.test(email) ? null : "Please enter a valid email address.")}
        />
        {/* T-285 (Fahad 124.4): Customer Path right above the phone number, framed as the product's own feature. */}
        <CustomerPath conversation={conversation} />
        <InfoRow
          icon={Phone}
          title="Phone number"
          value={contact.phone}
          href={contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : undefined}
          copyable
          onSave={(phone) => save({ phone })}
          validate={(phone) => (PHONE_RE.test(phone) ? null : "Phone number should be either empty or of E.164 format")}
        />
        <InfoRow icon={Building2} title="Company" value={contact.company} onSave={(company) => save({ company })} />
        {contact.location && <InfoRow icon={MapPin} title="Location" value={contact.location} />}
        {/* Chatwoot SocialIcons.vue draws only the profiles a contact has; no contact here has any, so no row. */}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <IconAction
          label="New message"
          onClick={() => openDialog({ type: "new-conversation", contact: contact.name, inbox: conversation.channel })}
        >
          <MessageSquarePlus />
        </IconAction>
        <IconAction label="View all conversations" href={profileHref}>
          <History />
        </IconAction>
        {callInfo.canCall && (
          <IconAction label={callInfo.tooltip} onClick={() => startSimCall(conversation.id)}>
            <PhoneCall />
          </IconAction>
        )}
        {callInfo.isInstagram && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex" title={callInfo.tooltip}>
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled
                  data-call-button="instagram-disabled"
                  aria-label={callInfo.label}
                  className="opacity-50"
                >
                  <PhoneCall />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{callInfo.tooltip}</TooltipContent>
          </Tooltip>
        )}
        <IconAction label="Edit contact" onClick={() => openDialog({ type: "edit-contact", convId: conversation.id })}>
          <PenLine />
        </IconAction>
        <IconAction
          label="Merge contact"
          onClick={() => openDialog({ type: "merge-contact", convId: conversation.id })}
        >
          <GitMerge />
        </IconAction>
        {/* F-5A "View as": administrators only (Chatwoot conversation/contact/ContactInfo.vue v-if="isAdmin"). */}
        {canDeleteContacts(viewer) && (
          <IconAction
            label="Delete contact"
            className="text-destructive hover:text-destructive"
            onClick={() => openDialog({ type: "delete-contact", convId: conversation.id })}
          >
            <Trash2 />
          </IconAction>
        )}
      </div>
    </div>
  );
}
