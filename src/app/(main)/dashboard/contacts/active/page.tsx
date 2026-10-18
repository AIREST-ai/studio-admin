import { redirect } from "next/navigation";

// T-94/T-95 (Fahad 21:21): the Active contacts view is removed; an old link lands on All contacts.
export default function Page() {
  redirect("/dashboard/contacts");
}
