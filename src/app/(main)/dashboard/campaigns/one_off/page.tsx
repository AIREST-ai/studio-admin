import { redirect } from "next/navigation";

// Chatwoot campaigns.routes.js: the legacy "one_off" route redirects to SMS campaigns.
export default function Page() {
  redirect("/dashboard/campaigns/sms");
}
