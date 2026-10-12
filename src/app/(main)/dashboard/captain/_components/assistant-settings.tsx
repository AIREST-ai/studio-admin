"use client";
// Chatwoot: routes/dashboard/captain/assistants/settings/{Index,System,Audience,Schedule}.vue, guardrails/Index.vue,
// guidelines/Index.vue (RuleCard, AddNewRulesInput, SuggestedRules, BulkSelectBar). Each Chatwoot sub-route is a
// Studio route too (/captain/settings/system ...), switched by the tabs under the heading.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ChevronRight,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { exampleGuardrails, exampleGuidelines, guardrails, guidelines } from "./data";
import { ConfirmDialog } from "./dialogs";
import { CaptainShell, RowMenuTrigger, useCurrentAssistant } from "./shared";

export type SettingsSection = "basic" | "system" | "audience" | "schedule" | "guardrails" | "guidelines";

const sections: { value: SettingsSection; label: string; href: string }[] = [
  { value: "basic", label: "Basic settings", href: "/dashboard/captain/settings" },
  { value: "system", label: "System settings", href: "/dashboard/captain/settings/system" },
  { value: "audience", label: "Audience", href: "/dashboard/captain/settings/audience" },
  { value: "schedule", label: "Schedule", href: "/dashboard/captain/settings/schedule" },
  { value: "guardrails", label: "Guardrails", href: "/dashboard/captain/settings/guardrails" },
  { value: "guidelines", label: "Response guidelines", href: "/dashboard/captain/settings/guidelines" },
];

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
      <CardHeader className="border-b">
        <CardTitle className="text-xl leading-none">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
      {footer && (
        <CardFooter className="justify-end border-t">
          <Button size="sm" onClick={() => toast.success("Assistant updated successfully")}>
            Update
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function ChoiceCards({
  value,
  onChange,
  options,
  cols = "md:grid-cols-3",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; desc: string }[];
  cols?: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className={cn("grid gap-2", cols)}>
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
  initial,
  examples,
  examplesTitle,
  placeholder,
  noun,
  addTitle,
  successNoun,
}: {
  title: string;
  description: string;
  initial: string[];
  examples: string[];
  examplesTitle: string;
  placeholder: string;
  noun: string;
  addTitle: string;
  successNoun: string;
}) {
  const [items, setItems] = React.useState(initial);
  const [suggested, setSuggested] = React.useState(examples);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [newRule, setNewRule] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [deleting, setDeleting] = React.useState<string | "bulk" | null>(null);
  const q = query.trim().toLowerCase();
  const rows = items.filter((i) => !q || i.toLowerCase().includes(q));
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r));

  function add(list: string[]) {
    const fresh = list.map((x) => x.trim()).filter((x) => x && !items.includes(x));
    if (!fresh.length) return;
    setItems((p) => [...p, ...fresh]);
    setSuggested((p) => p.filter((x) => !list.includes(x)));
    toast.success(`${successNoun} added successfully`);
  }

  return (
    <Section title={title} description={description} footer={false}>
      {suggested.length > 0 && (
        <div className="grid gap-3 rounded-xl border border-dashed bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-medium text-sm">
              <Lightbulb className="size-4 text-amber-500" /> {examplesTitle}
            </span>
            <Button variant="ghost" size="sm" onClick={() => add(suggested)}>
              Add all
            </Button>
          </div>
          {suggested.map((e) => (
            <div key={e} className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm">
              <span className="flex-1">{e}</span>
              <Button variant="outline" size="xs" onClick={() => add([e])}>
                Add this
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder={placeholder}
              className="bg-background"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  add([draft]);
                  setDraft("");
                }
              }}
            />
            <Button
              variant="outline"
              disabled={!draft.trim()}
              onClick={() => {
                add([draft]);
                setDraft("");
              }}
            >
              Add and save (↵)
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <InputGroup className="h-8 md:w-72">
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
        <div className="flex items-center gap-2">
          {selected.length > 0 ? (
            <>
              <span className="text-muted-foreground text-sm">
                {selected.length} {selected.length === 1 ? "item selected" : "items selected"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? [] : rows)}>
                {allSelected ? `Unselect all (${rows.length})` : `Select all (${rows.length})`}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting("bulk")}>
                <Trash2 /> Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => toast.success(`All ${noun}s passed the test`)}>
                Test all
              </Button>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus /> {addTitle}
              </Button>
            </>
          )}
        </div>
      </div>

      {adding && (
        <div className="grid gap-2 rounded-lg border p-3">
          <Label>{addTitle}</Label>
          <Textarea
            autoFocus
            placeholder={placeholder}
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            className="min-h-16"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(false);
                setNewRule("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newRule.trim()}
              onClick={() => {
                add([newRule]);
                setNewRule("");
                setAdding(false);
              }}
            >
              Create
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        {rows.length ? (
          rows.map((r) => (
            <div
              key={r}
              className="flex items-start gap-3 border-b p-3 text-sm last:border-b-0 data-[state=selected]:bg-muted/50"
              data-state={selected.includes(r) ? "selected" : undefined}
            >
              <Checkbox
                className="mt-0.5"
                aria-label={`Select ${r}`}
                checked={selected.includes(r)}
                onCheckedChange={(c) => setSelected((p) => (c ? [...p, r] : p.filter((x) => x !== r)))}
              />
              {editing === r ? (
                <div className="grid flex-1 gap-2">
                  <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-14" />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="xs" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      disabled={!editText.trim()}
                      onClick={() => {
                        setItems((p) => p.map((x) => (x === r ? editText.trim() : x)));
                        setEditing(null);
                        toast.success(`${successNoun} updated successfully`);
                      }}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="flex-1 leading-relaxed">{r}</span>
              )}
              <DropdownMenu>
                <RowMenuTrigger label={`Open actions for ${r}`} />
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(r);
                      setEditText(r);
                    }}
                  >
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(r)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground text-sm">
            {q ? `No ${noun}s found for this search.` : `No ${noun}s found. Create or add examples to begin.`}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting === "bulk" ? `Delete ${noun}s?` : `Are you sure to delete the ${noun}?`}
        description={
          deleting === "bulk"
            ? `Are you sure you want to delete the selected ${noun}s? This action cannot be undone.`
            : undefined
        }
        confirm={deleting === "bulk" ? "Yes, delete all" : "Yes, delete"}
        success={`${successNoun} deleted successfully`}
        onConfirm={() => {
          const target = deleting;
          if (target === "bulk") {
            setItems((p) => p.filter((x) => !selected.includes(x)));
            setSelected([]);
          } else if (target) setItems((p) => p.filter((x) => x !== target));
        }}
      />
    </Section>
  );
}

const attributeGroups = [
  { label: "Contact attributes", options: ["Browser language", "Country", "City", "Company", "Logged-in user"] },
  { label: "Conversation", options: ["First message language", "Inbox", "Labels"] },
  { label: "Custom attributes", options: ["Plan type", "Customer since"] },
];

interface Condition {
  cid: number;
  attribute: string;
  operator: string;
  value: string;
}

function AudienceSection() {
  const [audience, setAudience] = React.useState("specific");
  const [match, setMatch] = React.useState("all");
  const [conditions, setConditions] = React.useState<Condition[]>([
    { cid: 1, attribute: "Browser language", operator: "Equal to", value: "Arabic" },
    { cid: 2, attribute: "Country", operator: "Equal to", value: "Qatar" },
  ]);
  const [groups, setGroups] = React.useState<number[]>([]);
  const [error, setError] = React.useState(false);

  function patch(cid: number, field: keyof Condition, value: string) {
    setConditions((list) => list.map((c) => (c.cid === cid ? Object.assign({}, c, { [field]: value }) : c)));
  }

  const row = (c: Condition) => (
    <div key={c.cid} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
      <NativeSelect
        size="sm"
        className="w-full"
        value={c.attribute}
        onChange={(e) => patch(c.cid, "attribute", e.target.value)}
      >
        {attributeGroups.map((g) => (
          <NativeSelectOptGroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <NativeSelectOption key={o} value={o}>
                {o}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        className="w-full"
        value={c.operator}
        onChange={(e) => patch(c.cid, "operator", e.target.value)}
      >
        <option>Equal to</option>
        <option>Not equal to</option>
        <option>Contains</option>
      </NativeSelect>
      {c.attribute === "Logged-in user" ? (
        <NativeSelect
          size="sm"
          className="w-full"
          value={c.value}
          onChange={(e) => patch(c.cid, "value", e.target.value)}
        >
          <option>Yes</option>
          <option>No</option>
        </NativeSelect>
      ) : (
        <Input className="h-8" value={c.value} onChange={(e) => patch(c.cid, "value", e.target.value)} />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove condition"
        onClick={() => setConditions((list) => list.filter((x) => x.cid !== c.cid))}
      >
        <Trash2 />
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl leading-none">Audience</CardTitle>
        <CardDescription>
          Choose whether this assistant responds to everyone or only to a specific audience.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ChoiceCards
          value={audience}
          onChange={setAudience}
          cols="md:grid-cols-2"
          options={[
            {
              value: "everyone",
              label: "Everyone",
              desc: "Captain responds to every conversation in connected inboxes.",
            },
            {
              value: "specific",
              label: "Specific audience",
              desc: "Captain responds only to customers who match the conditions below.",
            },
          ]}
        />
        {audience === "specific" && (
          <div className="grid gap-3 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm">
              Match
              <NativeSelect size="sm" value={match} onChange={(e) => setMatch(e.target.value)}>
                <option value="all">all</option>
                <option value="any">any</option>
              </NativeSelect>
              of the following
            </div>
            {conditions.length === 0 && groups.length === 0 ? (
              <div className="grid gap-1 rounded-md border border-dashed p-4 text-center">
                <span className="font-medium text-sm">No conditions yet</span>
                <span className="text-muted-foreground text-xs">
                  Add a condition to target specific customers, or a condition group to combine conditions with
                  different and/or logic.
                </span>
              </div>
            ) : (
              conditions.map(row)
            )}
            {groups.map((g) => (
              <div key={g} className="grid gap-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    Match
                    <NativeSelect size="sm" defaultValue="any">
                      <option value="all">all</option>
                      <option value="any">any</option>
                    </NativeSelect>
                    of the following
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove condition group"
                    onClick={() => setGroups((p) => p.filter((x) => x !== g))}
                  >
                    <X />
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
                  <NativeSelect size="sm" className="w-full" defaultValue="First message language">
                    {attributeGroups.map((gr) => (
                      <NativeSelectOptGroup key={gr.label} label={gr.label}>
                        {gr.options.map((o) => (
                          <NativeSelectOption key={o} value={o}>
                            {o}
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    ))}
                  </NativeSelect>
                  <NativeSelect size="sm" className="w-full" defaultValue="Equal to">
                    <option>Equal to</option>
                    <option>Not equal to</option>
                  </NativeSelect>
                  <Input className="h-8" defaultValue="English" />
                </div>
              </div>
            ))}
            {error && <p className="text-destructive text-xs">Add at least one condition for a specific audience.</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(false);
                  setConditions((list) => [
                    ...list,
                    { cid: Date.now(), attribute: "Browser language", operator: "Equal to", value: "" },
                  ]);
                }}
              >
                <Plus /> Add condition
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(false);
                  setGroups((p) => [...p, Date.now()]);
                }}
              >
                Add condition group
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button
          size="sm"
          onClick={() => {
            if (audience === "specific" && conditions.length === 0 && groups.length === 0) {
              setError(true);
              return;
            }
            toast.success("Assistant updated successfully");
          }}
        >
          Update
        </Button>
      </CardFooter>
    </Card>
  );
}

export function AssistantSettings({ section = "basic" }: { section?: SettingsSection }) {
  const assistant = useCurrentAssistant();
  const [mode, setMode] = React.useState("evaluated");
  const [schedule, setSchedule] = React.useState("always");
  const [sendOnResolve, setSendOnResolve] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);

  return (
    <CaptainShell title="Settings" subtitle="Name, messages, audience, schedule and the rules your assistant follows.">
      <Tabs value={section}>
        <TabsList className="h-auto flex-wrap">
          {sections.map((s) => (
            <TabsTrigger key={s.value} value={s.value} asChild>
              <Link href={s.href}>{s.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {section === "basic" && (
        <div className="grid gap-4">
          <Section
            title="Basic settings"
            description="Customize what the assistant says when ending a conversation or transferring to a human."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input key={`n${assistant.id}`} placeholder="Enter assistant name" defaultValue={assistant.name} />
              </div>
              <div className="grid gap-2">
                <Label>Product Name</Label>
                <Input key={`p${assistant.id}`} placeholder="Enter product name" defaultValue={assistant.productName} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                key={`d${assistant.id}`}
                placeholder="Enter assistant description"
                defaultValue={assistant.description}
              />
            </div>
            <Separator />
            <div className="grid gap-3">
              <span className="font-medium text-sm">Features</span>
              {(
                [
                  ["Generate FAQs from resolved conversations", true],
                  ["Capture key details as memories from customer interactions.", true],
                  ["Include source citations in responses", false],
                  ["Allow access to contact information", true],
                ] as const
              ).map(([label, on]) => (
                <Label key={label} className="justify-between font-normal">
                  {label}
                  <Switch defaultChecked={on} />
                </Label>
              ))}
            </div>
          </Section>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-xl leading-none">The Fun Stuff</CardTitle>
              <CardDescription>Add more control to the assistant.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: "Guardrails",
                  desc: "Keeps things on track—only the kinds of questions you want your assistant to answer, nothing off-limits or off-topic.",
                  href: "/dashboard/captain/settings/guardrails",
                },
                {
                  icon: MessageSquareQuote,
                  title: "Response guidelines",
                  desc: "The vibe and structure of your assistant’s replies—clear and friendly? Short and snappy? Detailed and formal?",
                  href: "/dashboard/captain/settings/guidelines",
                },
              ].map((c) => (
                <Link
                  key={c.title}
                  href={c.href}
                  className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <c.icon className="size-4" />
                  </div>
                  <div className="grid flex-1 gap-1">
                    <span className="font-medium text-sm">{c.title}</span>
                    <span className="text-muted-foreground text-xs leading-snug">{c.desc}</span>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
              <Link
                href="/dashboard/captain/scenarios"
                className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 md:col-span-2"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <ListChecks className="size-4" />
                </div>
                <div className="grid flex-1 gap-1">
                  <span className="font-medium text-sm">Scenarios</span>
                  <span className="text-muted-foreground text-xs leading-snug">
                    Give your assistant some context—like “what to do when a user is stuck,” or “how to act during a
                    refund request.”
                  </span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

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
        </div>
      )}

      {section === "system" && (
        <Section
          title="System settings"
          description="Manage what Captain does when customers stop replying and set the handoff message."
        >
          <div className="grid gap-2">
            <Label>Welcome Message</Label>
            <Textarea
              placeholder="Enter welcome message"
              defaultValue="Hi! I'm Noor, the Home Fibre assistant. Ask me about plans, bills, roaming or your installation."
            />
          </div>
          <div className="grid gap-2">
            <Label>Handoff message</Label>
            <Textarea
              placeholder="Enter handoff message"
              defaultValue="I'm passing you to one of our team members now. They'll reply here shortly."
            />
          </div>
          <div className="grid gap-2">
            <Label>Instructions</Label>
            <Textarea
              placeholder="Enter instructions for the assistant"
              className="min-h-24"
              defaultValue="You help home customers in Qatar with fibre plans, bills, roaming and installations. Use QAR for prices. Hand billing disputes to the team."
            />
          </div>
          <Separator />
          <div className="grid gap-1">
            <span className="font-medium text-sm">When customers stop replying</span>
            <span className="text-muted-foreground text-xs">Choose how Captain handles the conversation.</span>
          </div>
          <ChoiceCards
            value={mode}
            onChange={setMode}
            options={[
              {
                value: "disabled",
                label: "Wait for the customer",
                desc: "Captain does not resolve the conversation. Captain can still hand it off if the customer asks.",
              },
              {
                value: "legacy",
                label: "Always resolve",
                desc: "Captain resolves every conversation after the selected time.",
              },
              {
                value: "evaluated",
                label: "Let Captain review it (recommended)",
                desc: "Captain decides whether to resolve the conversation or hand it off.",
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
                Captain will resolve every conversation after the selected time without reviewing it. Some conversations
                that still need help may be closed.
              </AlertDescription>
            </Alert>
          )}
          {mode === "disabled" && (
            <p className="text-muted-foreground text-sm">
              The conversation remains pending until the customer replies.
            </p>
          )}
          {mode !== "disabled" && (
            <>
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="grid gap-1">
                  <span className="font-medium text-sm">Send a message when resolving</span>
                  <span className="text-muted-foreground text-xs">
                    Captain sends this closing message before it resolves the conversation.
                  </span>
                </div>
                <Switch checked={sendOnResolve} onCheckedChange={setSendOnResolve} />
              </div>
              {sendOnResolve && (
                <div className="grid gap-2">
                  <Label>Resolution Message</Label>
                  <Textarea
                    placeholder="Enter resolution message"
                    defaultValue="Glad I could help! I'll close this chat now. Message us anytime if you need anything else."
                  />
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {section === "audience" && <AudienceSection />}

      {section === "schedule" && (
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
      )}

      {section === "guardrails" && (
        <RuleList
          title="Guardrails"
          description="Keeps things on track—only the kinds of questions you want your assistant to answer, nothing off-limits or off-topic."
          initial={guardrails}
          examples={exampleGuardrails}
          examplesTitle="Example guardrails"
          placeholder="Type in another guardrail..."
          noun="guardrail"
          addTitle="Add a guardrail"
          successNoun="Guardrails"
        />
      )}

      {section === "guidelines" && (
        <RuleList
          title="Response Guidelines"
          description="The vibe and structure of your assistant’s replies—clear and friendly? Short and snappy? Detailed and formal?"
          initial={guidelines}
          examples={exampleGuidelines}
          examplesTitle="Example response guidelines"
          placeholder="Type in another response guideline..."
          noun="response guideline"
          addTitle="Add a response guideline"
          successNoun="Response guidelines"
        />
      )}

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Are you sure to delete the assistant?"
        description="This action is permanent. Deleting this assistant will remove it from all connected inboxes and permanently erase all generated knowledge."
        success="Assistant deleted successfully"
      />
    </CaptainShell>
  );
}
