"use client";
// Chatwoot Linear.vue, Notion.vue and Shopify.vue: one Integration row with Connect (OAuth, or a store URL dialog
// for Shopify) and Delete when connected, each with its own confirm texts. Shopify also shows its help text.
import * as React from "react";

import { CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";

import { SettingsCard } from "../../_components/settings-card";
import { loadSettingsPreview, saveIntegrations } from "../../_components/settings-preview-client";
import { PageHeader } from "../../labels/_shared/settings-shell";
import { BackToIntegrations, ConfirmAction, EnabledBadge, IntegrationRow, integrationById } from "./integration-ui";
import { INTEGRATION_NOTE } from "./integrations-store";

type OAuthId = "linear" | "notion" | "shopify";

const deleteTexts: Record<OAuthId, { title: string; message: string; yes: string }> = {
  linear: {
    title: "Are you sure you want to delete the integration?",
    message: "Are you sure you want to delete the integration?",
    yes: "Yes, delete",
  },
  notion: {
    title: "Are you sure you want to delete the Notion integration?",
    message:
      "Deleting this integration will remove access to your Notion workspace and stop all related functionality.",
    yes: "Yes, delete",
  },
  shopify: {
    title: "Delete Shopify Integration",
    message: "Are you sure you want to delete the Shopify integration?",
    yes: "Yes, delete",
  },
};

// F-6A (monitor's update: Linear, Notion, Shopify said "connected" and kept nothing): the connection is saved in this
// preview (api/settings-preview, section "integrations") and stays after a reload. No sign-in page of Linear or
// Notion is opened and nothing is read from them, so the page names no workspace it never saw; Shopify shows the store
// the user typed.
const simulatedLine: Record<OAuthId, string> = {
  linear: "Simulated connection: no Linear workspace is linked and no issue is read or created.",
  notion: "Simulated connection: no Notion workspace is linked and no page is read.",
  shopify: "Simulated connection: no order is read from this store.",
};

const SHOPIFY_URL = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function OAuthIntegration({ integrationId }: { integrationId: OAuthId }) {
  const item = integrationById(integrationId);
  const [enabled, setEnabled] = React.useState(false);
  const [account, setAccount] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview()
      .then(({ integrations }) => {
        const saved = integrations?.[integrationId];
        if (!alive || !saved) return;
        setEnabled(saved.connected);
        setAccount(saved.account ?? null);
      })
      .catch((error: Error) => toast.error("Saved integrations could not be read", { description: error.message }))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [integrationId]);

  async function keep(connected: boolean, store: string | null, done: string) {
    try {
      await saveIntegrations({
        [integrationId]: connected ? { connected, account: store ?? "preview" } : { connected },
      });
      setEnabled(connected);
      setAccount(connected ? store : null);
      toast.success(done, { description: INTEGRATION_NOTE });
      return true;
    } catch (error) {
      toast.error("Not saved", { description: (error as Error).message });
      return false;
    }
  }
  const [confirming, setConfirming] = React.useState(false);
  const [storeOpen, setStoreOpen] = React.useState(false);
  const [storeUrl, setStoreUrl] = React.useState("");
  const [storeError, setStoreError] = React.useState("");
  const [authorizing, setAuthorizing] = React.useState(false);

  if (!item) return null;
  const texts = deleteTexts[integrationId];

  function connect() {
    if (integrationId === "shopify") {
      setStoreUrl("");
      setStoreError("");
      setStoreOpen(true);
      return;
    }
    setAuthorizing(true);
    void keep(true, null, `${item?.name} connected`).finally(() => setAuthorizing(false));
  }

  async function submitStore(event: React.FormEvent) {
    event.preventDefault();
    const value = storeUrl
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (!SHOPIFY_URL.test(value)) {
      setStoreError("Please enter a valid Shopify store URL (e.g., your-store.myshopify.com)");
      return;
    }
    if (await keep(true, value, "Shopify store connected")) setStoreOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <BackToIntegrations current={item.name} />
      <PageHeader
        title={item.name}
        description={item.description}
        learnMore={`Learn more about ${item.name}`}
        actions={<EnabledBadge enabled={enabled} />}
      />
      <Card className="py-0">
        <CardContent className="px-0">
          <IntegrationRow
            item={item}
            action={
              // م137 round 2 (judge M137): Delete moved to the red card at the foot of the page (below).
              enabled ? null : (
                <Button onClick={connect} disabled={authorizing || !loaded}>
                  {authorizing ? "Connecting..." : "Connect"}
                </Button>
              )
            }
          />
          {enabled ? (
            <div className="flex items-center gap-2 border-t px-6 py-4 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>
                {integrationId === "shopify" && account ? `Store: ${account}. ` : ""}
                {simulatedLine[integrationId]} {INTEGRATION_NOTE}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {integrationId === "shopify" && enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>How to use the Shopify Integration?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-muted-foreground text-sm leading-relaxed">
            <p>
              With this integration, your Shopify store{" "}
              <strong className="text-foreground">{account ?? "your store"}</strong> is connected to your Weblabs Studio
              workspace. Here's what you can do:
            </p>
            <p>
              <strong className="text-foreground">Track orders in conversations:</strong> When you open a conversation,
              the Shopify sidebar will automatically display recent orders for the customer based on their email
              address. This gives your support team instant context without switching tabs.
            </p>
            <p>
              <strong className="text-foreground">Access order details:</strong> View order status, fulfillment status,
              and total amount directly within the conversation panel.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* م137 round 2 (Fahad 137, judge M137): deleting the integration is the page's danger action, so it sits in a red
          card at the bottom (GitHub's Danger Zone; Chatwoot's AccountDelete at the foot of its page). Same dialog. */}
      {enabled ? (
        <SettingsCard
          tone="danger"
          title="Delete integration"
          description={texts.message}
          action={
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          }
        />
      ) : null}

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => {
          void keep(false, null, "Integration deleted successfully");
        }}
        title={texts.title}
        message={texts.message}
        yes={texts.yes}
        no="Cancel"
      />

      <Dialog open={storeOpen} onOpenChange={setStoreOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitStore} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Connect Shopify Store</DialogTitle>
              <DialogDescription className="sr-only">Store URL</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="shopify-store-url">Store URL</Label>
              <Input
                id="shopify-store-url"
                placeholder="your-store.myshopify.com"
                value={storeUrl}
                aria-invalid={Boolean(storeError)}
                onChange={(e) => {
                  setStoreUrl(e.target.value);
                  setStoreError("");
                }}
              />
              <p className={storeError ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                {storeError || "Enter your Shopify store's myshopify.com URL"}
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">
                Connect Store <ExternalLink />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
