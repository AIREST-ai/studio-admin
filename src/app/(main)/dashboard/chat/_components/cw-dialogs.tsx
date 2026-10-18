"use client";

// Every Chatwoot dialog of the conversations area, opened from anywhere through openDialog().
import { type ReactNode, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { ArrowDown, Check, Paperclip, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { toggleTag, useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { DeleteContactDialog } from "@/app/(main)/dashboard/contacts/_components/contact-dialogs";
import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import { CountrySelect } from "@/app/(main)/dashboard/contacts/_components/country-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useCustomerPath } from "@/lib/cw/customer-path";
import { useVisibleMacros } from "@/lib/cw/macro-visibility";
import { SIMULATED, usePreviewSimSettled } from "@/lib/cw/preview-sim";
import { SimBadge } from "@/lib/cw/preview-sim-ui";
import { useSectionShown } from "@/lib/owner/site-sections-context";

import { CommandBarDialog } from "./cw-command-bar";
import {
  agentName,
  baseConversations,
  contactIdOf,
  conversationAttributeDefs,
  type FilterAttribute,
  type FilterOperator,
  type FilterRow,
  filterAttributes,
  filterOperators,
  helpArticles,
  priorities,
  requiredOnResolve,
  statusFilterItems,
  teamName,
  useLiveAgents,
  useLiveInboxes,
  useLiveTeams,
  useLiveWhatsappTemplates,
} from "./cw-data";
import { closeDialog, macroTeam, openDialog, runMacro, useDialogStore } from "./cw-dialog-store";
import { contactKeyOf, cw, useContactOf, useCwStore } from "./cw-store";
import { type AttributeDef, previewOnly } from "./panel-attributes";
import {
  simCreateConversation,
  simDeleteContact,
  simMergeContacts,
  simSendTranscript,
  useMergedAwayKeys,
} from "./sim-actions";
import { changeStatus, deleteMessage } from "./sim-thread-persist";

export { closeDialog, type DialogState, openDialog, runMacro, useDialogStore } from "./cw-dialog-store";

export function CwDialogs() {
  const dialog = useDialogStore((s) => s.dialog);
  const [chat] = useChat();
  const selected = chat.selected;
  // Chatwoot opens its command bar with ⌘ K / Ctrl K anywhere in the dashboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyK" || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      openDialog({ type: "command", convId: selected ?? undefined });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
  if (!dialog) return null;
  const onOpenChange = (open: boolean) => {
    if (!open) closeDialog();
  };

  switch (dialog.type) {
    case "delete-conversation":
      return <DeleteConversationDialog ids={dialog.ids} onOpenChange={onOpenChange} />;
    case "transcript":
      return <TranscriptDialog id={dialog.id} onOpenChange={onOpenChange} />;
    case "snooze":
      return <CustomSnoozeDialog ids={dialog.ids} onOpenChange={onOpenChange} />;
    case "bulk-agent":
      return <BulkAgentConfirm ids={dialog.ids} agentId={dialog.agentId} onOpenChange={onOpenChange} />;
    case "bulk-team":
      return <BulkTeamConfirm ids={dialog.ids} teamId={dialog.teamId} onOpenChange={onOpenChange} />;
    case "new-conversation":
      return (
        <NewConversationDialog
          contact={dialog.contact}
          inbox={dialog.inbox}
          contactId={dialog.contactId}
          onOpenChange={onOpenChange}
        />
      );
    case "translate":
      return <TranslateDialog text={dialog.text} onOpenChange={onOpenChange} />;
    case "add-canned":
      return <AddCannedDialog text={dialog.text} onOpenChange={onOpenChange} />;
    case "macro-preview":
      return <MacroPreviewDialog macroId={dialog.macroId} convId={dialog.convId} onOpenChange={onOpenChange} />;
    case "delete-message":
      return <DeleteMessageDialog convId={dialog.convId} messageId={dialog.messageId} onOpenChange={onOpenChange} />;
    case "edit-contact":
      return <EditContactDialog convId={dialog.convId} onOpenChange={onOpenChange} />;
    case "merge-contact":
      return <MergeContactDialog convId={dialog.convId} onOpenChange={onOpenChange} />;
    case "delete-contact":
      // M129-A (Fahad 129.2): the contact and its conversations really leave the preview's data (sim-actions.ts);
      // the toast says it is simulated and that nothing was deleted in Chatwoot.
      return <DeleteContactDialog open onOpenChange={onOpenChange} onConfirm={() => simDeleteContact(dialog.convId)} />;
    case "filter":
      return <FilterDialog folderId={dialog.folderId} onOpenChange={onOpenChange} />;
    case "save-folder":
      return <SaveFolderDialog onOpenChange={onOpenChange} />;
    case "delete-folder":
      return <DeleteFolderDialog folderId={dialog.folderId} onOpenChange={onOpenChange} />;
    case "whatsapp-templates":
      return <WhatsappTemplatesDialog onInsert={dialog.onInsert} onOpenChange={onOpenChange} />;
    case "articles":
      return <ArticleSearchDialog onInsert={dialog.onInsert} onOpenChange={onOpenChange} />;
    case "shortcuts":
      return <ShortcutsDialog onOpenChange={onOpenChange} />;
    case "command":
      return <CommandBarDialog convId={dialog.convId} initialPage={dialog.page} onOpenChange={onOpenChange} />;
    case "contact-note":
      return <ContactNoteDialog convId={dialog.convId} onOpenChange={onOpenChange} />;
    case "resolve-attributes":
      return <ResolveAttributesDialog convId={dialog.convId} missing={dialog.missing} onOpenChange={onOpenChange} />;
    default:
      return null;
  }
}

type Open = { onOpenChange: (open: boolean) => void };

// Chatwoot's keyboard shortcuts modal (components/widgets/modal/constants.js SHORTCUT_KEYS), opened with ⌘ /.
const shortcutKeys: { label: string; keys: string[] }[] = [
  { label: "Open conversation", keys: ["Alt / ⌥", "J", "/", "Alt / ⌥", "K"] },
  { label: "Resolve and move to next", keys: ["Win / ⌘", "Alt / ⌥", "E"] },
  { label: "Navigate dropdown items", keys: ["Up", "Down"] },
  { label: "Resolve Conversation", keys: ["Alt / ⌥", "E"] },
  { label: "Go to Conversation Dashboard", keys: ["Alt / ⌥", "C"] },
  { label: "Add Attachment", keys: ["Win / ⌘", "Alt / ⌥", "A"] },
  { label: "Go to Contacts Dashboard", keys: ["Alt / ⌥", "V"] },
  { label: "Toggle Sidebar", keys: ["Alt / ⌥", "O"] },
  { label: "Go to Reports sidebar", keys: ["Alt / ⌥", "R"] },
  { label: "Move to next tab in conversation list", keys: ["Alt / ⌥", "N"] },
  { label: "Go to Settings", keys: ["Alt / ⌥", "S"] },
  { label: "Switch to Private Note", keys: ["Alt / ⌥", "P"] },
  { label: "Switch to Reply", keys: ["Alt / ⌥", "L"] },
  { label: "Toggle snooze dropdown", keys: ["Alt / ⌥", "M"] },
];

function ShortcutsDialog({ onOpenChange }: Open) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            <Kbd>⌘</Kbd> <Kbd>/</Kbd> View all shortcuts
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {shortcutKeys.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
              <span className="min-w-0">{item.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {item.keys.map((key, index) =>
                  key === "/" ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed key list
                    <span key={index} className="text-muted-foreground text-xs">
                      /
                    </span>
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed key list
                    <Kbd key={index}>{key}</Kbd>
                  ),
                )}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConversationDialog({ ids, onOpenChange }: Open & { ids: number[] }) {
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete conversation #{ids.join(", #")}</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete this conversation?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              cw.deleteConversation(ids);
              toast.success("Conversation deleted successfully");
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Chatwoot widgets/conversation/EmailTranscriptModal.vue: customer / assigned agent / another email (validated).
function TranscriptDialog({ id, onOpenChange }: Open & { id: number }) {
  const conversation = baseConversations.find((c) => c.id === id);
  const assigneeId = useCwStore((s) => s.meta[id]?.assigneeId);
  const assignee = useLiveAgents().find((a) => a.id === assigneeId);
  const customerEmail = conversation?.contact.email;
  const [target, setTarget] = useState(customerEmail ? "contact" : assignee ? "agent" : "other");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const emailError =
    target === "other" && !EMAIL_PATTERN.test(email.trim()) ? "Please enter a valid email address" : null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send conversation transcript</DialogTitle>
          <DialogDescription>
            Send a copy of the conversation transcript to the specified email address
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (emailError) return;
            // F-2 (Fahad 99 and 129.2): nothing is emailed from the preview. The request is recorded in the thread and
            // kept by the preview; the toast comes only once the preview server has kept it.
            const address = target === "contact" ? customerEmail : target === "agent" ? assignee?.email : email.trim();
            if (!address) return;
            const { saved } = simSendTranscript({
              convId: id,
              target: target as "contact" | "agent" | "other",
              email: address,
            });
            void saved.then((kept) => {
              if (kept)
                toast.success("Transcript recorded in the preview", {
                  description: `${SIMULATED}: nothing was emailed to ${address}. The request stays in this conversation after a reload.`,
                });
            });
            onOpenChange(false);
          }}
        >
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 border-dashed bg-amber-500/5 p-2 text-muted-foreground text-xs">
            <SimBadge />
            <span data-slot="transcript-sim-note">
              No email is sent from the preview. The request is recorded in this conversation only.
            </span>
          </div>
          <RadioGroup value={target} onValueChange={setTarget} className="gap-3">
            <Label className="flex items-start gap-2 font-normal">
              <RadioGroupItem value="contact" disabled={!customerEmail} className="mt-0.5" />
              <span className="grid gap-0.5">
                Send the transcript to the customer
                {customerEmail && <span className="text-muted-foreground text-xs">{customerEmail}</span>}
              </span>
            </Label>
            <Label className="flex items-start gap-2 font-normal">
              <RadioGroupItem value="agent" disabled={!assignee} className="mt-0.5" />
              <span className="grid gap-0.5">
                Send the transcript to the assigned agent
                {assignee && <span className="text-muted-foreground text-xs">{assignee.email}</span>}
              </span>
            </Label>
            <Label className="flex items-start gap-2 font-normal">
              <RadioGroupItem value="other" className="mt-0.5" />
              Send the transcript to another email address
            </Label>
          </RadioGroup>
          {target === "other" && (
            <div className="grid gap-1.5">
              <Input
                autoFocus
                type="email"
                aria-label="Email address"
                placeholder="Enter an email address"
                aria-invalid={touched && !!emailError}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setTouched(true)}
              />
              {touched && <FieldError message={emailError} />}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={target === "other" && touched && !!emailError}>
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Chatwoot components/CustomSnoozeModal.vue: pick a future date and time, then Snooze.
function CustomSnoozeDialog({ ids, onOpenChange }: Open & { ids: number[] }) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const when = date
    ? new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        ...(time.split(":").map(Number) as [number, number]),
      )
    : undefined;
  const inPast = when ? when.getTime() <= Date.now() : false;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Snooze until</DialogTitle>
          <DialogDescription>
            Pick a date and time. The conversation reopens then, or on the next reply.
          </DialogDescription>
        </DialogHeader>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={{ before: today }}
          className="mx-auto rounded-md border"
        />
        <div className="grid gap-1.5">
          <Label htmlFor="snooze-time">Time</Label>
          <Input id="snooze-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          {inPast && <FieldError message="Please pick a time in the future" />}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!when || inPast}
            onClick={() => {
              if (!when) return;
              // F-5A: kept in the preview with this time; the toast comes once it is saved.
              void changeStatus(ids, "snoozed", { snooze: when });
              onOpenChange(false);
            }}
          >
            Snooze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAgentConfirm({ ids, agentId, onOpenChange }: Open & { ids: number[]; agentId: number | null }) {
  const n = ids.length;
  const word = n === 1 ? "conversation" : "conversations";
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Assign agent</AlertDialogTitle>
          <AlertDialogDescription>
            {agentId
              ? `Are you sure you want to assign ${n} ${word} to ${agentName(agentId)}?`
              : `Are you sure you want to unassign ${n} ${word}?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              cw.assignAgent(ids, agentId);
              cw.setSelection([]);
              toast.success("Conversations assigned successfully.");
            }}
          >
            Yes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BulkTeamConfirm({ ids, teamId, onOpenChange }: Open & { ids: number[]; teamId: string | null }) {
  const n = ids.length;
  const word = n === 1 ? "conversation" : "conversations";
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Assign team</AlertDialogTitle>
          <AlertDialogDescription>
            {teamId
              ? `Are you sure you want to assign ${n} ${word} to ${teamName(teamId)}?`
              : `Are you sure you want to unassign ${n} ${word}?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              cw.assignTeam(ids, teamId);
              cw.setSelection([]);
              toast.success("Teams assigned successfully.");
            }}
          >
            Yes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Chatwoot components-next/NewConversation (ComposeNewConversationForm.vue): To (contact search), Via (inbox), email
// options (Subject, Cc, Bcc) for the email inbox, WhatsApp template picker for the WhatsApp inbox, the message editor,
// attachments, then Discard / Send (⌘ + ↵).
// F-1 (Fahad 99 and 129.2): Chatwoot sends the message to the customer here. This preview has no channel behind it, so
// Send makes the conversation and its message in the preview's own inbox (sim-actions.ts simCreateConversation), the
// preview keeps them across reloads, and the dialog, the toast and the thread all say "Preview — simulated" and that
// no real customer is contacted. It used to toast a success that claimed the message was on its way and keep nothing.
function NewConversationDialog({
  contact,
  inbox: initialInbox,
  contactId,
  onOpenChange,
}: Open & { contact?: string; inbox?: string; contactId?: number }) {
  // F-3: opened from a Contacts page ("Send message"): that person, who may have no conversation yet.
  const person = useContactsStore((s) =>
    contactId === undefined ? undefined : s.list.find((c) => c.id === contactId),
  );
  const [, setChat] = useChat();
  const inboxes = useLiveInboxes();
  // F-3: the approved templates of Settings > Templates as they are now (not the starting sample).
  const whatsappTemplates = useLiveWhatsappTemplates();
  const [to, setTo] = useState(contact ?? "");
  const [query, setQuery] = useState("");
  const [inbox, setInbox] = useState(
    initialInbox && inboxes.some((i) => i.id === initialInbox) ? initialInbox : "email",
  );
  const [subject, setSubject] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [message, setMessage] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const contacts = [...new Map(baseConversations.map((c) => [contactKeyOf(c), c.contact])).values()];
  const matches =
    query.trim().length >= 2
      ? contacts.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(query.trim().toLowerCase()))
      : [];
  const isEmail = inbox === "email";
  const isWhatsapp = inbox === "whatsapp";
  const badEmails = (value: string) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .some((part) => !EMAIL_PATTERN.test(part));
  const errors = {
    to: to ? null : "Select a contact",
    message: isWhatsapp ? (template ? null : "Select template") : message.trim() ? null : "Write your message here...",
    cc: isEmail && badEmails(cc) ? "Please enter a valid email address" : null,
    bcc: isEmail && showBcc && badEmails(bcc) ? "Please enter a valid email address" : null,
  };
  const valid = !errors.to && !errors.message && !errors.cc && !errors.bcc;
  // The numbers of the conversations the preview kept are known once its record is read, so a new one waits for that.
  const recordRead = usePreviewSimSettled();
  const send = () => {
    setSubmitted(true);
    if (!valid || !recordRead) return;
    // F-3: to the person of the Contacts page it was opened from (their own details, even with no conversation yet),
    // else to the person of a conversation, as before.
    const own = person && to === person.name ? person : undefined;
    const from = own ? undefined : baseConversations.find((c) => c.contact.name === to);
    if (!from && !own) return;
    const body = isWhatsapp ? (whatsappTemplates.find((t) => t.name === template)?.body ?? "") : message;
    const location = own ? [own.city, own.country].filter(Boolean).join(", ") : "";
    const { id, saved } = simCreateConversation({
      from,
      person: own
        ? {
            contactId: own.id,
            contact: { name: own.name, email: own.email, phone: own.phone, company: own.company, location },
          }
        : undefined,
      channel: inbox,
      subject: isEmail ? subject : "",
      text: body,
      files: isWhatsapp ? [] : files,
    });
    // Chatwoot opens the new conversation; it is assigned to you and open, so Mine / Open list it.
    const open = () => {
      const { statusFilter } = useCwStore.getState();
      if (statusFilter !== "all" && statusFilter !== "open") cw.setStatusFilter("open");
      cw.setAssigneeTab("me");
      cw.focus(id);
      setChat({ selected: id });
    };
    open();
    // Said only once the preview has really kept it (when it could not, recordSim has shown its own error).
    void saved.then((kept) => {
      if (kept)
        toast.success("Conversation created in the preview", {
          description: `${SIMULATED}: it stays here after a reload. No real customer was contacted.`,
          action: { label: "View", onClick: open },
        });
    });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>Start a new conversation by sending a new message.</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 border-dashed bg-amber-500/5 p-2 text-muted-foreground text-xs">
          <SimBadge />
          <span data-slot="new-conversation-sim-note">
            No real customer is contacted. The conversation and its message are made in this preview only.
          </span>
        </div>
        <div className="grid gap-3">
          <div className="grid grid-cols-[4.5rem_1fr] items-start gap-x-2 gap-y-3">
            <Label className="pt-2 text-muted-foreground">To:</Label>
            <div className="grid gap-1">
              {to ? (
                <div className="flex h-8 items-center justify-between rounded-md border bg-muted/40 px-2 text-sm">
                  <span className="truncate">{to}</span>
                  <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => setTo("")}>
                    <X />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    aria-label="To"
                    placeholder="Enter at least 2 characters to search by name, email, or phone number"
                    value={query}
                    aria-invalid={submitted && !!errors.to}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {matches.length > 0 && (
                    <div className="absolute inset-x-0 top-9 z-10 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                      {matches.map((c) => (
                        <button
                          key={`${c.name}|${c.email}|${c.phone}`}
                          type="button"
                          className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setTo(c.name);
                            setQuery("");
                          }}
                        >
                          <span>{c.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {[c.email, c.phone].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {submitted && <FieldError message={errors.to} />}
            </div>
            <Label className="pt-2 text-muted-foreground">Via:</Label>
            <NativeSelect className="w-full" value={inbox} onChange={(event) => setInbox(event.target.value)}>
              {inboxes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.address})
                </option>
              ))}
            </NativeSelect>
            {isEmail && (
              <>
                <Label className="pt-2 text-muted-foreground">Subject :</Label>
                <Input
                  aria-label="Subject"
                  placeholder="Enter your email subject here"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
                <Label className="pt-2 text-muted-foreground">Cc:</Label>
                <div className="grid gap-1">
                  <div className="flex gap-2">
                    <Input
                      aria-label="Cc"
                      placeholder="Enter at least 2 characters to search by email"
                      value={cc}
                      aria-invalid={submitted && !!errors.cc}
                      onChange={(event) => setCc(event.target.value)}
                    />
                    {!showBcc && (
                      <Button variant="ghost" size="sm" onClick={() => setShowBcc(true)}>
                        Bcc
                      </Button>
                    )}
                  </div>
                  {submitted && <FieldError message={errors.cc} />}
                </div>
                {showBcc && (
                  <>
                    <Label className="pt-2 text-muted-foreground">Bcc:</Label>
                    <div className="grid gap-1">
                      <Input
                        aria-label="Bcc"
                        placeholder="Enter at least 2 characters to search by email"
                        value={bcc}
                        aria-invalid={submitted && !!errors.bcc}
                        onChange={(event) => setBcc(event.target.value)}
                      />
                      {submitted && <FieldError message={errors.bcc} />}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {isWhatsapp ? (
            <div className="grid gap-1.5">
              <Label>Select template</Label>
              <ScrollArea className="max-h-44 rounded-md border">
                <div className="grid gap-1 p-1">
                  {whatsappTemplates.map((t) => (
                    <button
                      key={`${t.name}:${t.language}`}
                      type="button"
                      onClick={() => setTemplate(t.name)}
                      className={`rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted ${template === t.name ? "bg-muted" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{t.name}</span>
                        {template === t.name && <Check className="size-3.5" />}
                      </div>
                      <p className="line-clamp-2 text-muted-foreground text-xs">{t.body}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
              {submitted && <FieldError message={errors.message} />}
            </div>
          ) : (
            <div className="grid gap-1">
              <Textarea
                aria-label="Message"
                className="min-h-32"
                placeholder="Write your message here..."
                value={message}
                aria-invalid={submitted && !!errors.message}
                onChange={(event) => setMessage(event.target.value)}
              />
              {submitted && errors.message && <FieldError message="Message can not be empty" />}
            </div>
          )}
          {!isWhatsapp && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Paperclip /> Choose files
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(event) =>
                      setFiles((prev) => [...prev, ...Array.from(event.target.files ?? []).map((f) => f.name)])
                    }
                  />
                </label>
              </Button>
              {files.length === 0 && (
                <span className="text-muted-foreground text-xs">
                  Drag and drop files here or choose files to attach
                </span>
              )}
              {files.map((name) => (
                <Badge key={name} variant="secondary" className="gap-1">
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => setFiles((prev) => prev.filter((f) => f !== name))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Discard</Button>
          </DialogClose>
          <Button onClick={send} disabled={!recordRead}>
            Send (⌘ + ↵)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TranslateDialog({ text, onOpenChange }: Open & { text: string }) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>View translated content</DialogTitle>
          <DialogDescription>You can view the translated content in each langauge.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <span className="font-medium text-muted-foreground text-xs">Original Content</span>
            <p className="rounded-md border bg-muted/40 p-3">{text}</p>
          </div>
          <div className="grid gap-1">
            <span className="font-medium text-muted-foreground text-xs">Translated Content</span>
            <p className="rounded-md border border-dashed p-3 text-muted-foreground">
              No translations are available for this content
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCannedDialog({ text, onOpenChange }: Open & { text: string }) {
  const [code, setCode] = useState("");
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add canned response</DialogTitle>
          <DialogDescription>
            Canned Responses are predefined reply templates which can be used to quickly send out replies to
            conversations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="canned-short-code">Short code</Label>
            <Input
              id="canned-short-code"
              placeholder="Please enter a short code."
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="canned-content">Message</Label>
            <Textarea
              id="canned-content"
              defaultValue={text}
              placeholder="Please write the message you want to save as a template to use later."
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!code.trim()}
            onClick={() => {
              toast.success("Canned response added successfully.");
              onOpenChange(false);
            }}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MacroPreviewDialog({ macroId, convId, onOpenChange }: Open & { macroId: number; convId: number }) {
  // F-8: the macro as Settings > Macros saved it (the one runMacro runs), not the sample copy.
  // F-24: only one the person the page is viewed as may see (a private macro is its creator's).
  const saved = useVisibleMacros();
  const teams = useLiveTeams(); // a missing team is marked below
  // F-19: no fall-back to the sample copy: a macro deleted in Settings is gone here too.
  const macro = saved.find((m) => m.id === macroId);
  if (!macro) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{macro.name}</DialogTitle>
          <DialogDescription>Preview Macro</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-1.5 text-sm">
          <Badge variant="secondary">Start Flow</Badge>
          {macro.actions.map((action) => (
            <div key={`${action.action}-${action.value}`} className="flex w-full flex-col items-center gap-1.5">
              <ArrowDown className="size-3.5 text-muted-foreground" />
              <div className="w-full rounded-md border px-3 py-2">
                <div className="font-medium">{action.action}</div>
                {action.value && <div className="text-muted-foreground text-xs">{action.value}</div>}
                {/* F-8 (sim3 8.14e): a team that does not exist is named, and the action is skipped when run. */}
                {action.action === "Assign a Team" && macroTeam(action.value, teams).kind === "missing" && (
                  <div className="mt-1 text-destructive text-xs" data-macro-missing-team="">
                    {`Team “${action.value.trim()}” does not exist. This action will be skipped.`}
                  </div>
                )}
              </div>
            </div>
          ))}
          <ArrowDown className="size-3.5 text-muted-foreground" />
          <Badge variant="secondary">End Flow</Badge>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              runMacro(macroId, convId);
              onOpenChange(false);
            }}
          >
            Execute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// F-8 (sim3: "Message deleted successfully" with no request, and the message came back after a reload): the delete is
// kept in the preview (sim-thread-persist.ts deleteMessage) and the message stays in the thread as "This message was
// deleted", as Chatwoot does (messages_controller.rb#destroy). The toast comes only after the preview kept it.
function DeleteMessageDialog({ convId, messageId, onOpenChange }: Open & { convId: number; messageId: string }) {
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this message?</AlertDialogTitle>
          <AlertDialogDescription>You cannot undo this action</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              void deleteMessage(convId, messageId);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

function FieldError({ message }: { message?: string | null }) {
  return message ? <span className="text-destructive text-xs">{message}</span> : null;
}

// Chatwoot routes/dashboard/conversation/contact/EditContact.vue + ContactForm.vue (the dialog the conversation
// sidebar opens): Full Name, Bio, Email Address, Phone Number (E.164), Company Name, Country, City and the social
// profiles. Saving updates the contact everywhere in the panel (cw.editContact).
function EditContactDialog({ convId, onOpenChange }: Open & { convId: number }) {
  const conversation = baseConversations.find((c) => c.id === convId);
  if (!conversation) return null;
  return <EditContactForm conversation={conversation} onOpenChange={onOpenChange} />;
}

function EditContactForm({ conversation, onOpenChange }: Open & { conversation: (typeof baseConversations)[number] }) {
  const contact = useContactOf(conversation);
  const [form, setForm] = useState({
    name: contact.name,
    bio: [contact.role, contact.company].filter(Boolean).join(" at "),
    email: contact.email,
    phone: contact.phone.replace(/\s/g, ""),
    company: contact.company,
    country: contact.location.split(",").at(-1)?.trim() ?? "",
    // T-285 (125.7): a location with no city ("Qatar") has no city part; never repeat the country as a city.
    city: contact.location.includes(",") ? (contact.location.split(",")[0]?.trim() ?? "") : "",
    facebook: "",
    twitter: "",
    linkedin: "",
    github: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    name: form.name.trim() ? null : "Please enter a valid name",
    email: !form.email || EMAIL_PATTERN.test(form.email) ? null : "Please enter a valid email address.",
    phone:
      !form.phone || PHONE_PATTERN.test(form.phone) ? null : "Phone number should be either empty or of E.164 format",
  };
  const valid = !errors.name && !errors.email && !errors.phone;
  const field = (name: keyof typeof form) => ({
    id: `edit-contact-${name}`,
    value: form[name],
    onChange: (event: { target: { value: string } }) => setForm((prev) => ({ ...prev, [name]: event.target.value })),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
          <DialogDescription>Edit contact details</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (!valid) return;
            const location = [form.city.trim(), form.country.trim()].filter(Boolean).join(", ");
            cw.editContact(contactKeyOf(conversation), {
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim(),
              company: form.company.trim(),
              location,
            });
            previewOnly("Contact changed");
            onOpenChange(false);
          }}
        >
          <ScrollArea className="max-h-[60vh] pe-3">
            <div className="grid gap-3 p-0.5">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-contact-name">Full Name</Label>
                <Input
                  placeholder="Enter the full name of the contact"
                  aria-invalid={submitted && !!errors.name}
                  {...field("name")}
                />
                {submitted && <FieldError message={errors.name} />}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-contact-bio">Bio</Label>
                <Textarea className="min-h-16" placeholder="Enter the bio of the contact" {...field("bio")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contact-email">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="Enter the email address of the contact"
                    aria-invalid={submitted && !!errors.email}
                    {...field("email")}
                  />
                  {submitted && <FieldError message={errors.email} />}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contact-phone">Phone Number</Label>
                  <Input
                    placeholder="Enter the phone number of the contact"
                    aria-invalid={submitted && !!errors.phone}
                    {...field("phone")}
                  />
                  {submitted && errors.phone ? (
                    <FieldError message={errors.phone} />
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Phone number should be of E.164 format eg: +1415555555 [+][country code][area code][local phone
                      number].
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-contact-company">Company Name</Label>
                <Input placeholder="Enter the company name" {...field("company")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  {/* T-285 (Fahad 125.9): every country with a search inside, the same picker and size as the
                      Contacts page form (country-select.tsx). */}
                  <Label>Country Name</Label>
                  <CountrySelect
                    value={form.country}
                    placeholder="Select Country"
                    onChange={(country) => setForm((prev) => ({ ...prev, country }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contact-city">City Name</Label>
                  <Input placeholder="Enter the city name" {...field("city")} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Social Profiles</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="Facebook" placeholder="Enter the Facebook username" {...field("facebook")} />
                  <Input aria-label="Twitter" placeholder="Enter the Twitter username" {...field("twitter")} />
                  <Input aria-label="LinkedIn" placeholder="Enter the LinkedIn username" {...field("linkedin")} />
                  <Input aria-label="Github" placeholder="Enter the Github username" {...field("github")} />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Submit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Chatwoot ContactMergeModal: the open contact is the primary one (to be deleted), the searched one is kept.
function MergeContactDialog({ convId, onOpenChange }: Open & { convId: number }) {
  const conversation = baseConversations.find((c) => c.id === convId);
  const [parent, setParent] = useState<string>("");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const deleted = useCwStore((s) => s.deleted);
  const edits = useCwStore((s) => s.contactEdits);
  const mergedAway = useMergedAwayKeys();
  if (!conversation) return null;
  const own = contactKeyOf(conversation);
  const contact = { ...conversation.contact, ...edits[own] };
  // M129-A: one row per person (contactKeyOf: a contact may have no email); contacts deleted or merged away in the
  // preview are no longer offered.
  const people = new Map<string, { key: string; name: string; email: string; id: number }>();
  for (const c of baseConversations) {
    const key = contactKeyOf(c);
    if (key === own || people.has(key) || deleted.includes(c.id) || mergedAway.includes(key)) continue;
    const shown = { ...c.contact, ...edits[key] };
    people.set(key, { key, name: shown.name, email: shown.email, id: contactIdOf(c.id) ?? c.id });
  }
  const matches = [...people.values()].filter((person) =>
    `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const chosen = parent ? people.get(parent) : undefined;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge contacts</DialogTitle>
          <DialogDescription>
            Merge contacts to combine two profiles into one, including all attributes and conversations. In case of
            conflict, the Primary contact’s attributes will take precedence.
          </DialogDescription>
          <SimBadge />
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Primary contact</Label>
              <span className="text-destructive text-xs">To be deleted</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{contact.name}</span>
              <span className="truncate text-muted-foreground text-xs">{contact.email}</span>
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="merge-search">Contact to merge</Label>
              <span className="text-emerald-600 text-xs dark:text-emerald-400">To be kept</span>
            </div>
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                id="merge-search"
                placeholder="Search for a contact"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </InputGroup>
            <ScrollArea className="max-h-40 rounded-md border">
              <div className="p-1">
                {matches.length === 0 && <p className="p-2 text-muted-foreground text-xs">No results found</p>}
                {matches.map((person) => (
                  <button
                    key={person.key}
                    type="button"
                    onClick={() => setParent(person.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted ${parent === person.key ? "bg-muted" : ""}`}
                  >
                    <span className="truncate">
                      {person.name} <span className="text-muted-foreground text-xs">(ID: {person.id})</span>
                    </span>
                    {parent === person.key && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </ScrollArea>
            {submitted && !chosen && <FieldError message="Select a child contact to merge" />}
          </div>
          {chosen && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <div className="mb-1 font-medium">Summary</div>
              <p>
                Contact of <strong>{contact.name}</strong> will be deleted.
              </p>
              <p>
                Contact details of <strong>{contact.name}</strong> will be copied to <strong>{chosen.name}</strong>.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              setSubmitted(true);
              if (!chosen) return;
              // M129-A (Fahad 129.2): the merge really happens in the preview's data (sim-actions.ts simMergeContacts).
              simMergeContacts(convId, parent);
              onOpenChange(false);
            }}
          >
            Merge contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Chatwoot ContactNotes.vue "Add contact note" modal.
function ContactNoteDialog({ convId, onOpenChange }: Open & { convId: number }) {
  const [text, setText] = useState("");
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact note</DialogTitle>
          <DialogDescription className="sr-only">Write a note about this contact</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          className="min-h-32"
          placeholder="Add a note"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && text.trim()) {
              cw.addNote(convId, text.trim());
              previewOnly("Note added");
              onOpenChange(false);
            }
          }}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!text.trim()}
            onClick={() => {
              cw.addNote(convId, text.trim());
              previewOnly("Note added");
              onOpenChange(false);
            }}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// F161: Chatwoot ConversationResolveAttributesModal.vue (settings.json CONVERSATION_WORKFLOW.REQUIRED_ATTRIBUTES.MODAL):
// one field per missing required attribute; "Resolve conversation" stays disabled until every field has a value,
// then saves the values on the conversation and resolves it.
const resolvePlaceholders: Record<string, string> = {
  Text: "Write a note...",
  Number: "Enter a number",
  Link: "Add a link",
  Date: "Pick a date",
  List: "Select an option",
};

function ResolveAttributesDialog({ convId, missing, onOpenChange }: Open & { convId: number; missing: string[] }) {
  const current = useCwStore((s) => s.conversationAttrs[convId]);
  const fields: AttributeDef[] = missing
    .map((key) => conversationAttributeDefs.find((def) => def.key === key))
    .filter((def): def is (typeof conversationAttributeDefs)[number] => def !== undefined);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((def) => [def.key, current?.[def.key] ?? ""])),
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const errorOf = (key: string, type: string): string => {
    const value = (values[key] ?? "").trim();
    if (type === "Checkbox") return "";
    if (value === "") return "Valid value is required";
    if (type === "Link" && !/^https?:\/\/\S+\.\S+/.test(value)) return "Invalid URL";
    const rule = requiredOnResolve.find((attr) => attr.key === key);
    if (rule?.regex && !rule.regex.test(value)) return rule.cue ?? "Invalid Input";
    return "";
  };
  const complete = fields.every((def) => (values[def.key] ?? "").trim() !== "");
  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    setTouched(Object.fromEntries(fields.map((def) => [def.key, true])));
    if (fields.some((def) => errorOf(def.key, def.type))) return;
    for (const def of fields) cw.setConversationAttr(convId, def.key, values[def.key].trim());
    // F-5A: kept in the preview; the toast comes once it is saved.
    void changeStatus([convId], "resolved");
    onOpenChange(false);
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve conversation</DialogTitle>
          <DialogDescription>
            Please fill in the following custom attributes before resolving this conversation
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {fields.map((def) => {
            const error = touched[def.key] ? errorOf(def.key, def.type) : "";
            const id = `resolve-attr-${def.key}`;
            const blur = () => setTouched((prev) => ({ ...prev, [def.key]: true }));
            return (
              <div key={def.key} className="flex flex-col gap-2">
                <Label htmlFor={id}>{def.label}</Label>
                {def.type === "Text" && (
                  <Textarea
                    id={id}
                    placeholder={resolvePlaceholders.Text}
                    value={values[def.key]}
                    onChange={(event) => set(def.key, event.target.value)}
                    onBlur={blur}
                  />
                )}
                {(def.type === "Number" || def.type === "Link" || def.type === "Date") && (
                  <Input
                    id={id}
                    type={def.type === "Number" ? "number" : def.type === "Link" ? "url" : "date"}
                    placeholder={resolvePlaceholders[def.type]}
                    value={values[def.key]}
                    onChange={(event) => set(def.key, event.target.value)}
                    onBlur={blur}
                  />
                )}
                {def.type === "List" && def.options && (
                  <NativeSelect
                    id={id}
                    className="w-full"
                    value={values[def.key]}
                    onChange={(event) => set(def.key, event.target.value)}
                    onBlur={blur}
                  >
                    <option value="">{resolvePlaceholders.List}</option>
                    {def.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {def.type === "Checkbox" && (
                  <RadioGroup
                    id={id}
                    className="flex gap-4"
                    value={values[def.key]}
                    onValueChange={(v) => set(def.key, v)}
                  >
                    {[
                      ["true", "Yes"],
                      ["false", "No"],
                    ].map(([value, label]) => (
                      <Label key={value} className="flex items-center gap-2 font-normal">
                        <RadioGroupItem value={value} /> {label}
                      </Label>
                    ))}
                  </RadioGroup>
                )}
                {error && <p className="text-destructive text-xs">{error}</p>}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={!complete} onClick={submit}>
            Resolve conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const enumAttributes: FilterAttribute[] = [
  "status",
  "assignee_id",
  "inbox_id",
  "team_id",
  "priority",
  "labels",
  "customer_path",
];
const dateAttributes: FilterAttribute[] = ["created_at", "last_activity_at"];

function operatorsFor(attribute: FilterAttribute): FilterOperator[] {
  if (enumAttributes.includes(attribute)) return ["equal_to", "not_equal_to", "is_present", "is_not_present"];
  if (dateAttributes.includes(attribute)) return ["is_greater_than", "is_less_than", "days_before"];
  return ["equal_to", "not_equal_to", "contains", "does_not_contain", "is_present", "is_not_present"];
}

function ValueField({ row, onChange }: { row: FilterRow; onChange: (value: string) => void }) {
  const { tags } = useChatTags();
  const agents = useLiveAgents();
  const inboxes = useLiveInboxes();
  const teams = useLiveTeams();
  const stages = useCustomerPath((s) => s.stages);
  if (row.operator === "is_present" || row.operator === "is_not_present") return <div />;
  const options: { value: string; label: string }[] | null =
    row.attribute === "status"
      ? statusFilterItems.filter((s) => s.value !== "all")
      : row.attribute === "assignee_id"
        ? agents.map((a) => ({ value: String(a.id), label: a.name }))
        : row.attribute === "inbox_id"
          ? inboxes.map((i) => ({ value: i.id, label: i.name }))
          : row.attribute === "team_id"
            ? teams.map((t) => ({ value: t.id, label: t.name }))
            : row.attribute === "priority"
              ? priorities.filter((p) => p.value !== "none").map((p) => ({ value: p.value, label: p.label }))
              : row.attribute === "labels"
                ? tags.map((t) => ({ value: t.id, label: t.label }))
                : row.attribute === "customer_path"
                  ? stages.map((s) => ({ value: s.id, label: s.name }))
                  : null;
  if (options) {
    return (
      <NativeSelect size="sm" className="w-full" value={row.value} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>
          Select
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  return (
    <Input
      className="h-7"
      type={row.operator === "days_before" ? "number" : dateAttributes.includes(row.attribute) ? "date" : "text"}
      placeholder="Enter value"
      value={row.value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const filterDialogCopy = {
  filter: {
    title: "Filter conversations",
    description: "Add your filters below and hit 'Apply filters' to cut through the chat clutter.",
    submit: "Apply filters",
  },
  edit: { title: "Edit Folder", description: "Add or remove filters and update your folder.", submit: "Update folder" },
  create: {
    title: "Create folder",
    description: "Name the folder and add the filters its conversations must match.",
    submit: "Create folder",
  },
};

// T-75: `create` makes it the "Create folder" dialog of the Inbox bar (section-subnav.tsx): a name and the folder's
// conditions, the same rows as editing a folder; the new folder opens once saved.
export function FilterDialog({
  folderId,
  create = false,
  onOpenChange,
}: Open & { folderId?: string; create?: boolean }) {
  const router = useRouter();
  const applied = useCwStore((s) => s.applied);
  const folder = useCwStore((s) => s.folders.find((f) => f.id === folderId));
  const named = Boolean(folder) || create;
  let mode: keyof typeof filterDialogCopy = "filter";
  if (create) mode = "create";
  else if (folder) mode = "edit";
  const copy = filterDialogCopy[mode];
  const [name, setName] = useState(folder?.name ?? "");
  const [rows, setRows] = useState<FilterRow[]>(
    folder?.filters ??
      (create ? null : applied) ?? [{ attribute: "status", operator: "equal_to", value: "open", join: "and" }],
  );
  const [error, setError] = useState("");
  const update = (index: number, patch: Partial<FilterRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const groups = Array.from(new Set(filterAttributes.map((a) => a.group)));

  const submit = () => {
    const missing = rows.some(
      (row) => row.operator !== "is_present" && row.operator !== "is_not_present" && !row.value.trim(),
    );
    if (missing) {
      setError("Value is required.");
      return;
    }
    if (create) {
      if (!name.trim()) {
        setError("Folder name is required.");
        return;
      }
      if (rows.length === 0) {
        setError("Oops, looks like we can't save nothing! Please add at least one filter to save it.");
        return;
      }
      const created = cw.addFolder(name, rows);
      toast.success("Folder created successfully.");
      onOpenChange(false);
      router.push(`/dashboard/chat/folders/${created.id}`);
      return;
    }
    if (folder) {
      if (rows.length === 0) {
        setError("Oops, looks like we can't save nothing! Please add at least one filter to save it.");
        return;
      }
      cw.updateFolder(folder.id, name, rows);
      toast.success("Folder updated successfully.");
    } else {
      cw.applyFilters(rows);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {named && (
          <div className="grid gap-1.5">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={name}
              placeholder={create ? "Example: VIP customers" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
            />
          </div>
        )}
        <div className="grid gap-2">
          {named && <Label>Folder Query</Label>}
          {rows.map((row, index) => (
            <div key={`${index}-${row.attribute}`} className="grid gap-2">
              {index > 0 && (
                <NativeSelect
                  size="sm"
                  className="w-24"
                  value={row.join}
                  onChange={(event) => update(index, { join: event.target.value as FilterRow["join"] })}
                >
                  <option value="and">AND</option>
                  <option value="or">OR</option>
                </NativeSelect>
              )}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 rounded-md border bg-muted/30 p-2">
                <NativeSelect
                  size="sm"
                  className="w-full"
                  value={row.attribute}
                  onChange={(event) => {
                    const attribute = event.target.value as FilterAttribute;
                    update(index, { attribute, operator: operatorsFor(attribute)[0], value: "" });
                  }}
                >
                  {groups.map((group) => (
                    <optgroup key={group} label={group}>
                      {filterAttributes
                        .filter((a) => a.group === group)
                        .map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </NativeSelect>
                <NativeSelect
                  size="sm"
                  className="w-full"
                  value={row.operator}
                  onChange={(event) => {
                    const operator = event.target.value as FilterOperator;
                    // A date and a number of days are different values, so switching between them clears it.
                    const clear = (operator === "days_before") !== (row.operator === "days_before");
                    update(index, clear ? { operator, value: "" } : { operator });
                  }}
                >
                  {operatorsFor(row.attribute).map((op) => (
                    <option key={op} value={op}>
                      {filterOperators.find((o) => o.value === op)?.label}
                    </option>
                  ))}
                </NativeSelect>
                <ValueField row={row} onChange={(value) => update(index, { value })} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove filter"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="link"
            size="sm"
            className="w-fit px-0"
            onClick={() =>
              setRows((prev) => [...prev, { attribute: "assignee_id", operator: "equal_to", value: "", join: "and" }])
            }
          >
            <Plus /> Add filter
          </Button>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter className="sm:justify-between">
          {!named ? (
            <Button
              variant="ghost"
              onClick={() => {
                cw.applyFilters(null);
                onOpenChange(false);
              }}
            >
              Clear filters
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={submit}>{copy.submit}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveFolderDialog({ onOpenChange }: Open) {
  const router = useRouter();
  const applied = useCwStore((s) => s.applied);
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Do you want to save this filter?</DialogTitle>
          <DialogDescription>Saved filters show up as folders under Conversations.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="save-folder-name">Name this filter</Label>
          <Input
            id="save-folder-name"
            placeholder="Name your filter to refer it later."
            value={name}
            aria-invalid={error}
            onChange={(event) => {
              setName(event.target.value);
              setError(false);
            }}
          />
          {error && <p className="text-destructive text-xs">Name is required.</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              if (!name.trim()) {
                setError(true);
                return;
              }
              const folder = cw.addFolder(name, applied ?? []);
              toast.success("Folder created successfully.");
              onOpenChange(false);
              router.push(`/dashboard/chat/folders/${folder.id}`);
            }}
          >
            Save filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFolderDialog({ folderId, onOpenChange }: Open & { folderId: string }) {
  const router = useRouter();
  const folder = useCwStore((s) => s.folders.find((f) => f.id === folderId));
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
          <AlertDialogDescription>Are you sure to delete the filter {folder?.name}?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              cw.deleteFolder(folderId);
              toast.success("Folder deleted successfully.");
              router.push("/dashboard/chat");
            }}
          >
            Yes, delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SearchList({
  title,
  description,
  placeholder,
  onOpenChange,
  children,
  query,
  setQuery,
}: Open & {
  title: string;
  description: string;
  placeholder: string;
  children: ReactNode;
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
        </InputGroup>
        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-2 pe-2">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function WhatsappTemplatesDialog({ onInsert, onOpenChange }: Open & { onInsert: (text: string) => void }) {
  const [query, setQuery] = useState("");
  // F-3: the approved templates of Settings > Templates as they are now (not the starting sample).
  const list = useLiveWhatsappTemplates().filter((t) => t.name.includes(query.toLowerCase()));
  return (
    <SearchList
      title="Whatsapp Templates"
      description="Select the template you want to send"
      placeholder="Search Templates"
      query={query}
      setQuery={setQuery}
      onOpenChange={onOpenChange}
    >
      {list.map((template) => (
        <button
          key={`${template.name}:${template.language}`}
          type="button"
          className="rounded-md border p-3 text-left hover:bg-muted/60"
          onClick={() => {
            onInsert(template.body);
            onOpenChange(false);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{template.name}</span>
            <span className="text-muted-foreground text-xs">
              Language: {template.language} · Category: {template.category}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground text-xs">{template.body}</p>
        </button>
      ))}
    </SearchList>
  );
}

function ArticleSearchDialog({ onInsert, onOpenChange }: Open & { onInsert: (text: string) => void }) {
  const [query, setQuery] = useState("");
  // Q4: like Chatwoot's ArticleSearchPopover (ReplyBox.vue v-if "showArticleSearchPopover && connectedPortalSlug"),
  // the search closes when the Help Center section is hidden while it is open.
  const helpCenterShown = useSectionShown("help-center");
  useEffect(() => {
    if (!helpCenterShown) onOpenChange(false);
  }, [helpCenterShown, onOpenChange]);
  const list = helpArticles.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <SearchList
      title="Search articles"
      description="Insert article from Help Center"
      placeholder="Search articles"
      query={query}
      setQuery={setQuery}
      onOpenChange={onOpenChange}
    >
      {list.length === 0 && <p className="py-6 text-center text-muted-foreground text-sm">No articles found</p>}
      {list.map((article) => (
        <div key={article.title} className="flex items-center justify-between gap-2 rounded-md border p-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-sm">{article.title}</div>
            <div className="text-muted-foreground text-xs">
              {article.category} · {article.views} views
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onInsert(`https://help.weblabs.studio/articles/${article.title.toLowerCase().replaceAll(" ", "-")}`);
              toast.success("Article inserted successfully");
              onOpenChange(false);
            }}
          >
            Insert
          </Button>
        </div>
      ))}
    </SearchList>
  );
}

// Assign / remove labels on many conversations (bulk actions). Labels are the Studio chat tags.
export function bulkLabels(
  ids: number[],
  tagIds: string[],
  mode: "assign" | "remove",
  byConv: Record<string, string[]>,
) {
  for (const id of ids) {
    const current = byConv[String(id)] ?? [];
    for (const tagId of tagIds) {
      const has = current.includes(tagId);
      if ((mode === "assign" && !has) || (mode === "remove" && has)) toggleTag(String(id), tagId);
    }
  }
  toast.success(mode === "assign" ? "Labels assigned successfully." : "Labels removed successfully.");
}
