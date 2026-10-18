"use client";

import * as React from "react";

import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getInitials } from "@/lib/utils";

import { AddClientSheet } from "./add-client-sheet";
import {
  type BigcapitalCustomer,
  type ClientInput,
  ensureBigcapitalCustomer,
  listBigcapitalCustomers,
} from "./bigcapital-client";
import type { InvoiceFormValues, InvoiceToDetails } from "./data";
import { DeleteCustomerButton } from "./delete-bigcapital";

/** The searchable text of a row: what the row shows (name, email, phone, company, country). */
function searchText(option: { name: string; email: string; phone: string; company: string; country: string }) {
  return `${option.name} ${option.email} ${option.phone} ${option.company} ${option.country}`.toLowerCase();
}

/** Round 2: one rule for both the list filter and the group counts, so "Contacts (N)" is what the list shows. */
function matchesSearch(option: Parameters<typeof searchText>[0], search: string) {
  const query = search.trim().toLowerCase();
  return !query || searchText(option).includes(query);
}

/** One row of the picker: a Contacts entry (source of the client data) or a customer that exists only in Bigcapital. */
interface ClientOption {
  key: string;
  source: "contacts" | "bigcapital";
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  customer?: BigcapitalCustomer;
}

export function toInvoiceClient(customer: BigcapitalCustomer, from?: ClientInput): InvoiceToDetails {
  const company = customer.company || from?.company || "";
  const country = customer.country || from?.country || "";
  const phone = customer.phone || from?.phone || "";
  return {
    id: `bc-${customer.id}`,
    name: customer.name,
    email: customer.email,
    addressLines: [company !== customer.name ? company : "", customer.address, customer.city, country].filter(Boolean),
    taxId: "",
    phone,
    company,
    country,
    bigcapitalCustomerId: customer.id,
  };
}

