import * as React from "react";

import { cn } from "cn";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ClientSelector } from "./client-selector";
import { InvoiceAdjustments } from "./invoice-adjustments";
import { InvoiceBusiness } from "./invoice-business";
import { InvoiceDetails } from "./invoice-details";
import { InvoiceItems } from "./invoice-items";
import { InvoicePayment } from "./invoice-payment";
import { PdfFillSection } from "./pdf-fill-sheet";

export function InvoiceForm() {
  const [tab, setTab] = React.useState("invoice");

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>
        <TabsContent value="business" className="mt-2">
          <InvoiceBusiness />
        </TabsContent>
      </Tabs>

      {/* M129-D: each tab shows only its own fields. The panels stay mounted (hidden) so their form fields keep their
          values while another tab is open. */}
      <div className={cn("flex flex-col gap-4", tab !== "invoice" && "hidden")} data-tab-panel="invoice">
        <PdfFillSection />

        <Separator />

        <InvoiceDetails />

        <Separator />

        <ClientSelector />

        <Separator />

        <InvoiceItems />

        <Separator />

        <InvoiceAdjustments />
      </div>

      <div className={cn("flex flex-col gap-4", tab !== "payment" && "hidden")} data-tab-panel="payment">
        <InvoicePayment />
      </div>
    </div>
  );
}
