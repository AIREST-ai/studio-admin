import { redirect } from "next/navigation";

// F161: Chatwoot's conversation URL (accounts/:id/conversations/:conversation_id) as a path. It opens the same
// conversation as /dashboard/chat?conversation=<id>, which the workspace reads on load.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(/^\d+$/.test(id) ? `/dashboard/chat?conversation=${id}` : "/dashboard/chat");
}
