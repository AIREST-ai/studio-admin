// F159 Companies mock data. The companies are the ones the Contacts page people work for (contacts/_components/data.ts),
// so a company's Contacts tab, History and Notes show the same people, conversations and ids as the rest of Studio.
// Two companies have no linked contacts yet, to show Chatwoot's empty states.
import { contacts } from "@/app/(main)/dashboard/contacts/_components/data";

export interface Company {
  id: number;
  name: string;
  domain: string;
  description: string;
  createdAt: string;
  createdOrder: number;
  // Used only while no contact is linked; otherwise last activity is the latest activity of its contacts.
  ownActivity: string;
  ownActivityMinutes: number;
  attributes: Record<string, string>;
}

export const initialCompanies: Company[] = [
  {
    id: 1,
    name: "Ooredoo",
    domain: "ooredoo.qa",
    description: "Telecom operator in Qatar. Digital operations raise staging incidents and manage the billing account.",
    createdAt: "Mar 14, 2026",
    createdOrder: 9,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: {
      industry: "Telecom",
      plan: "Enterprise",
      employees: "2700",
      account_manager: "Lina Haddad",
      renewal_date: "2027-01-31",
      priority_support: "true",
    },
  },
  {
    id: 2,
    name: "Emirates NBD",
    domain: "emiratesnbd.com",
    description: "Bank in Dubai evaluating WhatsApp for card and loan enquiries.",
    createdAt: "Feb 2, 2026",
    createdOrder: 7,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Banking", plan: "Business", account_manager: "Priya Nair" },
  },
  {
    id: 3,
    name: "Qatar Foundation",
    domain: "qf.org.qa",
    description: "Education and community programmes in Education City.",
    createdAt: "Jan 19, 2026",
    createdOrder: 6,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Education", plan: "Business", employees: "8000", priority_support: "false" },
  },
  {
    id: 4,
    name: "STC",
    domain: "stc.com.sa",
    description: "Saudi telecom group. Partner team for the Riyadh rollout.",
    createdAt: "Dec 8, 2025",
    createdOrder: 4,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Telecom", plan: "Enterprise", account_manager: "Yousef Al-Harbi" },
  },
  {
    id: 5,
    name: "Hamad Medical Corporation",
    domain: "hamad.qa",
    description: "Public healthcare provider. Uses the help center for patient appointment questions.",
    createdAt: "Apr 3, 2026",
    createdOrder: 11,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Healthcare", plan: "Business", renewal_date: "2026-12-15" },
  },
  {
    id: 6,
    name: "DP World",
    domain: "dpworld.com",
    description: "Ports and logistics. Freight updates between Jebel Ali and Hamad Port.",
    createdAt: "Nov 21, 2025",
    createdOrder: 3,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Logistics", employees: "1200" },
  },
  {
    id: 7,
    name: "Etihad Airways",
    domain: "etihad.com",
    description: "Airline in Abu Dhabi. Guest services team asks about baggage and refunds.",
    createdAt: "Jan 5, 2026",
    createdOrder: 5,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Aviation", plan: "Enterprise", account_manager: "Ravi Menon" },
  },
  {
    id: 8,
    name: "Qatar Airways",
    domain: "qatarairways.com",
    description: "Airline in Doha. Corporate travel desk and loyalty questions.",
    createdAt: "Feb 27, 2026",
    createdOrder: 8,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: {
      industry: "Aviation",
      plan: "Enterprise",
      employees: "4300",
      account_manager: "Lina Haddad",
      priority_support: "true",
    },
  },
  {
    id: 9,
    name: "Saudi Aramco",
    domain: "aramco.com",
    description: "Energy company. Procurement contacts in Dhahran.",
    createdAt: "Oct 30, 2025",
    createdOrder: 2,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Energy", plan: "Enterprise", renewal_date: "2027-03-01" },
  },
  {
    id: 10,
    name: "QNB",
    domain: "qnb.com",
    description: "Bank in Doha. Integration questions about the website widget.",
    createdAt: "Mar 30, 2026",
    createdOrder: 10,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Banking", plan: "Business" },
  },
  {
    id: 11,
    name: "ADNOC",
    domain: "adnoc.ae",
    description: "Energy group in Abu Dhabi. Partner account for the service station chat.",
    createdAt: "May 2, 2025",
    createdOrder: 1,
    ownActivity: "",
    ownActivityMinutes: 0,
    attributes: { industry: "Energy", plan: "Enterprise", account_manager: "Priya Nair", priority_support: "true" },
  },
  {
    id: 12,
    name: "Lusail Fitness Club",
    domain: "lusailfitness.qa",
    description: "",
    createdAt: "Jun 18, 2026",
    createdOrder: 12,
    ownActivity: "2 weeks ago",
    ownActivityMinutes: 20160,
    attributes: {},
  },
  {
    id: 13,
    name: "Bahrain Bay Events",
    domain: "",
    description: "",
    createdAt: "Jul 9, 2026",
    createdOrder: 13,
    ownActivity: "1 month ago",
    ownActivityMinutes: 43200,
    attributes: {},
  },
];

