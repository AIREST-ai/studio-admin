"use client";
import * as React from "react";

import { cn } from "cn";
import { ExternalLink, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

import { PageHeader } from "../../labels/_shared/settings-shell";

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
  const [step, setStep] = React.useState<"pick" | "confirm">("pick");
  const [refreshing, setRefreshing] = React.useState(false);
  const [credits, setCredits] = React.useState({ used: 3420, total: 5000 });
  const [currency, setCurrency] = React.useState("USD");
  const picked = packages.find((p) => p.credits === pick) ?? packages[1];

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
  }

  function confirmPurchase() {
    const added = Number(picked.credits.replace(",", ""));
    setCredits((c) => ({ ...c, total: c.total + added }));
    setBuyOpen(false);
    toast.success(`Successfully added ${picked.credits} credits to your account`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Billing"
        description="Manage your subscription here, upgrade your plan and get more for your team."
        actions={
          <Button variant="outline" asChild>
            <a href="https://www.chatwoot.com/pricing" target="_blank" rel="noreferrer">
              View Pricing <ExternalLink />
            </a>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Current Plan", value: "Business" },
          { label: "Number of seats", value: "12" },
          { label: "Renews on", value: "Nov 3, 2026" },
          { label: "Captain credits left", value: (credits.total - credits.used).toLocaleString() },
        ].map((stat) => (
          <Card key={stat.label} className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
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
            <DetailItem label="Currency" value={currency === "USD" ? "US Dollar (USD)" : "Brazilian Real (BRL)"} />
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
              <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing}>
                <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setStep("pick");
                  setBuyOpen(true);
                }}
              >
                Buy more credits
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Meter label="Credits" used={credits.used} total={credits.total} />
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
              <Button variant="outline" onClick={() => toast("Opening the billing portal...")}>
                Go to the billing portal <ExternalLink />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Need help?</CardTitle>
              <CardDescription>Do you face any issues in billing? We are here to help.</CardDescription>
              <CardAction>
                <Button variant="secondary" onClick={() => toast("Support chat opened")}>
                  <MessageCircle /> Chat with us
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose your billing currency</CardTitle>
          <CardDescription>
            Select the currency you'd like to be billed in. This can't be changed once your subscription is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={currency} onValueChange={setCurrency} className="grid gap-3 sm:grid-cols-2">
            {[
              { value: "USD", label: "US Dollar (USD)" },
              { value: "BRL", label: "Brazilian Real (BRL)" },
            ].map((option) => (
              <Label
                key={option.value}
                className="items-center gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary"
              >
                <RadioGroupItem value={option.value} />
                {option.label}
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="sm:max-w-lg">
          {step === "confirm" ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Purchase</DialogTitle>
                <DialogDescription>
                  You are about to purchase {picked.credits} credits for {picked.price}.
                </DialogDescription>
              </DialogHeader>
              <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-sm">
                Your saved card will be charged immediately upon confirmation.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("pick")}>
                  Go Back
                </Button>
                <Button onClick={confirmPurchase}>Confirm Purchase</Button>
              </DialogFooter>
            </>
          ) : (
            <>
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
            <Button onClick={() => setStep("confirm")}>Purchase Credits</Button>
          </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
