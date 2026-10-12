"use client";
import * as React from "react";

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Chatwoot TextArea with max-length 280 and show-character-count (CompanyCreateDialog / CompanyProfileCard).
export function DescriptionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Textarea
        className="min-h-24"
        maxLength={280}
        placeholder="Add a short description for this company"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="justify-self-end text-muted-foreground text-xs tabular-nums">{value.length} / 280</span>
    </div>
  );
}

// Chatwoot CompanyCreateDialog: name is required (Add company stays disabled until it has text), domain and
// description are optional, and the form resets when the dialog closes.
export function CreateCompanyDialog({
  open,
  onOpenChange,
  onCreate,
}: DialogProps & { onCreate: (input: { name: string; domain: string; description: string }) => void }) {
  const [name, setName] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [description, setDescription] = React.useState("");

  function reset() {
    setName("");
    setDomain("");
    setDescription("");
  }

  function submit() {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), domain: domain.trim(), description: description.trim() });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add company details</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Name</Label>
              <Input
                id="company-name"
                placeholder="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-domain">Domain</Label>
              <Input
                id="company-domain"
                placeholder="Domain"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-description">Description</Label>
            <DescriptionField value={description} onChange={setDescription} />
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="link">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Add company
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCompanyDialog({
  open,
  onOpenChange,
  companyName,
  onConfirm,
}: DialogProps & { companyName: string; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete company?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove {companyName} and unlink all associated contacts. Contacts themselves will be preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete company
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
