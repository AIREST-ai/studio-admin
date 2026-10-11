export interface CompanyContact {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface Company {
  id: number;
  name: string;
  domain: string;
  description: string;
  contactsCount: number;
  lastActivity: string;
  lastActivityMinutes: number;
  createdAt: string;
  createdOrder: number;
}

export const companies: Company[] = [
  {
    id: 1,
    name: "Al Meera Consumer Goods",
    domain: "almeera.com.qa",
    description: "Supermarket chain across Qatar. Uses WhatsApp for delivery updates and loyalty questions.",
    contactsCount: 14,
    lastActivity: "12m ago",
    lastActivityMinutes: 12,
    createdAt: "Jan 8, 2026",
    createdOrder: 3,
  },
  {
    id: 2,
    name: "Doha Dental Studio",
    domain: "dohadentalstudio.qa",
    description: "Private clinic in West Bay. Patients book and reschedule appointments by chat.",
    contactsCount: 6,
    lastActivity: "1h ago",
    lastActivityMinutes: 60,
    createdAt: "Mar 2, 2026",
    createdOrder: 9,
  },
  {
    id: 3,
    name: "Gulf Bridge Logistics",
    domain: "gulfbridge.ae",
    description: "Freight forwarding between Jebel Ali and Hamad Port.",
    contactsCount: 9,
    lastActivity: "3h ago",
    lastActivityMinutes: 180,
    createdAt: "Nov 19, 2025",
    createdOrder: 1,
  },
  {
    id: 4,
    name: "Najd Home Furnishings",
    domain: "najdhome.sa",
    description: "Furniture showroom in Riyadh with online orders and assembly bookings.",
    contactsCount: 11,
    lastActivity: "Yesterday",
    lastActivityMinutes: 1440,
    createdAt: "Feb 14, 2026",
    createdOrder: 6,
  },
  {
    id: 5,
    name: "Pearl Bay Properties",
    domain: "pearlbayproperties.qa",
    description: "Leasing and maintenance for apartments in The Pearl and Lusail.",
    contactsCount: 23,
    lastActivity: "2d ago",
    lastActivityMinutes: 2880,
    createdAt: "Dec 3, 2025",
    createdOrder: 2,
  },
  {
    id: 6,
    name: "Sidra Learning Centre",
    domain: "sidralearning.qa",
    description: "After-school tutoring and English classes for children in Al Wakrah.",
    contactsCount: 4,
    lastActivity: "3d ago",
    lastActivityMinutes: 4320,
    createdAt: "Apr 21, 2026",
    createdOrder: 11,
  },
  {
    id: 7,
    name: "Dubai Creek Travel",
    domain: "dubaicreektravel.ae",
    description: "Umrah packages, visas and family holidays.",
    contactsCount: 17,
    lastActivity: "5d ago",
    lastActivityMinutes: 7200,
    createdAt: "Jan 29, 2026",
    createdOrder: 5,
  },
  {
    id: 8,
    name: "Jeddah Coast Motors",
    domain: "jeddahcoastmotors.sa",
    description: "Car service centre. Customers ask for quotes and pick-up times.",
    contactsCount: 8,
    lastActivity: "1w ago",
    lastActivityMinutes: 10080,
    createdAt: "Mar 17, 2026",
    createdOrder: 10,
  },
  {
    id: 9,
    name: "Lusail Fitness Club",
    domain: "lusailfitness.qa",
    description: "",
    contactsCount: 1,
    lastActivity: "2w ago",
    lastActivityMinutes: 20160,
    createdAt: "Feb 2, 2026",
    createdOrder: 7,
  },
  {
    id: 10,
    name: "Muscat Spice Traders",
    domain: "muscatspice.om",
    description: "Wholesale spices and dates for restaurants across the GCC.",
    contactsCount: 3,
    lastActivity: "3w ago",
    lastActivityMinutes: 30240,
    createdAt: "Jan 15, 2026",
    createdOrder: 4,
  },
  {
    id: 11,
    name: "Bahrain Bay Events",
    domain: "",
    description: "",
    contactsCount: 0,
    lastActivity: "1mo ago",
    lastActivityMinutes: 43200,
    createdAt: "Feb 25, 2026",
    createdOrder: 8,
  },
];

export const companyContacts: CompanyContact[] = [
  { id: 1, name: "Noura Al-Thani", email: "noura.althani@outlook.com", phone: "+974 5512 3344" },
  { id: 2, name: "Khalid Al-Mansoori", email: "khalid.m@gmail.com", phone: "+971 50 412 7781" },
  { id: 3, name: "Fatima Al-Kuwari", email: "fatima.kuwari@hotmail.com", phone: "+974 3301 8892" },
  { id: 4, name: "Omar Al-Harbi", email: "omar.harbi@icloud.com", phone: "+966 55 309 1124" },
  { id: 5, name: "Mariam Al-Sulaiti", email: "mariam.sulaiti@outlook.com", phone: "+974 6670 2219" },
  { id: 6, name: "Yousef Al-Marri", email: "", phone: "+974 7712 4450" },
];

export const contactSearchPool: (CompanyContact & { company?: string })[] = [
  { id: 21, name: "Hessa Al-Naimi", email: "hessa.naimi@gmail.com", phone: "+974 5590 1123" },
  {
    id: 22,
    name: "Rashid Al-Shamsi",
    email: "rashid.shamsi@outlook.com",
    phone: "+971 55 220 9031",
    company: "Gulf Bridge Logistics",
  },
  { id: 23, name: "Abdullah Al-Qahtani", email: "a.qahtani@icloud.com", phone: "+966 50 118 7720" },
  {
    id: 24,
    name: "Lina Haddad",
    email: "lina.haddad@gmail.com",
    phone: "+974 3344 9012",
    company: "Doha Dental Studio",
  },
];

export const companyConversations = [
  {
    id: 4821,
    contact: "Noura Al-Thani",
    inbox: "WhatsApp",
    status: "Open",
    preview: "Is the Thursday delivery slot still available for Al Waab?",
    time: "12m",
    labels: ["delivery"],
  },
  {
    id: 4790,
    contact: "Khalid Al-Mansoori",
    inbox: "Website",
    status: "Pending",
    preview: "I need a copy of last month's invoice with the VAT number.",
    time: "2h",
    labels: ["billing"],
  },
  {
    id: 4702,
    contact: "Fatima Al-Kuwari",
    inbox: "Email",
    status: "Resolved",
    preview: "Re: Loyalty points not showing after my purchase",
    time: "3d",
    labels: [],
  },
  {
    id: 4655,
    contact: "Omar Al-Harbi",
    inbox: "WhatsApp",
    status: "Resolved",
    preview: "Thanks, the replacement arrived today.",
    time: "1w",
    labels: ["vip"],
  },
];

export const companyNotes = [
  {
    id: 1,
    contact: "Noura Al-Thani",
    author: "Lina Haddad",
    time: "2 days ago",
    body: "Procurement contact. Prefers Arabic and calls after 4pm. Asked for a bulk pricing sheet for Ramadan.",
  },
  {
    id: 2,
    contact: "Khalid Al-Mansoori",
    author: "You",
    time: "1 week ago",
    body: "Invoices must go to the finance mailbox, not to Khalid directly.",
  },
  {
    id: 3,
    contact: "Mariam Al-Sulaiti",
    author: "Ahmed Saleh",
    time: "3 weeks ago",
    body: "Escalated the late delivery complaint. Offered free delivery on the next two orders.",
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

export const avatarTones = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
];

export function toneFor(id: number) {
  return avatarTones[id % avatarTones.length];
}

export function contactsCountLabel(n: number) {
  return `${n} ${n === 1 ? "contact" : "contacts"}`;
}
