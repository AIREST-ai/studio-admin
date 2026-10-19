"use client";

import * as React from "react";

import Link from "next/link";

import {
  Bot,
  CheckCircle2,
  Database,
  KeyRound,
  Layers,
  Mic,
  PenLine,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { loadSettingsPreview, SAVED_IN_PREVIEW, saveCaptain } from "../../settings/_components/settings-preview-client";
import { models } from "./data";
import { CaptainShell, ToneBadge } from "./shared";

interface ClientWorkspaceStatusDto {
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

interface IsolationReportDto {
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

interface SsoSessionDto {
  authenticated: boolean;
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
  sso: {
    provider: string;
    workspaceSlug: string;
    workspaceId: string;
    userId: string;
    email: string;
    emailVerified: boolean;
    signatureDigest: string;
    issuedAt: string;
    oidc?: {
      issuer: string;
      discoveryUrl: string;
    };
  };
}

const CLIENT_ACCOUNTS = [
  { id: "client_test_a", label: "Test Client Alpha · client_test_a" },
  { id: "client_test_b", label: "Test Client Beta · client_test_b" },
] as const;

function formatUtcTimestamp(iso: string | null | undefined): string {
  if (!iso) return "No writes recorded yet";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Recently updated";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

const modelRows = [
  {
    icon: PenLine,
    title: "Editor Features",
    description:
      "Powers smart compose, grammar corrections, tone adjustments, and content enhancement in your message editor.",
    value: "gpt-4.1-mini",
  },
  {
    icon: Bot,
    title: "Assistant",
    description:
      "Handles automated responses, conversation summaries, and intelligent reply suggestions for customer interactions.",
    value: "gpt-4.1",
  },
  {
    icon: Sparkles,
    title: "Co-pilot",
    description:
      "Provides real-time contextual suggestions, knowledge base recommendations, and proactive insights during conversations.",
    value: "gpt-5-mini",
  },
];

const features = [
  {
    icon: Mic,
    title: "Audio Transcription",
    description: "Automatically convert voice messages and call recordings into searchable text transcripts.",
    modelTitle: "Audio Transcription Model",
    modelDescription: "Select the AI model to use for converting audio messages into text transcripts",
    on: true,
  },
  {
    icon: Search,
    title: "Help Center Search Indexing",
    description: "Use AI for context aware search inside your help center articles.",
    on: true,
  },
  {
    icon: Tags,
    title: "Label Suggestion",
    description:
      "Automatically suggest relevant labels and tags for conversations based on content analysis and context.",
    modelTitle: "Label Suggestion Model",
    modelDescription: "Select the AI model to use for analyzing conversations and suggesting appropriate labels",
    on: false,
  },
];

const FEATURE_MODEL_DEFAULT = "gpt-4.1-mini";

export function CaptainSettings() {
  const [on, setOn] = React.useState<Record<string, boolean>>(Object.fromEntries(features.map((f) => [f.title, f.on])));
  const [chosen, setChosen] = React.useState<Record<string, string>>({
    ...Object.fromEntries(modelRows.map((r) => [r.title, r.value])),
    ...Object.fromEntries(
      features.filter((f) => f.modelTitle).map((f) => [f.modelTitle as string, FEATURE_MODEL_DEFAULT]),
    ),
  });
  const [loaded, setLoaded] = React.useState(false);

  const [selectedClientId, setSelectedClientId] = React.useState<string>("client_test_a");
  const [clientsMap, setClientsMap] = React.useState<Record<string, ClientWorkspaceStatusDto>>({});
  const [workspaceLoading, setWorkspaceLoading] = React.useState<boolean>(true);
  const [busyAction, setBusyAction] = React.useState<"provision" | "verify" | "sso" | null>(null);
  const [isolationReport, setIsolationReport] = React.useState<IsolationReportDto | null>(null);
  const [ssoSession, setSsoSession] = React.useState<SsoSessionDto | null>(null);

  const fetchWorkspaceStatus = React.useCallback(async (clientId: string) => {
    setWorkspaceLoading(true);
    try {
      const res = await fetch(`/api/lobehub-provision?clientId=${encodeURIComponent(clientId)}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        activeClient?: ClientWorkspaceStatusDto;
        clients?: Record<string, ClientWorkspaceStatusDto>;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (data.clients) {
        setClientsMap(data.clients);
      } else if (data.activeClient) {
        setClientsMap((prev) => ({ ...prev, [data.activeClient!.clientId]: data.activeClient! }));
      }
    } catch (error) {
      toast.error("Could not load isolated workspace status", {
        description: (error as Error).message,
      });
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview()
      .then(({ captain }) => {
        if (!alive || !captain) return;
        if (captain.features) setOn((p) => ({ ...p, ...captain.features }));
        if (captain.models) setChosen((p) => ({ ...p, ...captain.models }));
      })
      .catch((error) =>
        toast.error("Saved Captain settings could not be read", { description: (error as Error).message }),
      )
      .finally(() => alive && setLoaded(true));

    void fetchWorkspaceStatus("client_test_a");

    return () => {
      alive = false;
    };
  }, [fetchWorkspaceStatus]);

  async function handleProvisionWorkspace() {
    setBusyAction("provision");
    try {
      const res = await fetch("/api/lobehub-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "provision",
          clientId: selectedClientId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        activeClient?: ClientWorkspaceStatusDto;
        clients?: Record<string, ClientWorkspaceStatusDto>;
      };
      if (!res.ok || !data.ok || !data.activeClient) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (data.clients) {
        setClientsMap(data.clients);
      } else {
        setClientsMap((prev) => ({ ...prev, [data.activeClient!.clientId]: data.activeClient! }));
      }
      toast.success(`Isolated workspace provisioned for ${data.activeClient.clientId}`, {
        description: `Workspace ${data.activeClient.workspaceId} and single-bank memory are active.`,
      });
    } catch (error) {
      toast.error("Workspace provisioning failed", {
        description: (error as Error).message,
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleVerifyIsolation() {
    setBusyAction("verify");
    try {
      const res = await fetch("/api/lobehub-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_isolation" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        isolation?: IsolationReportDto;
        clients?: Record<string, ClientWorkspaceStatusDto>;
      };
      if (!res.ok || !data.ok || !data.isolation) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setIsolationReport(data.isolation);
      if (data.clients) {
        setClientsMap(data.clients);
      }
      toast.success("Cross-tenant memory isolation verified", {
        description: `${data.isolation.leakedFactsCount} leaked facts between ${data.isolation.clientA} and ${data.isolation.clientB}.`,
      });
    } catch (error) {
      toast.error("Memory isolation verification failed", {
        description: (error as Error).message,
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenSsoWorkspace() {
    setBusyAction("sso");
    try {
      const res = await fetch(
        `/api/lobehub-provision?action=sso_redirect&clientId=${encodeURIComponent(selectedClientId)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = (await res.json()) as SsoSessionDto & {
        ok?: boolean;
        error?: string;
        status?: ClientWorkspaceStatusDto;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSsoSession(data);
      if (data.status) {
        setClientsMap((prev) => ({ ...prev, [data.status!.clientId]: data.status! }));
      }
      toast.success(`Unified Sign-On session ready for ${data.workspaceId}`, {
        description: data.session?.id
          ? `Live auth_sessions row ${data.session.id} is active for ${data.userId}.`
          : `Account ${data.userId} verified with OIDC handoff signature.`,
      });
    } catch (error) {
      toast.error("SSO handoff failed", {
        description: (error as Error).message,
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function keep(part: { features?: Record<string, boolean>; models?: Record<string, string> }, undo: () => void) {
    try {
      await saveCaptain(part);
      toast.success("Captain settings updated successfully", { description: SAVED_IN_PREVIEW });
    } catch (error) {
      undo();
      toast.error("Captain settings not saved", { description: (error as Error).message });
    }
  }

  function chooseModel(title: string, value: string) {
    const before = chosen[title];
    setChosen((p) => ({ ...p, [title]: value }));
    void keep({ models: { [title]: value } }, () => setChosen((p) => ({ ...p, [title]: before })));
  }

  const activeClientStatus = clientsMap[selectedClientId] ?? null;
  const isProvisioned = Boolean(activeClientStatus?.provisioned);
  const workspaceIdText = activeClientStatus?.workspaceId ?? `ws_${selectedClientId}`;
  const userIdText = activeClientStatus?.userId ?? `user_${selectedClientId}`;
  const bankIdText = activeClientStatus?.memoryBank.bankId ?? selectedClientId;
  const factCount = activeClientStatus?.memoryBank.factCount ?? 0;
  const singleBankLocked = Boolean(activeClientStatus?.connector.singleBankLocked ?? true);
  const exposedToolsCount = activeClientStatus?.memoryBank.exposedTools.length ?? 3;
  const exposedToolsList = (activeClientStatus?.memoryBank.exposedTools ?? ["retain", "recall", "reflect"]).join(" · ");

  return (
    <CaptainShell
      title="Captain"
      switcher={false}
      nav={false}
      subtitle={
        <>
          Configure your AI models and features for Captain. Captain follows a credit based billing, you will be charged
          credits for every action Captain takes based on the model selected.
        </>
      }
    >
      <Card data-testid="isolated-workspace-card">
        <CardHeader className="gap-3 border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Isolated AI Workspace &amp; Memory Bank</CardTitle>
                <ToneBadge tone={isProvisioned ? "green" : "amber"}>
                  {isProvisioned ? "Multi-Tenant Isolation Active" : "Ready to Provision"}
                </ToneBadge>
              </div>
              <CardDescription>
                Dedicated multi-agent workspace and single-bank long-term memory isolation per customer account with
                unified single sign-on.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="font-medium text-muted-foreground text-xs">Active Customer Account</span>
              <NativeSelect
                size="sm"
                aria-label="Active Customer Account"
                data-testid="active-client-select"
                value={selectedClientId}
                disabled={busyAction !== null}
                className="sm:w-64"
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedClientId(nextId);
                  setSsoSession(null);
                  if (!clientsMap[nextId]) {
                    void fetchWorkspaceStatus(nextId);
                  }
                }}
              >
                {CLIENT_ACCOUNTS.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3.5" data-testid="workspace-status-metric">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                  <Layers className="size-3.5" />
                  Workspace Status
                </span>
                <ToneBadge tone={isProvisioned ? "green" : "amber"}>
                  {isProvisioned ? "Provisioned & Isolated" : "Not Provisioned"}
                </ToneBadge>
              </div>
              <div className="grid gap-0.5">
                <span className="font-mono font-semibold text-sm tabular-nums">{workspaceIdText}</span>
                <span className="text-muted-foreground text-xs">
                  Account: <span className="font-mono">{userIdText}</span> · Role:{" "}
                  {activeClientStatus?.memberRole ?? "owner"}
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3.5" data-testid="memory-bank-isolation-metric">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                  <ShieldCheck className="size-3.5" />
                  Memory Bank Isolation
                </span>
                <ToneBadge tone={singleBankLocked ? "sky" : "amber"}>
                  {singleBankLocked ? "Single-Bank MCP Locked" : "Pending Lock"}
                </ToneBadge>
              </div>
              <div className="grid gap-0.5">
                <span className="font-mono font-semibold text-sm tabular-nums">{bankIdText}</span>
                <span className="text-muted-foreground text-xs">
                  {exposedToolsCount} Tools: {exposedToolsList} · No bank_id override
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3.5" data-testid="stored-memory-facts-metric">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                  <Database className="size-3.5" />
                  Stored Memory Facts
                </span>
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {workspaceLoading ? "..." : `${factCount} facts`}
                </Badge>
              </div>
              <div className="grid gap-0.5">
                <span className="font-semibold text-lg tabular-nums">{factCount}</span>
                <span className="text-muted-foreground text-xs">
                  Last write: {formatUtcTimestamp(activeClientStatus?.memoryBank.lastWriteAt)}
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3.5" data-testid="unified-sso-metric">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                  <KeyRound className="size-3.5" />
                  Unified Sign-On (SSO)
                </span>
                <ToneBadge tone="violet">
                  {ssoSession?.session?.active ? "Live OIDC Session Active" : "Verified Email · OIDC Ready"}
                </ToneBadge>
              </div>
              <div className="grid gap-0.5">
                <span className="truncate font-medium text-sm">
                  {activeClientStatus?.email ?? `${selectedClientId}@clients.studio.local`}
                </span>
                <span className="text-muted-foreground text-xs">
                  {ssoSession?.session?.id
                    ? `auth_sessions ${ssoSession.session.id} · digest ${ssoSession.session.tokenDigest}`
                    : `Session bound to ${workspaceIdText} · OIDC IdP on 8797`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              data-testid="provision-workspace-btn"
              disabled={busyAction !== null}
              onClick={() => void handleProvisionWorkspace()}
            >
              <RefreshCw className="size-3.5" />
              {busyAction === "provision" ? "Provisioning Workspace..." : "Provision / Sync Workspace"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              data-testid="verify-isolation-btn"
              disabled={busyAction !== null}
              onClick={() => void handleVerifyIsolation()}
            >
              <ShieldCheck className="size-3.5" />
              {busyAction === "verify" ? "Verifying Isolation..." : "Verify Memory Isolation"}
            </Button>

            <Button
              size="sm"
              variant="secondary"
              data-testid="open-sso-workspace-btn"
              disabled={busyAction !== null}
              onClick={() => void handleOpenSsoWorkspace()}
            >
              <KeyRound className="size-3.5" />
              {busyAction === "sso" ? "Signing Session..." : "Open Isolated Workspace (SSO)"}
            </Button>

            <Button asChild size="sm" variant="outline" data-testid="open-ai-workspace-page-btn">
              <Link href="/dashboard/ai-workspace">
                <Layers className="size-3.5" />
                AI Workspace Console
              </Link>
            </Button>
          </div>

          {isolationReport && (
            <div
              data-testid="isolation-result-banner"
              className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 text-xs dark:text-emerald-300"
            >
              <div className="flex flex-wrap items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  Cross-Tenant Isolation Verified · {isolationReport.leakedFactsCount} Leaked Facts between{" "}
                  {isolationReport.clientA} and {isolationReport.clientB} · Single-Bank Tools:{" "}
                  {isolationReport.exposedTools.join(", ")}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">
                Marker <span className="font-mono">{isolationReport.markerTested}</span> retained in{" "}
                <span className="font-mono">{isolationReport.clientA}</span> and queried from{" "}
                <span className="font-mono">{isolationReport.clientB}</span> ·{" "}
                <span className="font-mono">bank_id</span> override blocked:{" "}
                <span className="font-mono">{String(!isolationReport.bankIdParamExposed)}</span>
              </div>
            </div>
          )}

          {ssoSession && (
            <div
              data-testid="sso-handoff-banner"
              className="flex flex-col gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sky-700 text-xs dark:text-sky-300"
            >
              <div className="flex flex-wrap items-center gap-2 font-semibold text-sm">
                <KeyRound className="size-4 shrink-0" />
                <span>
                  Unified Sign-On Live Session Active · Workspace {ssoSession.workspaceId} ({ssoSession.userId})
                </span>
              </div>
              <div className="text-muted-foreground text-xs" data-testid="sso-live-session-id">
                Table: <span className="font-mono">{ssoSession.session?.table ?? "auth_sessions"}</span> · Session:{" "}
                <span className="font-mono">{ssoSession.session?.id ?? "pending"}</span> · Digest:{" "}
                <span className="font-mono">{ssoSession.session?.tokenDigest ?? ssoSession.sso.signatureDigest}</span> ·
                Expires: <span className="font-mono">{ssoSession.session?.expiresAt ?? ssoSession.sso.issuedAt}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                Provider: <span className="font-mono">{ssoSession.sso.provider}</span> · Verified Email:{" "}
                <span className="font-mono">{ssoSession.sso.email}</span> · Discovery:{" "}
                <span className="font-mono">
                  {ssoSession.sso.oidc?.discoveryUrl ?? "http://127.0.0.1:8797/.well-known/openid-configuration"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* م137 (Fahad 137): the cards fill the page width, as on every other Settings page (they were max-w-4xl). */}
      <Card>
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>Select AI models for different features.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-0">
          {modelRows.map((r, i) => (
            <div key={r.title}>
              {i > 0 && <Separator className="my-4" />}
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex flex-1 items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <r.icon className="size-4" />
                  </div>
                  <div className="grid gap-0.5">
                    <span className="font-medium text-sm">{r.title}</span>
                    <span className="text-muted-foreground text-sm">{r.description}</span>
                  </div>
                </div>
                <NativeSelect
                  size="sm"
                  value={chosen[r.title]}
                  disabled={!loaded}
                  aria-label={`${r.title} model`}
                  className="md:w-64"
                  onChange={(e) => chooseModel(r.title, e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} · {m.credits} credit/message
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>Enable or disable AI-powered features.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {features.map((f) => (
            <div key={f.title} className="grid gap-3 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <f.icon className="size-4" />
                </div>
                <div className="grid flex-1 gap-0.5">
                  <span className="font-medium text-sm">{f.title}</span>
                  <span className="text-muted-foreground text-sm">{f.description}</span>
                </div>
                <Switch
                  checked={on[f.title]}
                  aria-label={f.title}
                  disabled={!loaded}
                  onCheckedChange={(v) => {
                    setOn((p) => Object.assign({}, p, { [f.title]: v }));
                    void keep({ features: { [f.title]: v } }, () =>
                      setOn((p) => Object.assign({}, p, { [f.title]: !v })),
                    );
                  }}
                />
              </div>
              {f.modelTitle && (
                <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="grid gap-0.5">
                    <span className="text-sm">{f.modelTitle}</span>
                    <span className="text-muted-foreground text-xs">{f.modelDescription}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!on[f.title] && (
                      <Badge variant="outline" className="font-normal">
                        Off
                      </Badge>
                    )}
                    <NativeSelect
                      size="sm"
                      value={chosen[f.modelTitle]}
                      disabled={!on[f.title] || !loaded}
                      aria-label={f.modelTitle}
                      className="md:w-52"
                      onChange={(e) => chooseModel(f.modelTitle as string, e.target.value)}
                    >
                      {models.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </CaptainShell>
  );
}
