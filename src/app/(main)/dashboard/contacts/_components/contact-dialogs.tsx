"use client";
import * as React from "react";

import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { usePreviewSimSettled } from "@/lib/cw/preview-sim";

import { simAddContact } from "./contacts-sim";
import { type ContactDraft, type SocialKey, useContactsStore } from "./contacts-store";
import { CountrySelect } from "./country-select";
import type { Contact } from "./data";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---- contact form (Chatwoot components-next/Contacts/ContactsForm/ContactsForm.vue) ----

export interface ContactFormValue {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  bio: string;
  company: string;
  social: Partial<Record<SocialKey, string>>;
}

export function contactFormValue(contact?: Contact, social?: Partial<Record<SocialKey, string>>): ContactFormValue {
  const [firstName = "", ...rest] = contact?.name.split(" ") ?? [];
  return {
    firstName,
    lastName: rest.join(" "),
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    city: contact?.city ?? "",
    country: contact?.country ?? "",
    bio: contact?.bio ?? "",
    company: contact?.company ?? "",
    social: { ...(social ?? {}) },
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Chatwoot validations: firstName required, email must be a valid address when given (ContactsForm.vue:88-94).
export function contactFormErrors(value: ContactFormValue): { firstName?: string; email?: string } {
  return {
    firstName: value.firstName.trim() ? undefined : "First name is required",
    email: !value.email.trim() || EMAIL.test(value.email.trim()) ? undefined : "Please enter a valid email address.",
  };
}

export function isContactFormValid(value: ContactFormValue) {
  const errors = contactFormErrors(value);
  return !errors.firstName && !errors.email;
}

export function contactDraft(value: ContactFormValue): ContactDraft {
  return {
    name: [value.firstName.trim(), value.lastName.trim()].filter(Boolean).join(" "),
    email: value.email.trim(),
    phone: value.phone.trim(),
    city: value.city.trim(),
    country: value.country,
    bio: value.bio.trim(),
    company: value.company.trim(),
    social: value.social,
  };
}

export function ContactFormFields({
  value,
  onChange,
}: {
  value: ContactFormValue;
  onChange: (value: ContactFormValue) => void;
}) {
  const errors = contactFormErrors(value);
  const field = (key: Exclude<keyof ContactFormValue, "social">) => ({
    value: value[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange({ ...value, [key]: event.target.value }),
  });
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Input placeholder="Enter the first name" aria-invalid={!!errors.firstName} {...field("firstName")} />
        </div>
        <Input placeholder="Enter the last name" {...field("lastName")} />
      </div>
      <div className="grid gap-1">
        <Input type="email" placeholder="Enter the email address" aria-invalid={!!errors.email} {...field("email")} />
        {errors.email ? <span className="text-destructive text-xs">{errors.email}</span> : null}
      </div>
      <Input placeholder="Enter the phone number" {...field("phone")} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Enter the city name" {...field("city")} />
        <CountrySelect value={value.country} onChange={(country) => onChange({ ...value, country })} />
      </div>
      <Textarea placeholder="Enter the bio" className="min-h-16" {...field("bio")} />
      <Input placeholder="Enter the company name" {...field("company")} />
    </div>
  );
}

// Chatwoot SOCIAL_CONFIG order (ContactsForm.vue:47-56), eight networks.
const socialItems: { key: SocialKey; placeholder: string }[] = [
  { key: "linkedin", placeholder: "Add LinkedIn" },
  { key: "facebook", placeholder: "Add Facebook" },
  { key: "instagram", placeholder: "Add Instagram" },
  { key: "whatsapp", placeholder: "Add WhatsApp" },
  { key: "telegram", placeholder: "Add Telegram" },
  { key: "tiktok", placeholder: "Add TikTok" },
  { key: "twitter", placeholder: "Add Twitter" },
  { key: "github", placeholder: "Add Github" },
];

export function SocialLinksFields({
  value,
  onChange,
}: {
  value: ContactFormValue;
  onChange: (value: ContactFormValue) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">Edit social links</Label>
      <div className="grid grid-cols-2 gap-2">
        {socialItems.map((item) => (
          <Input
            key={item.key}
            placeholder={item.placeholder}
            className="h-7 text-xs"
            value={value.social[item.key] ?? ""}
            onChange={(event) => onChange({ ...value, social: { ...value.social, [item.key]: event.target.value } })}
          />
        ))}
      </div>
    </div>
  );
}

export function AddContactDialog({ open, onOpenChange }: DialogProps) {
  // F-3: the saved contacts are replayed first, so a new one never takes the number of a saved one.
  const settled = usePreviewSimSettled();
  const [value, setValue] = React.useState(() => contactFormValue());

  function change(next: boolean) {
    if (!next) setValue(contactFormValue());
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>Edit contact details</DialogDescription>
        </DialogHeader>
        <ContactFormFields value={value} onChange={setValue} />
        <SocialLinksFields value={value} onChange={setValue} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!isContactFormValid(value) || !settled}
            onClick={() => {
              // F-3: kept in the preview's saved record; its toast says "Preview — simulated" once saved.
              simAddContact(contactDraft(value));
              change(false);
            }}
          >
            Save contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- import / export ----

const csvColumns = ["name", "email", "phone_number", "city", "country", "company_name"] as const;

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      out.push(cell);
      cell = "";
    } else cell += char;
  }
  out.push(cell);
  return out.map((v) => v.trim());
}

