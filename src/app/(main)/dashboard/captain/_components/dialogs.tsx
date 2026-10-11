"use client";
import * as React from "react";

import { FileText, Link2, Plus, Trash2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { type Assistant, assistants, availableInboxes, type Tool } from "./data";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Footer({ submit }: { submit: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <DialogClose asChild>
        <Button>{submit}</Button>
      </DialogClose>
    </DialogFooter>
  );
}

function AssistantSelect() {
  return (
    <div className="grid gap-2">
      <Label>Assistant</Label>
      <NativeSelect className="w-full" defaultValue="1">
        {assistants.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function AssistantDialog({ open, onOpenChange, assistant }: DialogProps & { assistant?: Assistant }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assistant ? "Update the assistant" : "Create an assistant"}</DialogTitle>
          <DialogDescription>
            Fill out the details below to name your assistant, describe its purpose, and specify the product it will
            support.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input placeholder="Enter assistant name" defaultValue={assistant?.name} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Enter assistant description"
              defaultValue={assistant?.description}
              className="min-h-20"
            />
          </div>
          <div className="grid gap-2">
            <Label>Product Name</Label>
            <Input placeholder="Enter product name" defaultValue={assistant?.productName} />
          </div>
        </div>
        <Footer submit={assistant ? "Update" : "Create"} />
      </DialogContent>
    </Dialog>
  );
}

export function DocumentDialog({ open, onOpenChange }: DialogProps) {
  const [type, setType] = React.useState("url");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            Enter the URL of the document to add it as a knowledge source and choose the assistant to associate it with.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Document Type</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={type}
              onValueChange={(v) => v && setType(v)}
              className="w-full"
            >
              <ToggleGroupItem value="url" className="flex-1">
                <Link2 /> URL
              </ToggleGroupItem>
              <ToggleGroupItem value="pdf" className="flex-1">
                <FileText /> PDF File
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {type === "url" ? (
            <div className="grid gap-2">
              <Label>URL</Label>
              <Input placeholder="Enter the URL of the document" />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>PDF File</Label>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground text-xs">Maximum file size: 10MB</span>
                </div>
                <Button variant="outline" size="sm">
                  Choose PDF file
                </Button>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Document Name (Optional)</Label>
            <Input placeholder="Enter a name for the document" />
          </div>
          <AssistantSelect />
        </div>
        <Footer submit="Create" />
      </DialogContent>
    </Dialog>
  );
}

export function FaqDialog({
  open,
  onOpenChange,
  initial,
}: DialogProps & { initial?: { question: string; answer: string } }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Update the FAQ" : "Add an FAQ"}</DialogTitle>
          <DialogDescription>
            Add a question and its corresponding answer to the knowledge base and select the assistant it should be
            associated with.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Question</Label>
            <Input placeholder="Enter the question here" defaultValue={initial?.question} />
          </div>
          <div className="grid gap-2">
            <Label>Answer</Label>
            <Textarea placeholder="Enter the answer here" defaultValue={initial?.answer} className="min-h-28" />
          </div>
          <AssistantSelect />
        </div>
        <Footer submit={initial ? "Update" : "Create"} />
      </DialogContent>
    </Dialog>
  );
}

export function ToolDialog({ open, onOpenChange, tool }: DialogProps & { tool?: Tool }) {
  const [auth, setAuth] = React.useState(tool?.auth ?? "None");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tool ? "Edit Custom Tool" : "Create Custom Tool"}</DialogTitle>
          <DialogDescription>Configure your custom tool to connect with external APIs</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Tool Name</Label>
            <Input placeholder="Order Lookup" defaultValue={tool?.title} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Looks up order details by order ID"
              defaultValue={tool?.description}
              className="min-h-16"
            />
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="grid gap-2">
              <Label>Method</Label>
              <NativeSelect className="w-full" defaultValue={tool?.method ?? "GET"}>
                <option>GET</option>
                <option>POST</option>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label>Endpoint URL</Label>
              <Input
                placeholder="https://api.example.com/orders/{{ order_id }}"
                defaultValue={tool?.endpoint}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Authentication Type</Label>
            <NativeSelect className="w-full" value={auth} onChange={(e) => setAuth(e.target.value)}>
              <option>None</option>
              <option>Bearer Token</option>
              <option>Basic Auth</option>
              <option>API Key</option>
            </NativeSelect>
          </div>
          {auth === "Bearer Token" && (
            <div className="grid gap-2">
              <Label>Bearer Token</Label>
              <Input type="password" placeholder="Enter your bearer token" />
            </div>
          )}
          {auth === "Basic Auth" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Username</Label>
                <Input placeholder="Enter username" />
              </div>
              <div className="grid gap-2">
                <Label>Password</Label>
                <Input type="password" placeholder="Enter password" />
              </div>
            </div>
          )}
          {auth === "API Key" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Header Name</Label>
                <Input placeholder="X-API-Key" />
              </div>
              <div className="grid gap-2">
                <Label>Header Value</Label>
                <Input type="password" placeholder="Enter API key value" />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Parameters</Label>
            <p className="text-muted-foreground text-xs">
              Define the parameters that will be extracted from user queries
            </p>
            <div className="grid gap-2 rounded-lg border p-3">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <Input placeholder="Parameter name (e.g., order_id)" defaultValue={tool ? "order_id" : ""} />
                <NativeSelect className="w-full" defaultValue="string">
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="array">Array</option>
                  <option value="object">Object</option>
                </NativeSelect>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Description of the parameter"
                  defaultValue={tool ? "The order number shared by the customer" : ""}
                />
                <Label className="flex items-center gap-2 whitespace-nowrap font-normal">
                  <Checkbox defaultChecked /> Required
                </Label>
                <Button variant="ghost" size="icon-sm" aria-label="Remove parameter">
                  <Trash2 />
                </Button>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-fit">
              <Plus /> Add Parameter
            </Button>
          </div>
          <div className="grid gap-2">
            <Label>Request Body Template (Optional)</Label>
            <Textarea placeholder={'{\n  "order_id": "{{ order_id }}"\n}'} className="min-h-20 font-mono text-xs" />
          </div>
          <div className="grid gap-2">
            <Label>Response Template (Optional)</Label>
            <Textarea
              placeholder="Order {{ order_id }} status: {{ status }}"
              className="min-h-16 font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline">Test connection</Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button>{tool ? "Update" : "Create"}</Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScenarioDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a scenario</DialogTitle>
          <DialogDescription>
            Give your assistant some context—like “what to do when a user is stuck,” or “how to act during a refund
            request.”
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input placeholder="Enter a name for the scenario" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea placeholder="Describe how and where this scenario will be used" className="min-h-16" />
          </div>
          <div className="grid gap-2">
            <Label>How to handle</Label>
            <Textarea placeholder="Describe how and where this scenario will be handled" className="min-h-24" />
          </div>
        </div>
        <Footer submit="Create" />
      </DialogContent>
    </Dialog>
  );
}

export function InboxDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect an Inbox</DialogTitle>
          <DialogDescription>Choose an inbox to connect with the assistant.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>Inbox</Label>
          <NativeSelect className="w-full" defaultValue="">
            <option value="" disabled>
              Choose the inbox to deploy the assistant.
            </option>
            {availableInboxes.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </NativeSelect>
        </div>
        <Footer submit="Create" />
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm = "Yes, delete",
}: DialogProps & { title: string; description?: string; confirm?: string }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
