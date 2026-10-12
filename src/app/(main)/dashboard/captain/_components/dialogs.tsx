"use client";
// Chatwoot dialogs: CreateAssistantDialog/AssistantForm, CreateDocumentDialog/DocumentForm, CreateResponseDialog/
// ResponseForm, CreateCustomToolDialog/CustomToolForm/AuthConfig/ParamRow, AddNewScenariosDialog/ToolsDropdown,
// ConnectInboxDialog, DeleteDialog. Required fields are checked on submit with Chatwoot's own error texts.
import * as React from "react";

import { cn } from "cn";
import { AtSign, FileText, Link2, Plus, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { type Assistant, assistants, availableInboxes, type Scenario, type Tool, tools } from "./data";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Errors = Record<string, string | undefined>;

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)} data-invalid={error ? true : undefined}>
      <Label className={cn(error && "text-destructive")}>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

const invalid = "aria-invalid:border-destructive";

function Footer({ submit, onSubmit }: { submit: string; onSubmit: () => void }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button onClick={onSubmit}>{submit}</Button>
    </DialogFooter>
  );
}

// Runs the checks; the dialog closes with Chatwoot's success toast only when every required field is filled.
function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = React.useState<T>(initial);
  const [errors, setErrors] = React.useState<Errors>({});
  const set =
    (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setValues((p) => ({ ...p, [field]: value }));
      setErrors((p) => ({ ...p, [field as string]: undefined }));
    };
  function validate(rules: Partial<Record<keyof T, string | ((v: string) => string | undefined)>>) {
    const next: Errors = {};
    for (const [field, rule] of Object.entries(rules)) {
      const v = (values[field] ?? "").trim();
      if (typeof rule === "function") next[field] = rule(v);
      else if (!v) next[field] = rule as string;
    }
    setErrors(next);
    return Object.values(next).every((x) => !x);
  }
  return { values, errors, set, validate, setValues };
}

const isUrl = (v: string) => /^https?:\/\/[^\s.]+\.[^\s]+/.test(v);

function AssistantSelect() {
  return (
    <Field label="Assistant">
      <NativeSelect className="w-full" defaultValue="1">
        {assistants.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function AssistantDialog({ open, onOpenChange, assistant }: DialogProps & { assistant?: Assistant }) {
  const { values, errors, set, validate } = useForm({
    name: assistant?.name ?? "",
    description: assistant?.description ?? "",
    productName: assistant?.productName ?? "",
  });
  function submit() {
    if (
      !validate({
        name: "The name is required",
        description: "The description is required",
        productName: "The product name is required",
      })
    )
      return;
    toast.success(assistant ? "Assistant updated successfully" : "Assistant created successfully");
    onOpenChange(false);
  }
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
          <Field label="Name" error={errors.name}>
            <Input
              placeholder="Enter assistant name"
              value={values.name}
              onChange={set("name")}
              aria-invalid={!!errors.name}
              className={invalid}
            />
          </Field>
          <Field label="Description" error={errors.description}>
            <Textarea
              placeholder="Enter assistant description"
              value={values.description}
              onChange={set("description")}
              aria-invalid={!!errors.description}
              className={cn("min-h-20", invalid)}
            />
          </Field>
          <Field label="Product Name" error={errors.productName}>
            <Input
              placeholder="Enter product name"
              value={values.productName}
              onChange={set("productName")}
              aria-invalid={!!errors.productName}
              className={invalid}
            />
          </Field>
        </div>
        <Footer submit={assistant ? "Update" : "Create"} onSubmit={submit} />
      </DialogContent>
    </Dialog>
  );
}

export function DocumentDialog({ open, onOpenChange }: DialogProps) {
  const [type, setType] = React.useState("url");
  const [file, setFile] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { values, errors, set, validate } = useForm({ url: "", name: "" });
  const [fileError, setFileError] = React.useState<string>();
  function submit() {
    if (type === "url") {
      if (!validate({ url: (v) => (isUrl(v) ? undefined : "Please provide a valid URL for the document") })) return;
    } else if (!file) {
      setFileError("Please select a PDF file");
      return;
    }
    toast.success("Document created successfully");
    onOpenChange(false);
  }
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
          <Field label="Document Type">
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
          </Field>
          {type === "url" ? (
            <Field label="URL" error={errors.url}>
              <Input
                placeholder="Enter the URL of the document"
                value={values.url}
                onChange={set("url")}
                aria-invalid={!!errors.url}
                className={invalid}
              />
            </Field>
          ) : (
            <Field label="PDF File" error={fileError}>
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-dashed p-4",
                  fileError && "border-destructive",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <span className="truncate text-muted-foreground text-xs">{file ?? "Maximum file size: 10MB"}</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.type !== "application/pdf") return setFileError("Please select a valid PDF file");
                    if (f.size > 10 * 1024 * 1024) return setFileError("File size exceeds 10MB limit");
                    setFile(f.name);
                    setFileError(undefined);
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Choose PDF file
                </Button>
              </div>
            </Field>
          )}
          <Field label="Document Name (Optional)">
            <Input placeholder="Enter a name for the document" value={values.name} onChange={set("name")} />
          </Field>
          <AssistantSelect />
        </div>
        <Footer submit="Create" onSubmit={submit} />
      </DialogContent>
    </Dialog>
  );
}

