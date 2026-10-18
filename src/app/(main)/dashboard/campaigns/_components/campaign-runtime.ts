"use client";

// M129-C: the campaign actions and the clock that moves the statuses (Scheduled → Running at the scheduled time,
// Running → Completed / Failed when the simulated send ends). The audience is read from the Contacts store and the
// inbox conversations (channels, 24-hour window as the inbox shows it: cw-data.ts canReply), the template from the
// shared template list. All of it is simulated in the preview; nothing is sent.
import * as React from "react";

import { toast } from "sonner";

import { conversations } from "@/app/(main)/chat/_components/data";
import { canReply, contactIdOf } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import { PRODUCT_NAME } from "@/config/app-config";
import { useCwShared } from "@/lib/cw/store";

import type { TemplateRecord } from "../../settings/templates/_components/template-model";
import { templateKey } from "../../settings/templates/_components/template-model";
import {
  type AudienceContact,
  type AudienceResult,
  type CampaignRun,
  fillFor,
  metricsAt,
  resolveAudience,
  retryRun,
  startRun,
} from "./broadcast";
import { type BroadcastChannel, CHANNELS } from "./channels";
import type { OneOffCampaign } from "./data";
import { allOneOff, setCampaignList, useCampaignsReady, useCampaignsStore } from "./store";

export const SIMULATED_SEND = `Simulated in the ${PRODUCT_NAME} preview: nothing was sent to customers, Meta or the engine.`;

const CHANNEL_OF: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Messenger",
  email: "Email",
  chat: "Website",
  phone: "Phone",
};

/** The Contacts people with their conversations' channels and open 24-hour windows. */
export function audienceContacts(): AudienceContact[] {
  const { list, blocked } = useContactsStore.getState();
  return list.map((c) => {
    const own = conversations.filter((conversation) => contactIdOf(conversation.id) === c.id);
    const channels = Array.from(new Set(own.map((conversation) => CHANNEL_OF[conversation.channel]).filter(Boolean)));
    const openWindow = Array.from(
      new Set(
        own
          .filter(
            (conversation) =>
              ["whatsapp", "instagram", "facebook"].includes(conversation.channel) && canReply(conversation),
          )
          .map((conversation) => CHANNEL_OF[conversation.channel]),
      ),
    );
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      city: c.city,
      country: c.country,
      labels: c.labels,
      channels,
      openWindow,
      blocked: blocked.includes(c.id),
    };
  });
}

export function useAudienceContacts(): AudienceContact[] {
  const list = useContactsStore((s) => s.list);
  const blocked = useContactsStore((s) => s.blocked);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed when the Contacts list or blocks change
  return React.useMemo(() => audienceContacts(), [list, blocked]);
}

export function templateFor(c: Pick<OneOffCampaign, "content">): TemplateRecord | undefined {
  const key = c.content?.templateKey;
  if (!key) return undefined;
  return (useCwShared.getState().whatsappTemplates as TemplateRecord[]).find((t) => templateKey(t) === key);
}

export function campaignAudience(c: OneOffCampaign): AudienceResult | null {
  if (!c.channel || !c.audienceSpec) return null;
  return resolveAudience(c.audienceSpec, c.channel, audienceContacts());
}

/** The run that starts now, or a failed run when the campaign can no longer be sent (template not approved). */
function buildRun(c: OneOffCampaign, now: number): CampaignRun {
  const channel = c.channel as BroadcastChannel;
  const audience = campaignAudience(c) ?? { total: 0, recipients: [], skipped: [] };
  let marketing = false;
  let message = (_: { fields: Record<string, string> }) => c.content?.text ?? c.message;
  if (channel === "whatsapp") {
    const template = templateFor(c);
    if (!template || template.status !== "APPROVED")
      return {
        startedAt: now,
        endsAt: now,
        attempt: 1,
        results: [],
        failure: `Template ${c.content?.templateName ?? ""} is not approved now${template ? ` (${template.status.toLowerCase()})` : " (deleted)"}, so nothing could be sent.`,
      };
    marketing = template.category === "MARKETING";
    message = (r) => fillFor(template.body, c.content?.variables, r);
  }
  return startRun(c.id, channel, audience, message, marketing, now);
}

