"use client";
// «كل شيء سمارت» (بنود فهد 1–4)، منسوخة من صندوق التجربة (../../_components/playground.tsx) ومعدّلة:
// المساعد بيده كل الإعدادات ويسأل العميل ويقترح عليه حتى ينهي إعداده (1، 2)، وكل ما يُذكر يظهر على
// الصفحة الفارغة مثل السحر (3)، وبجانبها لوحة رسائل شفافة تطفو يكتب منها العميل ويرد عليه المساعد (4).
// تبسيط مجلس التصميم بأمر فهد (2026-10-18 18:20): إيمه واقفة بجانب محادثة عادية شبه شفافة، تكتب وتتحدث والعميل
// يكتب، وتحت آخر رسالة منها خيارات قليلة بمقاس القالب العادي بدل الحبوب الصغيرة، و«ما اتفقنا عليه» على الطرف الآخر.
// عرض تجريبي بمطابقة كلمات عربية بسيطة، بلا خادم.
import * as React from "react";

import Image from "next/image";

import { cn } from "cn";
import { Check, Link2, ListChecks, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { CaptainShell } from "../../_components/shared";
import emma from "./assets/emma-blazer.webp";
import { MagicCanvas } from "./canvas";
import { SmartHub } from "./smart-hub";
import { allWords, normalize, noWords, T, type Topic, topics, yesWords } from "./data";

interface Msg {
  id: number;
  role: "user" | "assistant" | "added";
  text: string;
  channelId?: string;
}

const firstMessage: Msg = { id: 0, role: "assistant", text: T.greeting, channelId: "whatsapp" };

const mentions = (n: string, t: Topic) => t.keywords.some((k) => n.includes(normalize(k)));
const saysWord = (n: string, words: string[]) => words.some((w) => ` ${n} `.includes(` ${normalize(w)} `));

export function SmartSetup() {
  const [messages, setMessages] = React.useState<Msg[]>([firstMessage]);
  const [placed, setPlaced] = React.useState<string[]>([]);
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>("whatsapp");
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [activated, setActivated] = React.useState(false);
  const [connectModalTopic, setConnectModalTopic] = React.useState<Topic | null>(null);
  const [accountHandle, setAccountHandle] = React.useState("");

  const committed = React.useRef<string[]>([]);
  const skipped = React.useRef<Set<string>>(new Set());
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = React.useRef(1);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // استرجاع حالة الشركة من المحرك الخلفي الذكي
  React.useEffect(() => {
    fetch("/api/captain-engine")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const smart = res?.state?.smart;
        if (smart && Array.isArray(smart.placed) && smart.placed.length > 0) {
          committed.current = smart.placed;
          setPlaced(smart.placed);
          setActivated(Boolean(smart.activated));
        }
      })
      .catch(() => {});
  }, []);

  const syncEngine = React.useCallback(async (nextPlaced: string[], nextActivated: boolean, onSuccess?: () => void) => {
    try {
      const r = await fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "smart.save",
          placed: nextPlaced,
          activated: nextActivated,
        }),
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data?.ok) {
        onSuccess?.();
      } else {
        toast.error("تعذر حفظ الإعداد في المحرك الخلفي");
      }
    } catch {
      toast.error("تعذر الاتصال بالمحرك الخلفي");
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll down whenever a message is added.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  function connectTopicNow(topic: Topic, handleText?: string) {
    if (!committed.current.includes(topic.id)) {
      committed.current = [...committed.current, topic.id];
    }
    setPlaced((prev) => {
      const next = prev.includes(topic.id) ? prev : [...prev, topic.id];
      void syncEngine(next, activated, () => toast.success(T.connectedToast(topic.label)));
      return next;
    });
    setFresh(topic.id);
    later(1600, () => setFresh(null));

    const remaining = topics.filter((t) => !committed.current.includes(t.id));
    const next = remaining.find((t) => !skipped.current.has(t.id)) ?? remaining[0] ?? null;
    setPending(next?.id ?? null);

    setMessages((m) => [
      ...m,
      {
        id: nextId.current++,
        role: "assistant",
        text: `${topic.doneLine}${handleText ? ` (${handleText})` : ""} ${next ? next.ask : T.allDone}`,
        channelId: next?.kind === "channel" ? next.id : undefined,
      },
    ]);
  }

  function respond(raw: string) {
    const n = normalize(raw);
    const remaining = topics.filter((t) => !committed.current.includes(t.id));
    const isNegated = saysWord(n, noWords);
    let matched = isNegated ? [] : remaining.filter((t) => mentions(n, t));
    let lead = "";
    const all = !isNegated && allWords.some((w) => n.includes(normalize(w)));

    if (all) matched = remaining;
    else if (isNegated && pending) {
      skipped.current.add(pending);
      lead = T.skipped;
    } else if (matched.length === 0 && pending && saysWord(n, yesWords))
      matched = remaining.filter((t) => t.id === pending);
    else if (matched.length === 0 && topics.some((t) => committed.current.includes(t.id) && mentions(n, t)))
      lead = T.already;
    else if (matched.length === 0) lead = T.unknown;

    committed.current = [...committed.current, ...matched.map((t) => t.id)];
    const left = remaining.filter((t) => !matched.includes(t));
    let next = left.find((t) => !skipped.current.has(t.id));
    if (!next && left.length > 0) {
      skipped.current.clear();
      next = left[0];
    }

    const doneText = all
      ? `${T.allPrefix} ${matched.map((t) => t.label).join(T.joiner)}.`
      : matched.map((t) => t.doneLine).join(" ");
    const reply = [lead, doneText, next ? next.ask : T.allDone].filter(Boolean).join(" ");

    setTyping(true);
    later(700, () => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          role: "assistant",
          text: reply,
          channelId: next?.kind === "channel" ? next.id : undefined,
        },
      ]);
      setPending(next?.id ?? null);
    });
    matched.forEach((t, i) => {
      later(850 + i * 320, () => {
        setPlaced((p) => {
          const nextPlaced = p.includes(t.id) ? p : [...p, t.id];
          syncEngine(nextPlaced, activated);
          return nextPlaced;
        });
        setFresh(t.id);
        setMessages((m) => [...m, { id: nextId.current++, role: "added", text: t.label }]);
      });
    });
    if (matched.length > 0) later(850 + matched.length * 320 + 1400, () => setFresh(null));
  }

  function send(text: string) {
    const value = text.trim();
    if (!value) return;
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: value }]);
    setDraft("");
    respond(value);
  }

  function restart() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    committed.current = [];
    skipped.current = new Set();
    setMessages([firstMessage]);
    setPlaced([]);
    setFresh(null);
    setPending("whatsapp");
    setDraft("");
    setTyping(false);
    setActivated(false);
    syncEngine([], false);
  }

  const open = topics.filter((t) => !committed.current.includes(t.id) && !placed.includes(t.id));
  const quick = typing ? [] : [...(pending ? [T.yes, T.no] : []), ...(open.length > 1 ? [T.all] : [])];
  const lastEmma = messages.findLast((m) => m.role === "assistant")?.id;
  const complete = placed.length === topics.length;
  const channelTopics = topics.filter((t) => t.kind === "channel");
  const pendingTopic = topics.find((t) => t.id === pending);

  const handleActivatePlan = async () => {
    const ok = await syncEngine(
      placed,
      true,
      `تم اعتماد وتفعيل خطة إيمه في كل شيء سمارت (${placed.length} عناصر مفعّلة)`,
    );
    if (!ok) {
      toast.error("تعذر حفظ وتفعيل الخطة في الخادم");
      return;
    }
    setActivated(true);
    toast.success("تم تفعيل خطة إيمه وحفظها في الخادم وبنك الذاكرة المعزول");
  };

  const agreed = (
    <MagicCanvas
      placed={placed}
      fresh={fresh}
      activated={activated}
      onActivate={() => void handleActivatePlan()}
      onConnectChannel={(topic) => {
        setAccountHandle("");
        setConnectModalTopic(topic);
      }}
    />
  );

  return (
    <CaptainShell
      title={T.title}
      subtitle={T.subtitle}
      switcher={false}
      nav={false}
      actions={
        <Button variant="outline" onClick={restart}>
          <RotateCcw /> {T.restart}
        </Button>
      }
    >
      <SmartHub />
      <div className="grid gap-4 pb-[72px] xl:h-[calc(100svh-12rem)] xl:min-h-[620px] xl:grid-cols-[minmax(0,1fr)_21rem] xl:pb-0">
        <div className="relative isolate flex h-[36rem] overflow-hidden rounded-2xl border bg-muted/30 xl:h-auto">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute start-10 -top-24 size-96 rounded-full bg-primary/25 blur-3xl" />
            <div className="absolute end-0 -bottom-24 size-96 rounded-full bg-sky-500/20 blur-3xl" />
          </div>

          {/* إيمه */}
          <div className="relative hidden w-40 shrink-0 flex-col items-center justify-end md:flex xl:w-56">
            <div className="absolute bottom-6 h-8 w-36 rounded-full bg-foreground/10 blur-xl" />
            <Image
              src={emma}
              alt={T.emmaAlt}
              priority
              sizes="240px"
              className={cn(
                "relative max-h-[88%] w-auto object-contain transition-transform duration-500",
                typing && "-translate-y-1",
              )}
            />
            <div className="absolute bottom-3 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-sm backdrop-blur">
              <span className={cn("size-2 rounded-full bg-emerald-500", typing && "animate-pulse")} />
              {typing ? T.typing : T.emmaName}
            </div>
          </div>

          {/* المحادثة الشفافة + شريط القنوات الزجاجي للربط في نفس المكان */}
          <section
            aria-label={T.emmaName}
            className="my-4 ms-4 me-4 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/45 shadow-xl backdrop-blur-xl md:ms-0"
          >
            <header className="flex flex-wrap items-center gap-3 border-border/60 border-b px-4 py-3">
              <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                <Image src={emma} alt="" sizes="36px" className="absolute top-0 h-auto w-[140%] max-w-none" />
              </span>
              <div className="grid min-w-0">
                <span className="font-medium text-sm">{T.emmaName}</span>
                <span className="truncate text-muted-foreground text-xs">{typing ? T.typing : T.emmaRole}</span>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="ms-auto xl:hidden">
                    <ListChecks /> {`${T.agreedTitle} · ${placed.length} ${T.of} ${topics.length}`}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full gap-0 p-0 sm:max-w-sm">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{T.agreedTitle}</SheetTitle>
                    <SheetDescription>{T.emptyHint}</SheetDescription>
                  </SheetHeader>
                  <div className="h-full p-3 pt-12">{agreed}</div>
                </SheetContent>
              </Sheet>
            </header>

            {/* أمر فهد: شريط القنوات الخمس في نفس المكان مع زر «اربط الآن» الزجاجي المتجانس */}
            <div className="flex flex-wrap items-center gap-2 border-border/50 border-b bg-background/35 px-4 py-2.5 backdrop-blur-md">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                <Sparkles className="size-3.5 text-primary" />
                {T.channelsBarLabel}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {channelTopics.map((ch) => {
                  const isConnected = placed.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        setAccountHandle("");
                        setConnectModalTopic(ch);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-medium text-xs transition-all duration-200 backdrop-blur-xl",
                        isConnected
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 shadow-xs dark:text-emerald-300"
                          : "border-white/30 bg-white/15 text-foreground shadow-sm hover:border-primary/40 hover:bg-primary/10 dark:border-white/15 dark:bg-white/10",
                      )}
                    >
                      {ch.brand && (
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
                          <path d={ch.brand.path} />
                        </svg>
                      )}
                      <span>{ch.label}</span>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px]",
                          isConnected
                            ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {isConnected ? T.connectedBadge : T.connectNow}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {messages.map((m) =>
                m.role === "added" ? (
                  <div
                    key={m.id}
                    className="fade-in slide-in-from-bottom-1 flex animate-in items-center gap-2 self-start rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm duration-300 xl:hidden"
                  >
                    <Check className="size-4 text-primary" />
                    {`${T.added} ${m.text}`}
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className={cn(
                      "fade-in slide-in-from-bottom-1 grid max-w-[85%] animate-in gap-2 duration-300",
                      m.role === "user" ? "self-end" : "self-start",
                    )}
                  >
                    <span className={cn("text-muted-foreground text-xs", m.role === "user" && "text-end")}>
                      {m.role === "user" ? T.you : T.emmaName}
                    </span>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "rounded-se-sm bg-primary text-primary-foreground"
                          : "rounded-ss-sm border bg-background/80",
                      )}
                    >
                      {m.text}
                    </div>
                    {m.id === lastEmma && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {/* زر «اربط الآن» الزجاجي المتجانس يظهر في نفس المكان لأي قناة مقترحة */}
                        {pendingTopic && pendingTopic.kind === "channel" && !placed.includes(pendingTopic.id) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAccountHandle("");
                              setConnectModalTopic(pendingTopic);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 font-semibold text-emerald-700 text-sm shadow-lg backdrop-blur-xl transition-all hover:scale-[1.01] hover:bg-emerald-500/25 dark:text-emerald-300"
                          >
                            <Link2 className="size-4" />
                            <span>{`${T.connectNow} · ${pendingTopic.label}`}</span>
                          </button>
                        )}
                        {quick.map((q) => (
                          <Button
                            key={q}
                            variant="outline"
                            className="justify-start bg-background/70 backdrop-blur-md"
                            onClick={() => send(q)}
                          >
                            {q}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
              {typing && (
                <div className="flex items-center gap-1 self-start rounded-2xl rounded-ss-sm border bg-background/80 px-4 py-3">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                  <span className="sr-only">{T.typing}</span>
                </div>
              )}
            </div>

            <div className="grid gap-2 border-border/60 border-t p-3">
              {complete && (
                <Button
                  className="xl:hidden"
                  onClick={() => {
                    setActivated(true);
                    syncEngine(placed, true);
                  }}
                  disabled={activated}
                >
                  <Check /> {activated ? T.activated : T.activate}
                </Button>
              )}
              <InputGroup className="bg-background/80">
                <InputGroupTextarea
                  placeholder={T.placeholder}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  className="min-h-10"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-sm"
                    variant="default"
                    aria-label={T.send}
                    disabled={!draft.trim()}
                    onClick={() => send(draft)}
                  >
                    <SendHorizontal className="rtl:-scale-x-100" />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </section>
        </div>

        {/* ما اتفقنا عليه */}
        <div className="hidden xl:block xl:min-h-0">{agreed}</div>
      </div>

      {/* نافذة الربط الزجاجية في نفس المكان دون مغادرة الصفحة */}
      <Dialog open={connectModalTopic !== null} onOpenChange={(o) => !o && setConnectModalTopic(null)}>
        <DialogContent className="border-white/25 bg-background/85 shadow-2xl backdrop-blur-2xl sm:max-w-md">
          {connectModalTopic && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {connectModalTopic.brand && (
                    <span className="flex size-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
                        <path d={connectModalTopic.brand.path} />
                      </svg>
                    </span>
                  )}
                  <span>{`${T.connectModalTitle} · ${connectModalTopic.label}`}</span>
                </DialogTitle>
                <DialogDescription>{T.connectModalDesc}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-800 text-xs dark:text-emerald-300">
                  {T.instantOAuth}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="smart-channel-handle">{T.accountLabel}</Label>
                  <Input
                    id="smart-channel-handle"
                    dir="ltr"
                    placeholder={T.accountPlaceholder}
                    value={accountHandle}
                    onChange={(e) => setAccountHandle(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild>
                  <Button variant="outline">{T.cancel}</Button>
                </DialogClose>
                <Button
                  onClick={() => {
                    const topic = connectModalTopic;
                    setConnectModalTopic(null);
                    if (topic) connectTopicNow(topic, accountHandle.trim() || undefined);
                  }}
                >
                  <Link2 className="size-4" />
                  {`${T.confirmConnect} · ${connectModalTopic.label}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </CaptainShell>
  );
}
