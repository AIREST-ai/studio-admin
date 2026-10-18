"use client";
// F-6A (sim2 problems 10, 13, 14; task item 1): the inbox settings that said "updated successfully" and kept nothing
// (Allowed Domains, the agent bot, Pre Chat Form, IMAP / SMTP, Voice, WhatsApp Calling, the API webhook, the
// auto-assignment limit) are kept on the inbox row as `config.extras`, beside the sections T-223 keeps there, so they
// are saved with the shared inboxes list on the preview server's disk and come back after a reload. Preview only:
// nothing here reaches Chatwoot, Meta, Twilio or a mail server, and no password or API key is kept.
import { toast } from "sonner";

import type { Inbox } from "@/lib/cw/data";
import { setCwList } from "@/lib/cw/store";

import { SAVED_IN_PREVIEW } from "../../_components/settings-preview-client";
import { inboxConfig, whenSaved } from "./inboxes-store";

export interface PreChatField {
  key: string;
  label: string;
  placeholder: string;
  type: string;
  on: boolean;
  req: boolean;
}

export interface InboxExtras {
  allowedDomains?: string;
  widgetInMobileApps?: boolean;
  /** Website: "Require identity validation"; API: "Enforce User Identity Validation". */
  identityRequired?: boolean;
  /** The agent bot connected to the inbox (Settings > Bots), or null. Nothing is connected until someone does it. */
  botId?: number | null;
  webhookUrl?: string;
  webhookSecret?: string;
  autoAssignLimit?: number;
  preChat?: { enabled: boolean; message: string; fields: PreChatField[] };
  imap?: { enabled: boolean; address: string; port: number; login: string; ssl: boolean };
  smtp?: {
    enabled: boolean;
    address: string;
    port: number;
    login: string;
    domain: string;
    encryption: string;
    authentication: string;
  };
  voice?: { enabled: boolean; apiKeySid: string; allowIncoming: boolean; record: boolean; transcribe: boolean };
  calls?: { enabled: boolean; permissionMessage: string };
}

type WithExtras = Inbox & { config?: { extras?: InboxExtras } };

export const inboxExtras = (inbox: Inbox): InboxExtras => (inbox as WithExtras).config?.extras ?? {};

/** Saves part of an inbox's extras in one write; settles after the preview server has it. */
export function saveInboxExtras(id: number, patch: Partial<InboxExtras>, rowPatch: Partial<Inbox> = {}): Promise<void> {
  const saved = whenSaved();
  setCwList("inboxes", (list) =>
    list.map((inbox) =>
      inbox.id === id
        ? {
            ...inbox,
            ...rowPatch,
            config: { ...inboxConfig(inbox), extras: { ...inboxExtras(inbox), ...patch } },
          }
        : inbox,
    ),
  );
  return saved;
}

/** "updated" only after the save, with the line that says where it was saved; otherwise why it was not. */
export function toastInboxSaved(saving: Promise<void>, message: string, note = SAVED_IN_PREVIEW): Promise<boolean> {
  return saving.then(
    () => {
      toast.success(message, { description: note });
      return true;
    },
    (error: unknown) => {
      toast.error(`Not saved: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    },
  );
}

/**
 * A value made by the preview for one inbox (widget token, inbox identifier, webhook secret, callback path): the same
 * for the same inbox every time, different for each inbox. It is not a Chatwoot value and nothing accepts it; the
 * pages that show one say so (PREVIEW_ADDRESS_NOTE).
 */
export function previewValue(inbox: Pick<Inbox, "id" | "slug">, kind: string, length = 20): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let hash = 2166136261;
  let out = "";
  const seed = `${kind}:${inbox.id}:${inbox.slug}`;
  for (let i = 0; out.length < length; i++) {
    hash ^= seed.charCodeAt(i % seed.length) + i;
    hash = Math.imul(hash, 16777619) >>> 0;
    out += chars[hash % chars.length];
  }
  return out;
}

export const PREVIEW_ADDRESS_NOTE =
  "Preview — simulated: made by this preview for this inbox. No server answers at this address yet, so nothing arrives through it until the inbox is connected to the engine.";

/** The website widget script for this inbox (its own token), as Chatwoot's ConfigurationPage shows it. */
export function widgetScript(inbox: Pick<Inbox, "id" | "slug">) {
  return `<script>
  (function(d,t) {
    var BASE_URL="https://chat.weblabs.studio";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js"; g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){ window.weblabsSDK.run({ websiteToken: '${previewValue(inbox, "website-token", 12)}', baseUrl: BASE_URL }) }
  })(document,"script");
</script>`;
}
