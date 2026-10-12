import { redirect } from "next/navigation";

// F159: Chatwoot Settings > Agents lives in Studio's Users & Roles page (Agents tab).
export default function Page() {
  redirect("/dashboard/users");
}
