"use client";
import * as React from "react";

import { ChevronDown, X } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import {
  type LiveChatCampaign,
  labels,
  senders,
  smsInboxes,
  websiteInboxes,
  whatsappInboxes,
  whatsappTemplates,
} from "./data";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  id,
  placeholder,
  options,
  defaultValue = "",
  disabled,
  onChange,
}: {
  id: string;
  placeholder: string;
  options: string[] | { value: string; label: string }[];
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <NativeSelect
      id={id}
      className="w-full"
      defaultValue={defaultValue}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => {
        const value = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </NativeSelect>
  );
}

function AudiencePicker() {
  const [selected, setSelected] = React.useState<string[]>([]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm dark:bg-input/30"
        >
          <span className="flex flex-1 flex-wrap gap-1">
            {selected.length ? (
              selected.map((label) => (
                <Badge key={label} variant="secondary" className="gap-1 font-normal">
                  {label}
                  <X
                    className="size-3 cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected((prev) => prev.filter((l) => l !== label));
                    }}
                  />
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Select the customer labels</span>
            )}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1">
        {labels.map((label) => {
          const checked = selected.includes(label);
          return (
            // biome-ignore lint/a11y/noLabelWithoutControl: checkbox is nested
            <label
              key={label}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) =>
                  setSelected((prev) => (value ? [...prev, label] : prev.filter((l) => l !== label)))
                }
              />
              {label}
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function FormFooter({ submitLabel = "Create" }: { submitLabel?: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <DialogClose asChild>
        <Button>{submitLabel}</Button>
      </DialogClose>
    </DialogFooter>
  );
}

export function LiveChatCampaignDialog({ open, onOpenChange, campaign }: DialogProps & { campaign?: LiveChatCampaign }) {
  const isEdit = Boolean(campaign);
  const [inbox, setInbox] = React.useState(campaign?.inbox ?? "");
  React.useEffect(() => setInbox(campaign?.inbox ?? ""), [campaign]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" key={campaign?.id ?? "new"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit live chat campaign" : "Create a live chat campaign"}</DialogTitle>
          <DialogDescription className="sr-only">Live chat campaign details</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Title" htmlFor="lc-title">
            <Input id="lc-title" placeholder="Please enter the title of campaign" defaultValue={campaign?.title} />
          </FormField>
          <FormField label="Message" htmlFor="lc-message">
            <Textarea
              id="lc-message"
              className="min-h-20"
              placeholder="Please enter the message of campaign"
              defaultValue={campaign?.message}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Select Inbox" htmlFor="lc-inbox">
              <SelectField
                id="lc-inbox"
                placeholder="Select Inbox"
                options={websiteInboxes}
                defaultValue={campaign?.inbox}
                onChange={setInbox}
              />
            </FormField>
            <FormField label="Sent by" htmlFor="lc-sender">
              <SelectField
                id="lc-sender"
                placeholder="Please select sender"
                options={senders}
                defaultValue={campaign ? (campaign.sender ?? "Bot") : ""}
                disabled={!inbox}
              />
            </FormField>
          </div>
          <FormField label="URL" htmlFor="lc-url">
            <Input id="lc-url" type="url" placeholder="Please enter the URL" defaultValue={campaign?.url} />
          </FormField>
          <FormField label="Time on page(Seconds)" htmlFor="lc-time">
            <Input id="lc-time" type="number" placeholder="Please enter the time" defaultValue={campaign?.timeOnPage} />
          </FormField>
          <fieldset className="grid gap-2.5">
            <legend className="mb-2.5 font-medium text-sm">Other preferences</legend>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: checkbox is nested */}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox defaultChecked={campaign?.enabled ?? true} />
              Enable campaign
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: checkbox is nested */}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox defaultChecked={campaign?.businessHoursOnly ?? false} />
              Trigger only during business hours
            </label>
          </fieldset>
        </div>
        <FormFooter submitLabel={isEdit ? "Update" : "Create"} />
      </DialogContent>
    </Dialog>
  );
}

export function SMSCampaignDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create SMS campaign</DialogTitle>
          <DialogDescription className="sr-only">SMS campaign details</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Title" htmlFor="sms-title">
            <Input id="sms-title" placeholder="Please enter the title of campaign" />
          </FormField>
          <FormField label="Message" htmlFor="sms-message">
            <Textarea id="sms-message" className="min-h-20" placeholder="Please enter the message of campaign" />
          </FormField>
          <FormField label="Select Inbox" htmlFor="sms-inbox">
            <SelectField id="sms-inbox" placeholder="Select Inbox" options={smsInboxes} />
          </FormField>
          <FormField label="Audience">
            <AudiencePicker />
          </FormField>
          <FormField label="Scheduled time" htmlFor="sms-time">
            <Input id="sms-time" type="datetime-local" placeholder="Please select the time" />
          </FormField>
        </div>
        <FormFooter />
      </DialogContent>
    </Dialog>
  );
}

export function WhatsAppCampaignDialog({ open, onOpenChange }: DialogProps) {
  const [inbox, setInbox] = React.useState("");
  const [template, setTemplate] = React.useState("");
  const selected = whatsappTemplates.find((t) => t.value === template);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setInbox("");
          setTemplate("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create WhatsApp campaign</DialogTitle>
          <DialogDescription className="sr-only">WhatsApp campaign details</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Title" htmlFor="wa-title">
            <Input id="wa-title" placeholder="Please enter the title of campaign" />
          </FormField>
          <FormField label="Select Inbox" htmlFor="wa-inbox">
            <SelectField id="wa-inbox" placeholder="Select Inbox" options={whatsappInboxes} onChange={setInbox} />
          </FormField>
          <FormField label="WhatsApp Template" htmlFor="wa-template">
            <SelectField
              id="wa-template"
              placeholder="Select a template"
              options={whatsappTemplates}
              disabled={!inbox}
              onChange={setTemplate}
            />
            <p className="text-muted-foreground text-xs">Select a template to use for this campaign.</p>
          </FormField>
          {selected ? (
            <div className="grid gap-3 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">Process {selected.value}</span>
                <div className="flex gap-1.5 text-muted-foreground text-xs">
                  <span>Language: {selected.language}</span>
                  <span>·</span>
                  <span>Category: {selected.category}</span>
                </div>
              </div>
              <p className="rounded-md bg-background p-2.5 text-sm">
                Hi {"{{1}}"}, White Friday starts early for you! Shop 48 hours before everyone else.
              </p>
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground text-xs">Variables</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {"{{1}}"}
                  </Badge>
                  <Input className="h-7" placeholder="Enter value for 1" />
                </div>
              </div>
            </div>
          ) : null}
          <FormField label="Audience">
            <AudiencePicker />
          </FormField>
          <FormField label="Scheduled time" htmlFor="wa-time">
            <Input id="wa-time" type="datetime-local" placeholder="Please select the time" />
          </FormField>
        </div>
        <FormFooter />
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDeleteCampaignDialog({ open, onOpenChange, title }: DialogProps & { title?: string }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure to delete?</AlertDialogTitle>
          <AlertDialogDescription>
            {title ? <span className="font-medium text-foreground">{title}. </span> : null}
            The delete action is permanent and cannot be reversed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
