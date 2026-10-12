import { redirect } from "next/navigation";

// F159: Chatwoot Settings > Custom Roles lives in Studio's Users & Roles page (Custom Roles tab).
export default function Page() {
  redirect("/dashboard/users?tab=roles");
}
