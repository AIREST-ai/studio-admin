"use client";
// المقترح المدموج (القواعد العامة 2): مفتاحا الاختيار أعلى النظرة العامة (المساعد والنطاق) بمقاس القالب العادي.
// نفس عمل AssistantSwitcher وChipSelect في _components (القائمة نفسها والمساعد المختار نفسه لكل صفحات كابتن)،
// لكن بمقاس default، لأن تلك المشتركة بمقاس sm ولا نعدّلها هنا.
import Link from "next/link";

import { Bot, Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { setCurrentAssistant, useCurrentAssistant } from "../_components/shared";
import { useCaptainList } from "../_components/store";

const T = {
  assistants: "المساعدون",
  switchHint: "بدّل بين المساعدين",
  empty: "لا يوجد مساعدون بعد، أنشئ واحداً للبدء",
  create: "إنشاء مساعد",
  pickAssistant: "اختر المساعد",
};

export function AssistantPicker() {
  const assistants = useCaptainList("assistants");
  const current = useCurrentAssistant();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={T.pickAssistant}>
          <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
            <Bot className="size-3.5" />
          </span>
          {current.name}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5">
          <span>{T.assistants}</span>
          <span className="font-normal text-muted-foreground text-xs">{T.switchHint}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {assistants.length === 0 && <p className="px-2 py-1.5 text-muted-foreground text-sm">{T.empty}</p>}
        {assistants.map((a) => (
          <DropdownMenuItem key={a.id} className="items-start" onSelect={() => setCurrentAssistant(a.id)}>
            <Bot className="mt-0.5" />
            <div className="grid flex-1 gap-0.5">
              <span>{a.name}</span>
              <span className="line-clamp-1 text-muted-foreground text-xs">{a.productName}</span>
            </div>
            {a.id === current.id && <Check className="mt-0.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/captain/assistants?create=1">
            <Plus /> {T.create}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RangePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
