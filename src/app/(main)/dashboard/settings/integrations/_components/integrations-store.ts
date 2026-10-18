"use client";
// F-6A (sim2 problem 13; task item 2 and the monitor's update: "Linear, Notion, Shopify and the others"): the
// integrations are saved in this preview (api/settings-preview) instead of the page's memory:
// - lists with revisions (F-3 rule): webhooks, dashboard apps, and the hooks of the hook apps (OpenAI, Dialogflow,
//   Google Translate, Dyte, LeadSquared);
// - the section "integrations" for the OAuth apps (Linear, Notion, Shopify), and "slack" for Slack (م137).
// "Enabled" follows Chatwoot's rule (app/models/integrations/app.rb `enabled?`): a webhook exists, a dashboard app
// exists, or the app has a hook. Nothing was connected in the sample, so no hook app starts enabled (OpenAI showed a
// made-up key). Preview only: no request reaches OpenAI, Slack, Linear, Notion, Shopify or a webhook URL.
import * as React from "react";

import type { SettingsPreview } from "@/app/api/settings-preview/route";

import {
  createSavedList,
  loadSettingsPreview,
  useSavedList,
  useSavedListLoaded,
} from "../../_components/settings-preview-client";
import { type DashboardApp, dashboardApps, type IntegrationHook, type Webhook, webhooks } from "./data";

export type WebhookRow = Webhook & { secret: string };

const SAMPLE_SECRETS = [
  "k3v9q2x8m1p7z4t6w0r5y8u2e1a9s3d7",
  "h8j2k4l6m9n1b3v5c7x0z2q4w6e8r1t3",
  "p0o9i8u7y6t5r4e3w2q1a2s3d4f5g6h7",
  "z9x8c7v6b5n4m3l2k1j0h9g8f7d6s5a4",
];

export const webhooksStore = createSavedList<WebhookRow>(
  "webhooks",
  webhooks.map((w, i) => ({ ...w, secret: SAMPLE_SECRETS[i] ?? SAMPLE_SECRETS[0] })),
);
export const dashboardAppsStore = createSavedList<DashboardApp>("dashboardApps", dashboardApps);

export type SavedHook = IntegrationHook & { app: string };
export const hooksStore = createSavedList<SavedHook>("integrationHooks", []);

export const useWebhooks = () => useSavedList(webhooksStore);
export const useWebhooksLoaded = () => useSavedListLoaded(webhooksStore);
export const useDashboardApps = () => useSavedList(dashboardAppsStore);
export const useDashboardAppsLoaded = () => useSavedListLoaded(dashboardAppsStore);
export const useHooks = () => useSavedList(hooksStore);
export const useHooksLoaded = () => useSavedListLoaded(hooksStore);

/** The line under every integration message in this preview. */
export const INTEGRATION_NOTE =
  "Preview — simulated: saved in this preview, not in the engine. Nothing is sent to the app. It stays after a reload.";

/** Which integrations are enabled, by Chatwoot's rule, from what is saved. `null` until loaded. */
export function useEnabledIntegrations(): Record<string, boolean> | null {
  const hooks = useHooks();
  const webhookRows = useWebhooks();
  const apps = useDashboardApps();
  const loaded = [useHooksLoaded(), useWebhooksLoaded(), useDashboardAppsLoaded()].every(Boolean);
  const [settings, setSettings] = React.useState<SettingsPreview | null>(null);
  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview().then(
      (saved) => alive && setSettings(saved),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!loaded || !settings) return null;
  const has = (app: string) => hooks.some((hook) => hook.app === app);
  return {
    webhook: webhookRows.length > 0,
    dashboard_apps: apps.length > 0,
    slack: Boolean(settings.slack?.connection && settings.slack.connection !== "disconnected"),
    linear: Boolean(settings.integrations?.linear?.connected),
    notion: Boolean(settings.integrations?.notion?.connected),
    shopify: Boolean(settings.integrations?.shopify?.connected),
    openai: has("openai"),
    dialogflow: has("dialogflow"),
    google_translate: has("google_translate"),
    dyte: has("dyte"),
    leadsquared: has("leadsquared"),
  };
}
