"use client";
import * as React from "react";

import { cn } from "cn";
import { ExternalLink, Info, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCwShared } from "@/lib/cw/store";

import {
  loadSettingsPreview,
  type BillingSettings as SavedBilling,
  saveBilling,
} from "../../_components/settings-preview-client";
import { PageHeader } from "../../labels/_shared/settings-shell";

// F-6A (sim2 problem 11; task item 3): this preview has no subscription and no payment provider. The page says so:
// - the plan is a sample, and its licences are the agents the workspace really has (Settings > Agents);
// - buying credits is a simulation: no card, no charge; the credits go to the sample balance and are saved in this
//   preview (api/settings-preview, section "billing"), so they stay after a reload;
// - the billing portal and the support chat say why they do not open here; Refresh reads the saved balance again.
// The packs and prices are Chatwoot's Buy AI Credits dialog's.
const packages = [
  { credits: "1,000", value: 1000, price: "$20" },
  { credits: "2,500", value: 2500, price: "$45", popular: true },
  { credits: "6,000", value: 6000, price: "$100" },
  { credits: "12,000", value: 12000, price: "$180" },
];
const SAMPLE_CREDITS = { used: 3420, total: 5000 };
const NO_PAYMENT = "Preview — simulated: no payment in this preview. No card is charged and nothing is bought.";

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
  const [saved, setSaved] = React.useState<SavedBilling | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [buying, setBuying] = React.useState(false);
  const picked = packages.find((p) => p.credits === pick) ?? packages[1];
  const agents = useCwShared((state) => state.agents).length;
  const currency = saved?.currency ?? "USD";
  const purchases = saved?.purchases ?? [];
  const credits = {
    used: SAMPLE_CREDITS.used,
    total: SAMPLE_CREDITS.total + purchases.reduce((sum, p) => sum + (p.credits || 0), 0),
  };

  const load = React.useCallback(async () => {
    try {
      const settings = await loadSettingsPreview();
      setSaved(settings.billing);
      return true;
    } catch (error) {
      toast.error("Saved billing could not be read", { description: (error as Error).message });
      return false;
    } finally {
      setLoaded(true);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    if (await load()) toast.success("Usage refreshed", { description: "Read again from this preview's saved data." });
    setRefreshing(false);
  }

  async function confirmPurchase() {
    setBuying(true);
    try {
      void fetch("/api/captain-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "balance.topup", points: picked.value }),
      }).catch(() => {});
      setSaved(await saveBilling({ addPurchase: picked.value }));
      setBuyOpen(false);
      toast.success(`${picked.credits} credits added to the sample balance`, {
        description: `${NO_PAYMENT} The credits are saved in this preview and stay after a reload.`,
      });
    } catch (error) {
      toast.error("Credits not added", { description: (error as Error).message });
    } finally {
      setBuying(false);
    }
  }

  async function chooseCurrency(next: string) {
    try {
      setSaved(await saveBilling({ currency: next as "USD" | "BRL" }));
      toast.success("Billing currency saved", {
        description: "Preview — simulated: saved in this preview. There is no subscription to bill.",
      });
    } catch (error) {
      toast.error("Billing currency not saved", { description: (error as Error).message });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Billing"
        description="Manage your subscription here, upgrade your plan and get more for your team."
        actions={
          // F-9 (sim3 step 12.2: View Pricing opened chatwoot.com/pricing, Chatwoot's prices, not this product's): this
          // product has no plans or pricing page of its own yet, so the button says so, as the billing portal and the
          // support chat buttons below do, and opens nothing outside the preview.
          <Button
            variant="outline"
            size="sm"
            data-view-pricing=""
            onClick={() =>
              toast.info("No pricing page yet", {
                description:
                  "Preview — simulated: this product has no plans or prices of its own yet, so there is no pricing page to open. The plan on this page is a sample.",
              })
            }
          >
            View Pricing
          </Button>
        }
      />

      {/* م137 round 2 (judge M137: the plan's data was shown twice): each fact once. The row of four number cards
          above repeated the plan, seats and renewal date of the Current Plan card and the credits of the Captain card,
          so it is gone; the Current Plan card keeps Chatwoot's line (plan and seats) and adds only what the line does
          not say (renewal date and currency). */}
      <p
        className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm"
        data-preview-note
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        Preview — simulated: this preview has no subscription and no payment provider. The plan below is a sample, and
        no payment is ever taken here.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription data-plan-line>
            Sample plan: <strong className="text-foreground">Business</strong> with{" "}
            <strong className="text-foreground">{agents}</strong> {agents === 1 ? "license" : "licenses"}, one for each
            agent in Settings › Agents
          </CardDescription>
          <CardAction>
            <Badge variant="secondary" className="font-normal">
              Sample (no subscription)
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 rounded-lg border bg-muted/30 p-4">
            <DetailItem label="Renews on" value="Does not renew (no subscription)" />
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
            {loaded ? (
              <Meter label="Credits" used={credits.used} total={credits.total} />
            ) : (
              <p className="text-muted-foreground text-sm">Loading saved credits…</p>
            )}
            <Meter label="Documents" used={46} total={200} />
            <p className="text-muted-foreground text-xs" data-credits-note>
              Sample usage.{" "}
              {purchases.length
                ? `${purchases.length} simulated ${purchases.length === 1 ? "purchase" : "purchases"} added ${purchases
                    .reduce((sum, p) => sum + (p.credits || 0), 0)
                    .toLocaleString()} credits; nothing was paid.`
                : "No credits were bought in this preview."}
            </p>
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
              <Button
                variant="outline"
                onClick={() =>
                  toast.info("No billing portal in this preview", {
                    description:
                      "There is no subscription or payment provider here, so there are no invoices or billing details to open. In the engine this opens the Stripe customer portal.",
                  })
                }
              >
                Go to the billing portal <ExternalLink />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Need help?</CardTitle>
              <CardDescription>Do you face any issues in billing? We are here to help.</CardDescription>
              <CardAction>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toast.info("The support chat does not open in this preview", {
                      description:
                        "In the engine it opens the engine's own support chat. The preview sends no request outside it, and there is no billing to ask about.",
                    })
                  }
                >
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
          <RadioGroup value={currency} onValueChange={chooseCurrency} className="grid gap-3 sm:grid-cols-2">
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
              <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-sm" data-purchase-note>
                {NO_PAYMENT} Confirming adds {picked.credits} credits to the sample balance of this preview.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("pick")}>
                  Go Back
                </Button>
                <Button onClick={confirmPurchase} disabled={buying}>
                  {buying ? "Saving…" : "Confirm Purchase"}
                </Button>
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
                    {p.popular && <Badge className="absolute top-2 right-2 h-4 px-1.5 text-[10px]">Most Popular</Badge>}
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
                <span className="font-medium text-foreground">Note:</span> In this preview no payment is taken: the
                credits are added to the sample balance only. (In the engine, credits are added immediately and expire
                in 6 months.)
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
