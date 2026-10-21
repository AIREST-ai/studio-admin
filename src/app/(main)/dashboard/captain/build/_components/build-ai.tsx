"use client";
// «اربط ذكاءك» (Fahad items 50–52, 54–55), simplified by the design council (merged proposal, section 5):
// a connection card (one provider Select, model, key, one «حفظ واختبار» button, status in the header), the
// «اربط API» link under it, an instructions card whose extra fields sit in a folded «إعدادات متقدمة», and the
// test chat beside the page. Mock only: local state, no fetch.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  CircleCheck,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  Ruler,
  Settings2,
  Thermometer,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

import { CaptainShell, ToneBadge } from "../../_components/shared";
import { TestChat } from "./test-chat";
import { CHANNELS_HREF, lengthOptions, memoryOptions, type ProviderId, providers, T } from "./texts";

type TestState = "idle" | "testing" | "ok";

function Section({
  title,
  description,
  action,
  children,
  footer,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl leading-none">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
      {footer && <CardFooter className="justify-end gap-2 border-t">{footer}</CardFooter>}
    </Card>
  );
}

// The captain-settings row: icon square, title and line under it, the control at the end.
function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="flex flex-1 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </div>
        <div className="grid gap-0.5">
          <span className="font-medium text-sm">{title}</span>
          <span className="text-muted-foreground text-sm">{description}</span>
        </div>
      </div>
      <div className="md:w-64">{children}</div>
    </div>
  );
}

// A standard shadcn Select over a plain list of {value, label} options.
function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const BRAIN_MODE_T = {
  heading: "أي عقل يشغّل موظفك؟",
  sub: "اختر بين عقل إيمه الجاهز والمُدار بالكامل أو ربط مفتاحك وعقلك الخاص مع عزل تام لذاكرة شركتك.",
  emmaTitle: "عقل إيمه الجاهز (موصى به)",
  emmaDesc: "يعمل فوراً برصيد البطارية الذكية دون الحاجة لمفاتيح خارجية أو إعدادات تقنية.",
  customTitle: "عقلك الخاص (مفتاح API خاص بك)",
  customDesc: "اربط OpenAI أو Anthropic أو Gemini أو خادمك الخاص مع تحكم كامل بالنموذج والتعليمات.",
  memoryIsolationBadge: "بنك ذاكرة معزول كلياً لشركتك · لا يختلط بأي شركة أخرى",
};

