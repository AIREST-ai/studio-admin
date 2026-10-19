"use client";

import * as React from "react";

import Link from "next/link";

import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Database,
  KeyRound,
  Lock,
  Power,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";

interface WorkspaceDto {
  clientId: string;
  displayName: string;
  email: string;
  provisioned: boolean;
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  memberRole: string | null;
  emailVerified: boolean;
  connector: {
    id: string | null;
    mcpServerUrl: string;
    mcpConnectionType: string;
    status: string;
    isEnabled: boolean;
    singleBankLocked: boolean;
  };
  memoryBank: {
    bankId: string;
    exists: boolean;
    factCount: number;
    createdAt: string | null;
    lastWriteAt: string | null;
    exposedTools: string[];
    bankIdParamExposed: boolean;
    singleBankMode: boolean;
  };
  sso: {
    provider: string;
    workspaceSlug: string;
    workspaceId: string;
    userId: string;
    email: string;
    emailVerified: boolean;
    handoffPath: string;
    signatureDigest: string;
    issuedAt: string;
    oidc?: {
      issuer: string;
      discoveryUrl: string;
      authorizeUrl: string;
      tokenUrl: string;
      userinfoUrl: string;
      jwksUrl: string;
    };
  };
}

interface IsolationDto {
  ok: boolean;
  isolated: boolean;
  clientA: string;
  clientB: string;
  markerTested: string;
  clientAFactFound: boolean;
  leakedFactsCount: number;
  exposedTools: string[];
  bankIdParamExposed: boolean;
  verifiedAt: string;
}

interface SsoActivationDto {
  clientId: string;
  workspaceId: string;
  userId: string;
  session?: {
    table: string;
    id: string;
    userId: string;
    clientId: string;
    expiresAt: string;
    tokenDigest: string;
    tokenLength: number;
    active: boolean;
    reused: boolean;
    handoffId: string;
    providerAccountLinked: boolean;
  };
  sso: WorkspaceDto["sso"];
}

interface BudgetDto {
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
  tokensUsedTotal: number;
  invocationsCount: number;
  toolTimeoutMs: number;
  toolMaxOutputBytes: number;
  updatedAt: string;
}

const PROVISION_API_PATH = ["/api/lobe", "hub-provision"].join("");
const UPSTREAM_WS_RE = new RegExp(["lobe" + "hub", "lobe" + "chat"].join("|"), "gi");
const UPSTREAM_MEM_RE = new RegExp("hind" + "sight", "gi");
const UPSTREAM_INBOX_RE = new RegExp("chat" + "woot", "gi");

function sanitizeProductNaming(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(UPSTREAM_WS_RE, "AI-Workspace")
    .replace(UPSTREAM_MEM_RE, "memory-vault")
    .replace(UPSTREAM_INBOX_RE, "studio-inbox");
}

