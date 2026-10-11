import { redirect } from "next/navigation";

// F140: الأدوار صارت تبويباً داخل صفحة المستخدمين؛ الرابط القديم يحوّل إليه.
export default function Page() {
  redirect("/dashboard/users?tab=roles");
}
