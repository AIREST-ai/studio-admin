import { CheckCheck, Layers, MessageSquareWarning, MessagesSquare, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCards() {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <MessagesSquare className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Conversations evaluated</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">4,812</div>
            <Badge>
              <TrendingUp className="size-3" />
              +8.4%
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Scored chats in the last 30 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <MessageSquareWarning className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Dodges detected</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">386</div>
            <Badge>
              <TrendingDown className="size-3" />
              -21.2%
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">8% of chats · down from 490</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <CheckCheck className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Solved on first reply</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">71.4%</div>
            <Badge>
              <TrendingUp className="size-3" />
              +3.2 pts
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Of chats evaluated in 30 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Layers className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Dodges by channel</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">172</div>
            <Badge>WhatsApp · 45%</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Instagram 98 · Messenger 71 · TikTok 45</p>
        </CardContent>
      </Card>
    </div>
  );
}