function parseContactsCsv(text: string): ContactDraft[] {
  const [header, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
  if (!header) return [];
  const keys = parseCsvLine(header).map((k) => k.toLowerCase());
  const col = (row: string[], key: string) => row[keys.indexOf(key)] ?? "";
  return lines
    .map(parseCsvLine)
    .map((row) => ({
      name: col(row, "name"),
      email: col(row, "email"),
      phone: col(row, "phone_number"),
      city: col(row, "city"),
      country: col(row, "country"),
      company: col(row, "company_name") || col(row, "company"),
      bio: "",
    }))
    .filter((draft) => draft.name || draft.email || draft.phone);
}

export function ImportContactsDialog({ open, onOpenChange }: DialogProps) {
  const add = useContactsStore((s) => s.add);
  const input = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);

  function change(next: boolean) {
    if (!next) setFile(null);
    onOpenChange(next);
  }

  async function runImport() {
    if (!file) return;
    const drafts = parseContactsCsv(await file.text());
    for (const draft of [...drafts].reverse()) add({ ...draft, name: draft.name || draft.email || draft.phone });
    // T-290 (rule 129.2: say only what happened): no mail is sent here, the rows are added to the Contacts list at once.
    if (drafts.length)
      toast.success(`${drafts.length} ${drafts.length === 1 ? "contact" : "contacts"} imported from ${file.name}.`);
    else toast.error(`No contacts found in ${file.name}. Use the columns of the sample CSV.`);
    change(false);
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Import contacts through a CSV file.{" "}
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() =>
                downloadCsv("import-contacts-sample.csv", [
                  [...csvColumns],
                  ["Jane Doe", "jane@example.com", "+97455550000", "Doha", "Qatar", "Example Co"],
                ])
              }
            >
              Download a sample csv.
            </button>
          </DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Upload className="size-4 text-muted-foreground" />
            </div>
            <div className="grid min-w-0 gap-0.5">
              <span className="font-medium text-sm">CSV File:</span>
              <span className="truncate text-muted-foreground text-xs">{file ? file.name : "No file chosen"}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            {file ? "Change" : "Choose file"}
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={!file} onClick={runImport}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExportContactsDialog({ open, onOpenChange }: DialogProps) {
  const list = useContactsStore((s) => s.list);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export contacts</AlertDialogTitle>
          <AlertDialogDescription>
            Quickly export a csv file with comprehensive details of your contacts
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              // No mail server here, so the file is downloaded at once instead of being emailed.
              downloadCsv("contacts.csv", [
                [...csvColumns],
                ...list.map((c) => [c.name, c.email, c.phone, c.city, c.country, c.company]),
              ]);
              toast.success(
                "Export is in progress. You will be notified on email when the export file is ready to download.",
              );
            }}
          >
            <Download /> Export
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteContactDialog({
  open,
  onOpenChange,
  onConfirm,
}: DialogProps & { onConfirm?: React.MouseEventHandler<HTMLButtonElement> }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete this contact?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Yes, Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