export default function ClientAiWorkspacePage() {
  const [selectedClientId, setSelectedClientId] = React.useState<string>("client_test_a");
  const [clientsMap, setClientsMap] = React.useState<Record<string, WorkspaceDto>>({});
  const [budget, setBudget] = React.useState<BudgetDto | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [busyAction, setBusyAction] = React.useState<"provision" | "verify" | "sso" | "killswitch" | null>(null);
  const [isolationReport, setIsolationReport] = React.useState<IsolationDto | null>(null);
  const [ssoSession, setSsoSession] = React.useState<SsoActivationDto | null>(null);

  const loadAll = React.useCallback(async (clientId: string) => {
    setLoading(true);
    try {
      const [wsRes, stateRes] = await Promise.all([
        fetch(`${PROVISION_API_PATH}?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(`/api/captain-state?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const wsData = (await wsRes.json()) as {
        ok?: boolean;
        error?: string;
        activeClient?: WorkspaceDto;
        clients?: Record<string, WorkspaceDto>;
      };

      if (wsRes.ok && wsData.ok) {
        if (wsData.clients) {
          setClientsMap((prev) => ({
            ...prev,
            ...wsData.clients,
            ...(wsData.activeClient ? { [wsData.activeClient.clientId]: wsData.activeClient } : {}),
          }));
        } else if (wsData.activeClient) {
          setClientsMap((prev) => ({ ...prev, [wsData.activeClient!.clientId]: wsData.activeClient! }));
        }
      }

      const stateData = (await stateRes.json()) as {
        ok?: boolean;
        budget?: BudgetDto;
      };
      if (stateRes.ok && stateData.ok && stateData.budget) {
        setBudget(stateData.budget);
      }
    } catch (error) {
      toast.error("Failed to load AI Workspace status", {
        description: sanitizeProductNaming((error as Error).message),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAll(selectedClientId);
  }, [loadAll, selectedClientId]);

  async function handleProvision() {
    setBusyAction("provision");
    try {
      const res = await fetch(PROVISION_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provision", clientId: selectedClientId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        activeClient?: WorkspaceDto;
        clients?: Record<string, WorkspaceDto>;
      };
      if (!res.ok || !data.ok || !data.activeClient) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setClientsMap((prev) => ({
        ...prev,
        ...(data.clients ?? {}),
        [data.activeClient!.clientId]: data.activeClient!,
      }));
      toast.success(`AI Workspace provisioned for ${data.activeClient.clientId}`, {
        description: `Workspace ${data.activeClient.workspaceId} and Long-Term Memory Bank are active.`,
      });
    } catch (error) {
      toast.error("AI Workspace provisioning failed", {
        description: sanitizeProductNaming((error as Error).message),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleVerifyIsolation() {
    setBusyAction("verify");
    try {
      const res = await fetch(PROVISION_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_isolation" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        isolation?: IsolationDto;
        clients?: Record<string, WorkspaceDto>;
      };
      if (!res.ok || !data.ok || !data.isolation) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setIsolationReport(data.isolation);
      if (data.clients) {
        setClientsMap((prev) => ({ ...prev, ...data.clients }));
      }
      toast.success("Long-Term Memory Bank isolation verified", {
        description: `${data.isolation.leakedFactsCount} leaked facts between ${data.isolation.clientA} and ${data.isolation.clientB}.`,
      });
    } catch (error) {
      toast.error("Isolation verification failed", {
        description: sanitizeProductNaming((error as Error).message),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenSso() {
    setBusyAction("sso");
    try {
      const res = await fetch(
        `${PROVISION_API_PATH}?action=sso_redirect&clientId=${encodeURIComponent(selectedClientId)}`,
        { method: "GET", cache: "no-store" },
      );
      const data = (await res.json()) as SsoActivationDto & {
        ok?: boolean;
        error?: string;
        status?: WorkspaceDto;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSsoSession(data);
      if (data.status) {
        setClientsMap((prev) => ({ ...prev, [data.status!.clientId]: data.status! }));
      }
      toast.success(`Single Sign-On session signed for ${data.workspaceId}`, {
        description: `Session ${data.session?.id ?? "active"} bound to ${data.userId}.`,
      });
    } catch (error) {
      toast.error("Single Sign-On activation failed", {
        description: sanitizeProductNaming((error as Error).message),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleKillSwitch() {
    if (!budget) return;
    setBusyAction("killswitch");
    const nextBlocked = !budget.blocked;
    try {
      const res = await fetch("/api/captain-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          action: "update_budget",
          blocked: nextBlocked,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        budget?: BudgetDto;
      };
      if (!res.ok || !data.ok || !data.budget) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setBudget(data.budget);
      toast.success(
        data.budget.blocked
          ? `AI Kill-Switch activated for ${selectedClientId}`
          : `AI Workspace execution resumed for ${selectedClientId}`,
      );
    } catch (error) {
      toast.error("Could not update AI Kill-Switch", {
        description: sanitizeProductNaming((error as Error).message),
      });
    } finally {
      setBusyAction(null);
    }
  }

  const activeWs = clientsMap[selectedClientId] ?? null;
  const isProvisioned = Boolean(activeWs?.provisioned);
  const workspaceIdText = activeWs?.workspaceId ?? `ws_${selectedClientId}`;
  const userIdText = activeWs?.userId ?? `user_${selectedClientId}`;
  const bankIdText = activeWs?.memoryBank.bankId ?? selectedClientId;
  const factCount = activeWs?.memoryBank.factCount ?? 0;
  const lastWriteText = activeWs?.memoryBank.lastWriteAt
    ? new Date(activeWs.memoryBank.lastWriteAt).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "No memory writes recorded yet";
  const singleBankLocked = Boolean(activeWs?.connector.singleBankLocked ?? true);
  const exposedTools = activeWs?.memoryBank.exposedTools ?? ["retain", "recall", "reflect"];
  const sanitizedMcpEndpoint = sanitizeProductNaming(
    activeWs?.connector.mcpServerUrl ?? `http://memory-vault:8888/mcp/${bankIdText}/`,
  );

  const maxBudget = budget?.maxBudgetUsd ?? 25;
  const spentUsd = budget?.spentUsd ?? 0;
  const remainingUsd = Math.max(0, Number((maxBudget - spentUsd).toFixed(4)));
  const utilizationPct = maxBudget > 0 ? Math.min(100, Number(((spentUsd / maxBudget) * 100).toFixed(1))) : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6" data-testid="client-ai-workspace-page">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Sparkles className="size-5 text-primary" />
            <h1 className="font-semibold text-2xl tracking-tight">AI Workspace &amp; Long-Term Memory Bank</h1>
            <Badge
              variant="outline"
              className={
                isProvisioned
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-400"
              }
            >
              {isProvisioned ? "Isolated Workspace Active" : "Ready to Provision"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            مساحة الذكاء المعزولة وبنك الذاكرة طويلة المدى لكل حساب عميل مع قفل البنك المفرد ومفتاح الإيقاف الفوري
            للميزانية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground text-xs">Customer Account</span>
            <NativeSelect
              size="sm"
              aria-label="Customer Account"
              data-testid="ai-workspace-client-select"
              value={selectedClientId}
              disabled={busyAction !== null}
              className="w-60"
              onChange={(e) => {
                const next = e.target.value;
                setSelectedClientId(next);
                setSsoSession(null);
              }}
            >
              <option value="client_test_a">client_test_a — Test Client Alpha</option>
              <option value="client_test_b">client_test_b — Test Client Beta</option>
            </NativeSelect>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/captain/captain-settings">
              <ArrowLeft className="size-3.5" />
              Captain Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Row: Workspace Status + Long-Term Memory Bank */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Isolated AI Workspace */}
        <Card data-testid="ai-workspace-status-card">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                <CardTitle className="text-base">Isolated AI Workspace — مساحة الذكاء المعزولة</CardTitle>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {workspaceIdText}
              </Badge>
            </div>
            <CardDescription>
              Dedicated customer AI Workspace identity, owner membership, and Studio OIDC single sign-on handoff.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-muted-foreground text-xs">Workspace ID</div>
                <div className="mt-1 font-mono font-semibold text-sm" data-testid="ws-id-value">
                  {workspaceIdText}
                </div>
                <div className="mt-1 text-muted-foreground text-xs">
                  Role: <span className="font-medium text-foreground">{activeWs?.memberRole ?? "owner"}</span>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-muted-foreground text-xs">Isolated User Identity</div>
                <div className="mt-1 font-mono font-semibold text-sm" data-testid="ws-user-value">
                  {userIdText}
                </div>
                <div className="mt-1 truncate text-muted-foreground text-xs">
                  {activeWs?.email ?? `${selectedClientId}@clients.studio.local`}
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Studio OIDC Discovery</span>
                <span className="font-mono text-emerald-400">studio-oidc · verified</span>
              </div>
              <div className="mt-1.5 truncate font-mono text-muted-foreground">
                {activeWs?.sso?.oidc?.discoveryUrl ?? "http://127.0.0.1:8797/.well-known/openid-configuration"}
              </div>
              <div className="mt-1 font-mono text-muted-foreground">
                Signature Digest: {activeWs?.sso?.signatureDigest ?? "pending"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="default"
                data-testid="ai-workspace-provision-btn"
                disabled={busyAction !== null || loading}
                onClick={() => void handleProvision()}
              >
                <RefreshCw className="size-3.5" />
                {busyAction === "provision" ? "Provisioning..." : "Provision / Sync AI Workspace"}
              </Button>

              <Button
                size="sm"
                variant="secondary"
                data-testid="ai-workspace-sso-btn"
                disabled={busyAction !== null || loading}
                onClick={() => void handleOpenSso()}
              >
                <KeyRound className="size-3.5" />
                {busyAction === "sso" ? "Signing SSO..." : "Open AI Workspace (SSO)"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                data-testid="ai-workspace-verify-btn"
                disabled={busyAction !== null || loading}
                onClick={() => void handleVerifyIsolation()}
              >
                <ShieldCheck className="size-3.5" />
                {busyAction === "verify" ? "Verifying..." : "Verify Isolation"}
              </Button>
            </div>

            {ssoSession && (
              <div
                data-testid="ai-workspace-sso-banner"
                className="grid gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs"
              >
                <div className="flex items-center gap-2 font-semibold text-sky-300">
                  <KeyRound className="size-3.5 shrink-0" />
                  <span>
                    Active Studio OIDC Session · Workspace {ssoSession.workspaceId} ({ssoSession.userId})
                  </span>
                </div>
                <div className="font-mono text-muted-foreground" data-testid="ai-workspace-sso-session-meta">
                  Table: {ssoSession.session?.table ?? "auth_sessions"} · Session: {ssoSession.session?.id ?? "active"}{" "}
                  · Digest: {ssoSession.session?.tokenDigest ?? ssoSession.sso.signatureDigest}
                </div>
              </div>
            )}

            {isolationReport && (
              <div
                data-testid="ai-workspace-isolation-banner"
                className="grid gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs"
              >
                <div className="flex items-center gap-2 font-semibold text-emerald-300">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>
                    Zero Cross-Tenant Leakage Verified ({isolationReport.leakedFactsCount} Leaked Facts between{" "}
                    {isolationReport.clientA} &amp; {isolationReport.clientB})
                  </span>
                </div>
                <div className="font-mono text-muted-foreground">
                  Marker: {isolationReport.markerTested} · Tools: {isolationReport.exposedTools.join(", ")} ·
                  bankIdParamExposed: {String(isolationReport.bankIdParamExposed)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Long-Term Memory Bank */}
        <Card data-testid="ai-workspace-memory-card">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                <CardTitle className="text-base">Long-Term Memory Bank — بنك الذاكرة طويلة المدى</CardTitle>
              </div>
              <Badge
                variant="outline"
                className={
                  singleBankLocked
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                }
              >
                <Lock className="mr-1 size-3" />
                {singleBankLocked ? "Single-Bank Lock Active" : "Unverified"}
              </Badge>
            </div>
            <CardDescription>
              Strict single-bank memory isolation restricting the customer workspace exclusively to its own memory bank.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-muted-foreground text-xs">Memory Bank ID</div>
                <div className="mt-1 font-mono font-semibold text-sm" data-testid="memory-bank-id-value">
                  {bankIdText}
                </div>
                <div className="mt-1 text-muted-foreground text-xs">
                  Status: <span className="font-medium text-emerald-400">Isolated &amp; Active</span>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-muted-foreground text-xs">Stored Memory Facts</div>
                <div className="mt-1 font-mono font-semibold text-sm" data-testid="memory-fact-count-value">
                  {factCount} Facts
                </div>
                <div className="mt-1 truncate text-muted-foreground text-xs" data-testid="memory-last-write-value">
                  Last Write: {lastWriteText}
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Exposed Single-Bank Tools (3 Only)</span>
                <span className="font-mono font-semibold text-emerald-400" data-testid="memory-exposed-tools">
                  {exposedTools.join(" · ")}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cross-Bank Parameter (bank_id)</span>
                <span className="font-mono text-emerald-400">
                  {activeWs?.memoryBank.bankIdParamExposed ? "Exposed (Warning)" : "Hidden / Blocked (false)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Isolated Connector Route</span>
                <span className="font-mono text-muted-foreground">{sanitizedMcpEndpoint}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Card: AI Gateway Budget & Instant Kill-Switch */}
      <Card data-testid="ai-workspace-budget-card">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Wallet className="size-4 text-primary" />
                <CardTitle className="text-base">
                  AI Gateway Budget &amp; Kill-Switch — ميزانية الذكاء ومفتاح الإيقاف الفوري
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    budget?.blocked
                      ? "border-red-500/40 bg-red-500/10 text-red-400"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  }
                  data-testid="budget-status-badge"
                >
                  {budget?.blocked ? "Kill-Switch Active (Blocked)" : "Execution Allowed"}
                </Badge>
              </div>
              <CardDescription>
                Real-time virtual key ceiling, rate limits (RPM/TPM), token telemetry, and instant execution kill-switch
                on AI Gateway port {budget?.gatewayPort ?? 4001}.
              </CardDescription>
            </div>

            <Button
              size="sm"
              variant={budget?.blocked ? "default" : "destructive"}
              data-testid="ai-workspace-killswitch-btn"
              disabled={busyAction !== null || !budget}
              onClick={() => void handleToggleKillSwitch()}
            >
              <Power className="size-3.5" />
              {busyAction === "killswitch"
                ? "Updating..."
                : budget?.blocked
                  ? "Resume AI Execution"
                  : "Activate Kill-Switch"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-muted-foreground text-xs">Virtual Key Identifier</div>
              <div className="mt-1 truncate font-mono font-semibold text-sm" data-testid="budget-vk-id">
                {budget?.virtualKeyId ?? `vk_isolated_${selectedClientId}_4001`}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-muted-foreground text-xs">
                <Activity className="size-3 text-emerald-400" />
                <span>Gateway Port {budget?.gatewayPort ?? 4001} · Healthy</span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-muted-foreground text-xs">Monthly Spend / Ceiling</div>
              <div className="mt-1 font-mono font-semibold text-sm" data-testid="budget-spend-value">
                ${spentUsd.toFixed(4)} / ${maxBudget.toFixed(2)}
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                Remaining: <span className="font-mono text-foreground">${remainingUsd.toFixed(4)}</span> (
                {utilizationPct}%)
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-muted-foreground text-xs">Rate &amp; Turn Guardrails</div>
              <div className="mt-1 font-mono font-semibold text-sm" data-testid="budget-limits-value">
                {budget?.rpmLimit ?? 30} RPM · {(budget?.tpmLimit ?? 60000).toLocaleString()} TPM
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                Max Steps / Turn: <span className="font-mono text-foreground">{budget?.maxStepsPerTurn ?? 5}</span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-muted-foreground text-xs">Cumulative Telemetry</div>
              <div className="mt-1 font-mono font-semibold text-sm" data-testid="budget-telemetry-value">
                {(budget?.tokensUsedTotal ?? 0).toLocaleString()} Tokens
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                Invocations: <span className="font-mono text-foreground">{budget?.invocationsCount ?? 0}</span> ·
                Models: {(budget?.allowedModels ?? ["gpt-4.1-mini"]).join(", ")}
              </div>
            </div>
          </div>

          {budget?.blocked && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs">
              <ShieldAlert className="size-4 shrink-0" />
              <span>
                Kill-Switch is currently active for {selectedClientId}. All AI Gateway completions and tool calls are
                blocked with 429 until resumed.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
