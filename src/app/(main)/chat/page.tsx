import { redirect } from "next/navigation";

// F159: one inbox. Studio's standalone chat page now opens Chatwoot's conversations inside the dashboard, so
// there is one list, one store and one thread for every conversation. The files in ./_components stay as the
// shared library that /dashboard/chat imports (labels, status button, send and resolve, channels bar, email).
export default function Page() {
  redirect("/dashboard/chat");
}
