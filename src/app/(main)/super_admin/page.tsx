import { cookies } from "next/headers";

import type { Metadata } from "next";

import { agents as seedAgents } from "@/lib/cw/data";
import { readPreviewState } from "@/lib/cw/persistence/file-store";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";

import { OwnerConsole, OwnerConsoleDenied } from "./_components/owner-console";

export const metadata: Metadata = {
  title: "Owner console",
  description: "Show or hide the site's sections for everyone.",
};

export const dynamic = "force-dynamic";

/** The name and role of the agent this browser views the preview as (F-5A "View as"). */
async function viewedAs(id: number): Promise<{ name: string; role: string }> {
  let agents = seedAgents as { id: number; name: string; role: string }[];
  try {
    const saved = await readPreviewState();
    if (saved?.lists?.agents?.length) agents = saved.lists.agents as unknown as typeof agents;
  } catch {
    // unreadable saved lists: the seed names still say who it is
  }
  const agent = agents.find((item) => item.id === id);
  return { name: agent?.name ?? `agent #${id}`, role: agent?.role === "administrator" ? "Administrator" : "Agent" };
}

// F-17 (T-91): Chatwoot opens /super_admin to a super admin only (config/routes.rb devise_for :super_admins). The
// preview has no sign-in; a browser viewing it as another agent ("View as") is the one case it can tell apart, and it is
// not given the console.
export default async function Page() {
  const viewAsId = parseViewAs((await cookies()).get(VIEW_AS_COOKIE)?.value);
  if (viewAsId !== null) return <OwnerConsoleDenied {...(await viewedAs(viewAsId))} />;
  return <OwnerConsole />;
}
