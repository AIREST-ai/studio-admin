export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  country: string;
  bio: string;
  lastActivity: string;
  lastActivityMinutes: number;
  createdAt: string;
  labels: string[];
}

export const contacts: Contact[] = [
  {
    id: 1,
    name: "Noura Al-Thani",
    email: "noura.althani@outlook.com",
    phone: "+974 5512 3348",
    company: "Ooredoo",
    city: "Doha",
    country: "Qatar",
    bio: "Asked about family plans and fibre upgrade.",
    lastActivity: "5 minutes ago",
    lastActivityMinutes: 5,
    createdAt: "Mar 14, 2026",
    labels: ["vip", "billing"],
  },
  {
    id: 2,
    name: "Khalid Al-Mansoori",
    email: "khalid.mansoori@gmail.com",
    phone: "+971 50 482 1190",
    company: "Emirates NBD",
    city: "Dubai",
    country: "United Arab Emirates",
    bio: "Prefers WhatsApp. Follow up after Eid.",
    lastActivity: "22 minutes ago",
    lastActivityMinutes: 22,
    createdAt: "Feb 2, 2026",
    labels: ["lead"],
  },
  {
    id: 3,
    name: "Sarah Mitchell",
    email: "sarah.mitchell@qf.org.qa",
    phone: "+974 3344 9021",
    company: "Qatar Foundation",
    city: "Al Rayyan",
    country: "Qatar",
    bio: "Coordinator for the spring school programme.",
    lastActivity: "1 hour ago",
    lastActivityMinutes: 60,
    createdAt: "Jan 19, 2026",
    labels: ["education"],
  },
  {
    id: 4,
    name: "Abdullah Al-Qahtani",
    email: "a.qahtani@stc.com.sa",
    phone: "+966 55 310 7744",
    company: "STC",
    city: "Riyadh",
    country: "Saudi Arabia",
    bio: "",
    lastActivity: "3 hours ago",
    lastActivityMinutes: 180,
    createdAt: "Dec 8, 2025",
    labels: ["partner"],
  },
  {
    id: 5,
    name: "Maryam Al-Kuwari",
    email: "maryam.kuwari@hotmail.com",
    phone: "+974 6609 1275",
    company: "Hamad Medical Corporation",
    city: "Doha",
    country: "Qatar",
    bio: "Booked a demo for the clinic front desk.",
    lastActivity: "Yesterday",
    lastActivityMinutes: 1440,
    createdAt: "Apr 1, 2026",
    labels: ["lead", "healthcare"],
  },
  {
    id: 6,
    name: "James Carter",
    email: "james.carter@dpworld.com",
    phone: "+971 55 902 3318",
    company: "DP World",
    city: "Dubai",
    country: "United Arab Emirates",
    bio: "",
    lastActivity: "2 days ago",
    lastActivityMinutes: 2880,
    createdAt: "Nov 23, 2025",
    labels: [],
  },
  {
    id: 7,
    name: "Fatima Al-Suwaidi",
    email: "fatima.suwaidi@etihad.ae",
    phone: "+971 52 117 6604",
    company: "Etihad Airways",
    city: "Abu Dhabi",
    country: "United Arab Emirates",
    bio: "Corporate travel desk.",
    lastActivity: "3 days ago",
    lastActivityMinutes: 4320,
    createdAt: "Oct 30, 2025",
    labels: ["vip"],
  },
  {
    id: 8,
    name: "Hamad Al-Marri",
    email: "hamad.almarri@qatarairways.com.qa",
    phone: "+974 5578 2240",
    company: "Qatar Airways",
    city: "Lusail",
    country: "Qatar",
    bio: "",
    lastActivity: "5 days ago",
    lastActivityMinutes: 7200,
    createdAt: "Sep 12, 2025",
    labels: ["support"],
  },
  {
    id: 9,
    name: "Reem Al-Otaibi",
    email: "reem.otaibi@aramco.com",
    phone: "+966 50 644 8812",
    company: "Saudi Aramco",
    city: "Dhahran",
    country: "Saudi Arabia",
    bio: "Requested Arabic invoices.",
    lastActivity: "1 week ago",
    lastActivityMinutes: 10080,
    createdAt: "Aug 4, 2025",
    labels: ["billing"],
  },
  {
    id: 10,
    name: "Daniel Hughes",
    email: "daniel.hughes@qnb.com",
    phone: "+974 3091 5567",
    company: "QNB",
    city: "Doha",
    country: "Qatar",
    bio: "",
    lastActivity: "2 weeks ago",
    lastActivityMinutes: 20160,
    createdAt: "Jul 21, 2025",
    labels: [],
  },
  {
    id: 11,
    name: "Aisha Al-Hajri",
    email: "aisha.hajri@gmail.com",
    phone: "+974 7012 4489",
    company: "",
    city: "Al Wakrah",
    country: "Qatar",
    bio: "Parent, interested in the kids English plan.",
    lastActivity: "3 weeks ago",
    lastActivityMinutes: 30240,
    createdAt: "Jun 15, 2025",
    labels: ["lead"],
  },
  {
    id: 12,
    name: "Omar Al-Shehhi",
    email: "omar.shehhi@adnoc.ae",
    phone: "+971 56 238 9050",
    company: "ADNOC",
    city: "Abu Dhabi",
    country: "United Arab Emirates",
    bio: "",
    lastActivity: "1 month ago",
    lastActivityMinutes: 43200,
    createdAt: "May 2, 2025",
    labels: ["partner"],
  },
];

export const conversations = [
  { id: 4821, inbox: "WhatsApp", status: "Open", preview: "Can you confirm my booking for Thursday?", time: "5m" },
  { id: 4710, inbox: "Website", status: "Resolved", preview: "Thanks, the invoice is clear now.", time: "3d" },
  { id: 4532, inbox: "Email", status: "Resolved", preview: "Re: Upgrade to the family plan", time: "2w" },
];

export const notes = [
  {
    author: "You",
    time: "2 days ago",
    body: "Called back, prefers Arabic. Wants a quote before the end of the month.",
  },
  { author: "Lina Haddad", time: "1 week ago", body: "Sent the pricing sheet by email." },
];

export const attributes = [
  { label: "Customer type", value: "Individual" },
  { label: "Preferred language", value: "Arabic" },
  { label: "Plan", value: "Family" },
  { label: "Signed up", value: "Mar 14, 2026" },
];

export const sortOptions = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone_number", label: "Phone number" },
  { value: "company", label: "Company" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "last_activity_at", label: "Last activity" },
  { value: "created_at", label: "Created at" },
];

export const countries = ["Qatar", "United Arab Emirates", "Saudi Arabia", "Kuwait", "Bahrain", "Oman"];

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