// Starting links: each Contacts page person belongs to the company named on their contact (Aisha has none).
export const initialLinks: Record<number, number | null> = Object.fromEntries(
  contacts.map((contact) => [contact.id, initialCompanies.find((c) => c.name === contact.company)?.id ?? null]),
);

// Company custom attributes (Settings > Custom attributes, applies to Company), shown on the Attributes tab.
export type AttributeType = "text" | "number" | "date" | "list" | "checkbox" | "link";

export interface AttributeDef {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[];
}

export const companyAttributeDefs: AttributeDef[] = [
  {
    key: "industry",
    label: "Industry",
    type: "list",
    options: [
      "Aviation",
      "Banking",
      "Education",
      "Energy",
      "Healthcare",
      "Logistics",
      "Retail",
      "Telecom",
      "Other",
    ],
  },
  { key: "plan", label: "Plan", type: "list", options: ["Startup", "Business", "Enterprise"] },
  { key: "employees", label: "Employees", type: "number" },
  { key: "account_manager", label: "Account manager", type: "text" },
  { key: "renewal_date", label: "Contract renewal", type: "date" },
  { key: "website", label: "Billing portal", type: "link" },
  { key: "priority_support", label: "Priority support", type: "checkbox" },
];

// Notes written on the company's contacts (Chatwoot's company Notes tab lists its contacts' notes).
export const contactNotes: { id: number; contactId: number; author: string; time: string; body: string }[] = [
  {
    id: 1,
    contactId: 1,
    author: "Lina Haddad",
    time: "2 days ago",
    body: "Owns the Ooredoo billing account. Prefers Arabic on calls, English in writing.",
  },
  {
    id: 2,
    contactId: 1,
    author: "You",
    time: "1 week ago",
    body: "Staging incidents go to the infra channel first, then to Noura.",
  },
  {
    id: 3,
    contactId: 2,
    author: "Priya Nair",
    time: "3 days ago",
    body: "Asked for a WhatsApp pricing sheet. Follow up after Eid.",
  },
  {
    id: 4,
    contactId: 3,
    author: "Yousef Al-Harbi",
    time: "5 days ago",
    body: "Spring school programme starts in March. Needs Arabic and English replies.",
  },
  {
    id: 5,
    contactId: 8,
    author: "Ravi Menon",
    time: "2 weeks ago",
    body: "Corporate travel desk. Invoices go to the finance mailbox, not to Hamad directly.",
  },
  {
    id: 6,
    contactId: 12,
    author: "You",
    time: "3 weeks ago",
    body: "Partner contract renewed. Station chat goes live next quarter.",
  },
];

export const sortOptions = [
  { value: "name", label: "Name" },
  { value: "domain", label: "Domain" },
  { value: "created_at", label: "Created at" },
  { value: "last_activity_at", label: "Last activity" },
  { value: "contacts_count", label: "Contacts count" },
] as const;

export type SortKey = (typeof sortOptions)[number]["value"];

export function contactsCountLabel(n: number) {
  return `${n} ${n === 1 ? "contact" : "contacts"}`;
}

export function companyDisplayName(company: { name: string }) {
  return company.name || "Unnamed Company";
}
