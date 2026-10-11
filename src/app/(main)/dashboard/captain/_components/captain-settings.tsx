"use client";

import { Bot, ExternalLink, Mic, PenLine, Search, Sparkles, Tags } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { models } from "./data";

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
    on: false,
  },
];

export function CaptainSettings() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="grid gap-1.5">
        <h1 className="font-semibold text-xl">Captain Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure your AI models and features for Captain. Captain follows a credit based billing, you will be charged
          credits for every action Captain takes based on the model selected.{" "}
          <Button variant="link" className="h-auto p-0 text-sm">
            Learn more about Captain Credits <ExternalLink className="size-3" />
          </Button>
        </p>
      </div>

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
                <NativeSelect size="sm" defaultValue={r.value} className="md:w-60">
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
                <Switch defaultChecked={f.on} aria-label={f.title} />
              </div>
              {f.modelTitle && (
                <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 md:flex-row md:items-center md:justify-between">
                  <span className="text-sm">{f.modelTitle}</span>
                  <div className="flex items-center gap-2">
                    {!f.on && (
                      <Badge variant="outline" className="font-normal">
                        Off
                      </Badge>
                    )}
                    <NativeSelect size="sm" defaultValue="gpt-4.1-mini" disabled={!f.on} className="md:w-52">
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
    </div>
  );
}