export function FaqDialog({
  open,
  onOpenChange,
  initial,
}: DialogProps & { initial?: { question: string; answer: string } }) {
  const { values, errors, set, validate } = useForm({
    question: initial?.question ?? "",
    answer: initial?.answer ?? "",
  });
  function submit() {
    if (!validate({ question: "Please provide a valid question.", answer: "Please provide a valid answer." })) return;
    toast.success(initial ? "FAQ updated successfully" : "FAQ added successfully");
    onOpenChange(false);
  }
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
          <Field label="Question" error={errors.question}>
            <Input
              placeholder="Enter the question here"
              value={values.question}
              onChange={set("question")}
              aria-invalid={!!errors.question}
              className={invalid}
            />
          </Field>
          <Field label="Answer" error={errors.answer}>
            <Textarea
              placeholder="Enter the answer here"
              value={values.answer}
              onChange={set("answer")}
              aria-invalid={!!errors.answer}
              className={cn("min-h-28", invalid)}
            />
          </Field>
          <AssistantSelect />
        </div>
        <Footer submit={initial ? "Update" : "Create"} onSubmit={submit} />
      </DialogContent>
    </Dialog>
  );
}

interface Param {
  pid: number;
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export function ToolDialog({ open, onOpenChange, tool }: DialogProps & { tool?: Tool }) {
  const [auth, setAuth] = React.useState(tool?.auth ?? "None");
  const { values, errors, set, validate } = useForm({
    title: tool?.title ?? "",
    description: tool?.description ?? "",
    method: tool?.method ?? "GET",
    endpoint: tool?.endpoint ?? "",
  });
  const [params, setParams] = React.useState<Param[]>(
    tool
      ? [
          {
            pid: 1,
            name: tool.endpoint.match(/\{\{\s*(\w+)\s*\}\}/)?.[1] ?? "order_id",
            type: "string",
            description: "Shared by the customer in the conversation",
            required: true,
          },
        ]
      : [],
  );
  const [paramErrors, setParamErrors] = React.useState<number[]>([]);
  function updateParam(pid: number, patch: Partial<Param>) {
    setParams((list) => list.map((item) => (item.pid === pid ? Object.assign({}, item, patch) : item)));
  }

  function submit() {
    const ok = validate({
      title: (v) => {
        if (!v) return "Tool name is required";
        if (v.length > 55) return "Tool name must be 55 characters or fewer";
        return undefined;
      },
      endpoint: (v) => (isUrl(v) ? undefined : "Valid URL is required"),
    });
    const badParams = params.filter((p) => !p.name.trim()).map((p) => p.pid);
    setParamErrors(badParams);
    if (!ok || badParams.length) return;
    toast.success(tool ? "Custom tool updated successfully" : "Custom tool created successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tool ? "Edit Custom Tool" : "Create Custom Tool"}</DialogTitle>
          <DialogDescription>Configure your custom tool to connect with external APIs</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Tool Name" error={errors.title}>
            <Input
              placeholder="Order Lookup"
              value={values.title}
              onChange={set("title")}
              aria-invalid={!!errors.title}
              className={invalid}
            />
          </Field>
          <Field label="Description">
            <Textarea
              placeholder="Looks up order details by order ID"
              value={values.description}
              onChange={set("description")}
              className="min-h-16"
            />
          </Field>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Method">
              <NativeSelect className="w-full" value={values.method} onChange={set("method")}>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </NativeSelect>
            </Field>
            <Field label="Endpoint URL" error={errors.endpoint}>
              <Input
                placeholder="https://api.example.com/orders/{{ order_id }}"
                value={values.endpoint}
                onChange={set("endpoint")}
                aria-invalid={!!errors.endpoint}
                className={cn("font-mono text-xs", invalid)}
              />
            </Field>
          </div>
          <Field label="Authentication Type">
            <NativeSelect className="w-full" value={auth} onChange={(e) => setAuth(e.target.value)}>
              <option>None</option>
              <option>Bearer Token</option>
              <option>Basic Auth</option>
              <option>API Key</option>
            </NativeSelect>
          </Field>
          {auth === "Bearer Token" && (
            <Field label="Bearer Token">
              <Input type="password" placeholder="Enter your bearer token" />
            </Field>
          )}
          {auth === "Basic Auth" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username">
                <Input placeholder="Enter username" />
              </Field>
              <Field label="Password">
                <Input type="password" placeholder="Enter password" />
              </Field>
            </div>
          )}
          {auth === "API Key" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Header Name">
                <Input placeholder="X-API-Key" />
              </Field>
              <Field label="Header Value">
                <Input type="password" placeholder="Enter API key value" />
              </Field>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Parameters</Label>
            <p className="text-muted-foreground text-xs">
              Define the parameters that will be extracted from user queries
            </p>
            {params.map((p) => (
              <div key={p.pid} className="grid gap-2 rounded-lg border p-3">
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <Input
                    placeholder="Parameter name (e.g., order_id)"
                    value={p.name}
                    aria-invalid={paramErrors.includes(p.pid)}
                    className={invalid}
                    onChange={(e) => {
                      updateParam(p.pid, { name: e.target.value });
                      setParamErrors((x) => x.filter((k) => k !== p.pid));
                    }}
                  />
                  <NativeSelect
                    className="w-full"
                    value={p.type}
                    onChange={(e) => updateParam(p.pid, { type: e.target.value })}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array</option>
                    <option value="object">Object</option>
                  </NativeSelect>
                </div>
                {paramErrors.includes(p.pid) && <p className="text-destructive text-xs">Parameter name is required</p>}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Description of the parameter"
                    value={p.description}
                    onChange={(e) => updateParam(p.pid, { description: e.target.value })}
                  />
                  <Label className="flex items-center gap-2 whitespace-nowrap font-normal">
                    <Checkbox
                      checked={p.required}
                      onCheckedChange={(c) => updateParam(p.pid, { required: c === true })}
                    />
                    Required
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove parameter"
                    onClick={() => setParams((x) => x.filter((y) => y.pid !== p.pid))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() =>
                setParams((x) => [
                  ...x,
                  { pid: Date.now(), name: "", type: "string", description: "", required: false },
                ])
              }
            >
              <Plus /> Add Parameter
            </Button>
          </div>
          <Field label="Request Body Template (Optional)">
            <Textarea placeholder={'{\n  "order_id": "{{ order_id }}"\n}'} className="min-h-20 font-mono text-xs" />
          </Field>
          <Field label="Response Template (Optional)">
            <Textarea placeholder="Order {{ order_id }} status: {{ status }}" className="min-h-16 font-mono text-xs" />
          </Field>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() =>
              isUrl(values.endpoint)
                ? toast.success("Connection successful: 200 OK in 182 ms")
                : toast.error("Valid URL is required")
            }
          >
            Test connection
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={submit}>{tool ? "Update" : "Create"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScenarioDialog({ open, onOpenChange, scenario }: DialogProps & { scenario?: Scenario }) {
  const { values, errors, set, validate, setValues } = useForm({
    title: scenario?.title ?? "",
    description: scenario?.description ?? "",
    instruction: scenario?.instruction ?? "",
  });
  const [toolsOpen, setToolsOpen] = React.useState(false);
  function submit() {
    if (
      !validate({
        title: "Scenario name is required",
        description: "Scenario description is required",
        instruction: "Scenario content is required",
      })
    )
      return;
    toast.success(scenario ? "Scenarios updated successfully" : "Scenarios added successfully");
    onOpenChange(false);
  }
  function insertTool(name: string) {
    setValues((p) => ({ ...p, instruction: `${p.instruction.replace(/@$/, "")}[@${name}] ` }));
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scenario ? "Update scenario" : "Create a scenario"}</DialogTitle>
          <DialogDescription>
            Give your assistant some context—like “what to do when a user is stuck,” or “how to act during a refund
            request.”
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title" error={errors.title}>
            <Input
              placeholder="Enter a name for the scenario"
              value={values.title}
              onChange={set("title")}
              aria-invalid={!!errors.title}
              className={invalid}
            />
          </Field>
          <Field label="Description" error={errors.description}>
            <Textarea
              placeholder="Describe how and where this scenario will be used"
              value={values.description}
              onChange={set("description")}
              aria-invalid={!!errors.description}
              className={cn("min-h-16", invalid)}
            />
          </Field>
          <Field label="How to handle" error={errors.instruction}>
            <div className="relative">
              <Textarea
                placeholder="Describe how and where this scenario will be handled"
                value={values.instruction}
                onChange={(e) => {
                  set("instruction")(e);
                  if (e.target.value.endsWith("@")) setToolsOpen(true);
                }}
                aria-invalid={!!errors.instruction}
                className={cn("min-h-24 pb-9", invalid)}
              />
              <DropdownMenu open={toolsOpen} onOpenChange={setToolsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="xs" className="absolute bottom-1.5 left-1.5 text-muted-foreground">
                    <AtSign /> Tools
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Insert a tool</DropdownMenuLabel>
                  {tools.map((t) => (
                    <DropdownMenuItem key={t.id} onSelect={() => insertTool(t.title)}>
                      {t.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-muted-foreground text-xs">Type @ to reference one of your tools.</p>
          </Field>
        </div>
        <Footer submit={scenario ? "Update changes" : "Create"} onSubmit={submit} />
      </DialogContent>
    </Dialog>
  );
}

export function InboxDialog({ open, onOpenChange }: DialogProps) {
  const { values, errors, set, validate } = useForm({ inbox: "" });
  function submit() {
    if (!validate({ inbox: "An inbox selection is required." })) return;
    toast.success("Inbox connected successfully");
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect an Inbox</DialogTitle>
          <DialogDescription>Choose an inbox to connect with the assistant.</DialogDescription>
        </DialogHeader>
        <Field label="Inbox" error={errors.inbox}>
          <NativeSelect
            className={cn("w-full", errors.inbox && "[&_select]:border-destructive")}
            value={values.inbox}
            onChange={set("inbox")}
          >
            <option value="" disabled>
              Choose the inbox to deploy the assistant.
            </option>
            {availableInboxes.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </NativeSelect>
        </Field>
        <Footer submit="Create" onSubmit={submit} />
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
  onConfirm,
  success,
}: DialogProps & {
  title: string;
  description?: string;
  confirm?: string;
  onConfirm?: () => void;
  success?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm?.();
              if (success) toast.success(success);
            }}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
