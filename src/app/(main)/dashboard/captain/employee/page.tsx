import type { Metadata } from "next";

import { EmployeePage } from "./_components/employee";

const meta = { title: "موظف الذكاء البشري", description: "تعيين الذكاء الاصطناعي موظفاً والاتفاق على بنود عمله." };

export const metadata: Metadata = meta;

export default function Page() {
  return <EmployeePage />;
}
