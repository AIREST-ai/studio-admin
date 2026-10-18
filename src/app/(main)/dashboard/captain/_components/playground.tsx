"use client";
import * as React from "react";

import { cn } from "cn";
import {
  Activity,
  Bot,
  ChevronDown,
  DollarSign,
  Eraser,
  Loader2,
  MessageSquare,
  PanelRight,
  PhoneCall,
  RotateCcw,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { CaptainShell, useCurrentAssistant } from "./shared";
import {
  addKnowledgeDocument,
  addPermanently,
  reloadCaptainClientState,
  useActiveCaptainClient,
  useCaptainList,
} from "./store";

interface Msg {
  id?: number;
  role: "user" | "assistant";
  text: string;
  blockedError?: boolean;
  run?: {
    ms: number;
    handler: string;
    events: string[];
    scenarios?: number;
    rules?: number;
    knowledge?: boolean;
  };
}

interface ClientBudgetState {
  clientId: string;
  virtualKeyId: string;
  gatewayPort: number;
  gatewayHealthy: boolean;
  maxBudgetUsd: number;
  spentUsd: number;
  rpmLimit: number;
  tpmLimit: number;
  maxStepsPerTurn: number;
  allowedModels: string[];
  blocked: boolean;
  toolTimeoutMs?: number;
  toolMaxOutputBytes?: number;
  updatedAt: string;
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

function scenarioCount(n: number) {
  if (n === 0) return "No scenarios";
  if (n === 1) return "One scenario";
  return `${n} scenarios`;
}

function SavedList({
  items,
  disabled = [],
  summary,
  temp,
  onRemoveTemp,
  onAddPermanent,
  noun,
}: {
  items: string[];
  disabled?: string[];
  summary: string;
  temp: string[];
  onRemoveTemp: (t: string) => void;
  onAddPermanent: (t: string) => void;
  noun: string;
}) {
  return (
    <div className="grid gap-4">
      {temp.length > 0 && (
        <div className="grid gap-2">
          {temp.map((t) => (
            <div key={t} className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">
              <div className="flex items-start gap-2">
                <Checkbox defaultChecked className="mt-0.5" aria-label="Include in this test" />
                <span className="flex-1 whitespace-pre-line leading-snug">{t}</span>
                <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => onRemoveTemp(t)}>
                  <X />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-normal text-[10px]">
                  Temporary
                </Badge>
                <Badge variant="outline" className="font-normal text-[10px]">
                  Session only
                </Badge>
                <Button
                  variant="link"
                  size="xs"
                  className="ms-auto h-auto p-0"
                  onClick={() => {
                    onAddPermanent(t);
                    onRemoveTemp(t);
                    toast.success(`${noun} added to the assistant`);
                  }}
                >
                  Add {noun.toLowerCase()} permanently
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Collapsible defaultOpen className="grid gap-2">
        <CollapsibleTrigger className="flex items-center justify-between font-medium text-sm">
          {summary} <ChevronDown className="size-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-2">
          {items.map((i) => (
            <Label key={i} className="items-start gap-2 rounded-lg border p-2.5 font-normal text-sm leading-snug">
              <Checkbox defaultChecked className="mt-0.5" /> <span className="flex-1 whitespace-pre-line">{i}</span>
              {disabled.includes(i) && (
                <Badge variant="outline" className="font-normal text-[10px]">
                  Disabled
                </Badge>
              )}
            </Label>
          ))}
          <span className="text-muted-foreground text-xs">Include in this test</span>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function TempComposer({
  title,
  hint,
  placeholder,
  onAdd,
}: {
  title: string;
  hint: string;
  placeholder: string;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = React.useState("");
  function add() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  }
  return (
    <div className="grid gap-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="outline" className="font-normal text-[10px]">
          Temporary
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <Textarea
        placeholder={placeholder}
        className="min-h-14 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            add();
          }
        }}
      />
      <Button variant="outline" size="xs" className="w-fit" onClick={add} disabled={!text.trim()}>
        Add to test (↵)
      </Button>
    </div>
  );
}

export function Playground() {
  const assistant = useCurrentAssistant();
  const [activeClientId, setActiveClientId] = useActiveCaptainClient();
  const [budget, setBudget] = React.useState<ClientBudgetState>({
    clientId: "client_test_a",
    virtualKeyId: "vk_isolated_client_test_a_4001",
    gatewayPort: 4001,
    gatewayHealthy: true,
    maxBudgetUsd: 25.0,
    spentUsd: 0.024,
    rpmLimit: 30,
    tpmLimit: 60000,
    maxStepsPerTurn: 5,
    allowedModels: ["gpt-4.1-mini", "gpt-5.4-mini", "gpt-4.1"],
    blocked: false,
    toolTimeoutMs: 10000,
    toolMaxOutputBytes: 16384,
    updatedAt: new Date().toISOString(),
  });
  const [selectedModel, setSelectedModel] = React.useState("gpt-4.1-mini");
  const [running, setRunning] = React.useState(false);
  const [lastBlockedAlert, setLastBlockedAlert] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [setupOpen, setSetupOpen] = React.useState(true);
  const [temp, setTemp] = React.useState<Record<string, string[]>>({ scenarios: [], guidelines: [], guardrails: [] });
  const [setupTab, setSetupTab] = React.useState("scenarios");
  const [knowledge, setKnowledge] = React.useState("");
  const scenarios = useCaptainList("scenarios");
  const documents = useCaptainList("documents");
  const faqs = useCaptainList("faqs");
  const guidelines = useCaptainList("guidelines");
  const guardrails = useCaptainList("guardrails");
  const addTemp = (group: string) => (text: string) =>
    setTemp((p) => Object.assign({}, p, { [group]: [...p[group], text] }));
  const removeTemp = (group: string) => (text: string) =>
    setTemp((p) => Object.assign({}, p, { [group]: p[group].filter((t) => t !== text) }));

  const refreshClientBudget = React.useCallback(async (cid: "client_test_a" | "client_test_b") => {
    const data = await reloadCaptainClientState(cid);
    if (data?.budget && typeof data.budget === "object") {
      setBudget(data.budget as ClientBudgetState);
    }
  }, []);

  React.useEffect(() => {
    void refreshClientBudget(activeClientId);
  }, [activeClientId, refreshClientBudget]);

  async function handleSwitchClient(nextClient: "client_test_a" | "client_test_b") {
    setActiveClientId(nextClient);
    setLastBlockedAlert(null);
    await refreshClientBudget(nextClient);
    toast.success(`Switched active isolated tenant to ${nextClient}`);
  }

  async function updateBudgetConfig(patch: { maxBudgetUsd?: number; blocked?: boolean }) {
    try {
      const res = await fetch("/api/captain-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-studio-client-id": activeClientId,
        },
        body: JSON.stringify({
          clientId: activeClientId,
          ...patch,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; budget?: ClientBudgetState; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Failed to update client budget state");
        return;
      }
      if (data.budget) {
        setBudget(data.budget);
        if (data.budget.blocked) {
          setLastBlockedAlert("403: Kill-Switch active — model and tools are blocked for this client");
          toast.warning("Kill-Switch activated: model and tools blocked immediately");
        } else {
          setLastBlockedAlert(null);
          toast.success("Client budget & model execution policy updated");
        }
      }
    } catch {
      toast.error("Network error while updating budget state");
    }
  }

  async function executePlaygroundTurn(userText: string, probeTool?: string) {
    const cleanText = userText.trim();
    if (!cleanText || running) return;

    const userMsgId = Date.now();
    setMessages((m) => [...m, { id: userMsgId, role: "user", text: cleanText }]);
    setDraft("");
    setRunning(true);

    try {
      const res = await fetch("/api/mcp/studio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-studio-client-id": activeClientId,
        },
        body: JSON.stringify({
          action: "playground_run",
          clientId: activeClientId,
          model: selectedModel,
          message: cleanText,
          probeTool,
          scenariosCount: scenarios.filter((s) => s.enabled).length + temp.scenarios.length,
          rulesCount: guidelines.length + guardrails.length + temp.guidelines.length + temp.guardrails.length,
          knowledge: knowledge.trim(),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        reply?: string;
        ms?: number;
        handler?: string;
        events?: string[];
        budget?: ClientBudgetState;
      };

      if (data.budget) {
        setBudget(data.budget);
      }

      if (!res.ok || !data.ok) {
        const errText =
          res.status === 403
            ? "403: Kill-Switch active — model and tools are blocked for this client"
            : `${res.status}: ${data.error ?? "Execution blocked by budget guard"}`;
        setLastBlockedAlert(errText);
        toast.error(errText);
        return;
      }

      setLastBlockedAlert(null);
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: data.reply ?? "Live Studio MCP execution completed.",
          run: {
            ms: typeof data.ms === "number" ? data.ms : 120,
            handler: data.handler ?? `${assistant.name} (${activeClientId})`,
            events: Array.isArray(data.events) ? data.events : [],
            scenarios: scenarios.filter((s) => s.enabled).length + temp.scenarios.length,
            rules: guidelines.length + guardrails.length + temp.guidelines.length + temp.guardrails.length,
            knowledge: knowledge.trim().length > 0,
          },
        },
      ]);
    } catch {
      toast.error("Failed to reach Studio MCP server");
    } finally {
      setRunning(false);
    }
  }

  function send() {
    if (!draft.trim()) return;
    void executePlaygroundTurn(draft);
  }

  return (
    <CaptainShell
      title="Playground"
      subtitle="Use this playground to send messages to your assistant and check if it responds accurately, quickly, and in the tone you expect."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setMessages([])}>
            <Eraser /> Clear conversation
          </Button>
          <Button
            variant={setupOpen ? "secondary" : "outline"}
            size="sm"
            aria-label="Toggle test setup"
            onClick={() => setSetupOpen((v) => !v)}
          >
            <PanelRight /> Test setup
          </Button>
        </>
      }
    >
      {/* Per-Client Model, MCP Capability Groups, Budget & Kill-Switch Bar */}
      <Card data-testid="playground-budget-bar" className="gap-3 py-3">
        <CardContent className="flex flex-col gap-3 px-4 py-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-xs text-muted-foreground">Active Client:</span>
              <div className="inline-flex rounded-md border p-0.5">
                <Button
                  size="xs"
                  variant={activeClientId === "client_test_a" ? "default" : "ghost"}
                  data-testid="switch-client-a"
                  onClick={() => void handleSwitchClient("client_test_a")}
                >
                  Test Client Alpha (client_test_a)
                </Button>
                <Button
                  size="xs"
                  variant={activeClientId === "client_test_b" ? "default" : "ghost"}
                  data-testid="switch-client-b"
                  onClick={() => void handleSwitchClient("client_test_b")}
                >
                  Test Client Beta (client_test_b)
                </Button>
              </div>
              <Badge variant="outline" className="gap-1 font-normal text-xs">
                <Sparkles className="size-3 text-primary" />
                Model: {selectedModel} (Gateway :{budget.gatewayPort})
              </Badge>
              <Badge variant="secondary" className="gap-1 font-normal text-xs">
                <Activity className="size-3 text-emerald-500" />8 Capability Groups · MCP Active
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {budget.blocked ? (
                <Badge variant="destructive" data-testid="kill-switch-badge" className="gap-1 px-2.5 py-1 text-xs">
                  <ShieldAlert className="size-3.5" />
                  Kill-Switch Active · Model & Tools Blocked
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs"
                >
                  <ShieldCheck className="size-3.5" />
                  Isolated Key Active ({budget.virtualKeyId})
                </Badge>
              )}

              <Button
                size="xs"
                variant="outline"
                data-testid="zero-budget-btn"
                onClick={() =>
                  void updateBudgetConfig({
                    maxBudgetUsd: budget.maxBudgetUsd <= 0 ? (activeClientId === "client_test_b" ? 15 : 25) : 0,
                  })
                }
              >
                <DollarSign className="size-3" />
                {budget.maxBudgetUsd <= 0 ? "Restore Budget ($25)" : "Zero Budget Test ($0)"}
              </Button>

              <Button
                size="xs"
                variant={budget.blocked ? "default" : "destructive"}
                data-testid="kill-switch-btn"
                onClick={() => void updateBudgetConfig({ blocked: !budget.blocked })}
              >
                <ShieldAlert className="size-3.5" />
                {budget.blocked ? "Resume Model" : "Kill-Switch: Block Model"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-foreground" data-testid="budget-usage-text">
                Budget: ${budget.spentUsd.toFixed(4)} / ${budget.maxBudgetUsd.toFixed(2)}
              </span>
              <span>
                RPM: {budget.rpmLimit} · TPM: {budget.tpmLimit.toLocaleString()} · Max Steps: {budget.maxStepsPerTurn}
              </span>
              <span>Isolation Caps: 10s Timeout · 16KB Output · Inbox #3 Write Lock · bank_id Hidden</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium">Quick Tool Probes:</span>
              <Button
                size="xs"
                variant="secondary"
                data-testid="probe-conversations-btn"
                disabled={running}
                onClick={() =>
                  void executePlaygroundTurn(
                    "Check live conversations and inboxes status in Studio",
                    "conversations.list",
                  )
                }
              >
                <MessageSquare className="size-3" />
                Check Live Conversations & Inboxes
              </Button>
              <Button
                size="xs"
                variant="secondary"
                data-testid="probe-calls-btn"
                disabled={running}
                onClick={() =>
                  void executePlaygroundTurn(
                    "Inspect call history and readiness diagnostics from port 3483",
                    "calls.list_history",
                  )
                }
              >
                <PhoneCall className="size-3" />
                Inspect Call History & Readiness
              </Button>
              <Button
                size="xs"
                variant="secondary"
                data-testid="probe-comments-btn"
                disabled={running}
                onClick={() =>
                  void executePlaygroundTurn(
                    "Inspect social comments and unread posts summary from port 3485",
                    "comments.list_posts",
                  )
                }
              >
                <Activity className="size-3" />
                Inspect Social Comments Summary
              </Button>
            </div>
          </div>

          {(budget.blocked || lastBlockedAlert) && (
            <div
              data-testid="playground-blocked-banner"
              className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <span className="font-medium">
                {lastBlockedAlert ?? "403: Kill-Switch active — model and tools are blocked for this client"}
              </span>
              <span>No synthetic assistant replies are generated while blocked.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className={cn("grid gap-4", setupOpen && "xl:grid-cols-[1fr_380px]")}>
        <Card className="h-[calc(100svh-21rem)] min-h-[500px] gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </span>
                {assistant.name}
                <Badge variant="outline" className="font-normal text-xs">
                  {activeClientId === "client_test_b" ? "Test Client Beta" : "Test Client Alpha"}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {(["gpt-4.1-mini", "gpt-5.4-mini", "gpt-4.1"] as const).map((m) => (
                  <Button
                    key={m}
                    size="xs"
                    variant={selectedModel === m ? "secondary" : "ghost"}
                    onClick={() => setSelectedModel(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
            <CardDescription>
              Live Studio MCP Playground bound to {activeClientId} via Gateway :4001 and isolated Studio memory bank.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="m-auto text-center text-muted-foreground text-sm">Type your message...</div>
            )}
            {messages.map((m) => (
              <div
                key={m.id ?? m.text}
                className={cn("flex max-w-[85%] gap-2", m.role === "user" ? "flex-row-reverse self-end" : "self-start")}
              >
                {m.role === "assistant" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-4" />
                  </div>
                )}
                <div className="grid gap-1">
                  <span className={cn("text-muted-foreground text-xs", m.role === "user" && "text-right")}>
                    {m.role === "user" ? "You" : `Assistant (${activeClientId})`}
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
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground">
                        Run details · {m.run.ms}ms <ChevronDown className="size-3" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 grid gap-1 rounded-lg border p-2 text-xs">
                        <span>Handled by: {m.run.handler}</span>
                        {m.run.scenarios !== undefined && (
                          <span className="text-muted-foreground">
                            {scenarioCount(m.run.scenarios)} · {m.run.rules} rules
                          </span>
                        )}
                        {m.run.knowledge && <span>Temporary knowledge was attached to this run.</span>}
                        <span className="font-medium text-emerald-500">
                          {m.run.events.length
                            ? m.run.events.join(" · ")
                            : "No tool calls or scenario handoffs were recorded."}
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
            {running && (
              <div className="flex items-center gap-2 self-start text-muted-foreground text-xs">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Executing live Studio MCP tools for {activeClientId}...
              </div>
            )}
          </CardContent>
          <div className="grid gap-2 border-t p-4">
            <InputGroup>
              <InputGroupTextarea
                placeholder="Ask your assistant or run a live tool check (e.g., Check live conversations and inboxes)..."
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
                <span className="text-muted-foreground text-xs">
                  Bound to {activeClientId} · Budget ${budget.spentUsd.toFixed(4)} / ${budget.maxBudgetUsd.toFixed(2)}
                </span>
                <InputGroupButton
                  size="icon-sm"
                  variant="default"
                  aria-label="Send message"
                  disabled={running}
                  onClick={send}
                >
                  <SendHorizontal />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </Card>

        {setupOpen && (
          <Card className="gap-0 py-0 xl:h-[calc(100svh-21rem)] xl:min-h-[500px]">
            <CardHeader className="border-b py-3.5">
              <div className="flex items-center justify-between">
                <CardTitle>Test setup ({activeClientId})</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTemp({ scenarios: [], guidelines: [], guardrails: [] });
                      toast.success("Test setup reset");
                    }}
                  >
                    <RotateCcw /> Reset test setup
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close test setup"
                    onClick={() => setSetupOpen(false)}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Saved items persist to server state (.studio-data/captain-state.json) per isolated client.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              <Tabs value={setupTab} onValueChange={setSetupTab} className="gap-4">
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
                    onAdd={addTemp("scenarios")}
                    placeholder="Type a temporary scenario title..."
                  />
                  <SavedList
                    summary={`Existing scenarios (${scenarios.length})`}
                    items={scenarios.map((s) => s.title)}
                    disabled={scenarios.filter((s) => !s.enabled).map((s) => s.title)}
                    temp={temp.scenarios}
                    onRemoveTemp={removeTemp("scenarios")}
                    onAddPermanent={(t) => addPermanently("scenarios", t)}
                    noun="Scenario"
                  />
                </TabsContent>
                <TabsContent value="guidelines" className="grid gap-4">
                  <TempComposer
                    title="Add a temporary guideline"
                    hint="Test a response preference before adding it to the assistant."
                    onAdd={addTemp("guidelines")}
                    placeholder="Type a temporary guideline..."
                  />
                  <SavedList
                    summary={`Existing guidelines (${guidelines.length})`}
                    items={guidelines}
                    temp={temp.guidelines}
                    onRemoveTemp={removeTemp("guidelines")}
                    onAddPermanent={(t) => addPermanently("guidelines", t)}
                    noun="Guideline"
                  />
                </TabsContent>
                <TabsContent value="guardrails" className="grid gap-4">
                  <TempComposer
                    title="Add a temporary guardrail"
                    hint="Test a safety boundary before adding it to the assistant."
                    onAdd={addTemp("guardrails")}
                    placeholder="Type a temporary guardrail..."
                  />
                  <SavedList
                    summary={`Existing guardrails (${guardrails.length})`}
                    items={guardrails}
                    temp={temp.guardrails}
                    onRemoveTemp={removeTemp("guardrails")}
                    onAddPermanent={(t) => addPermanently("guardrails", t)}
                    noun="Guardrail"
                  />
                </TabsContent>
                <TabsContent value="knowledge" className="grid gap-4">
                  <div className="grid gap-2 rounded-lg border p-3">
                    <span className="font-medium text-sm">Knowledge available to Captain</span>
                    <span className="text-muted-foreground text-xs">
                      Saved sources are summarized here and managed outside the playground.
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <div className="font-semibold">{documents.length}</div>
                        <div className="text-muted-foreground text-xs">Documents</div>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <div className="font-semibold">{faqs.length}</div>
                        <div className="text-muted-foreground text-xs">FAQs</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Reference text</Label>
                    <Textarea
                      placeholder="Paste or write new knowledge for this test"
                      className="min-h-28"
                      value={knowledge}
                      onChange={(e) => setKnowledge(e.target.value)}
                    />
                    <span className="text-muted-foreground text-xs">
                      This text is attached only to playground requests unless you add it as a document.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      disabled={!knowledge.trim()}
                      onClick={() => {
                        addKnowledgeDocument(knowledge);
                        setKnowledge("");
                        toast.success("Document created successfully");
                      }}
                    >
                      Add document permanently
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </CaptainShell>
  );
}