const line = (text: string, at = Date.now()) => ({ at, text });

function update(list: BroadcastChannel, id: number, patch: (c: OneOffCampaign) => OneOffCampaign) {
  setCampaignList(list, (prev) => prev.map((c) => (c.id === id ? patch(c) : c)));
}

/** Send now (from Draft or Scheduled): the simulated send starts and the status is Running. */
export function sendNow(list: BroadcastChannel, id: number) {
  const now = Date.now();
  update(list, id, (c) => {
    const run = buildRun(c, now);
    return {
      ...c,
      status: run.failure ? "failed" : "running",
      run,
      scheduledAt: new Date(now).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      history: [
        ...(c.history ?? []),
        line(run.failure ? `Failed: ${run.failure}` : "Running: sending started (simulated)", now),
      ],
    };
  });
}

/** Retry the failed messages of a Completed or Failed campaign. */
export function retryFailed(list: BroadcastChannel, id: number) {
  const now = Date.now();
  update(list, id, (c) => {
    if (!c.run) return c;
    const template = c.channel === "whatsapp" ? templateFor(c) : undefined;
    if (c.channel === "whatsapp" && (!template || template.status !== "APPROVED")) {
      toast.error("Retry not possible", {
        description: `Template ${c.content?.templateName ?? ""} is not approved now.`,
      });
      return c;
    }
    const failed = c.run.results.filter((r) => r.status === "failed").length;
    const run = retryRun(c.id, list, c.run, template?.category === "MARKETING", now);
    return {
      ...c,
      status: "running",
      run,
      history: [...(c.history ?? []), line(`Running: retry of ${failed} failed (simulated)`, now)],
    };
  });
}

/** Moves due campaigns on: Scheduled → Running at their time, Running → Completed or Failed at the end of the send. */
export function advanceCampaigns(now = Date.now()): { started: OneOffCampaign[]; finished: OneOffCampaign[] } {
  const started: OneOffCampaign[] = [];
  const finished: OneOffCampaign[] = [];
  for (const { list, campaign } of allOneOff(useCampaignsStore.getState())) {
    if (!campaign.channel) continue;
    if (campaign.status === "scheduled" && campaign.schedule?.at && campaign.schedule.at <= now) {
      // A send whose time passed while no page was open starts at its scheduled time (and may already be over).
      const at = campaign.schedule.at;
      update(list as BroadcastChannel, campaign.id, (c) => {
        const run = buildRun(c, at);
        const next: OneOffCampaign = {
          ...c,
          status: run.failure ? "failed" : "running",
          run,
          history: [
            ...(c.history ?? []),
            line(run.failure ? `Failed: ${run.failure}` : "Running: scheduled time reached (simulated)", at),
          ],
        };
        started.push(next);
        return next;
      });
    }
  }
  for (const { list, campaign } of allOneOff(useCampaignsStore.getState())) {
    if (!campaign.channel || campaign.status !== "running" || !campaign.run || campaign.run.endsAt > now) continue;
    update(list as BroadcastChannel, campaign.id, (c) => {
      if (!c.run) return c;
      const m = metricsAt(c.run, c.run.endsAt);
      const failedAll = m.delivered === 0 && (m.failed > 0 || m.skipped > 0);
      const next: OneOffCampaign = {
        ...c,
        status: failedAll ? "failed" : "completed",
        history: [
          ...(c.history ?? []),
          line(
            `${failedAll ? "Failed" : "Completed"}: ${m.delivered} delivered, ${m.read} read, ${m.replied} replied, ${m.failed} failed, ${m.skipped} skipped (simulated)`,
            c.run.endsAt,
          ),
        ],
      };
      finished.push(next);
      return next;
    });
  }
  return { started, finished };
}

/** Runs the clock every second while a campaign page is open (after the saved campaigns were read). */
export function useCampaignClock() {
  const ready = useCampaignsReady();
  React.useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const { finished } = advanceCampaigns();
      for (const c of finished)
        toast(`${c.title}: ${c.status === "failed" ? "Failed" : "Completed"}`, {
          id: `campaign-done-${c.id}`,
          description: SIMULATED_SEND,
        });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [ready]);
}

export const channelLabel = (channel: BroadcastChannel) => CHANNELS[channel].label;
