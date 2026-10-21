"use client";
// «ما اتفقنا عليه» (بند فهد 3): فارغة في البداية، وكل ما يُتفق عليه مع إيمه يظهر فيها بهدوء سطراً سطراً.
// تبسيط مجلس التصميم (2026-10-18): قائمة واحدة مرتبة بدل اللوح المنقّط، ومؤشر «3 من 8»، وزر رئيسي واحد عند الاكتمال.
import { cn } from "cn";
import { Check, Link2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { ToneBadge } from "../../_components/shared";
import { T, type Topic, topics } from "./data";

const appear = "fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-500";

function BrandMark({ topic, className }: { topic: Topic; className?: string }) {
  if (topic.brand) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("fill-current", className)}>
        <path d={topic.brand.path} />
      </svg>
    );
  }
  const Icon = topic.icon;
  return Icon ? <Icon className={className} /> : null;
}

function AgreedRow({ topic, fresh }: { topic: Topic; fresh: boolean }) {
  const detail = topic.quote ?? topic.lines?.[0] ?? topic.doneLine;
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors duration-1000",
        fresh && "border-primary/40 bg-primary/5",
        appear,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <BrandMark topic={topic} className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium text-sm">{topic.label}</span>
        <span className="text-muted-foreground text-xs leading-relaxed">{detail}</span>
      </span>
      <Check className="mt-1 size-4 shrink-0 text-emerald-600" />
    </li>
  );
}

export function MagicCanvas({
  placed,
  fresh,
  activated,
  onActivate,
  onConnectChannel,
}: {
  placed: string[];
  fresh: string | null;
  activated: boolean;
  onActivate: () => void;
  onConnectChannel?: (topic: Topic) => void;
}) {
  const items = placed.map((id) => topics.find((t) => t.id === id)).filter((t): t is Topic => Boolean(t));
  const unlinkedChannels = topics.filter((t) => t.kind === "channel" && !placed.includes(t.id));
  const total = topics.length;
  const complete = items.length === total;

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="gap-2 border-b py-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{T.agreedTitle}</CardTitle>
          <span className="ms-auto">
            {complete ? (
              <ToneBadge tone="green">{T.done}</ToneBadge>
            ) : (
              <span className="text-muted-foreground text-sm tabular-nums">{`${items.length} ${T.of} ${total}`}</span>
            )}
          </span>
        </div>
        <Progress value={(items.length / total) * 100} aria-label={`${T.progress} ${items.length} ${T.of} ${total}`} />
        <CardDescription className="sr-only">{T.emptyHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex min-h-24 flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground text-sm">
            <Sparkles className="size-5 text-primary/70" />
            {T.emptyHint}
          </div>
        ) : (
          <ul className="grid gap-2">
            {items.map((t) => (
              <AgreedRow key={t.id} topic={t} fresh={fresh === t.id} />
            ))}
          </ul>
        )}

        {unlinkedChannels.length > 0 && onConnectChannel && (
          <div className="mt-auto grid gap-1.5 rounded-xl border border-dashed bg-muted/20 p-2.5">
            <span className="font-medium text-muted-foreground text-xs">{T.channelsBarLabel}</span>
            <div className="grid gap-1.5">
              {unlinkedChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onConnectChannel(ch)}
                  className="flex items-center justify-between rounded-lg border border-white/25 bg-background/70 px-2.5 py-1.5 text-xs shadow-xs backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <BrandMark topic={ch} className="size-3.5 text-muted-foreground" />
                    {ch.label}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                    <Link2 className="size-3" />
                    {T.connectNow}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      {items.length > 0 && (
        <CardFooter className="border-t py-3">
          <Button className="w-full" onClick={onActivate} disabled={activated}>
            <Check /> {activated ? T.activated : T.activate}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
