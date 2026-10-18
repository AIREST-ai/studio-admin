import { redirect } from "next/navigation";

// T-148: Chatwoot campaigns.routes.js sends the empty campaigns path to Live chat campaigns (via "ongoing"), as
// ongoing/page.tsx does here, so the page opens with its section bar. ?empty (the empty-state preview) is kept.
export default async function Page({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  const { empty } = await searchParams;
  redirect(empty !== undefined ? "/dashboard/campaigns/live-chat?empty" : "/dashboard/campaigns/live-chat");
}
