"use client";
// Chatwoot Slack.vue + Slack/SelectChannelWarning.vue, SlackMessageMode.vue, SlackIntegrationHelpText.vue in the
// Studio pattern. States: not connected -> Connect; connected without a channel -> "Attention required" with the
// channel picker; expired -> the expired warning; active -> message mode + help text. Open a state directly with
// ?state=disconnected|select|expired|active.
import * as React from "react";

import { useSearchParams } from "next/navigation";

import { AlertTriangle, Hash } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { SettingsCard } from "../../_components/settings-card";
import {
  loadSettingsPreview,
  SAVED_IN_PREVIEW,
  type SlackSettings,
  saveSlack,
} from "../../_components/settings-preview-client";
import { PageHeader } from "../../labels/_shared/settings-shell";
import { slackChannels } from "./data";
import { BackToIntegrations, ConfirmAction, EnabledBadge, IntegrationRow, integrationById } from "./integration-ui";

export type SlackState = "disconnected" | "select" | "expired" | "active";

// F-6A (sim2 problem 13: "Slack Enabled" though nobody connected it): with nothing saved, Slack is not connected; the
// page says the connection is simulated (no Slack sign-in, nothing posted to Slack).
export function SlackPage({ initialState = "disconnected" }: { initialState?: SlackState }) {
  const item = integrationById("slack");
  const [state, setState] = React.useState<SlackState>(initialState);
  const [channelId, setChannelId] = React.useState(state === "active" ? slackChannels[0].id : "");
  const [picked, setPicked] = React.useState("");
  const [mode, setMode] = React.useState("two_way");
  const [confirming, setConfirming] = React.useState(false);
  const [loadingChannels, setLoadingChannels] = React.useState(false);
  const [channelsLoaded, setChannelsLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // م137 round 2 (item 99, judge M137): the connection, channel and thread behaviour are saved in this preview
  // (api/settings-preview) and come back after a reload. A ?state= address still shows that state for a check and
  // does not read or change what is saved until a button is pressed.
  const addressState = useSearchParams().get("state");
  React.useEffect(() => {
    if (addressState) return;
    let alive = true;
    loadSettingsPreview()
      .then(({ slack }) => {
        if (!alive || !slack) return;
        if (slack.connection) setState(slack.connection);
        if (slack.channelId !== undefined) setChannelId(slack.channelId);
        if (slack.mode) setMode(slack.mode);
      })
      .catch((error) =>
        toast.error("Saved Slack settings could not be read", { description: (error as Error).message }),
      );
    return () => {
      alive = false;
    };
  }, [addressState]);

  async function keep(part: Partial<Omit<SlackSettings, "savedAt">>, done: string) {
    setBusy(true);
    try {
      await saveSlack(part);
      toast.success(done, { description: SAVED_IN_PREVIEW });
      return true;
    } catch (error) {
      toast.error("Slack settings not saved", { description: (error as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!item) return null;
  const channelName = slackChannels.find((c) => c.id === channelId)?.name ?? "customer-support";

  function loadChannels() {
    setLoadingChannels(true);
    window.setTimeout(() => {
      setLoadingChannels(false);
      setChannelsLoaded(true);
    }, 500);
  }

  async function updateChannel() {
    if (!picked) return;
    if (!(await keep({ connection: "active", channelId: picked }, "The channel is connected successfully"))) return;
    setChannelId(picked);
    setState("active");
  }

  return (
    <div className="flex flex-col gap-4">
      <BackToIntegrations current="Slack" />
      <PageHeader
        title="Slack"
        description="Slack is a chat tool that brings all your communication together in one place."
        learnMore="Learn more about Slack"
        actions={<EnabledBadge enabled={state !== "disconnected"} />}
      />

      <p className="text-muted-foreground text-xs" data-preview-note>
        Preview — simulated: Connect does not open Slack, no Slack workspace is linked, and nothing is posted to Slack.
        The choices below are saved in this preview.
      </p>
      <Card className="py-0">
        <CardContent className="px-0">
          <IntegrationRow
            item={item}
            action={
              // م137 round 2 (judge M137): Delete moved to the red card at the foot of the page (below).
              state === "disconnected" ? (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    if (await keep({ connection: "select" }, "Slack workspace linked")) setState("select");
                  }}
                >
                  Connect
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>

      {state === "select" || state === "expired" ? (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4" /> Attention required
            </CardTitle>
            <CardDescription className="max-w-3xl leading-relaxed">
              {state === "expired" ? (
                "Your Slack integration has expired. To continue receiving messages on Slack, please delete the integration and connect your workspace again."
              ) : (
                <>
                  Your Slack workspace is now linked with Weblabs Studio. However, the integration is currently
                  inactive. To activate the integration and connect a channel to Weblabs Studio, please click the button
                  below.
                  <br />
                  <br />
                  <strong className="text-foreground">Note:</strong> If you are attempting to connect a private channel,
                  add the Weblabs Studio app to the Slack channel before proceeding with this step.
                </>
              )}
            </CardDescription>
          </CardHeader>
          {state === "select" ? (
            <CardContent>
              {channelsLoaded ? (
                <div className="grid max-w-sm gap-3">
                  <NativeSelect className="w-full" value={picked} onChange={(e) => setPicked(e.target.value)}>
                    <option value="" disabled>
                      Select a channel
                    </option>
                    {slackChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button className="w-fit" onClick={updateChannel} disabled={!picked || busy}>
                    Update
                  </Button>
                </div>
              ) : (
                <Button onClick={loadChannels} disabled={loadingChannels}>
                  {loadingChannels ? "Loading..." : "Connect channel"}
                </Button>
              )}
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {state === "active" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle>How to use the Slack Integration?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-muted-foreground text-sm leading-relaxed">
              {mode === "two_way" ? (
                <>
                  <p>
                    With this integration, all of your incoming conversations will be synced to the{" "}
                    <strong className="text-foreground">#{channelName}</strong> channel in your Slack workspace. You can
                    manage all your customer conversations right within the channel and never miss a message.
                  </p>
                  <p>Here are the main features of the integration:</p>
                  <p>
                    <strong className="text-foreground">Respond to conversations from within Slack:</strong> To respond
                    to a conversation in the <strong className="text-foreground">#{channelName}</strong> Slack channel,
                    simply type out your message and send it as a thread. This will create a response back to the
                    customer through Weblabs Studio. It's that simple!
                  </p>
                  <p>
                    <strong className="text-foreground">Create private notes:</strong> If you want to create private
                    notes instead of replies, start your message with{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-foreground text-xs">note:</code>. This ensures
                    that your message is kept private and won't be visible to the customer.
                  </p>
                  <p>
                    <strong className="text-foreground">Associate an agent profile:</strong> If the person who replied
                    on Slack has an agent profile in Weblabs Studio under the same email, the replies will be associated
                    with that agent profile automatically. This means you can easily track who said what and when. On
                    the other hand, when the replier doesn't have an associated agent profile, the replies will appear
                    from the bot profile to the customer.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    With this integration, all of your incoming conversations will be synced to the{" "}
                    <strong className="text-foreground">#{channelName}</strong> channel in your Slack workspace, so your
                    team can pick them up as soon as they come in.
                  </p>
                  <p>
                    This integration is set to <strong className="text-foreground">Alerts only</strong>, which means the
                    Slack thread is a safe space for internal discussion. Nothing posted in the thread reaches the
                    customer.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Connected channel</CardTitle>
                <CardDescription>Incoming conversations are posted here.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <Hash className="size-4 text-muted-foreground" />
                  <span className="font-medium">{channelName}</span>
                </div>
                {/* م137 round 2: one save pattern, the form's button at its end, left (Primer). */}
                <NativeSelect
                  className="w-full"
                  aria-label="Slack channel"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                >
                  {slackChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  className="w-fit"
                  disabled={busy}
                  onClick={() => void keep({ channelId }, "The channel is connected successfully")}
                >
                  Update
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slack thread behaviour</CardTitle>
                <CardDescription>
                  Decide whether replies in the Slack thread reach the customer or stay internal.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {/* م137 round 2: a choice in a form is saved by the form's button (Primer: radio groups save
                    explicitly), like the channel above. */}
                <RadioGroup value={mode} onValueChange={setMode} className="gap-3">
                  <Label className="items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
                    <RadioGroupItem value="two_way" className="mt-0.5" />
                    <div className="grid gap-1">
                      <span className="font-medium">Two-way sync</span>
                      <span className="text-muted-foreground text-xs leading-relaxed">
                        Replies in the Slack thread are sent to the customer. Start a message with `note:` to keep it
                        internal.
                      </span>
                    </div>
                  </Label>
                  <Label className="items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
                    <RadioGroupItem value="alert" className="mt-0.5" />
                    <div className="grid gap-1">
                      <span className="font-medium">Alerts only</span>
                      <span className="text-muted-foreground text-xs leading-relaxed">
                        Conversations are posted to Slack for internal discussion only. Nothing in the thread reaches
                        the customer.
                      </span>
                    </div>
                  </Label>
                </RadioGroup>
                <Button
                  className="w-fit"
                  disabled={busy}
                  onClick={() =>
                    void keep(
                      { mode: mode as SlackSettings["mode"] },
                      "The Slack thread behaviour is updated successfully",
                    )
                  }
                >
                  Update
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* م137 round 2 (Fahad 137, judge M137): deleting the integration is the page's danger action, so it sits in a red
          card at the bottom (GitHub's Danger Zone; Chatwoot's AccountDelete at the foot of its page). Same dialog. */}
      {state !== "disconnected" ? (
        <SettingsCard
          tone="danger"
          title="Delete the integration"
          description="Doing so will result in the loss of access to conversations on your Slack workspace."
          action={
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              Delete
            </Button>
          }
        />
      ) : null}

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={async () => {
          if (!(await keep({ connection: "disconnected", channelId: "" }, "Integration deleted successfully"))) return;
          setState("disconnected");
          setChannelId("");
          setPicked("");
          setChannelsLoaded(false);
        }}
        title="Delete the integration"
        message="Are you sure you want to delete the integration? Doing so will result in the loss of access to conversations on your Slack workspace."
        yes="Delete"
        no="Cancel"
      />
    </div>
  );
}
