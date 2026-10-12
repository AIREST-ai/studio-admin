import type { ReactNode } from "react";

import { redirect } from "next/navigation";

// F159: /chat and anything under it go to /dashboard/chat (see page.tsx).
export default function Layout(_props: Readonly<{ children: ReactNode }>) {
  redirect("/dashboard/chat");
}
