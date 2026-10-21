"use client";
// قطع صغيرة مشتركة بين خطوات موظف الذكاء: مربع الأيقونة، وصف المفتاح، وبطاقة قصيرة بعنوان وأيقونة.
import type * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function IconSquare({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <Icon className="size-4" />
    </div>
  );
}

export function SwitchRow({
  icon,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Label className="flex cursor-pointer items-center gap-3 p-3 font-normal">
      <IconSquare icon={icon} />
      <div className="grid flex-1 gap-1">
        <span className="font-medium text-sm">{label}</span>
        <span className="text-muted-foreground text-xs leading-snug">{desc}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Label>
  );
}

// بطاقة قصيرة في «طريقة العمل»: أيقونة وعنوان وسطر شرح، ثم أداة التحكم.
export function ShortCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <IconSquare icon={icon} />
          <div className="grid gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}
