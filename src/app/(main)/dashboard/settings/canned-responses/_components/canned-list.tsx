"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Canned Responses (canned/Index.vue, AddCanned.vue, EditCanned.vue;
// cannedMgmt.json) in the Studio pattern.
import * as React from "react";

import { ArrowDownAZ, ArrowUpAZ, Braces, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { FieldError, RowMenu, tableClass } from "../../labels/_shared/settings-ui";

interface Canned {
  id: number;
  shortCode: string;
  content: string;
}

const initialResponses: Canned[] = [
  { id: 1, shortCode: "greeting", content: "Hello {{contact.name}}, thank you for reaching out to us. How can I help you today?" },
  { id: 2, shortCode: "salam", content: "وعليكم السلام ورحمة الله، أهلاً بك. كيف يمكننا مساعدتك اليوم؟" },
  { id: 3, shortCode: "delivery-time", content: "Orders inside Doha are delivered within 24 hours. Al Khor, Dukhan and Mesaieed take 2 to 3 working days." },
  { id: 4, shortCode: "refund-policy", content: "You can return any unused item within 14 days. The refund reaches your card in 5 to 7 working days after we receive it." },
  { id: 5, shortCode: "working-hours", content: "Our team is available Saturday to Thursday, 8:00 AM to 10:00 PM (Doha time). Friday from 2:00 PM." },
  { id: 6, shortCode: "payment-link", content: "Here is your secure payment link for order {{conversation.custom_attribute.order_number}}. It is valid for 24 hours." },
  { id: 7, shortCode: "uae-shipping", content: "We ship to all Emirates. Delivery to Dubai and Abu Dhabi takes 2 working days, shipping fee is AED 25." },
  { id: 8, shortCode: "ksa-branch", content: "Our Riyadh showroom is on King Fahd Road, open daily from 10:00 AM to 11:00 PM." },
  { id: 9, shortCode: "handover", content: "I am passing you to {{agent.name}} from our billing team, who will continue with you here." },
  { id: 10, shortCode: "closing", content: "Is there anything else I can help you with? Have a lovely day!" },
];

// The variables Chatwoot's message editor offers after "{{" (shared/constants/messages.js MESSAGE_VARIABLES).
const variables = [
  { key: "contact.name", label: "Contact name" },
  { key: "contact.first_name", label: "Contact first name" },
  { key: "contact.last_name", label: "Contact last name" },
  { key: "contact.email", label: "Contact email" },
  { key: "contact.phone", label: "Contact phone" },
  { key: "contact.id", label: "Contact ID" },
  { key: "conversation.id", label: "Conversation ID" },
  { key: "agent.name", label: "Agent name" },
  { key: "agent.first_name", label: "Agent first name" },
  { key: "agent.email", label: "Agent email" },
  { key: "inbox.name", label: "Inbox name" },
];

function CannedDialog({
  open,
  onOpenChange,
  item,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Canned;
  onSave: (shortCode: string, content: string) => void;
}) {
  const [shortCode, setShortCode] = React.useState("");
  const [content, setContent] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setShortCode(item?.shortCode ?? "");
    setContent(item?.content ?? "");
    setSubmitted(false);
  }, [open, item]);

  const codeError = shortCode.trim() ? "" : item ? "Short code is required." : "Short Code is required.";
  const contentError = content.trim() ? "" : "Message is required.";

  function insertVariable(key: string) {
    const el = textRef.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    setContent(content.slice(0, start) + token + content.slice(end));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (codeError || contentError) return;
    onSave(shortCode.trim(), content.trim());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{item ? "Edit canned response" : "Add canned response"}</DialogTitle>
            <DialogDescription>
              Canned Responses are predefined reply templates which can be used to quickly send out replies to
              conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="canned-code">Short code</Label>
            <Input
              id="canned-code"
              placeholder={item ? "Please enter a shortcode." : "Please enter a short code."}
              value={shortCode}
              aria-invalid={submitted && !!codeError}
              onChange={(e) => setShortCode(e.target.value)}
            />
            <FieldError>{submitted ? codeError : ""}</FieldError>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="canned-content">Message</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-muted-foreground">
                    <Braces /> Insert variable
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Variables</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {variables.map((v) => (
                    <DropdownMenuItem key={v.key} onSelect={() => insertVariable(v.key)}>
                      <span className="flex-1">{v.label}</span>
                      <code className="text-muted-foreground text-xs">{`{{${v.key}}}`}</code>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              id="canned-content"
              ref={textRef}
              rows={6}
              placeholder="Please write the message you want to save as a template to use later."
              value={content}
              aria-invalid={submitted && !!contentError}
              onChange={(e) => setContent(e.target.value)}
            />
            <FieldError>{submitted ? contentError : ""}</FieldError>
          </div>
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

/** Variables like {{contact.name}} drawn as small chips inside the content, as the editor shows them. */
function ContentPreview({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("{{") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of one string.
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-foreground text-xs">
            {part}
          </code>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of one string.
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export function CannedList() {
  const [responses, setResponses] = React.useState(initialResponses);
  const [query, setQuery] = React.useState("");
  const [sortAsc, setSortAsc] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Canned | undefined>();
  const [deleting, setDeleting] = React.useState<Canned | undefined>();

  const q = query.trim().toLowerCase();
  const rows = responses
    .filter((r) => `${r.shortCode} ${r.content}`.toLowerCase().includes(q))
    .sort((a, b) => (sortAsc ? 1 : -1) * a.shortCode.localeCompare(b.shortCode));

  return (
    <>
      <SettingsShell
        title="Canned Responses"
        description="Canned Responses are pre-written reply templates that help you quickly respond to a conversation. Agents can type the '/' character followed by the shortcode to insert a canned response during a conversation."
        learnMore="Learn more about canned responses"
        count={plural(rows.length, "canned response", "canned responses")}
        search={{ placeholder: "Search canned responses...", value: query, onChange: setQuery }}
        cardTitle="Manage canned responses"
        cardDescription="Canned Responses are predefined reply templates which can be used to quickly send out replies to conversations."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add canned response
          </Button>
        }
      >
        {rows.length ? (
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-56 py-3 font-normal">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 hover:text-foreground"
                    onClick={() => setSortAsc((s) => !s)}
                    aria-label="Sort by short code"
                  >
                    Short code
                    {sortAsc ? <ArrowDownAZ className="size-3.5" /> : <ArrowUpAZ className="size-3.5" />}
                  </button>
                </TableHead>
                <TableHead className="py-3 font-normal">Content</TableHead>
                <TableHead className="w-20 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id} className="border-border/60">
                  <TableCell className="py-3.5 align-top">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/{item.shortCode}</code>
                  </TableCell>
                  <TableCell className="whitespace-normal py-3.5 text-muted-foreground leading-relaxed" dir="auto">
                    <ContentPreview text={item.content} />
                  </TableCell>
                  <TableCell className="py-3.5 text-right align-top">
                    <RowMenu
                      name={item.shortCode}
                      items={[
                        { label: "Edit", icon: Pencil, onSelect: () => setEditing(item) },
                        {
                          label: "Copy message",
                          icon: Copy,
                          onSelect: () => {
                            navigator.clipboard?.writeText(item.content).catch(() => undefined);
                            toast.success("Copied to clipboard");
                          },
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          destructive: true,
                          separatorBefore: true,
                          onSelect: () => setDeleting(item),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {q
              ? "No canned responses found matching your search"
              : "There are no canned responses available in this account."}
          </NoResults>
        )}
      </SettingsShell>

      <CannedDialog
        open={adding}
        onOpenChange={setAdding}
        onSave={(shortCode, content) => {
          setResponses((prev) => [...prev, { id: Date.now(), shortCode, content }]);
          toast.success("Canned response added successfully.");
        }}
      />
      <CannedDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        item={editing}
        onSave={(shortCode, content) => {
          setResponses((prev) => prev.map((r) => (r.id === editing?.id ? { ...r, shortCode, content } : r)));
          toast.success("Canned response is updated successfully.");
        }}
      />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm deletion"
        message={`Are you sure to delete ${deleting?.shortCode ?? ""}?`}
        yes={`Yes, delete ${deleting?.shortCode ?? ""}`}
        no={`No, keep ${deleting?.shortCode ?? ""}`}
        onConfirm={() => {
          setResponses((prev) => prev.filter((r) => r.id !== deleting?.id));
          toast.success("Canned response deleted successfully.");
        }}
      />
    </>
  );
}
