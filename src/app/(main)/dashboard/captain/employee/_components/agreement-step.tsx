"use client";
// الخطوة الأولى «الاتفاق» (البند 6): محادثة قصيرة مع المساعد، وبجانبها البنود المتفق عليها، ثم «التالي».
import * as React from "react";

import { cn } from "cn";
import { ArrowRight, Bot, CircleCheck, Pencil, SendHorizontal, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { ToneBadge } from "../../_components/shared";
import { type EmployeeSettings, type Patch, suggestedTerms, T } from "./data";

export interface Message {
  id: number;
  role: "assistant" | "user";
  text: string;
}

function Bubble({ m }: { m: Message }) {
  const mine = m.role === "user";
  return (
    <div className={cn("flex max-w-[85%] gap-2", mine ? "flex-row-reverse self-end" : "self-start")}>
      {!mine && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
      )}
      <div className="grid gap-1">
        <span className={cn("text-muted-foreground text-xs", mine && "text-end")}>{mine ? T.you : T.assistant}</span>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            mine ? "rounded-se-sm bg-primary text-primary-foreground" : "rounded-ss-sm bg-muted",
          )}
        >
          {m.text}
        </div>
      </div>
    </div>
  );
}

function TermRow({ term, onSave, onRemove }: { term: string; onSave: (text: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(term);
  const commit = () => {
    if (!text.trim()) return;
    onSave(text.trim());
    setEditing(false);
  };
  if (editing)
    return (
      <li className="grid gap-2 p-3">
        <Input
          autoFocus
          aria-label={T.edit}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setText(term);
              setEditing(false);
            }}
          >
            {T.cancel}
          </Button>
          <Button variant="secondary" disabled={!text.trim()} onClick={commit}>
            {T.saveTerm}
          </Button>
        </div>
      </li>
    );
  return (
    <li className="flex items-start gap-2 p-3 text-sm">
      <CircleCheck className="mt-2 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="flex-1 pt-1.5 leading-relaxed">{term}</span>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground"
        aria-label={T.edit}
        title={T.edit}
        onClick={() => {
          setText(term);
          setEditing(true);
        }}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        aria-label={T.remove}
        title={T.remove}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

export function AgreementStep({
  s,
  patch,
  messages,
  onSay,
  onNext,
}: {
  s: EmployeeSettings;
  patch: Patch;
  messages: Message[];
  onSay: (text: string) => void;
  onNext: () => void;
}) {
  const [draft, setDraft] = React.useState("");
  const chatEnd = React.useRef<HTMLDivElement>(null);
  const chips = suggestedTerms.filter((c) => !s.terms.includes(c));

  // ينزل إلى آخر رسالة داخل صندوق المحادثة فقط، بلا تحريك للصفحة.
  React.useEffect(() => {
    const box = chatEnd.current?.parentElement;
    if (messages.length > 1 && box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  const send = (text: string) => {
    onSay(text);
    setDraft("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="h-[520px] gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-4" />
            </span>
            {T.chatTitle}
          </CardTitle>
          <CardDescription>{T.chatDesc}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          <div ref={chatEnd} />
        </CardContent>
        <div className="grid gap-3 border-t p-4">
          {chips.length > 0 && (
            <div className="grid gap-2">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                <Sparkles className="size-3.5 text-amber-500" />
                {T.suggestions}
              </span>
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <Button key={c} variant="outline" onClick={() => send(c)}>
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder={T.inputPlaceholder}
              aria-label={T.inputPlaceholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={T.send}
              title={T.send}
              disabled={!draft.trim()}
              onClick={() => send(draft)}
            >
              <SendHorizontal className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="gap-0 py-0 lg:h-[520px]">
        <CardHeader className="border-b py-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              {T.termsTitle}
              <Badge variant="secondary" className="tabular-nums">
                {s.terms.length}
              </Badge>
            </CardTitle>
            {s.agreed && <ToneBadge tone="green">{T.agreed}</ToneBadge>}
          </div>
          <CardDescription>{T.termsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {s.terms.length ? (
            <ul className="divide-y">
              {s.terms.map((t, i) => (
                <TermRow
                  key={t}
                  term={t}
                  onSave={(text) => {
                    if (s.terms.some((x, j) => j !== i && x === text)) return;
                    patch({ terms: s.terms.map((x, j) => (j === i ? text : x)) });
                  }}
                  onRemove={() => {
                    const terms = s.terms.filter((_, j) => j !== i);
                    patch({ terms, agreed: s.agreed && terms.length > 0 });
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="px-6 py-10 text-center text-muted-foreground text-sm leading-relaxed">{T.termsEmpty}</p>
          )}
        </CardContent>
        <CardFooter className="border-t py-4">
          <Button className="w-full" onClick={onNext}>
            {T.next}
            <ArrowRight className="rtl:rotate-180" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
