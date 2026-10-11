"use client";
import * as React from "react";

import { Calendar, CheckSquare, Hash, Link2, List, Pencil, Plus, Trash2, Type } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";

type Model = "conversation" | "contact" | "company";
type AttrType = "Text" | "Number" | "Link" | "Date" | "List" | "Checkbox";

interface Attribute {
  name: string;
  attrKey: string;
  description: string;
  type: AttrType;
  model: Model;
  badges?: ("Pre-chat" | "Resolution")[];
  values?: string[];
}

const attributes: Attribute[] = [
  { name: "Order number", attrKey: "order_number", description: "Order reference from the online store", type: "Text", model: "conversation", badges: ["Pre-chat"] },
  { name: "Delivery city", attrKey: "delivery_city", description: "City where the order is delivered", type: "List", model: "conversation", values: ["Doha", "Al Wakrah", "Lusail", "Dubai", "Riyadh"] },
  { name: "Resolution reason", attrKey: "resolution_reason", description: "Why the conversation was closed", type: "List", model: "conversation", badges: ["Resolution"], values: ["Refund issued", "Replaced item", "Information only"] },
  { name: "Refund amount (QAR)", attrKey: "refund_amount_qar", description: "Amount refunded to the customer", type: "Number", model: "conversation" },
  { name: "Callback requested", attrKey: "callback_requested", description: "Customer asked for a phone call back", type: "Checkbox", model: "conversation" },
  { name: "Subscription plan", attrKey: "subscription_plan", description: "Current plan of the customer", type: "List", model: "contact", values: ["Basic", "Plus", "Family"] },
  { name: "First purchase date", attrKey: "first_purchase_date", description: "Date of the first order", type: "Date", model: "contact" },
  { name: "Qatar ID verified", attrKey: "qid_verified", description: "Identity checked by the branch team", type: "Checkbox", model: "contact" },
  { name: "Loyalty points", attrKey: "loyalty_points", description: "Points balance in the rewards program", type: "Number", model: "contact" },
  { name: "Preferred language", attrKey: "preferred_language", description: "Language the contact wants replies in", type: "List", model: "contact", badges: ["Pre-chat"], values: ["Arabic", "English"] },
  { name: "Commercial registration", attrKey: "cr_number", description: "CR number of the company", type: "Text", model: "company" },
  { name: "Website", attrKey: "company_website", description: "Main website of the company", type: "Link", model: "company" },
  { name: "Contract renewal", attrKey: "contract_renewal", description: "Next renewal date of the service contract", type: "Date", model: "company" },
];

const typeIcon: Record<AttrType, React.ElementType> = {
  Text: Type,
  Number: Hash,
  Link: Link2,
  Date: Calendar,
  List,
  Checkbox: CheckSquare,
};

function AttributeDialog({
  open,
  onOpenChange,
  attribute,
  model,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attribute?: Attribute;
  model: Model;
}) {
  const [type, setType] = React.useState<string>(attribute?.type ?? "");
  const [regex, setRegex] = React.useState(false);
  React.useEffect(() => setType(attribute?.type ?? ""), [attribute]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{attribute ? "Edit Custom Attribute" : "Add Custom Attribute"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Applies to</Label>
            <NativeSelect className="w-full" defaultValue={attribute?.model ?? model} disabled={!!attribute}>
              <option value="conversation">Conversation</option>
              <option value="contact">Contact</option>
              <option value="company">Company</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attr-name">Display Name</Label>
            <Input id="attr-name" placeholder="Enter custom attribute display name" defaultValue={attribute?.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attr-code">Key</Label>
            <Input
              id="attr-code"
              placeholder="Enter custom attribute key"
              defaultValue={attribute?.attrKey}
              disabled={!!attribute}
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attr-desc">Description</Label>
            <Textarea
              id="attr-desc"
              placeholder="Enter custom attribute description"
              defaultValue={attribute?.description}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <NativeSelect
              className="w-full"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={!!attribute}
            >
              <option value="" disabled>
                Please select a type
              </option>
              {Object.keys(typeIcon).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </div>
          {type === "List" ? (
            <div className="grid gap-2">
              <Label>List Values</Label>
              <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
                {(attribute?.values ?? ["Doha", "Dubai"]).map((v) => (
                  <Badge key={v} variant="secondary">
                    {v}
                  </Badge>
                ))}
                <input
                  className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Please enter value and press enter key"
                />
              </div>
            </div>
          ) : null}
          {type === "Text" ? (
            <>
              <div className="flex items-center gap-2">
                <Checkbox id="attr-regex" checked={regex} onCheckedChange={(c) => setRegex(c === true)} />
                <Label htmlFor="attr-regex" className="font-normal">
                  Enable regex validation
                </Label>
              </div>
              {regex ? (
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>Regex Pattern</Label>
                    <Input className="font-mono" placeholder="Please enter custom attribute regex pattern. (Optional)" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Regex Cue</Label>
                    <Input placeholder="Please enter regex pattern hint. (Optional)" />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{attribute ? "Update" : "Create"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttributesSettings() {
  const [model, setModel] = React.useState<Model>("conversation");
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Attribute | undefined>();
  const [deleting, setDeleting] = React.useState<Attribute | undefined>();

  const q = query.trim().toLowerCase();
  const rows = attributes.filter(
    (a) => a.model === model && `${a.name} ${a.attrKey} ${a.description}`.toLowerCase().includes(q),
  );

  return (
    <>
      <SettingsShell
        title="Custom Attributes"
        description="A custom attribute tracks additional details about your contacts, companies, or conversations—such as the subscription plan or the date of their first purchase. You can add different types of custom attributes, such as text, lists, or numbers, to capture the specific information you need."
        learnMore="Learn more about custom attributes"
        count={plural(rows.length, "attribute", "attributes")}
        search={{ placeholder: "Search attributes...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add Custom Attribute
          </Button>
        }
      >
        <div className="px-6 pt-4 pb-2">
          <Tabs value={model} onValueChange={(v) => setModel(v as Model)}>
            <TabsList>
              <TabsTrigger value="conversation">Conversation</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="py-3 font-normal">Description</TableHead>
                <TableHead className="py-3 font-normal">Type</TableHead>
                <TableHead className="py-3 font-normal">Key</TableHead>
                <TableHead className="w-24 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((attr) => {
                const Icon = typeIcon[attr.type];
                return (
                  <TableRow key={attr.attrKey} className="border-border/60">
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{attr.name}</span>
                        {attr.badges?.map((b) => (
                          <Badge key={b} variant="outline" className="font-normal text-muted-foreground">
                            {b}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-sm truncate py-3.5 text-muted-foreground">{attr.description}</TableCell>
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="size-3.5 text-muted-foreground" />
                        {attr.type}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{attr.attrKey}</code>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(attr)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(attr)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <NoResults>{q ? "No attributes found matching your search" : "There are no custom attributes created"}</NoResults>
        )}
      </SettingsShell>

      <AttributeDialog open={adding} onOpenChange={setAdding} model={model} />
      <AttributeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        attribute={editing}
        model={model}
      />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Are you sure want to delete - ${deleting?.name ?? ""}`}
        message="Deleting will remove the custom attribute"
        yes={`Delete ${deleting?.name ?? ""}`}
        no="Cancel"
      />
    </>
  );
}
