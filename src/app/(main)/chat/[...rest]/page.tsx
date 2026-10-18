import { redirect } from "next/navigation";

// F161: any old /chat/<anything> link also opens the one inbox (the layout comment promised this; without a page
// here Next.js answered 404 before the layout could redirect).
export default function Page() {
  redirect("/dashboard/chat");
}
