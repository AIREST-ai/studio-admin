import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PREVIEW_SIGNIN_COOKIE } from "@/lib/preview-signin/shared";

// F-6A (sim2 problem 17, task item 6): the first page is no longer the template's marketing page (its title, GitHub
// stars and Radix / Base UI links). As in Chatwoot, "/" opens the product: the login page for a visitor who has not
// entered the preview in this browser, the dashboard for one who has (Live demo, Login or Register set that, Log out
// clears it; lib/preview-signin/shared.ts). The old landing parts stay in ./_components, unused.
export const dynamic = "force-dynamic";

export default async function Home() {
  const entered = (await cookies()).get(PREVIEW_SIGNIN_COOKIE)?.value;
  redirect(entered ? "/dashboard/default" : "/auth/v2/login");
}
