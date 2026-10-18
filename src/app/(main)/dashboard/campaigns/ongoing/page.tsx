import { redirect } from "next/navigation";

// Chatwoot campaigns.routes.js: the legacy "ongoing" route redirects to Live chat campaigns.
export default function Page() {
  redirect("/dashboard/campaigns/live-chat");
}
