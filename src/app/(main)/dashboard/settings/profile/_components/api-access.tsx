"use client";
// F-12 (Fahad ل4, 14 Oct 01:18: «كل شيئ فيه api ونستطيع تزويده للعملاء»; the independent audit found no place in
// Settings where a customer gets API access). One place for it: Profile Settings > Access Token, because the token
// belongs to the signed-in person (Chatwoot keeps it in Profile Settings, profile/AccessToken.vue, and its API docs say
// "Find your API token in Profile Settings": https://raw.githubusercontent.com/chatwoot/chatwoot/develop/swagger/index.yml;
// Fahad, item 54: a person's own settings are not repeated in the Settings bar). Below the token, this file adds:
// - the API card: the API base URL and the API documentation link. The path is Chatwoot's Application API path
//   /api/v1/accounts/{account_id} (https://developers.chatwoot.com/api-reference/contacts/list-contacts) and the token
//   goes in the api_access_token header (swagger/index.yml, userApiKey; Bearer only from Chatwoot v4.19.0, and the
//   product follows v4.18.0);
// - the Webhooks card: how many are set up and the way to Integrations > Webhooks, where Chatwoot keeps them
//   (settings/integrations/Webhooks) and where they are added, edited and deleted with their events. Webhooks belong to
//   the account, not the person, so they are not copied here; Integrations is an administrator page in Chatwoot
//   (lib/cw/view-as.ts ROUTE_RULES), so an agent is told that instead of a link that would not open.
// Fahad 129.2 (honest simulation): the preview has no API, so every line here says what is real and what is not.
import * as React from "react";

import Link from "next/link";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { canOpen, useViewer } from "@/lib/cw/view-as";

import { ACCOUNT_ID } from "../../_components/account-id";
import { copyText } from "../../_components/copy-text";
import { SettingsCard } from "../../_components/settings-card";
import { useWebhooks, useWebhooksLoaded } from "../../integrations/_components/integrations-store";

/** Chatwoot's API reference (the product's API is Chatwoot's Application API). */
// F-16 (Fahad 15 Oct: "I do not want their links"): the API reference was Chatwoot's site
// (developers.chatwoot.com/api-reference/introduction); this site has no API pages of its own yet, so none is linked.
const WEBHOOKS_URL = "/dashboard/settings/integrations/webhooks";

/** The words on every preview token (F-12 task, condition 2). */
export const PREVIEW_TOKEN_LABEL = "Preview token — not valid against a live server";

/** The API base URL and the documentation link. */
export function ApiCard() {
  // The address this page is opened at, read after load (the server does not know it).
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  const baseUrl = origin ? `${origin}/api/v1/accounts/${ACCOUNT_ID}` : "";

  return (
    <SettingsCard
      title="API"
      description="Call the API from your own app or service. Send your access token in the api_access_token header."
    >
      <div className="grid max-w-xl gap-4">
        <div className="grid gap-2">
          <Label htmlFor="api-base-url">API base URL</Label>
          <InputGroup>
            <InputGroupInput id="api-base-url" readOnly value={baseUrl} className="font-mono text-xs" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Copy API base URL"
                title="Copy API base URL"
                disabled={!baseUrl}
                onClick={() => copyText(baseUrl, "API base URL copied to clipboard")}
              >
                <Copy />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <p className="text-muted-foreground text-xs">
            Includes your account ID ({ACCOUNT_ID}). Add an endpoint after it, for example /contacts.
          </p>
        </div>
        <p className="text-muted-foreground text-xs" data-api-docs>
          API documentation is not available on this site yet.
        </p>
        <p className="text-muted-foreground text-xs" data-preview-note>
          Preview — simulated: this preview has no API, so nothing answers at this address. On a live server the same
          path follows that server&apos;s address.
        </p>
      </div>
    </SettingsCard>
  );
}

/** How many webhooks are set up, and the way to add, edit and delete them. */
export function WebhooksCard() {
  const viewer = useViewer();
  const rows = useWebhooks();
  const loaded = useWebhooksLoaded();
  const allowed = canOpen(viewer, WEBHOOKS_URL);

  return (
    <SettingsCard
      title="Webhooks"
      description="Send this account's events, such as a new conversation or a new message, to your own URL. Add, edit and delete webhooks and pick their events in Integrations › Webhooks."
      action={
        allowed ? (
          <Button asChild variant="outline">
            <Link href={WEBHOOKS_URL}>Manage webhooks</Link>
          </Button>
        ) : null
      }
    >
      <div className="grid gap-2">
        <p className="text-sm" data-webhook-count>
          {loaded
            ? `${rows.length} ${rows.length === 1 ? "webhook" : "webhooks"} set up in this preview.`
            : "Loading saved webhooks…"}
        </p>
        {allowed ? null : (
          <p className="text-muted-foreground text-xs">
            Only administrators manage webhooks: Integrations is an administrator page, as in the engine.
          </p>
        )}
        <p className="text-muted-foreground text-xs" data-preview-note>
          Preview — simulated: webhooks are saved in this preview. No event is sent to their URLs.
        </p>
      </div>
    </SettingsCard>
  );
}
