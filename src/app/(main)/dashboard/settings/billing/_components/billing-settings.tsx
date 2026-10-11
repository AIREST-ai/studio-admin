"use client";
import * as React from "react";

import { cn } from "cn";
import { ExternalLink, MessageCircle, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const packages = [
  { credits: "1,000", price: "$20" },
  { credits: "2,500", price: "$45", popular: true },
  { credits: "6,000", price: "$100" },
  { credits: "12,000", price: "$180" },
];

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.round((used / total) * 100);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {used.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <Progress value={pct} />
      <span className="text-muted-foreground text-xs tabular-nums">{pct}% used this cycle</span>
    </div>
  );
}

export function BillingSettings() {
  const [buyOpen, setBuyOpen] = React.useState(false);
  const [pick, setPick] = React.useState("2,500");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid max-w-2xl gap-1.5">
          <h1 className="font-semibold text-xl">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Manage your subscription here, upgrade your plan and get more for your team.
          </p>
        </div>
        <Button variant="outline">
          View Pricing <ExternalLink />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are currently subscribed to the <strong className="text-foreground">Business</strong> plan with{" "}
            <strong className="text-foreground">12</strong> licenses
          </CardDescription>
          <CardAction>
            <Badge
              variant="secondary"
              className="bg-emerald-100 font-normal text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
            <DetailItem label="Current Plan" value="Business" />
            <DetailItem label="Number of seats" value="12" />
            <DetailItem label="Renews on" value="Nov 3, 2026" />
            <DetailItem label="Currency" value="US Dollar (USD)" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-500" /> Captain
            </CardTitle>
            <CardDescription>Manage usage and credits for Captain AI.</CardDescription>
            <CardAction className="flex gap-2">
              <Button variant="ghost" size="sm">
                <RefreshCw /> Refresh
              </Button>
              <Button size="sm" onClick={() => setBuyOpen(true)}>
                Buy more credits
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Meter label="Credits" used={3420} total={5000} />
            <Meter label="Documents" used={46} total={200} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage your subscription</CardTitle>
              <CardDescription>
                View your previous invoices, edit your billing details, or cancel your subscription.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline">
                Go to the billing portal <ExternalLink />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Need help?</CardTitle>
              <CardDescription>Do you face any issues in billing? We are here to help.</CardDescription>
              <CardAction>
                <Button variant="secondary">
                  <MessageCircle /> Chat with us
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buy AI Credits</DialogTitle>
            <DialogDescription>Purchase additional credits for Captain AI.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {packages.map((p) => (
              <button
                key={p.credits}
                type="button"
                onClick={() => setPick(p.credits)}
                className={cn(
                  "relative grid gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50",
                  pick === p.credits && "border-primary ring-1 ring-primary",
                )}
              >
                {p.popular && (
                  <Badge className="absolute top-2 right-2 h-4 px-1.5 text-[10px]">Most Popular</Badge>
                )}
                <span className="font-semibold text-lg tabular-nums">{p.credits}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider">CREDITS</span>
                <span className="mt-1 text-sm">
                  <span className="font-medium">{p.price}</span>{" "}
                  <span className="text-muted-foreground text-xs">one-time</span>
                </span>
              </button>
            ))}
          </div>
          <Separator />
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="font-medium text-foreground">Note:</span> Credits are added immediately and expire in 6
            months. An active subscription is required to use credits. Purchased credits are consumed after your
            monthly plan credits.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button>Purchase Credits</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
