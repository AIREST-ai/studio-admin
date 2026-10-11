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
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DescriptionField({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <div className="grid gap-1.5">
      <Textarea
        className="min-h-24"
        maxLength={280}
        placeholder="Add a short description for this company"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <span className="justify-self-end text-muted-foreground text-xs tabular-nums">{value.length} / 280</span>
    </div>
  );
}

export function CreateCompanyDialog({ open, onOpenChange }: DialogProps) {
  const [name, setName] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Add company details</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            <Input placeholder="Domain" />
          </div>
          <DescriptionField />
        </div>
        <DialogFooter className="sm:justify-between">
          <DialogClose asChild>
            <Button variant="link">Cancel</Button>
          </DialogClose>
          <Button disabled={!name.trim()} onClick={() => onOpenChange(false)}>
            Add company
          </Button>
        </DialogFooter>
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
