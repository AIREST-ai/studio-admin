"use client";
// F-6A (sim2 problems 2 and 10): the agent bots, saved in this preview (api/settings-preview, list "bots"), shared by
// Settings > Bots and the inbox Bot Configuration tab, so a bot created on one shows on the other and both stay after
// a reload. The four bots below are the sample the page always started with. Preview only: no event is sent to a
// bot's webhook.
import { createSavedList, useSavedList, useSavedListLoaded } from "../../_components/settings-preview-client";

export interface Bot {
  id: number;
  name: string;
  description: string;
  url: string;
  system?: boolean;
  accessToken: string;
  secret: string;
  /** A 128 px data: URL picture, or absent for the initials. */
  avatar?: string | null;
}

export const seedBots: Bot[] = [
  {
    id: 1,
    name: "Captain",
    description: "System bot",
    url: "https://chat.weblabs.studio/captain/webhook",
    system: true,
    accessToken: "Fq7vN2kXc9RtLm4bWz8sHy3d",
    secret: "whsec_4f8c2b1e9a7d6c3b",
  },
  {
    id: 2,
    name: "Order Status Bot",
    description: "Looks up an order by its number and answers delivery questions before handing off to an agent.",
    url: "https://bots.weblabs.studio/order-status",
    accessToken: "Mp3sQw8eRt2yUi7oPa5sDf6g",
    secret: "whsec_9b2d7e4a1c8f3e6d",
  },
  {
    id: 3,
    name: "Arabic FAQ Bot",
    description: "Answers common questions in Arabic about pricing, opening hours and the API.",
    url: "https://bots.weblabs.studio/faq-ar",
    accessToken: "Zx4cVb6nMq1wEr9tYu2iOp8a",
    secret: "whsec_1a5e9c3f7b2d8a4e",
  },
  {
    id: 4,
    name: "Lead Qualifier",
    description: "Asks new website visitors about budget and timeline, then labels the conversation as a lead.",
    url: "https://bots.weblabs.studio/lead-qualifier",
    accessToken: "Hj5kLz7xCv3bNm1qWe6rTy9u",
    secret: "whsec_7c3a1f9e5d2b6c8a",
  },
];

export const botsStore = createSavedList<Bot>("bots", seedBots);
export const useBots = () => useSavedList(botsStore);
export const useBotsLoaded = () => useSavedListLoaded(botsStore);

/** The line under a bot's "saved" message. */
export const BOT_SAVED_NOTE =
  "Preview — simulated: saved in this preview, not in the engine. No event is sent to the bot's webhook. It stays after a reload.";
