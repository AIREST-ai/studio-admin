import { redirect } from "next/navigation";

// F-6A: "/" يفتح المنتج لا صفحة القالب التسويقية. وبعد حارس الدخول (2026-10-19، src/proxy.ts) لا يصل هذه الصفحة إلا
// من معه جلسة صحيحة، ومن لا جلسة له يحوّله الحارس إلى صفحة الدخول.
// CMP-245: الوجهة /dashboard/start (ترحيب إيما)، وهي توجّه المالك العائد إلى الملخص والموظف إلى المحادثات.
export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/dashboard/start");
}
