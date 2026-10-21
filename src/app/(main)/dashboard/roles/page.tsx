import Link from "next/link";

import { Users } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

import { StandardRolesMatrixCard } from "./_components/roles";

export const metadata: Metadata = {
  title: "مصفوفة الصلاحيات والأدوار العالمية",
  description: "إدارة أدوار المالك والمدير والمشرف والموظف والمحاسب بضغطة زر.",
};

export default function Page() {
  return (
    <div dir="rtl" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">الصلاحيات والأدوار العالمية البسيطة</h1>
          <p className="text-muted-foreground text-sm">
            تحكّم مباشر في صلاحيات المدير والمشرف والموظف والمحاسب مع حفظ فوري في قاعدة بيانات PostgreSQL.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/users?tab=roles" className="gap-2">
            <Users className="size-4" />
            إدارة أعضاء الفريق وتعيين الأدوار
          </Link>
        </Button>
      </div>
      <StandardRolesMatrixCard />
    </div>
  );
}
