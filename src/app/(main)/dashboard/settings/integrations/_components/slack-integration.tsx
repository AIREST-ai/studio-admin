"use client";
import * as React from "react";

import Link from "next/link";

import { ChevronLeft, Hash, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

const channels = ["#customer-support", "#doha-store-orders", "#vip-clients", "#ops-alerts"];

export function SlackIntegration() {
  const [channel, setChannel] = React.useState(channels[0]);
  const [mode, setMode] = React.useState("two_way");

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit px-1.5 text-muted-foreground" asChild>
        <Link href="/dashboard/settings/integrations">
          <ChevronLeft /> Integrations
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-md border bg-rose-100 font-semibold text-rose-700 shadow-xs dark:bg-rose-500/15 dark:text-rose-300">
              SL
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">Slack</CardTitle>
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 font-normal text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  Enabled
                </Badge>
              </div>
              <CardDescription className="max-w-2xl">
                Slack is a chat tool that brings all your communication together in one place. By integrating Slack,
                you can get notified of all the new conversations in your account right inside your Slack.
              </CardDescription>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete the integration</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the integration? Doing so will result in the loss of access to
                  conversations on your Slack workspace.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>How to use the Slack Integration?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-muted-foreground text-sm leading-relaxed">
            <p>
              With this integration, all of your incoming conversations will be synced to the{" "}
              <strong className="font-semibold text-foreground">{channel}</strong> channel in your Slack workspace. You
              can manage all your customer conversations right within the channel and never miss a message.
            </p>
            <p>Here are the main features of the integration:</p>
            <p>
              <strong className="text-foreground">Respond to conversations from within Slack:</strong> To respond to a
              conversation in the <strong className="text-foreground">{channel}</strong> Slack channel, simply type out
              your message and send it as a thread. This will create a response back to the customer through Chatwoot.
              It's that simple!
            </p>
            <p>
              <strong className="text-foreground">Create private notes:</strong> If you want to create private notes
              instead of replies, start your message with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground text-xs">note:</code>. This ensures that
              your message is kept private and won't be visible to the customer.
            </p>
            <p>
              <strong className="text-foreground">Associate an agent profile:</strong> If the person who replied on
              Slack has an agent profile in Chatwoot under the same email, the replies will be associated with that
              agent profile automatically. This means you can easily track who said what and when. On the other hand,
              when the replier doesn't have an associated agent profile, the replies will appear from the bot profile
              to the customer.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected channel</CardTitle>
              <CardDescription>Conversations from every inbox are posted here.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Hash className="size-4 text-muted-foreground" />
                <span className="font-medium">{channel.slice(1)}</span>
                <span className="ml-auto text-muted-foreground text-xs">selected</span>
              </div>
              <NativeSelect className="w-full" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {channels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
              <Button variant="outline" className="w-fit">
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
            <CardContent>
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
                      Conversations are posted to Slack for internal discussion only. Nothing in the thread reaches the
                      customer.
                    </span>
                  </div>
                </Label>
              </RadioGroup>
              <Separator className="my-4" />
              <p className="text-muted-foreground text-xs">Workspace: Doha Retail Group · connected Sep 21, 2026</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
