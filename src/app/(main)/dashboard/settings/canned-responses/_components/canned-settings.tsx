"use client";
import * as React from "react";

import { Pencil, Plus, Trash2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";

interface Canned {
  shortCode: string;
  content: string;
}

const responses: Canned[] = [
  {
    shortCode: "greeting",
    content: "Hello {{contact.name}}, thank you for reaching out to us. How can I help you today?",
  },
  {
    shortCode: "salam",
    content: "وعليكم السلام ورحمة الله، أهلاً بك. كيف يمكننا مساعدتك اليوم؟",
  },
  {
    shortCode: "delivery-time",
    content:
      "Orders inside Doha are delivered within 24 hours. Al Khor, Dukhan and Mesaieed take 2 to 3 working days.",
  },
  {
    shortCode: "refund-policy",
    content:
      "You can return any unused item within 14 days. The refund reaches your card in 5 to 7 working days after we receive it.",
  },
  {
    shortCode: "working-hours",
    content: "Our team is available Saturday to Thursday, 8:00 AM to 10:00 PM (Doha time). Friday from 2:00 PM.",
  },
  {
    shortCode: "payment-link",
    content: "Here is your secure payment link for order {{conversation.custom_attribute.order_number}}. It is valid for 24 hours.",
  },
  {
    shortCode: "uae-shipping",
    content: "We ship to all Emirates. Delivery to Dubai and Abu Dhabi takes 2 working days, shipping fee is AED 25.",
  },
  {
    shortCode: "ksa-branch",
    content: "Our Riyadh showroom is on King Fahd Road, open daily from 10:00 AM to 11:00 PM.",
  },
  {
    shortCode: "closing",
    content: "Is there anything else I can help you with? Have a lovely day!",
  },
];

function CannedDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Canned;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit canned response" : "Add canned response"}</DialogTitle>
          <DialogDescription>
            Canned Responses are predefined reply templates which can be used to quickly send out replies to
            conversations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="canned-code">Short code</Label>
            <Input id="canned-code" placeholder="Please enter a short code." defaultValue={item?.shortCode} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="canned-message">Message</Label>
            <Textarea
              id="canned-message"
              rows={6}
              placeholder="Please write the message you want to save as a template to use later."
              defaultValue={item?.content}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Submit</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CannedSettings() {
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Canned | undefined>();
  const [deleting, setDeleting] = React.useState<Canned | undefined>();

  const q = query.trim().toLowerCase();
  const rows = responses.filter((r) => `${r.shortCode} ${r.content}`.toLowerCase().includes(q));

  return (
    <>
      <SettingsShell
        title="Canned Responses"
        description="Canned Responses are pre-written reply templates that help you quickly respond to a conversation. Agents can type the '/' character followed by the shortcode to insert a canned response during a conversation."
        learnMore="Learn more about canned responses"
        count={plural(rows.length, "canned response", "canned responses")}
        search={{ placeholder: "Search canned responses...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add canned response
          </Button>
        }
      >
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="w-56 py-3 font-normal">Short code</TableHead>
                <TableHead className="py-3 font-normal">Content</TableHead>
                <TableHead className="w-28 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.shortCode} className="border-border/60">
                  <TableCell className="py-3.5 align-top">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/{r.shortCode}</code>
                  </TableCell>
                  <TableCell className="whitespace-normal py-3.5 text-muted-foreground" dir="auto">
                    {r.content}
                  </TableCell>
                  <TableCell className="py-3.5 text-right align-top">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(r)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>No canned responses found matching your search</NoResults>
        )}
      </SettingsShell>

      <CannedDialog open={adding} onOpenChange={setAdding} />
      <CannedDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} item={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm deletion"
        message={`Are you sure to delete ${deleting?.shortCode ?? ""}?`}
        yes={`Yes, delete ${deleting?.shortCode ?? ""}`}
        no={`No, keep ${deleting?.shortCode ?? ""}`}
      />
    </>
  );
}