export function ClientSelector() {
  const { control, setValue } = useFormContext<InvoiceFormValues>();
  const selected = useWatch({ control, name: "to" });
  const contacts = useContactsStore((state) => state.list);
  const [open, setOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<BigcapitalCustomer[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [linking, setLinking] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const loadCustomers = React.useCallback(() => {
    setLoadError(null);
    listBigcapitalCustomers()
      .then(setCustomers)
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const byEmail = React.useMemo(() => {
    const map = new Map<string, BigcapitalCustomer>();
    for (const customer of customers ?? []) if (customer.email) map.set(customer.email.toLowerCase(), customer);
    return map;
  }, [customers]);

  const contactOptions: ClientOption[] = contacts.map((contact) => ({
    key: `contact-${contact.id}`,
    source: "contacts",
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    country: contact.country,
    customer: contact.email ? byEmail.get(contact.email.toLowerCase()) : undefined,
  }));
  const contactEmails = new Set(contacts.map((c) => c.email.toLowerCase()).filter(Boolean));
  const bigcapitalOnly: ClientOption[] = (customers ?? [])
    .filter((customer) => !customer.email || !contactEmails.has(customer.email.toLowerCase()))
    .map((customer) => ({
      key: `bigcapital-${customer.id}`,
      source: "bigcapital",
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      country: customer.country,
      customer,
    }));

  async function choose(option: ClientOption) {
    setOpen(false);
    if (option.customer) {
      setValue("to", toInvoiceClient(option.customer, option), { shouldDirty: true });
      toast.success(`${option.name} selected`, {
        description: `Customer #${option.customer.id} on the invoices server`,
      });
      return;
    }
    setLinking(option.key);
    try {
      const input: ClientInput = {
        name: option.name,
        email: option.email,
        phone: option.phone,
        company: option.company,
        country: option.country,
      };
      const { customer, created } = await ensureBigcapitalCustomer(input);
      setValue("to", toInvoiceClient(customer, input), { shouldDirty: true });
      setCustomers((list) => (list?.some((c) => c.id === customer.id) ? list : [...(list ?? []), customer]));
      toast.success(created ? `${option.name} added to the invoices server` : `${option.name} selected`, {
        description: created
          ? `New customer #${customer.id}, made from the contact`
          : `Customer #${customer.id} on the invoices server`,
      });
    } catch (error) {
      toast.error("Could not link this client to the invoices server", { description: (error as Error).message });
    } finally {
      setLinking(null);
    }
  }

  function onCreated(customer: BigcapitalCustomer, input: ClientInput) {
    setCustomers((list) => [...(list ?? []), customer]);
    setValue("to", toInvoiceClient(customer, input), { shouldDirty: true });
  }

  const hasClient = Boolean(selected?.name);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium tracking-tight">Billed To</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
          <Plus data-icon="inline-start" />
          Add New Client
        </Button>
      </div>

      <Field className="gap-1">
        <FieldLabel className="text-xs" htmlFor="invoice-client">
          Client
        </FieldLabel>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id="invoice-client"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-auto min-h-10 w-full justify-between px-3 py-1.5 font-normal"
            >
              {hasClient ? (
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-7 after:rounded-md">
                    <AvatarFallback className="rounded-md bg-muted text-foreground text-xs">
                      {getInitials(selected.name).slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 text-left text-xs">
                    <span className="block truncate">{selected.name}</span>
                    <span className="block truncate text-muted-foreground">
                      {[selected.email, selected.phone].filter(Boolean).join(" · ") || "No email or phone"}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Select client</span>
              )}
              {linking ? <Loader2 className="animate-spin opacity-60" /> : <ChevronsUpDown className="opacity-50" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
            <Command
              filter={(_value, query, keywords) =>
                (keywords ?? []).join(" ").toLowerCase().includes(query.trim().toLowerCase()) ? 1 : 0
              }
            >
              <CommandInput
                placeholder="Search name, email, phone, company…"
                aria-label="Search clients"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No client found. Use “Add New Client”.</CommandEmpty>
                <CommandGroup
                  heading={`Contacts (${contactOptions.filter((option) => matchesSearch(option, search)).length})`}
                >
                  {contactOptions.map((option) => (
                    <ClientRow
                      key={option.key}
                      option={option}
                      selected={selected?.email !== "" && selected?.email === option.email}
                      onSelect={() => choose(option)}
                    />
                  ))}
                </CommandGroup>
                {bigcapitalOnly.length ? (
                  <>
                    <CommandSeparator />
                    <CommandGroup
                      heading={`Only on the invoices server (${bigcapitalOnly.filter((option) => matchesSearch(option, search)).length})`}
                    >
                      {bigcapitalOnly.map((option) => (
                        <ClientRow
                          key={option.key}
                          option={option}
                          selected={selected?.bigcapitalCustomerId === option.customer?.id}
                          onSelect={() => choose(option)}
                        />
                      ))}
                    </CommandGroup>
                  </>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <FieldDescription className="text-xs">
          Clients come from Contacts (name, email, phone, company, country). Choosing one links it to the invoices
          server’s customer with the same email, or creates that customer.{" "}
          {loadError ? (
            <span className="text-destructive">Invoices server not reachable: {loadError}</span>
          ) : customers === null ? (
            "Loading customers…"
          ) : (
            <span>{customers.length} customers on the invoices server</span>
          )}
        </FieldDescription>
        {hasClient ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-muted-foreground text-xs" data-testid="client-link-state">
              {selected.bigcapitalCustomerId ? (
                <>
                  Linked to customer #{selected.bigcapitalCustomerId}
                  {[selected.company, selected.country].filter(Boolean).length
                    ? ` · ${[selected.company, selected.country].filter(Boolean).join(" · ")}`
                    : ""}
                </>
              ) : (
                "Not linked to the invoices server yet: choose the client again from the list."
              )}
            </p>
            {selected.bigcapitalCustomerId ? (
              // F-5B (condition 4): delete that Bigcapital customer (Bigcapital refuses while it has invoices).
              <DeleteCustomerButton
                customer={{ id: selected.bigcapitalCustomerId, name: selected.name }}
                onDeleted={() => {
                  const id = selected.bigcapitalCustomerId;
                  setCustomers((list) => list?.filter((customer) => customer.id !== id) ?? list);
                  setValue("to", { ...selected, id: "", bigcapitalCustomerId: undefined }, { shouldDirty: true });
                }}
              />
            ) : null}
          </div>
        ) : null}
      </Field>

      <AddClientSheet open={addOpen} onOpenChange={setAddOpen} onCreated={onCreated} />
    </section>
  );
}

function ClientRow({ option, selected, onSelect }: { option: ClientOption; selected: boolean; onSelect: () => void }) {
  const details = [option.email, option.phone].filter(Boolean).join(" · ");
  const place = [option.company, option.country].filter(Boolean).join(" · ");
  return (
    <CommandItem
      value={option.key}
      keywords={[searchText(option)]}
      onSelect={onSelect}
      className="items-start gap-2 py-2"
    >
      <Check className={selected ? "mt-0.5 opacity-100" : "mt-0.5 opacity-0"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{option.name}</span>
          {option.customer ? (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              Linked
            </Badge>
          ) : null}
        </span>
        <span className="block truncate text-muted-foreground text-xs">{details || "No email or phone"}</span>
        {place ? <span className="block truncate text-muted-foreground text-xs">{place}</span> : null}
      </span>
    </CommandItem>
  );
}
