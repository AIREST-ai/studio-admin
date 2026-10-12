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

import { PageHeader } from "../../labels/_shared/settings-shell";
import { BackToIntegrations, ConfirmAction, EnabledBadge, IntegrationRow, integrationById } from "./integration-ui";

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

const connectedAs: Record<OAuthId, string> = {
  linear: "Workspace: Weblabs Studio Engineering",
  notion: "Workspace: Weblabs Studio Help Docs",
  shopify: "Store: weblabs-studio.myshopify.com",
};

const SHOPIFY_URL = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function OAuthIntegration({ integrationId }: { integrationId: OAuthId }) {
  const item = integrationById(integrationId);
  const [enabled, setEnabled] = React.useState(item?.enabled ?? false);
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
    window.setTimeout(() => {
      setAuthorizing(false);
      setEnabled(true);
      toast.success(`${item?.name} connected`);
    }, 700);
  }

  function submitStore(event: React.FormEvent) {
    event.preventDefault();
    const value = storeUrl.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!SHOPIFY_URL.test(value)) {
      setStoreError("Please enter a valid Shopify store URL (e.g., your-store.myshopify.com)");
      return;
    }
    setStoreOpen(false);
    setEnabled(true);
    toast.success("Shopify store connected");
  }

  return (
    <div className="flex flex-col gap-4">
      <BackToIntegrations />
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
              enabled ? (
                <Button variant="destructive" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              ) : (
                <Button onClick={connect} disabled={authorizing}>
                  {authorizing ? "Connecting..." : "Connect"}
                </Button>
              )
            }
          />
          {enabled ? (
            <div className="flex items-center gap-2 border-t px-6 py-4 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>{connectedAs[integrationId]}</span>
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
              <strong className="text-foreground">weblabs-studio.myshopify.com</strong> is connected to your Weblabs Studio
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

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => {
          setEnabled(false);
          toast.success("Integration deleted successfully");
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