export function BuildAi() {
  const [brainMode, setBrainMode] = React.useState<"emma" | "custom">("custom");
  const [provider, setProvider] = React.useState<ProviderId>("openai");
  const [model, setModel] = React.useState(providers[0].model);
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState("");
  const [test, setTest] = React.useState<TestState>("idle");
  const [latency, setLatency] = React.useState(0);
  const [error, setError] = React.useState("");

  const [prompt, setPrompt] = React.useState("");
  const [context, setContext] = React.useState("");
  const [memory, setMemory] = React.useState("10");
  const [temperature, setTemperature] = React.useState(0.7);
  const [maxLength, setMaxLength] = React.useState("512");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const [dir, setDir] = React.useState<"ltr" | "rtl">("ltr");
  React.useEffect(() => setDir(document.documentElement.dir === "rtl" ? "rtl" : "ltr"), []);

  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const b = res?.state?.build;
        if (b) {
          if (b.provider) setProvider(b.provider as ProviderId);
          if (b.model) setModel(b.model);
          if (b.prompt) setPrompt(b.prompt);
          if (b.context) setContext(b.context);
          if (b.connected) setTest("ok");
        }
      })
      .catch(() => {});
  }, []);

  const current = providers.find((p) => p.id === provider) ?? providers[0];
  const isCustom = provider === "custom";

  function resetTest() {
    setTest("idle");
    setError("");
  }

  function chooseProvider(id: string) {
    const next = providers.find((p) => p.id === id) ?? providers[0];
    setProvider(next.id);
    setModel(next.model);
    resetTest();
  }

  async function saveAndTest() {
    if (brainMode === "emma") {
      setError("");
      setTest("testing");
      try {
        const res = await fetch("/api/captain-engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "build.test",
            testConnection: true,
            build: {
              brainMode: "emma",
              provider: "emma",
              model: "azure-gpt-6.1-sol",
              prompt,
              context,
              connected: true,
            },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ok?: boolean; latencyMs?: number };
        if (!data?.ok) throw new Error("Failed");
        setLatency(typeof data.latencyMs === "number" ? data.latencyMs : 180);
        setTest("ok");
        toast.success(T.savedAndConnected);
      } catch {
        setTest("idle");
        setError("تعذر الاتصال بالخادم");
        toast.error("تعذر حفظ واختبار الاتصال بالخادم");
      }
      return;
    }
    const checks: [boolean, string][] = [
      [!model.trim(), T.needModel],
      [isCustom && !baseUrl.trim(), T.needUrl],
      [!apiKey.trim(), T.needKey],
    ];
    const missing = checks.find(([empty]) => empty)?.[1];
    if (missing) {
      setError(missing);
      return;
    }
    setError("");
    setTest("testing");
    try {
      const res = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "build.test",
          testConnection: true,
          build: {
            brainMode: "custom",
            provider,
            model,
            baseUrl,
            prompt,
            context,
            memory,
            temperature,
            maxLength,
            connected: true,
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok?: boolean; latencyMs?: number };
      if (!data?.ok) throw new Error("Failed");
      setLatency(typeof data.latencyMs === "number" ? data.latencyMs : 220);
      setTest("ok");
      toast.success(T.savedAndConnected);
    } catch {
      setTest("idle");
      setError("تعذر الاتصال بالخادم");
      toast.error("تعذر حفظ واختبار الإعدادات في الخادم");
    }
  }

  return (
    <CaptainShell title={T.title} subtitle={T.subtitle} switcher={false} nav={false}>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-4">
          {/* اختيار العقل المشغّل + شارة عزل ذاكرة الشركة */}
          <Card className="border-violet-500/25 bg-linear-to-br from-violet-500/10 via-primary/5 to-card">
            <CardHeader className="gap-2 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="size-4 text-violet-600 dark:text-violet-400" />
                  {BRAIN_MODE_T.heading}
                </CardTitle>
                <ToneBadge tone="green">{BRAIN_MODE_T.memoryIsolationBadge}</ToneBadge>
              </div>
              <CardDescription>{BRAIN_MODE_T.sub}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setBrainMode("emma");
                  setTest("ok");
                  setLatency(290);
                }}
                className={cn(
                  "grid gap-1 rounded-xl border p-3.5 text-start transition-all",
                  brainMode === "emma"
                    ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
                    : "bg-background/70 hover:bg-muted/50",
                )}
              >
                <span className="font-semibold text-sm">{BRAIN_MODE_T.emmaTitle}</span>
                <span className="text-muted-foreground text-xs leading-relaxed">{BRAIN_MODE_T.emmaDesc}</span>
              </button>
              <button
                type="button"
                onClick={() => setBrainMode("custom")}
                className={cn(
                  "grid gap-1 rounded-xl border p-3.5 text-start transition-all",
                  brainMode === "custom"
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "bg-background/70 hover:bg-muted/50",
                )}
              >
                <span className="font-semibold text-sm">{BRAIN_MODE_T.customTitle}</span>
                <span className="text-muted-foreground text-xs leading-relaxed">{BRAIN_MODE_T.customDesc}</span>
              </button>
            </CardContent>
          </Card>

          {/* 1. Connection: provider, model, key, base URL, save and test (items 50–51). */}
          <div className="grid gap-2">
            <Section
              title={T.connectionTitle}
              description={T.connectionDesc}
              action={
                <ToneBadge tone={test === "ok" ? "green" : "muted"}>
                  {test === "ok" ? T.connected : T.notConnected}
                </ToneBadge>
              }
              footer={
                <Button disabled={test === "testing"} onClick={saveAndTest}>
                  {test === "testing" && <Loader2 className="animate-spin" />}
                  {test === "testing" ? T.testing : T.saveAndTest}
                </Button>
              }
            >
              <div className="grid gap-2">
                <Label htmlFor="build-provider">{T.provider}</Label>
                <Select value={provider} onValueChange={chooseProvider}>
                  <SelectTrigger id="build-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <p.icon />
                        <span>{p.label}</span>
                        <span className="text-muted-foreground">{p.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="build-model">{T.model}</Label>
                <Input
                  id="build-model"
                  dir="ltr"
                  list="build-models"
                  placeholder={T.modelPlaceholder}
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    resetTest();
                  }}
                />
                <datalist id="build-models">
                  {current.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <span className="text-muted-foreground text-xs">{T.modelHint}</span>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="build-key">{T.apiKey}</Label>
                <InputGroup dir="ltr">
                  <InputGroupAddon>
                    <KeyRound />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="build-key"
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={T.apiKeyPlaceholder}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      resetTest();
                    }}
                  />
                  <InputGroupAddon align="inline-end" className="py-0">
                    <InputGroupButton
                      size="icon-sm"
                      aria-label={showKey ? T.hideKey : T.showKey}
                      title={showKey ? T.hideKey : T.showKey}
                      onClick={() => setShowKey((v) => !v)}
                    >
                      {showKey ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <span className="text-muted-foreground text-xs">{T.apiKeyHint}</span>
              </div>

              {isCustom && (
                <div className="grid gap-2">
                  <Label htmlFor="build-url">{T.baseUrl}</Label>
                  <Input
                    id="build-url"
                    dir="ltr"
                    type="url"
                    placeholder={T.baseUrlPlaceholder}
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      resetTest();
                    }}
                  />
                  <span className="text-muted-foreground text-xs">{T.baseUrlHint}</span>
                </div>
              )}

              {error && <p className="text-destructive text-sm">{error}</p>}
              {test === "ok" && (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CircleCheck className="size-4" />
                  </span>
                  <div className="grid gap-0.5">
                    <span className="font-medium text-emerald-700 text-sm dark:text-emerald-400">{T.testOkTitle}</span>
                    <span className="text-muted-foreground text-xs">
                      {T.testOkDesc} <span className="tabular-nums">{latency}</span> {T.ms}
                    </span>
                  </div>
                </div>
              )}
            </Section>

            {/* Item 52: under the connection, «اربط API» leads to the channels connection page. */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-4 py-3">
              <span className="text-muted-foreground text-sm">{T.linkLead}</span>
              <Link
                href={CHANNELS_HREF}
                className="inline-flex items-center gap-1.5 font-medium text-primary text-sm hover:underline"
              >
                {T.linkApi}
                <ArrowLeft className="size-4 ltr:rotate-180" />
              </Link>
            </div>
          </div>

          {/* 2. Instructions: the system prompt shown, the rest of the standard settings folded (item 54). */}
          <Section
            title={T.promptTitle}
            description={T.promptDesc}
            footer={
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/captain-engine", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "build.save",
                        build: {
                          brainMode,
                          provider,
                          model,
                          baseUrl,
                          prompt,
                          context,
                          memory,
                          temperature,
                          maxLength,
                          connected: test === "ok",
                        },
                      }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = (await res.json()) as { ok?: boolean };
                    if (!data?.ok) throw new Error("Failed");
                    toast.success(T.saved);
                  } catch {
                    toast.error("تعذر حفظ التعليمات في الخادم");
                  }
                }}
              >
                {T.save}
              </Button>
            }
          >
            <div className="grid gap-2">
              <Label htmlFor="build-prompt" className="gap-2">
                <FileText className="size-4 text-muted-foreground" />
                {T.prompt}
              </Label>
              <Textarea
                id="build-prompt"
                className="min-h-32"
                placeholder={T.promptPlaceholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <span className="text-muted-foreground text-xs tabular-nums">
                {prompt.length} {T.chars}
              </span>
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="grid gap-4 rounded-lg border">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-auto w-full justify-between gap-3 px-4 py-3 text-start">
                  <span className="flex items-start gap-3">
                    <Settings2 className="mt-0.5 size-4 text-muted-foreground" />
                    <span className="grid gap-0.5">
                      <span className="font-medium text-sm">{T.advanced}</span>
                      <span className="whitespace-normal font-normal text-muted-foreground text-sm">
                        {T.advancedHint}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      advancedOpen && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-4 px-4 pb-4">
                <div className="grid gap-2">
                  <Label htmlFor="build-context">{T.context}</Label>
                  <Textarea
                    id="build-context"
                    className="min-h-20"
                    placeholder={T.contextPlaceholder}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                  />
                  <span className="text-muted-foreground text-xs">{T.contextHint}</span>
                </div>
                <Separator />
                <SettingRow icon={Brain} title={T.memory} description={T.memoryDesc}>
                  <OptionSelect label={T.memory} value={memory} onChange={setMemory} options={memoryOptions} />
                </SettingRow>
                <Separator />
                <SettingRow icon={Thermometer} title={T.temperature} description={T.temperatureDesc}>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-3">
                      <Slider
                        dir={dir}
                        aria-label={T.temperature}
                        min={0}
                        max={2}
                        step={0.1}
                        value={[temperature]}
                        onValueChange={([v]) => setTemperature(v)}
                      />
                      <span className="w-8 text-end font-medium text-sm tabular-nums" dir="ltr">
                        {temperature.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between pe-11 text-muted-foreground text-xs">
                      <span>{T.precise}</span>
                      <span>{T.creative}</span>
                    </div>
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow icon={Ruler} title={T.maxLength} description={T.maxLengthDesc}>
                  <OptionSelect label={T.maxLength} value={maxLength} onChange={setMaxLength} options={lengthOptions} />
                </SettingRow>
              </CollapsibleContent>
            </Collapsible>
          </Section>
        </div>

        {/* Small test chat beside the page, as in the Playground; it opens after a successful test. */}
        <TestChat
          ready={test === "ok"}
          model={model}
          providerLabel={current.label}
          memory={Number(memory)}
          prompt={prompt}
          context={context}
          temperature={temperature}
          maxLength={Number(maxLength)}
        />
      </div>
    </CaptainShell>
  );
}
