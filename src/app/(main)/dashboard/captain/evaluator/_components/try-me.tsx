"use client";
// صندوق الذكاء الاصطناعي للرسائل مع الاختبار «جرّبني» (20): محادثة تجربة صغيرة بردود وهمية،
// تُفتح في نافذة جانبية (Sheet) من زر «جرّبني» أعلى الصفحة. المحادثة تبقى بين الفتح والإغلاق.
import * as React from "react";

import { cn } from "cn";
import { Bot, FlaskConical, RotateCcw, SendHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { IconBox } from "./ui";

const T = {
  title: "صندوق الرسائل",
  desc: "جرّبني: اكتب كأنك عميل وشاهد كيف أرد.",
  reset: "من جديد",
  close: "إغلاق",
  placeholder: "اكتب رسالتك…",
  send: "إرسال",
  note: "رسائل التجربة تُخصم من رصيدك.",
  hello: "أهلاً بك! أنا المقيّم الذكي. اكتب لي كأنك عميل وسأرد عليك.",
  replies: [
    "فهمت طلبك. أتحقق من التفاصيل وأعود إليك خلال لحظات.",
    "شكراً لصبرك. طلبك في الطريق ويصل خلال يومين.",
    "هذا يحتاج فريق الدعم التقني، سأحوّلك إليهم الآن.",
    "تم. هل تحتاج شيئاً آخر؟",
  ],
};

interface Msg {
  id: number;
  me: boolean;
  text: string;
}

const first: Msg[] = [{ id: 0, me: false, text: T.hello }];

export function TryMeSheet({
  open,
  onOpenChange,
  side,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
}) {
  const [msgs, setMsgs] = React.useState(first);
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (msgs.length > 1 || typing) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msgs, typing]);

  const send = async () => {
    const text = draft.trim();
    if (!text || typing) return;
    const historyPayload = msgs.map((m) => ({
      role: m.me ? ("user" as const) : ("assistant" as const),
      text: m.text,
    }));
    setMsgs((p) => [...p, { id: Date.now(), me: true, text }]);
    setDraft("");
    setTyping(true);
    try {
      const res = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "try-me.chat",
          mode: "evaluator",
          message: text,
          history: historyPayload,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok?: boolean; reply?: string };
      const reply = data?.reply?.trim();
      if (!data?.ok || !reply) throw new Error("Empty reply");
      setMsgs((p) => [...p, { id: Date.now() + 1, me: false, text: reply }]);
    } catch {
      setMsgs((p) => [
        ...p,
        { id: Date.now() + 1, me: false, text: "تعذر الاتصال ببوابة النماذج الحية حالياً، يرجى المحاولة مرة أخرى." },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} showCloseButton={false} className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-3">
            <IconBox icon={FlaskConical} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <SheetTitle>{T.title}</SheetTitle>
              <SheetDescription>{T.desc}</SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={T.reset}
              title={T.reset}
              onClick={() => {
                setMsgs(first);
              }}
            >
              <RotateCcw />
            </Button>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label={T.close}>
                <X />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 bg-muted/20 p-4">
          <div className="grid content-start gap-3 overflow-y-auto p-1">
            {msgs.map((m) => (
              <div key={m.id} className={cn("flex items-end gap-2", m.me && "flex-row-reverse")}>
                {!m.me && (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-4" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    m.me ? "rounded-ee-sm bg-primary text-primary-foreground" : "rounded-es-sm border bg-background",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex items-end gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </span>
                <div className="flex gap-1 rounded-2xl rounded-es-sm border bg-background px-3.5 py-3">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
          <InputGroup className="bg-background">
            <InputGroupTextarea
              placeholder={T.placeholder}
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
              <span className="text-muted-foreground text-xs">{T.note}</span>
              <InputGroupButton size="icon-sm" variant="default" aria-label={T.send} onClick={send}>
                <SendHorizontal className="rtl:rotate-180" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
