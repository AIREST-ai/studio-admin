"use client";
import type * as React from "react";

import { Download, Upload } from "lucide-react";

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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { type Contact, countries } from "./data";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactFormFields({ contact }: { contact?: Contact }) {
  const [firstName, ...rest] = contact?.name.split(" ") ?? [""];
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Enter the first name" defaultValue={firstName} />
        <Input placeholder="Enter the last name" defaultValue={rest.join(" ")} />
      </div>
      <Input type="email" placeholder="Enter the email address" defaultValue={contact?.email} />
      <Input placeholder="Enter the phone number" defaultValue={contact?.phone} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Enter the city name" defaultValue={contact?.city} />
        <NativeSelect className="w-full" defaultValue={contact?.country ?? ""}>
          <option value="" disabled>
            Select country
          </option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Textarea placeholder="Enter the bio" defaultValue={contact?.bio} className="min-h-16" />
      <Input placeholder="Enter the company name" defaultValue={contact?.company} />
    </div>
  );
}

export function SocialLinksFields() {
  const items = ["Add Facebook", "Add Instagram", "Add WhatsApp", "Add LinkedIn", "Add Twitter", "Add TikTok"];
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">Edit social links</Label>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <Input key={item} placeholder={item} className="h-7 text-xs" />
        ))}
      </div>
    </div>
  );
}

export function AddContactDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>Edit contact details</DialogDescription>
        </DialogHeader>
        <ContactFormFields />
        <SocialLinksFields />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Save contact</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImportContactsDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Import contacts through a CSV file.{" "}
            <button type="button" className="text-primary underline-offset-4 hover:underline">
              Download a sample csv.
            </button>
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Upload className="size-4 text-muted-foreground" />
            </div>
            <div className="grid gap-0.5">
              <span className="font-medium text-sm">CSV File:</span>
              <span className="text-muted-foreground text-xs">No file chosen</span>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Choose file
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExportContactsDialog({ open, onOpenChange }: DialogProps) {
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
          <AlertDialogAction>
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
