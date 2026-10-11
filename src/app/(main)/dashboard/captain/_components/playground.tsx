"use client";
import * as React from "react";

import { cn } from "cn";
import { Bot, ChevronDown, Eraser, PanelRight, RotateCcw, SendHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { guardrails, guidelines, scenarios } from "./data";
import { AssistantSwitcher } from "./shared";

interface Msg {
  role: "user" | "assistant";
  text: string;
  run?: { ms: number; handler: string; events: string[] };
}

const initialMessages: Msg[] = [
  { role: "user", text: "My internet stopped working since this morning. I live in Al Sadd, zone 38." },
  {
    role: "assistant",
    text: "Sorry about that! I checked zone 38 and there is no known outage right now. Could you please restart your router by unplugging it for 30 seconds? Tell me once it is back on.",
    run: { ms: 1240, handler: "Internet is down", events: ["Outage Check → no outage in zone 38"] },
  },
  { role: "user", text: "I did that, still no internet. The light is red." },
  {
    role: "assistant",
    text: "Thanks for trying. A red light usually means the fibre line needs a technician. I can hand you to our team to book a visit. Would you like that?",
    run: { ms: 980, handler: "Internet is down", events: ["Internet is down → Handoff"] },
  },
];

function SavedList({ items, summary }: { items: string[]; summary: string }) {
  return (
    <Collapsible defaultOpen className="grid gap-2">
      <CollapsibleTrigger className="flex items-center justify-between font-medium text-sm">
        {summary} <ChevronDown className="size-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-2">
        {items.map((i) => (
          <Label key={i} className="items-start gap-2 rounded-lg border p-2.5 font-normal text-sm leading-snug">
            <Checkbox defaultChecked className="mt-0.5" /> {i}
          </Label>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TempComposer({ title, hint, placeholder }: { title: string; hint: string; placeholder: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="outline" className="font-normal text-[10px]">
          Temporary
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <Textarea placeholder={placeholder} className="min-h-14 text-sm" />
      <Button variant="outline" size="xs" className="w-fit">
        Add to test (↵)
      </Button>
    </div>
  );
}

export function Playground() {
  const [messages, setMessages] = React.useState(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [setupOpen, setSetupOpen] = React.useState(true);

  function send() {
    if (!draft.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: draft },
      {
        role: "assistant",
        text: "This is a preview of the playground. In the live product Captain would answer here using your saved knowledge.",
        run: { ms: 860, handler: "Noor", events: [] },
      },
    ]);
    setDraft("");
  }

  return (
    <div className={cn("grid gap-4", setupOpen && "xl:grid-cols-[1fr_380px]")}>
      <Card className="h-[calc(100svh-9rem)] min-h-[560px] gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl leading-none">Playground</CardTitle>
              <AssistantSwitcher />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
                <Eraser /> Clear conversation
              </Button>
              <Button
                variant={setupOpen ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Toggle test setup"
                onClick={() => setSetupOpen((v) => !v)}
              >
                <PanelRight />
              </Button>
            </div>
          </div>
          <CardDescription>
            Use this playground to send messages to your assistant and check if it responds accurately, quickly, and in
            the tone you expect.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="m-auto text-center text-muted-foreground text-sm">Type your message...</div>
          )}
          {messages.map((m, idx) => (
            <div
              key={`${idx}-${m.role}`}
              className={cn("flex max-w-[80%] gap-2", m.role === "user" ? "self-end flex-row-reverse" : "self-start")}
            >
              {m.role === "assistant" && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </div>
              )}
              <div className="grid gap-1">
                <span className={cn("text-muted-foreground text-xs", m.role === "user" && "text-right")}>
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted",
                  )}
                >
                  {m.text}
                </div>
                {m.run && (
                  <Collapsible>
                    <CollapsibleTrigger className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground">
                      Run details · {m.run.ms}ms <ChevronDown className="size-3" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 grid gap-1 rounded-lg border p-2 text-xs">
                      <span>Handled by: {m.run.handler}</span>
                      <span className="text-muted-foreground">
                        {m.run.events.length ? m.run.events.join(" · ") : "No tool calls or scenario handoffs were recorded."}
                      </span>
                      <Badge variant="secondary" className="w-fit font-normal">
                        Completed
                      </Badge>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </div>
          ))}
        </CardContent>
        <div className="grid gap-2 border-t p-4">
          <InputGroup>
            <InputGroupTextarea
              placeholder="Type your message..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="min-h-12"
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <span className="text-muted-foreground text-xs">Messages sent here will count toward your Captain credits.</span>
              <InputGroupButton size="icon-sm" variant="default" aria-label="Send message" onClick={send}>
                <SendHorizontal />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </Card>

      {setupOpen && (
        <Card className="gap-0 py-0 xl:h-[calc(100svh-9rem)] xl:min-h-[560px]">
          <CardHeader className="border-b py-4">
            <div className="flex items-center justify-between">
              <CardTitle>Test setup</CardTitle>
              <Button variant="ghost" size="sm">
                <RotateCcw /> Reset test setup
              </Button>
            </div>
            <CardDescription>
              Changes here apply only to this playground session unless you explicitly save an item.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4">
            <Tabs defaultValue="scenarios" className="gap-4">
              <TabsList className="w-full">
                <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
                <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
                <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
                <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
              </TabsList>
              <TabsContent value="scenarios" className="grid gap-4">
                <TempComposer
                  title="Add a temporary scenario"
                  hint="Try a new behavior without changing the assistant configuration."
                  placeholder="Type a temporary scenario title..."
                />
                <SavedList summary={`Existing scenarios (${scenarios.length})`} items={scenarios.map((s) => s.title)} />
              </TabsContent>
              <TabsContent value="guidelines" className="grid gap-4">
                <TempComposer
                  title="Add a temporary guideline"
                  hint="Test a response preference before adding it to the assistant."
                  placeholder="Type a temporary guideline..."
                />
                <SavedList summary={`Existing guidelines (${guidelines.length})`} items={guidelines} />
              </TabsContent>
              <TabsContent value="guardrails" className="grid gap-4">
                <TempComposer
                  title="Add a temporary guardrail"
                  hint="Test a safety boundary before adding it to the assistant."
                  placeholder="Type a temporary guardrail..."
                />
                <SavedList summary={`Existing guardrails (${guardrails.length})`} items={guardrails} />
              </TabsContent>
              <TabsContent value="knowledge" className="grid gap-4">
                <div className="grid gap-2 rounded-lg border p-3">
                  <span className="font-medium text-sm">Knowledge available to Captain</span>
                  <span className="text-muted-foreground text-xs">
                    Saved sources are summarized here and managed outside the playground.
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/60 p-2 text-center">
                      <div className="font-semibold">14</div>
                      <div className="text-muted-foreground text-xs">Documents</div>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2 text-center">
                      <div className="font-semibold">126</div>
                      <div className="text-muted-foreground text-xs">FAQs</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Reference text</Label>
                  <Textarea placeholder="Paste or write new knowledge for this test" className="min-h-28" />
                  <span className="text-muted-foreground text-xs">
                    This text is attached only to playground requests unless you add it as a document.
                  </span>
                  <Button variant="outline" size="sm" className="w-fit">
                    Add document permanently
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
