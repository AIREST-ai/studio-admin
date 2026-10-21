"use client";
// A small copy of the Captain Playground chat (playground.tsx): bubbles and an InputGroup composer. Mock replies.
import * as React from "react";

import { cn } from "cn";
import { Bot, Eraser, SendHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";

import { T } from "./texts";

interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export function TestChat({
  ready,
  model,
  providerLabel,
  memory,
  prompt,
  context,
  temperature,
  maxLength,
}: {
  ready: boolean;
  model: string;
  providerLabel: string;
  memory: number;
  prompt?: string;
  context?: string;
  temperature?: number;
  maxLength?: number;
}) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  // A changed connection locks the test again, so the old test talk is cleared.
  React.useEffect(() => {
    if (!ready) setMessages([]);
  }, [ready]);

  React.useEffect(() => {
    if (messages.length || typing) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, typing]);

  async function send() {
    const text = draft.trim();
    if (!text || !ready || typing) return;
    const historyWindow = memory > 0 ? messages.slice(-memory) : [];
    setDraft("");
    setMessages((p) => [...p, { id: Date.now(), role: "user", text }]);
    setTyping(true);
    try {
      const res = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-chat.send",
          mode: "build",
          message: text,
          history: historyWindow,
          model,
          prompt,
          context,
          temperature,
          maxLength,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok?: boolean; reply?: string };
      const reply = data?.reply?.trim();
      if (!data?.ok || !reply) throw new Error("Empty reply");
      setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant", text: reply }]);
    } catch {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "تعذر الاتصال ببوابة النماذج الحية حالياً، يرجى المحاولة مرة أخرى.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <Card className="gap-0 py-0 xl:sticky xl:top-4 xl:h-[calc(100svh-15rem)] xl:min-h-[520px]">
      <CardHeader className="border-b py-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{T.chatTitle}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            aria-label={T.clear}
            title={T.clear}
            disabled={!messages.length}
            onClick={() => setMessages([])}
          >
            <Eraser />
          </Button>
        </div>
        <CardDescription>{T.chatDesc}</CardDescription>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="secondary" className="font-normal">
            {providerLabel}
          </Badge>
          {model && (
            <Badge variant="outline" className="font-normal" dir="ltr">
              {model}
            </Badge>
          )}
          <Badge variant="outline" className="font-normal">
            {T.memoryNote} {memory} {T.messages}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-64 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {!ready && (
          <div className="m-auto grid justify-items-center gap-2 text-center">
            <span className="flex size-9 items-center justify-center rounded-lg border bg-muted">
              <Bot className="size-4 text-muted-foreground" />
            </span>
            <span className="text-muted-foreground text-sm">{T.chatLocked}</span>
          </div>
        )}
        {ready && messages.length === 0 && !typing && (
          <div className="m-auto grid justify-items-center gap-2 text-center">
            <span className="flex size-9 items-center justify-center rounded-lg border bg-muted">
              <Bot className="size-4 text-muted-foreground" />
            </span>
            <span className="text-muted-foreground text-sm">{T.chatEmpty}</span>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "rounded-se-sm bg-primary text-primary-foreground" : "rounded-ss-sm bg-muted",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-ss-sm bg-muted px-3.5 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </CardContent>

      <div className="border-t p-3">
        <InputGroup>
          <InputGroupTextarea
            placeholder={T.chatPlaceholder}
            aria-label={T.chatPlaceholder}
            disabled={!ready}
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
          <InputGroupAddon align="block-end" className="justify-end">
            <InputGroupButton
              size="icon-sm"
              variant="default"
              aria-label={T.send}
              title={T.send}
              disabled={!ready || !draft.trim()}
              onClick={send}
            >
              <SendHorizontal className="rtl:rotate-180" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </Card>
  );
}
