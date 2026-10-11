"use client";
import * as React from "react";

import { cn } from "cn";
import { Lightbulb, Plus, Search, Trash2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { assistants, exampleGuardrails, exampleGuidelines, guardrails, guidelines } from "./data";
import { ConfirmDialog } from "./dialogs";
import { AssistantSwitcher } from "./shared";

const assistant = assistants[0];

function Section({
  title,
  description,
  children,
  footer = true,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
      {footer && (
        <CardFooter className="justify-end border-t">
          <Button size="sm">Update</Button>
        </CardFooter>
      )}
    </Card>
  );
}

function ChoiceCards({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; desc: string }[];
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid gap-2 md:grid-cols-3">
      {options.map((o) => (
        <Label
          key={o.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
            value === o.value && "border-primary bg-primary/5",
          )}
        >
          <RadioGroupItem value={o.value} className="mt-0.5" />
          <div className="grid gap-1">
            <span className="font-medium text-sm">{o.label}</span>
            <span className="text-muted-foreground text-xs leading-snug">{o.desc}</span>
          </div>
        </Label>
      ))}
    </RadioGroup>
  );
}

function RuleList({
  title,
  description,
  items,
  examples,
  examplesTitle,
  placeholder,
}: {
  title: string;
  description: string;
  items: string[];
  examples: string[];
  examplesTitle: string;
  placeholder: string;
}) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<number[]>([]);
  const rows = items.filter((i) => !query || i.toLowerCase().includes(query.toLowerCase()));
  return (
    <Section title={title} description={description} footer={false}>
      <div className="grid gap-3 rounded-xl border border-dashed bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-medium text-sm">
            <Lightbulb className="size-4 text-amber-500" /> {examplesTitle}
          </span>
          <Button variant="ghost" size="sm">
            Add all
          </Button>
        </div>
        {examples.map((e) => (
          <div key={e} className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm">
            <span className="flex-1">{e}</span>
            <Button variant="outline" size="xs">
              Add this
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input placeholder={placeholder} className="bg-background" />
          <Button variant="outline">Add and save (↵)</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InputGroup className="h-8 md:w-72">
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
        {selected.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {selected.length} {selected.length === 1 ? "item selected" : "items selected"}
            </span>
            <Button variant="destructive" size="sm">
              <Trash2 /> Delete
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm">
            Test all
          </Button>
        )}
      </div>
      <div className="grid gap-2">
        {rows.length ? (
          rows.map((r, idx) => (
            <Label key={r} className="items-start gap-3 rounded-lg border p-3 font-normal text-sm">
              <Checkbox
                className="mt-0.5"
                checked={selected.includes(idx)}
                onCheckedChange={(c) => setSelected((p) => (c ? [...p, idx] : p.filter((x) => x !== idx)))}
              />
              {r}
            </Label>
          ))
        ) : (
          <p className="py-6 text-center text-muted-foreground text-sm">No results found for this search.</p>
        )}
      </div>
    </Section>
  );
}

export function AssistantSettings() {
  const [mode, setMode] = React.useState("evaluated");
  const [audience, setAudience] = React.useState("specific");
  const [schedule, setSchedule] = React.useState("always");
  const [deleting, setDeleting] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="font-semibold text-xl">Settings</h1>
        <AssistantSwitcher />
      </div>
      <Tabs defaultValue="basic" className="gap-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="basic">Basic settings</TabsTrigger>
          <TabsTrigger value="system">System settings</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
          <TabsTrigger value="guidelines">Response guidelines</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="grid gap-4">
          <Section
            title="Basic settings"
            description="Customize what the assistant says when ending a conversation or transferring to a human."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input placeholder="Enter assistant name" defaultValue={assistant.name} />
              </div>
              <div className="grid gap-2">
                <Label>Product Name</Label>
                <Input placeholder="Enter product name" defaultValue={assistant.productName} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea placeholder="Enter assistant description" defaultValue={assistant.description} />
            </div>
            <Separator />
            <div className="grid gap-3">
              <span className="font-medium text-sm">Features</span>
              {[
                ["Generate FAQs from resolved conversations", true],
                ["Capture key details as memories from customer interactions.", true],
                ["Include source citations in responses", false],
                ["Allow access to contact information", true],
              ].map(([label, on]) => (
                <Label key={String(label)} className="justify-between font-normal">
                  {label}
                  <Switch defaultChecked={Boolean(on)} />
                </Label>
              ))}
            </div>
          </Section>
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Delete Assistant</CardTitle>
              <CardDescription>
                This action is permanent. Deleting this assistant will remove it from all connected inboxes and
                permanently erase all generated knowledge.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
                <Trash2 /> Delete {assistant.name}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Section
            title="System settings"
            description="Manage what Captain does when customers stop replying and set the handoff message."
          >
            <div className="grid gap-1">
              <span className="font-medium text-sm">When customers stop replying</span>
              <span className="text-muted-foreground text-xs">Choose how Captain handles the conversation.</span>
            </div>
            <ChoiceCards
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: "evaluated",
                  label: "Let Captain review it (recommended)",
                  desc: "Captain decides whether to resolve the conversation or hand it off.",
                },
                {
                  value: "legacy",
                  label: "Always resolve",
                  desc: "Captain resolves every conversation after the selected time.",
                },
                {
                  value: "disabled",
                  label: "Wait for the customer",
                  desc: "Captain does not resolve the conversation. Captain can still hand it off if the customer asks.",
                },
              ]}
            />
            {mode !== "disabled" && (
              <div className="flex items-center gap-2">
                <Label className="w-28 font-normal">{mode === "legacy" ? "Resolve after" : "Review after"}</Label>
                <NativeSelect size="sm" defaultValue="1">
                  {[0, 1, 2, 4, 8, 24].map((h) => (
                    <option key={h} value={h}>
                      {h} h
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect size="sm" defaultValue="30">
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
            {mode === "legacy" && (
              <Alert>
                <TriangleAlert className="size-4" />
                <AlertDescription>
                  Captain will resolve every conversation after the selected time without reviewing it. Some
                  conversations that still need help may be closed.
                </AlertDescription>
              </Alert>
            )}
            {mode === "disabled" && (
              <p className="text-muted-foreground text-sm">The conversation remains pending until the customer replies.</p>
            )}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-1">
                <span className="font-medium text-sm">Send a message when resolving</span>
                <span className="text-muted-foreground text-xs">
                  Captain sends this closing message before it resolves the conversation.
                </span>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="grid gap-2">
              <Label>Resolution Message</Label>
              <Textarea
                placeholder="Enter resolution message"
                defaultValue="Glad I could help! I'll close this chat now. Message us anytime if you need anything else."
              />
            </div>
            <div className="grid gap-2">
              <Label>Handoff message</Label>
              <Textarea
                placeholder="Enter handoff message"
                defaultValue="I'm passing you to one of our team members now. They'll reply here shortly."
              />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="audience">
          <Section
            title="Audience"
            description="Choose whether this assistant responds to everyone or only to a specific audience."
          >
            <RadioGroup value={audience} onValueChange={setAudience} className="grid gap-2 md:grid-cols-2">
              {[
                ["everyone", "Everyone", "Captain responds to every conversation in connected inboxes."],
                ["specific", "Specific audience", "Captain responds only to customers who match the conditions below."],
              ].map(([v, l, d]) => (
                <Label
                  key={v}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
                    audience === v && "border-primary bg-primary/5",
                  )}
                >
                  <RadioGroupItem value={v} className="mt-0.5" />
                  <div className="grid gap-1">
                    <span className="font-medium text-sm">{l}</span>
                    <span className="text-muted-foreground text-xs">{d}</span>
                  </div>
                </Label>
              ))}
            </RadioGroup>
            {audience === "specific" && (
              <div className="grid gap-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm">
                  Match
                  <NativeSelect size="sm" defaultValue="all">
                    <option value="all">all</option>
                    <option value="any">any</option>
                  </NativeSelect>
                  of the following
                </div>
                {[
                  ["Browser language", "Equal to", "Arabic"],
                  ["Country", "Equal to", "Qatar"],
                ].map(([a, op, v]) => (
                  <div key={a} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <NativeSelect size="sm" className="w-full" defaultValue={a}>
                      <option>Browser language</option>
                      <option>First message language</option>
                      <option>Logged-in user</option>
                      <option>Country</option>
                    </NativeSelect>
                    <NativeSelect size="sm" className="w-full" defaultValue={op}>
                      <option>Equal to</option>
                      <option>Not equal to</option>
                    </NativeSelect>
                    <Input className="h-8" defaultValue={v} />
                    <Button variant="ghost" size="icon-sm" aria-label="Remove condition">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Plus /> Add condition
                  </Button>
                  <Button variant="ghost" size="sm">
                    Add condition group
                  </Button>
                </div>
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="schedule">
          <Section
            title="Schedule"
            description="Choose when Captain replies. Outside this window, conversations are handed to your team."
          >
            <ChoiceCards
              value={schedule}
              onChange={setSchedule}
              options={[
                {
                  value: "always",
                  label: "Anytime",
                  desc: "Captain responds to every conversation, regardless of time.",
                },
                {
                  value: "business",
                  label: "During business hours",
                  desc: "Captain responds only within each inbox's business hours.",
                },
                {
                  value: "outside",
                  label: "Outside business hours",
                  desc: "Captain responds only when each inbox is closed.",
                },
              ]}
            />
            <p className="text-muted-foreground text-xs">Inboxes without business hours configured are always covered.</p>
          </Section>
        </TabsContent>

        <TabsContent value="guardrails">
          <RuleList
            title="Guardrails"
            description="Keeps things on track—only the kinds of questions you want your assistant to answer, nothing off-limits or off-topic."
            items={guardrails}
            examples={exampleGuardrails}
            examplesTitle="Example guardrails"
            placeholder="Type in another guardrail..."
          />
        </TabsContent>

        <TabsContent value="guidelines">
          <RuleList
            title="Response Guidelines"
            description="The vibe and structure of your assistant’s replies—clear and friendly? Short and snappy? Detailed and formal?"
            items={guidelines}
            examples={exampleGuidelines}
            examplesTitle="Example response guidelines"
            placeholder="Type in another response guideline..."
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Are you sure to delete the assistant?"
        description="This action is permanent. Deleting this assistant will remove it from all connected inboxes and permanently erase all generated knowledge."
      />
    </div>
  );
}
